-- Teacher Resource Authoring: extend the existing supplementary resources authority.
-- Drafts are private to the teacher/school management. Only explicit sharing
-- makes materials available through the learner-facing resource reader.
-- Existing rows are deliberately migrated to draft for safe opt-in release.
alter table public.resources
  add column if not exists component_type text,
  add column if not exists publication_status text not null default 'draft',
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists scheme_lesson_id uuid references public.scheme_of_work(id) on delete set null;

alter table public.resources
  add constraint resources_component_type_canonical_check check (
    component_type is null or component_type in (
      'lesson-notes','worked-examples','illustrations-diagrams','demonstrations',
      'experiments','discussions','projects','educational-games','assignments',
      'homework','quizzes','tests-exams','revision','reflection','remedial-enrichment'
    )
  ),
  add constraint resources_publication_status_check check (publication_status in ('draft','shared')),
  add constraint resources_shared_has_content_check check (
    publication_status = 'draft'
    or nullif(btrim(coalesce(content,'')), '') is not null
    or external_url ~* '^https?://[^[:space:]]+$'
  );

create index if not exists resources_teacher_status_created_idx
  on public.resources (teacher_id, publication_status, created_at desc);
create index if not exists resources_scheme_lesson_idx on public.resources (scheme_lesson_id)
  where scheme_lesson_id is not null;

-- Optional Scheme linkage must belong to the same teacher/class/school/subject.
-- An arbitrary REST client cannot attach another class or school Scheme lesson.
create or replace function public.validate_teacher_resource_context()
returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  if new.subject_id is not null then
    if not exists (
      select 1 from public.teacher_classes tc
      where tc.teacher_id = new.teacher_id and tc.school_id = new.school_id
        and tc.class_id = new.class_id and tc.subject_id = new.subject_id
    ) then
      raise exception 'Resource class/subject is not assigned to this teacher';
    end if;
  end if;
  if new.scheme_lesson_id is not null then
    if new.subject_id is null or not exists (
      select 1 from public.scheme_of_work s
      where s.id = new.scheme_lesson_id
        and s.teacher_id = new.teacher_id
        and s.school_id = new.school_id
        and s.class_id = new.class_id
        and s.subject_id = new.subject_id
    ) then
      raise exception 'Scheme lesson must match the teacher, class, school and subject';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists resources_validate_teaching_context on public.resources;
create trigger resources_validate_teaching_context
  before insert or update of teacher_id, school_id, class_id, subject_id, scheme_lesson_id
  on public.resources for each row
  execute function public.validate_teacher_resource_context();

-- The pre-existing teacher/admin policies remain authoritative for draft access.
-- The prior student policy exposed every saved class resource automatically.
drop policy if exists resources_student_view on public.resources;
create policy resources_student_view on public.resources
  for select to authenticated
  using (
    publication_status = 'shared'
    and (
      exists (
        select 1 from public.student_classes sc
        join public.students st on st.id = sc.student_id
        where sc.class_id = resources.class_id
          and sc.is_current = true and st.profile_id = (select auth.uid())
      )
      or (
        is_school_wide is true
        and exists (
          select 1 from public.student_profiles sp
          where sp.profile_id = (select auth.uid()) and sp.school_id = resources.school_id
        )
      )
    )
  );

-- Keep a security-invoker view; the explicit status filter is defense in depth
-- even when a future resource SELECT policy changes.
create or replace view public.student_accessible_resources with (security_invoker = true) as
select
  r.id,r.teacher_id,r.class_id,r.school_id,r.title,r.description,r.type,r.subject,
  r.external_url,r.content,r.is_school_wide,r.created_at,
  r.component_type,r.publication_status,r.subject_id,r.scheme_lesson_id
from public.resources r
where r.publication_status = 'shared'
  and (
    r.is_school_wide = true
    or exists (
      select 1 from public.student_classes sc
      join public.students s on s.id = sc.student_id
      where sc.class_id = r.class_id and sc.is_current = true
        and s.profile_id = (select auth.uid())
    )
  );

revoke all on public.resources from anon;
grant select, insert, update, delete on public.resources to authenticated;
revoke all on public.student_accessible_resources from anon, authenticated;
grant select on public.student_accessible_resources to authenticated;

comment on column public.resources.component_type is
  'Optional exact Teaching Library component slot; not a separate content record or assessment engine.';
comment on column public.resources.publication_status is
  'Draft is teacher/school-management visible only. Shared is explicit learner release; no automatic sharing on save.';
comment on column public.resources.scheme_lesson_id is
  'Optional context link to the exact Scheme lesson, validated against teacher/class/school/subject.';
