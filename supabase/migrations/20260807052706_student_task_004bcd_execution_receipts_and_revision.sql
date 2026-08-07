create table if not exists public.student_task_execution_receipts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  task_id text not null,
  source_type text not null,
  source_id uuid not null,
  lifecycle text not null check (lifecycle in ('launched','in_progress','submitted','returned','released','completed')),
  launched_at timestamptz,
  last_saved_at timestamptz,
  submitted_at timestamptz,
  returned_at timestamptz,
  released_at timestamptz,
  completed_at timestamptz,
  revision_number integer not null default 1 check (revision_number > 0),
  receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, task_id)
);

create index if not exists student_task_execution_receipts_student_idx
  on public.student_task_execution_receipts(student_id, updated_at desc);
create index if not exists student_task_execution_receipts_source_idx
  on public.student_task_execution_receipts(source_type, source_id);

alter table public.student_task_execution_receipts enable row level security;

drop policy if exists student_task_execution_receipts_select_own on public.student_task_execution_receipts;
create policy student_task_execution_receipts_select_own
  on public.student_task_execution_receipts
  for select
  to authenticated
  using (student_id in (select s.id from public.students s where s.profile_id = (select auth.uid()) and s.deleted_at is null));

revoke all on table public.student_task_execution_receipts from anon, public;
grant select on table public.student_task_execution_receipts to authenticated;

create or replace function public.student_sync_task_execution_receipt(p_task_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_task jsonb;
  v_status text;
  v_lifecycle text;
  v_source_type text;
  v_source_id uuid;
  v_revision integer := 1;
  v_submitted_at timestamptz;
  v_returned_at timestamptz;
  v_released_at timestamptz;
  v_completed_at timestamptz;
  v_receipt jsonb := '{}'::jsonb;
  v_row public.student_task_execution_receipts%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select s.id into v_student_id from public.students s where s.profile_id=v_uid and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select task into v_task
  from jsonb_array_elements(coalesce(public.student_list_my_tasks()->'tasks','[]'::jsonb)) task
  where task->>'task_id'=p_task_id limit 1;
  if v_task is null then raise exception 'task_not_available'; end if;

  v_status := coalesce(v_task->>'status','ready');
  v_source_type := coalesce(v_task->>'task_type','task');
  begin v_source_id := (v_task->>'source_id')::uuid; exception when others then raise exception 'invalid_source_id'; end;

  if v_source_type='homework' then
    select coalesce(hs.revision_number,1), hs.submitted_at, hs.returned_at,
           case when hs.status='marked' or hs.mark is not null then coalesce(hs.feedback_released_at,hs.reviewed_at,hs.updated_at) end,
           jsonb_strip_nulls(jsonb_build_object('submission_id',hs.id,'status',hs.status,'received_at',hs.received_at,'mark',hs.mark,'feedback',hs.feedback,'returned_reason',hs.returned_reason))
    into v_revision,v_submitted_at,v_returned_at,v_released_at,v_receipt
    from public.homework_submissions hs
    where hs.homework_id=v_source_id and hs.student_id=v_student_id
    order by hs.revision_number desc, hs.updated_at desc limit 1;
  elsif v_source_type in ('quiz','cat','exam','remedial') then
    select coalesce(aa.attempt_number,1), aa.submitted_at,
           case when aa.status='returned' then aa.updated_at end,
           case when aa.result_status='released' then aa.updated_at end,
           jsonb_strip_nulls(jsonb_build_object('attempt_id',aa.id,'status',aa.status,'result_status',aa.result_status,'score',aa.score,'max_score',aa.max_score,'feedback',aa.feedback))
    into v_revision,v_submitted_at,v_returned_at,v_released_at,v_receipt
    from public.assessment_attempts aa
    where aa.assignment_id=v_source_id and aa.student_id=v_student_id
    order by aa.attempt_number desc limit 1;
  elsif v_source_type='exercise' then
    select 1, es.submitted_at, null::timestamptz,
           case when es.status='marked' or es.mark is not null then es.created_at end,
           jsonb_strip_nulls(jsonb_build_object('submission_id',es.id,'status',es.status,'mark',es.mark,'feedback',es.feedback))
    into v_revision,v_submitted_at,v_returned_at,v_released_at,v_receipt
    from public.exercise_submissions es where es.exercise_id=v_source_id and es.student_id=v_student_id order by es.created_at desc limit 1;
  elsif v_source_type='project' then
    select 1, ps.submitted_at, null::timestamptz,
           case when ps.status='marked' or ps.mark is not null then ps.created_at end,
           jsonb_strip_nulls(jsonb_build_object('submission_id',ps.id,'status',ps.status,'mark',ps.mark,'feedback',ps.feedback))
    into v_revision,v_submitted_at,v_returned_at,v_released_at,v_receipt
    from public.project_submissions ps where ps.project_id=v_source_id and ps.student_id=v_student_id order by ps.created_at desc limit 1;
  end if;

  v_lifecycle := case
    when v_status='released' then 'released'
    when v_status='awaiting_marking' then 'submitted'
    when v_status='returned' then 'returned'
    when v_status='in_progress' then 'in_progress'
    else 'launched' end;

  if v_status='released' then
    if exists(select 1 from public.student_learning_events e where e.student_id=v_student_id and e.event_type='task_completed' and e.source_type=v_source_type and e.source_id=v_source_id) then
      v_lifecycle := 'completed';
      select max(e.occurred_at) into v_completed_at from public.student_learning_events e where e.student_id=v_student_id and e.event_type='task_completed' and e.source_type=v_source_type and e.source_id=v_source_id;
    end if;
  end if;

  insert into public.student_task_execution_receipts(student_id,task_id,source_type,source_id,lifecycle,launched_at,last_saved_at,submitted_at,returned_at,released_at,completed_at,revision_number,receipt,updated_at)
  values(v_student_id,p_task_id,v_source_type,v_source_id,v_lifecycle,now(),case when v_lifecycle='in_progress' then now() end,v_submitted_at,v_returned_at,v_released_at,v_completed_at,coalesce(v_revision,1),coalesce(v_receipt,'{}'::jsonb),now())
  on conflict(student_id,task_id) do update set
    lifecycle=excluded.lifecycle,
    launched_at=coalesce(public.student_task_execution_receipts.launched_at,excluded.launched_at),
    last_saved_at=coalesce(excluded.last_saved_at,public.student_task_execution_receipts.last_saved_at),
    submitted_at=coalesce(excluded.submitted_at,public.student_task_execution_receipts.submitted_at),
    returned_at=coalesce(excluded.returned_at,public.student_task_execution_receipts.returned_at),
    released_at=coalesce(excluded.released_at,public.student_task_execution_receipts.released_at),
    completed_at=coalesce(excluded.completed_at,public.student_task_execution_receipts.completed_at),
    revision_number=greatest(public.student_task_execution_receipts.revision_number,excluded.revision_number),
    receipt=public.student_task_execution_receipts.receipt || excluded.receipt,
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object('ok',true,'task_id',v_row.task_id,'lifecycle',v_row.lifecycle,'revision_number',v_row.revision_number,'receipt',v_row.receipt,'launched_at',v_row.launched_at,'last_saved_at',v_row.last_saved_at,'submitted_at',v_row.submitted_at,'returned_at',v_row.returned_at,'released_at',v_row.released_at,'completed_at',v_row.completed_at);
end;
$$;

revoke all on function public.student_sync_task_execution_receipt(text) from public, anon;
grant execute on function public.student_sync_task_execution_receipt(text) to authenticated;

create or replace function public.student_record_verified_task_completion(p_source_type text,p_source_id uuid,p_subject_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid:=auth.uid(); learner public.students%rowtype; xp integer:=20; inserted_id uuid; prev_date date; new_streak integer;
  v_task_id text; v_completed_at timestamptz:=clock_timestamp();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into learner from public.students where profile_id=caller and deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;
  if p_source_type not in ('homework','exercise','project','assessment','revision','quiz','cat','exam','remedial') then raise exception 'unsupported_source_type'; end if;
  if p_source_type='homework' and not exists(select 1 from public.homework_submissions hs where hs.homework_id=p_source_id and hs.student_id=learner.id and (hs.status='marked' or hs.mark is not null)) then raise exception 'completion_not_verified'; end if;
  if p_source_type='exercise' and not exists(select 1 from public.exercise_submissions es where es.exercise_id=p_source_id and es.student_id=learner.id and (es.status='marked' or es.mark is not null)) then raise exception 'completion_not_verified'; end if;
  if p_source_type='project' and not exists(select 1 from public.project_submissions ps where ps.project_id=p_source_id and ps.student_id=learner.id and (ps.status='marked' or ps.mark is not null)) then raise exception 'completion_not_verified'; end if;
  if p_source_type in ('assessment','quiz','cat','exam','remedial') and not exists(select 1 from public.assessment_attempts aa where aa.assignment_id=p_source_id and aa.student_id=learner.id and aa.result_status='released') then raise exception 'completion_not_verified'; end if;

  insert into public.student_learning_events(student_id,event_type,source_type,source_id,subject_id,xp_awarded)
  values(learner.id,'task_completed',p_source_type,p_source_id,p_subject_id,xp)
  on conflict do nothing returning id into inserted_id;
  if inserted_id is null then return public.student_refresh_motivation_summary() || jsonb_build_object('awarded',false,'xp_awarded',0); end if;
  insert into public.funhub_xp_ledger(student_id,amount,source,reference_id) values(learner.id,xp,'verified_task',inserted_id);

  select last_active_date into prev_date from public.student_learning_streaks where student_id=learner.id;
  new_streak:=case when prev_date=current_date then coalesce((select current_streak from public.student_learning_streaks where student_id=learner.id),1) when prev_date=current_date-1 then coalesce((select current_streak from public.student_learning_streaks where student_id=learner.id),0)+1 else 1 end;
  insert into public.student_learning_streaks(student_id,current_streak,longest_streak,last_active_date)
  values(learner.id,new_streak,new_streak,current_date)
  on conflict(student_id) do update set current_streak=new_streak,longest_streak=greatest(public.student_learning_streaks.longest_streak,new_streak),last_active_date=current_date,updated_at=now();

  v_task_id := case when p_source_type in ('assessment','quiz','cat','exam','remedial') then 'assessment:'||p_source_id::text else p_source_type||':'||p_source_id::text end;
  insert into public.student_task_execution_receipts(student_id,task_id,source_type,source_id,lifecycle,completed_at,revision_number,receipt,updated_at)
  values(learner.id,v_task_id,p_source_type,p_source_id,'completed',v_completed_at,1,jsonb_build_object('completion_event_id',inserted_id),now())
  on conflict(student_id,task_id) do update set lifecycle='completed',completed_at=coalesce(public.student_task_execution_receipts.completed_at,excluded.completed_at),receipt=public.student_task_execution_receipts.receipt||excluded.receipt,updated_at=now();

  return public.student_refresh_motivation_summary() || jsonb_build_object('awarded',true,'xp_awarded',xp);
end;
$$;

revoke all on function public.student_record_verified_task_completion(text,uuid,uuid) from public, anon;
grant execute on function public.student_record_verified_task_completion(text,uuid,uuid) to authenticated;