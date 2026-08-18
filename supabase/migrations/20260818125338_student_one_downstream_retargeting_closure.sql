-- Student = 1 downstream retargeting closure.
-- Prevent canonical IDs from being reassigned across authorization boundaries after insert.

drop policy if exists pol_cbc_update on public.cbc_assessments;
create policy pol_cbc_update on public.cbc_assessments
for update to authenticated
using (
  teacher_id = (select auth.uid())
  or public.is_school_admin(school_id)
)
with check (
  school_id is not null
  and exists (
    select 1
    from public.student_classes sc
    join public.students s on s.id = sc.student_id
    where sc.student_id = cbc_assessments.student_id
      and sc.school_id = cbc_assessments.school_id
      and sc.class_id = cbc_assessments.class_id
      and sc.is_current = true
      and s.deleted_at is null
  )
  and (
    (
      teacher_id = (select auth.uid())
      and exists (
        select 1
        from public.teacher_classes tc
        where tc.teacher_id = (select auth.uid())
          and tc.school_id = cbc_assessments.school_id
          and tc.class_id = cbc_assessments.class_id
          and tc.subject_id = cbc_assessments.subject_id
      )
    )
    or public.is_school_admin(school_id)
  )
);

drop policy if exists project_submissions_student_insert on public.project_submissions;
create policy project_submissions_student_insert on public.project_submissions
for insert to authenticated
with check (
  exists (
    select 1
    from public.students s
    join public.student_classes sc
      on sc.student_id = s.id
     and sc.is_current = true
    join public.projects p
      on p.id = project_submissions.project_id
     and p.class_id = sc.class_id
     and p.school_id = sc.school_id
    where s.id = project_submissions.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

drop policy if exists pol_psl_update on public.parent_student_links;
create policy pol_psl_update on public.parent_student_links
for update to authenticated
using (
  exists (
    select 1
    from public.school_members sm
    where sm.school_id = parent_student_links.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
)
with check (
  exists (
    select 1
    from public.school_members sm
    where sm.school_id = parent_student_links.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
  and exists (
    select 1
    from public.student_classes sc
    join public.students s on s.id = sc.student_id
    where sc.student_id = parent_student_links.student_id
      and sc.school_id = parent_student_links.school_id
      and sc.is_current = true
      and s.deleted_at is null
  )
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='cbc_assessments'
      and policyname='pol_cbc_update'
      and roles = array['authenticated']::name[]
      and with_check ilike '%teacher_classes%'
      and with_check ilike '%student_classes%'
  ) then
    raise exception 'student_one_cbc_update_retargeting_postcondition_failed';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='project_submissions'
      and policyname='project_submissions_student_insert'
      and roles = array['authenticated']::name[]
      and with_check ilike '%projects%'
      and with_check ilike '%student_classes%'
  ) then
    raise exception 'student_one_project_submission_authority_postcondition_failed';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='parent_student_links'
      and policyname='pol_psl_update'
      and roles = array['authenticated']::name[]
      and with_check ilike '%school_members%'
      and with_check ilike '%student_classes%'
  ) then
    raise exception 'student_one_parent_link_retargeting_postcondition_failed';
  end if;
end
$$;
