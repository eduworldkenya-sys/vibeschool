-- Student OS pilot: canonical learner enrolment is visible to its owner,
-- while school membership alone must not reveal every learner's enrolment.
-- Teacher assignment and parent-child links retain their separate authorities.
-- Stage for disposable-DB RLS tests before production application.

do $migration$
begin
  if to_regclass('public.student_classes') is null
     or to_regclass('public.school_members') is null
     or to_regclass('public.students') is null
     or to_regprocedure('public.current_student_id()') is null then
    raise exception 'student_pilot_enrollment_contract_missing';
  end if;
end
$migration$;

alter table public.student_classes enable row level security;

drop policy if exists pol_student_classes_select on public.student_classes;
create policy pol_student_classes_select
  on public.student_classes for select to authenticated
  using (
    exists (
      select 1 from public.school_members sm
      where sm.school_id = student_classes.school_id
        and sm.profile_id = (select auth.uid())
        and sm.role::text in ('owner','admin')
    )
  );

drop policy if exists pol_student_classes_learner_self_read on public.student_classes;
create policy pol_student_classes_learner_self_read
  on public.student_classes for select to authenticated
  using (student_id = (select public.current_student_id()));

drop policy if exists pol_student_classes_parent_link_read on public.student_classes;
create policy pol_student_classes_parent_link_read
  on public.student_classes for select to authenticated
  using (
    exists (
      select 1 from public.parent_student_links psl
      where psl.student_id = student_classes.student_id
        and psl.parent_id = (select auth.uid())
        and coalesce(psl.access_level,'full') <> 'none'
    )
  );

-- The pre-existing pol_student_classes_teacher_read policy continues
-- restricting staff to their assigned teacher_classes class/school scope.
-- Do not add broad teacher or student school-membership reads.

-- Prevent a learner from bypassing review RPCs through direct PostgREST
-- UPDATE/INSERT writes (which previously exposed mark/feedback/status columns).
-- Confirm the authorized SECURITY DEFINER submission/review RPCs still exist.
do $migration$
declare rpc_count integer;
begin
  select count(*) into rpc_count from pg_proc p
  where p.pronamespace='public'::regnamespace
    and p.proname in (
      'save_student_homework_draft',
      'submit_student_homework',
      'review_homework_submission'
    )
    and p.prosecdef
    and pg_get_userbyid(p.proowner)='postgres';
  if rpc_count <> 3 then raise exception 'homework_rpc_authority_contract_missing'; end if;
end
$migration$;

revoke insert, update, delete on public.homework_submissions from authenticated;
-- Keep authenticated SELECT under its existing student/parent/teacher RLS policies.
-- All state-changing student and teacher clients must use authorized RPCs.

-- A received homework submission is final until a teacher explicitly returns it.
-- The existing server-authorized draft RPC was previously able to reopen received
-- work; update only those exact legacy fragments and fail on unknown schema drift.
do $migration$
declare
  draft_ddl text;
  source_status text := 'when public.homework_submissions.status in (''marked'',''under_review'')';
  source_lock text := 'if v_submission.status in (''marked'',''under_review'') then';
begin
  select pg_get_functiondef('public.save_student_homework_draft(uuid,jsonb,text)'::regprocedure)
    into draft_ddl;
  if draft_ddl is null
     or position(source_status in draft_ddl) = 0
     or position(source_lock in draft_ddl) = 0 then
    raise exception 'homework_draft_lifecycle_contract_drift';
  end if;
  draft_ddl := replace(draft_ddl, source_status,
    'when public.homework_submissions.status in (''marked'',''under_review'',''submitted'',''received'')');
  draft_ddl := replace(draft_ddl, source_lock,
    'if v_submission.status in (''marked'',''under_review'',''submitted'',''received'') then');
  execute draft_ddl;
end
$migration$;
