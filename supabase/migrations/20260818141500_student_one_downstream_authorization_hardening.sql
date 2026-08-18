-- Student = 1 downstream authorization hardening
-- Canonical learner identity is public.students.id. Account identity is auth.uid()/profiles.id.

-- Explicit role hygiene: authenticated product policies must never rely on PUBLIC + null auth.uid().

drop policy if exists cbc_admin_read on public.cbc_assessments;
create policy cbc_admin_read on public.cbc_assessments
for select to authenticated
using (public.is_school_admin(school_id));

drop policy if exists cbc_parent_read on public.cbc_assessments;
create policy cbc_parent_read on public.cbc_assessments
for select to authenticated
using (
  exists (
    select 1
    from public.parent_student_links psl
    where psl.student_id = cbc_assessments.student_id
      and psl.parent_id = (select auth.uid())
      and coalesce(psl.access_level, 'full') <> 'none'
  )
);

drop policy if exists cbc_student_read on public.cbc_assessments;
create policy cbc_student_read on public.cbc_assessments
for select to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = cbc_assessments.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

drop policy if exists cbc_teacher_read on public.cbc_assessments;
create policy cbc_teacher_read on public.cbc_assessments
for select to authenticated
using (teacher_id = (select auth.uid()));

drop policy if exists pol_cbc_delete on public.cbc_assessments;
create policy pol_cbc_delete on public.cbc_assessments
for delete to authenticated
using (false);

-- Consequential write: teacher, class, subject, school and canonical learner membership must agree.
drop policy if exists pol_cbc_insert on public.cbc_assessments;
create policy pol_cbc_insert on public.cbc_assessments
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and school_id is not null
  and exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = cbc_assessments.school_id
      and tc.class_id = cbc_assessments.class_id
      and tc.subject_id = cbc_assessments.subject_id
  )
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
);

-- Homework: canonical student self-service and teacher/parent reads are authenticated-only.
drop policy if exists "Teachers manage submissions for their homework" on public.homework_submissions;
create policy "Teachers manage submissions for their homework" on public.homework_submissions
for all to authenticated
using (
  exists (
    select 1 from public.homework h
    where h.id = homework_submissions.homework_id
      and h.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.homework h
    where h.id = homework_submissions.homework_id
      and h.teacher_id = (select auth.uid())
  )
);

drop policy if exists homework_submissions_parent_read on public.homework_submissions;
create policy homework_submissions_parent_read on public.homework_submissions
for select to authenticated
using (
  exists (
    select 1 from public.parent_student_links psl
    where psl.student_id = homework_submissions.student_id
      and psl.parent_id = (select auth.uid())
      and coalesce(psl.access_level, 'full') <> 'none'
  )
);

drop policy if exists homework_submissions_student_insert on public.homework_submissions;
create policy homework_submissions_student_insert on public.homework_submissions
for insert to authenticated
with check (
  exists (
    select 1
    from public.students s
    join public.student_classes sc on sc.student_id = s.id and sc.is_current = true
    join public.homework h on h.class_id = sc.class_id and h.school_id = sc.school_id
    where s.id = homework_submissions.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
      and h.id = homework_submissions.homework_id
  )
);

drop policy if exists homework_submissions_student_read on public.homework_submissions;
create policy homework_submissions_student_read on public.homework_submissions
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = homework_submissions.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

drop policy if exists homework_submissions_student_update on public.homework_submissions;
create policy homework_submissions_student_update on public.homework_submissions
for update to authenticated
using (
  status <> 'marked'
  and exists (
    select 1 from public.students s
    where s.id = homework_submissions.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
)
with check (
  status <> 'marked'
  and exists (
    select 1
    from public.students s
    join public.student_classes sc on sc.student_id = s.id and sc.is_current = true
    join public.homework h on h.class_id = sc.class_id and h.school_id = sc.school_id
    where s.id = homework_submissions.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
      and h.id = homework_submissions.homework_id
  )
);

drop policy if exists homework_submissions_teacher on public.homework_submissions;
create policy homework_submissions_teacher on public.homework_submissions
for all to authenticated
using (
  exists (
    select 1 from public.homework h
    where h.id = homework_submissions.homework_id
      and h.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.homework h
    where h.id = homework_submissions.homework_id
      and h.teacher_id = (select auth.uid())
  )
);

-- Evidence/intervention paths: authenticated teachers only.
drop policy if exists "teacher manages own lesson evidence" on public.lesson_evidence;
create policy "teacher manages own lesson evidence" on public.lesson_evidence
for all to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.teacher_classes tc
    join public.student_classes sc
      on sc.class_id = tc.class_id
     and sc.school_id = tc.school_id
     and sc.is_current = true
    where tc.teacher_id = (select auth.uid())
      and sc.student_id = lesson_evidence.student_id
      and tc.class_id = lesson_evidence.class_id
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.teacher_classes tc
    join public.student_classes sc
      on sc.class_id = tc.class_id
     and sc.school_id = tc.school_id
     and sc.is_current = true
    where tc.teacher_id = (select auth.uid())
      and sc.student_id = lesson_evidence.student_id
      and tc.class_id = lesson_evidence.class_id
  )
);

drop policy if exists "teacher manages own lesson interventions" on public.lesson_interventions;
create policy "teacher manages own lesson interventions" on public.lesson_interventions
for all to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.teacher_classes tc
    join public.student_classes sc
      on sc.class_id = tc.class_id
     and sc.school_id = tc.school_id
     and sc.is_current = true
    where tc.teacher_id = (select auth.uid())
      and sc.student_id = lesson_interventions.student_id
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.teacher_classes tc
    join public.student_classes sc
      on sc.class_id = tc.class_id
     and sc.school_id = tc.school_id
     and sc.is_current = true
    where tc.teacher_id = (select auth.uid())
      and sc.student_id = lesson_interventions.student_id
  )
);

-- Exercise/project parent and teacher paths: explicit authenticated roles.
drop policy if exists exercise_submissions_parent_read on public.exercise_submissions;
create policy exercise_submissions_parent_read on public.exercise_submissions
for select to authenticated
using (
  exists (
    select 1 from public.parent_student_links psl
    where psl.student_id = exercise_submissions.student_id
      and psl.parent_id = (select auth.uid())
      and coalesce(psl.access_level, 'full') <> 'none'
  )
);

drop policy if exists project_submissions_parent_read on public.project_submissions;
create policy project_submissions_parent_read on public.project_submissions
for select to authenticated
using (
  exists (
    select 1 from public.parent_student_links psl
    where psl.student_id = project_submissions.student_id
      and psl.parent_id = (select auth.uid())
      and coalesce(psl.access_level, 'full') <> 'none'
  )
);

drop policy if exists "teacher manages own project_submissions" on public.project_submissions;
create policy "teacher manages own project_submissions" on public.project_submissions
for all to authenticated
using (
  exists (
    select 1
    from public.projects p
    join public.teacher_classes tc
      on tc.teacher_id = (select auth.uid())
     and tc.school_id = p.school_id
     and tc.class_id = p.class_id
     and tc.subject_id = p.subject_id
    join public.student_classes sc
      on sc.student_id = project_submissions.student_id
     and sc.school_id = p.school_id
     and sc.class_id = p.class_id
     and sc.is_current = true
    where p.id = project_submissions.project_id
      and p.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects p
    join public.teacher_classes tc
      on tc.teacher_id = (select auth.uid())
     and tc.school_id = p.school_id
     and tc.class_id = p.class_id
     and tc.subject_id = p.subject_id
    join public.student_classes sc
      on sc.student_id = project_submissions.student_id
     and sc.school_id = p.school_id
     and sc.class_id = p.class_id
     and sc.is_current = true
    where p.id = project_submissions.project_id
      and p.teacher_id = (select auth.uid())
  )
);

-- Parent-link legacy policies must be explicit authenticated policies.
drop policy if exists pol_psl_delete on public.parent_student_links;
create policy pol_psl_delete on public.parent_student_links
for delete to authenticated
using (
  parent_id = (select auth.uid())
  or exists (
    select 1 from public.school_members sm
    where sm.school_id = parent_student_links.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
);

drop policy if exists psl_student_read on public.parent_student_links;
create policy psl_student_read on public.parent_student_links
for select to authenticated
using (public.is_own_student_link(student_id));

drop policy if exists psl_teacher_read on public.parent_student_links;
create policy psl_teacher_read on public.parent_student_links
for select to authenticated
using (
  exists (
    select 1
    from public.student_classes sc
    join public.teacher_classes tc
      on tc.class_id = sc.class_id
     and tc.school_id = sc.school_id
    where sc.student_id = parent_student_links.student_id
      and sc.is_current = true
      and tc.teacher_id = (select auth.uid())
  )
);

-- Fail closed if any hardened policy accidentally remains executable by PUBLIC.
do $$
declare
  v_bad text;
begin
  select string_agg(format('%I.%I:%I', schemaname, tablename, policyname), ', ' order by tablename, policyname)
  into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'cbc_assessments','homework_submissions','exercise_submissions','project_submissions',
      'lesson_evidence','lesson_interventions','parent_student_links'
    )
    and roles @> array['public']::name[];

  if v_bad is not null then
    raise exception 'student_one_downstream_public_policy_postcondition_failed: %', v_bad;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='cbc_assessments'
      and policyname='pol_cbc_insert'
      and roles = array['authenticated']::name[]
      and with_check ilike '%teacher_classes%'
      and with_check ilike '%student_classes%'
      and with_check ilike '%students%'
  ) then
    raise exception 'student_one_downstream_cbc_authority_postcondition_failed';
  end if;
end
$$;
