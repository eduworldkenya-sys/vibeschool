-- VibeSchool Task 6: Parent Core Journey privacy and publication closure.
-- Canonical authority: authenticated parent -> active parent_student_links -> students.id.
-- authorization-test: public.parent_student_links
-- authorization-test: public.attendance
-- authorization-test: public.homework
-- authorization-test: public.homework_submissions
-- authorization-test: public.parent_messages
-- authorization-test: public.assessment_gradebook_entries
-- authorization-test: public.exam_results
-- authorization-test: public.finance_fee_payments

begin;

create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.parent_student_links psl
    where psl.student_id = p_student_id
      and psl.parent_id = (select auth.uid())
      and coalesce(psl.access_level, 'full') <> 'none'
  );
$function$;

revoke all on function public.is_parent_of_student(uuid) from public, anon;
grant execute on function public.is_parent_of_student(uuid) to authenticated, service_role;

drop policy if exists attendance_parent_read on public.attendance;
create policy attendance_parent_read on public.attendance for select to authenticated
using ((select public.is_parent_of_student(attendance.student_id)));

drop policy if exists homework_parent_read on public.homework;
create policy homework_parent_read on public.homework for select to authenticated
using (exists (
  select 1 from public.parent_student_links psl
  join public.student_classes sc on sc.student_id = psl.student_id and sc.is_current = true
  where psl.parent_id = (select auth.uid())
    and coalesce(psl.access_level, 'full') <> 'none'
    and sc.class_id = homework.class_id
    and (homework.school_id is null or sc.school_id = homework.school_id)
));

drop policy if exists homework_submissions_parent_read on public.homework_submissions;
create policy homework_submissions_parent_read on public.homework_submissions for select to authenticated
using ((select public.is_parent_of_student(homework_submissions.student_id)));

drop policy if exists pol_parent_messages_select on public.parent_messages;
create policy pol_parent_messages_select on public.parent_messages for select to authenticated
using (
  parent_messages.teacher_id = (select auth.uid())
  or (select public.is_parent_of_student(parent_messages.student_id))
  or exists (
    select 1 from public.school_members sm
    where sm.school_id = parent_messages.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role = any (array['owner'::public.member_role, 'admin'::public.member_role])
  )
);

drop policy if exists assessment_gradebook_parent_read on public.assessment_gradebook_entries;
create policy assessment_gradebook_parent_read on public.assessment_gradebook_entries for select to authenticated
using (assessment_gradebook_entries.released_at is not null
  and (select public.is_parent_of_student(assessment_gradebook_entries.student_id)));

drop policy if exists exam_results_parent_read on public.exam_results;
create policy exam_results_parent_read on public.exam_results for select to authenticated
using (
  (select public.is_parent_of_student(exam_results.student_id))
  and exists (
    select 1 from public.exams e
    where e.id = exam_results.exam_id
      and e.school_id = exam_results.school_id
      and e.is_locked = true
  )
);

do $do$
begin
  if to_regclass('public.traditional_grades') is not null then
    execute 'drop policy if exists trad_grades_parent_read on public.traditional_grades';
  end if;
end
$do$;

drop policy if exists parent_summaries_learner_parent_read on public.parent_learning_summaries;
create policy parent_summaries_learner_parent_read on public.parent_learning_summaries for select to authenticated
using (
  parent_learning_summaries.status = 'published'
  and (
    exists (select 1 from public.students s
      where s.id = parent_learning_summaries.student_id
        and s.profile_id = (select auth.uid()) and s.deleted_at is null)
    or (select public.is_parent_of_student(parent_learning_summaries.student_id))
  )
);

drop policy if exists finance_fee_payments_parent_insert on public.finance_fee_payments;
drop policy if exists finance_fee_payments_parent_select on public.finance_fee_payments;
create policy finance_fee_payments_parent_select on public.finance_fee_payments for select to authenticated
using (exists (
  select 1 from public.parent_student_links psl
  where psl.parent_id = (select auth.uid())
    and psl.student_id = finance_fee_payments.student_id
    and (psl.school_id is null or psl.school_id = finance_fee_payments.school_id)
    and coalesce(psl.access_level, 'full') <> 'none'
    and coalesce(psl.can_view_finance, false)
));

do $do$
begin
  if to_regclass('public.finance_invoices') is not null then
    execute 'drop policy if exists finance_invoices_parent on public.finance_invoices';
    execute $sql$create policy finance_invoices_parent on public.finance_invoices for select to authenticated
      using (exists (select 1 from public.parent_student_links psl
        where psl.parent_id = (select auth.uid())
          and psl.student_id = finance_invoices.student_id
          and (psl.school_id is null or psl.school_id = finance_invoices.school_id)
          and coalesce(psl.access_level, 'full') <> 'none'
          and coalesce(psl.can_view_finance, false)))$sql$;
  end if;
  if to_regclass('public.finance_payments') is not null then
    execute 'drop policy if exists finance_payments_parent on public.finance_payments';
    execute $sql$create policy finance_payments_parent on public.finance_payments for select to authenticated
      using (exists (select 1 from public.parent_student_links psl
        where psl.parent_id = (select auth.uid())
          and psl.student_id = finance_payments.student_id
          and (psl.school_id is null or psl.school_id = finance_payments.school_id)
          and coalesce(psl.access_level, 'full') <> 'none'
          and coalesce(psl.can_view_finance, false)))$sql$;
  end if;
end
$do$;

drop policy if exists exercises_parent_read on public.exercises;
create policy exercises_parent_read on public.exercises for select to authenticated
using (exists (
  select 1 from public.parent_student_links psl
  join public.student_classes sc on sc.student_id = psl.student_id and sc.is_current = true
  where psl.parent_id = (select auth.uid())
    and coalesce(psl.access_level, 'full') <> 'none'
    and sc.class_id = exercises.class_id
    and (exercises.school_id is null or sc.school_id = exercises.school_id)
));

drop policy if exists projects_parent_read on public.projects;
create policy projects_parent_read on public.projects for select to authenticated
using (exists (
  select 1 from public.parent_student_links psl
  join public.student_classes sc on sc.student_id = psl.student_id and sc.is_current = true
  where psl.parent_id = (select auth.uid())
    and coalesce(psl.access_level, 'full') <> 'none'
    and sc.class_id = projects.class_id
    and (projects.school_id is null or sc.school_id = projects.school_id)
));

do $do$
begin
  if to_regclass('public.lesson_content') is not null then
    execute 'drop policy if exists pol_lesson_content_select_parent on public.lesson_content';
    execute $sql$create policy pol_lesson_content_select_parent on public.lesson_content for select to authenticated
      using (exists (select 1 from public.lesson_plans lp
        join public.student_classes sc on sc.class_id = lp.class_id and sc.is_current = true
        join public.parent_student_links psl on psl.student_id = sc.student_id
        where lp.id = lesson_content.lesson_plan_id
          and psl.parent_id = (select auth.uid())
          and coalesce(psl.access_level, 'full') <> 'none'
          and (lesson_content.school_id is null or sc.school_id = lesson_content.school_id)))$sql$;
  end if;
end
$do$;

drop policy if exists "authorized read homework_answers" on public.homework_answers;
create policy "authorized read homework_answers" on public.homework_answers for select to authenticated
using (
  homework_answers.submission_id is not null
  and exists (
    select 1 from public.homework_submissions hs
    left join public.students st on st.id = hs.student_id
    left join public.homework h on h.id = hs.homework_id
    where hs.id = homework_answers.submission_id
      and (st.profile_id = (select auth.uid())
        or h.teacher_id = (select auth.uid())
        or (select public.is_parent_of_student(hs.student_id)))
  )
);

do $do$
begin
  if to_regclass('public.child_badges') is not null then
    execute 'drop policy if exists "parent reads child badges" on public.child_badges';
    execute 'create policy "parent reads child badges" on public.child_badges for select to authenticated using ((select public.is_parent_of_student(child_badges.student_id)))';
    execute 'drop policy if exists child_badges_insert on public.child_badges';
    execute 'create policy child_badges_insert on public.child_badges for insert to authenticated with check ((select public.is_parent_of_student(child_badges.student_id)))';
  end if;
  if to_regclass('public.child_audit_log') is not null then
    execute 'drop policy if exists "parent reads audit log" on public.child_audit_log';
  end if;
end
$do$;

commit;
