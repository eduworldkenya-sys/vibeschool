-- Pilot authority chain: exercise_submissions.student_id is a domain student id,
-- while auth.uid() is a profile/auth identity. Resolve through students.profile_id.

drop policy if exists exercise_submissions_student_insert on public.exercise_submissions;
drop policy if exists exercise_submissions_student_read on public.exercise_submissions;

create policy exercise_submissions_student_insert
on public.exercise_submissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.students s
    where s.id = exercise_submissions.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
  and exists (
    select 1
    from public.exercises e
    join public.student_classes sc
      on sc.class_id = e.class_id
     and sc.student_id = exercise_submissions.student_id
     and sc.is_current = true
    where e.id = exercise_submissions.exercise_id
      and (e.school_id is null or e.school_id = sc.school_id)
  )
);

create policy exercise_submissions_student_read
on public.exercise_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = exercise_submissions.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

do $$
declare
  v_insert text;
  v_read text;
begin
  select with_check into v_insert from pg_policies where schemaname='public' and tablename='exercise_submissions' and policyname='exercise_submissions_student_insert';
  select qual into v_read from pg_policies where schemaname='public' and tablename='exercise_submissions' and policyname='exercise_submissions_student_read';
  if v_insert is null or v_read is null or v_insert not ilike '%profile_id%auth.uid%' or v_read not ilike '%profile_id%auth.uid%' then
    raise exception 'exercise_submissions identity authority certification failed';
  end if;
end $$;
