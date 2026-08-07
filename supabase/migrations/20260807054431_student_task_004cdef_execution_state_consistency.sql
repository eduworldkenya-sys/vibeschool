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
  if v_source_type in ('quiz','cat','exam','remedial') then v_source_type := 'assessment'; end if;
  begin v_source_id := (v_task->>'source_id')::uuid; exception when others then raise exception 'invalid_source_id'; end;

  if v_source_type='homework' then
    select coalesce(hs.revision_number,1), hs.submitted_at, hs.returned_at,
           case when hs.status='marked' or hs.mark is not null then coalesce(hs.feedback_released_at,hs.reviewed_at,hs.updated_at) end,
           jsonb_strip_nulls(jsonb_build_object('submission_id',hs.id,'status',hs.status,'received_at',hs.received_at,'mark',hs.mark,'feedback',hs.feedback,'returned_reason',hs.returned_reason))
    into v_revision,v_submitted_at,v_returned_at,v_released_at,v_receipt
    from public.homework_submissions hs
    where hs.homework_id=v_source_id and hs.student_id=v_student_id
    order by hs.revision_number desc, hs.updated_at desc limit 1;
  elsif v_source_type='assessment' then
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

  if v_status='released' and exists(
    select 1 from public.student_learning_events e
    where e.student_id=v_student_id and e.event_type='task_completed'
      and e.source_type=v_source_type and e.source_id=v_source_id
  ) then
    v_lifecycle := 'completed';
    select max(e.occurred_at) into v_completed_at from public.student_learning_events e
    where e.student_id=v_student_id and e.event_type='task_completed'
      and e.source_type=v_source_type and e.source_id=v_source_id;
  end if;

  insert into public.student_task_execution_receipts(student_id,task_id,source_type,source_id,lifecycle,launched_at,last_saved_at,submitted_at,returned_at,released_at,completed_at,revision_number,receipt,updated_at)
  values(v_student_id,p_task_id,v_source_type,v_source_id,v_lifecycle,now(),case when v_lifecycle='in_progress' then now() end,v_submitted_at,v_returned_at,v_released_at,v_completed_at,coalesce(v_revision,1),coalesce(v_receipt,'{}'::jsonb),now())
  on conflict(student_id,task_id) do update set
    source_type=excluded.source_type,
    source_id=excluded.source_id,
    lifecycle=case when public.student_task_execution_receipts.lifecycle='completed' then 'completed' else excluded.lifecycle end,
    launched_at=coalesce(public.student_task_execution_receipts.launched_at,excluded.launched_at),
    last_saved_at=coalesce(excluded.last_saved_at,public.student_task_execution_receipts.last_saved_at),
    submitted_at=coalesce(excluded.submitted_at,public.student_task_execution_receipts.submitted_at),
    returned_at=coalesce(excluded.returned_at,public.student_task_execution_receipts.returned_at),
    released_at=coalesce(excluded.released_at,public.student_task_execution_receipts.released_at),
    completed_at=coalesce(public.student_task_execution_receipts.completed_at,excluded.completed_at),
    revision_number=greatest(public.student_task_execution_receipts.revision_number,excluded.revision_number),
    receipt=public.student_task_execution_receipts.receipt || excluded.receipt,
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object('ok',true,'task_id',v_row.task_id,'lifecycle',v_row.lifecycle,'revision_number',v_row.revision_number,'receipt',v_row.receipt,'launched_at',v_row.launched_at,'last_saved_at',v_row.last_saved_at,'submitted_at',v_row.submitted_at,'returned_at',v_row.returned_at,'released_at',v_row.released_at,'completed_at',v_row.completed_at);
end;
$$;

revoke all on function public.student_sync_task_execution_receipt(text) from public, anon;
grant execute on function public.student_sync_task_execution_receipt(text) to authenticated;

create or replace function public.student_execution_source_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_type text := TG_ARGV[0];
  v_task_id text;
  v_source_id uuid;
  v_student_id uuid;
  v_subject_id uuid;
  v_lifecycle text;
  v_revision integer := 1;
  v_last_saved_at timestamptz;
  v_submitted_at timestamptz;
  v_returned_at timestamptz;
  v_released_at timestamptz;
  v_qualifies boolean := false;
  v_receipt jsonb := '{}'::jsonb;
begin
  if TG_TABLE_NAME='homework_submissions' then
    v_source_type := 'homework';
    v_source_id := NEW.homework_id;
    v_task_id := 'homework:'||NEW.homework_id::text;
    v_student_id := NEW.student_id;
    v_revision := coalesce(NEW.revision_number,1);
    v_last_saved_at := case when NEW.status='draft' then NEW.updated_at end;
    v_submitted_at := NEW.submitted_at;
    v_returned_at := NEW.returned_at;
    v_released_at := case when NEW.status='marked' or NEW.mark is not null then coalesce(NEW.feedback_released_at,NEW.reviewed_at,NEW.updated_at) end;
    v_lifecycle := case when NEW.status='marked' or NEW.mark is not null then 'released' when NEW.status='returned' then 'returned' when NEW.status in ('submitted','received','under_review') then 'submitted' when NEW.status='draft' then 'in_progress' else 'launched' end;
    v_qualifies := NEW.status='marked' or NEW.mark is not null;
    v_receipt := jsonb_strip_nulls(jsonb_build_object('submission_id',NEW.id,'status',NEW.status,'received_at',NEW.received_at,'mark',NEW.mark,'feedback',NEW.feedback,'returned_reason',NEW.returned_reason));
    select s.id into v_subject_id from public.homework h left join public.subjects s on lower(s.name)=lower(h.subject) and s.school_id=h.school_id where h.id=NEW.homework_id limit 1;
  elsif TG_TABLE_NAME='exercise_submissions' then
    v_source_type := 'exercise';
    v_source_id := NEW.exercise_id;
    v_task_id := 'exercise:'||NEW.exercise_id::text;
    v_student_id := NEW.student_id;
    v_submitted_at := NEW.submitted_at;
    v_released_at := case when NEW.status='marked' or NEW.mark is not null then coalesce(NEW.submitted_at,NEW.created_at) end;
    v_lifecycle := case when NEW.status='marked' or NEW.mark is not null then 'released' when NEW.status='submitted' then 'submitted' when NEW.status='pending' then 'in_progress' else 'launched' end;
    v_qualifies := NEW.status='marked' or NEW.mark is not null;
    v_receipt := jsonb_strip_nulls(jsonb_build_object('submission_id',NEW.id,'status',NEW.status,'mark',NEW.mark,'feedback',NEW.feedback));
    select e.subject_id into v_subject_id from public.exercises e where e.id=NEW.exercise_id;
  elsif TG_TABLE_NAME='project_submissions' then
    v_source_type := 'project';
    v_source_id := NEW.project_id;
    v_task_id := 'project:'||NEW.project_id::text;
    v_student_id := NEW.student_id;
    v_submitted_at := NEW.submitted_at;
    v_released_at := case when NEW.status='marked' or NEW.mark is not null then coalesce(NEW.submitted_at,NEW.created_at) end;
    v_lifecycle := case when NEW.status='marked' or NEW.mark is not null then 'released' when NEW.status='submitted' then 'submitted' when NEW.status='pending' then 'in_progress' else 'launched' end;
    v_qualifies := NEW.status='marked' or NEW.mark is not null;
    v_receipt := jsonb_strip_nulls(jsonb_build_object('submission_id',NEW.id,'status',NEW.status,'mark',NEW.mark,'feedback',NEW.feedback));
    select p.subject_id into v_subject_id from public.projects p where p.id=NEW.project_id;
  elsif TG_TABLE_NAME='assessment_attempts' then
    v_source_type := 'assessment';
    v_source_id := NEW.assignment_id;
    v_task_id := 'assessment:'||NEW.assignment_id::text;
    v_student_id := NEW.student_id;
    v_revision := coalesce(NEW.attempt_number,1);
    v_last_saved_at := case when NEW.status='in_progress' then NEW.updated_at end;
    v_submitted_at := NEW.submitted_at;
    v_released_at := case when NEW.result_status='released' then NEW.updated_at end;
    v_lifecycle := case when NEW.result_status='released' then 'released' when NEW.status in ('submitted','auto_marked','teacher_review','marked','released') then 'submitted' when NEW.status='in_progress' then 'in_progress' else 'launched' end;
    v_qualifies := NEW.result_status='released';
    v_receipt := jsonb_strip_nulls(jsonb_build_object('attempt_id',NEW.id,'status',NEW.status,'result_status',NEW.result_status,'score',NEW.score,'max_score',NEW.max_score,'feedback',NEW.feedback));
    select ad.subject_id into v_subject_id from public.assessment_assignments aa join public.assessment_definitions ad on ad.id=aa.assessment_id where aa.id=NEW.assignment_id;
  else
    return NEW;
  end if;

  insert into public.student_task_execution_receipts(student_id,task_id,source_type,source_id,lifecycle,last_saved_at,submitted_at,returned_at,released_at,revision_number,receipt,updated_at)
  values(v_student_id,v_task_id,v_source_type,v_source_id,v_lifecycle,v_last_saved_at,v_submitted_at,v_returned_at,v_released_at,v_revision,v_receipt,now())
  on conflict(student_id,task_id) do update set
    source_type=excluded.source_type,
    source_id=excluded.source_id,
    lifecycle=case when public.student_task_execution_receipts.lifecycle='completed' then 'completed' else excluded.lifecycle end,
    last_saved_at=coalesce(excluded.last_saved_at,public.student_task_execution_receipts.last_saved_at),
    submitted_at=coalesce(excluded.submitted_at,public.student_task_execution_receipts.submitted_at),
    returned_at=coalesce(excluded.returned_at,public.student_task_execution_receipts.returned_at),
    released_at=coalesce(excluded.released_at,public.student_task_execution_receipts.released_at),
    revision_number=greatest(public.student_task_execution_receipts.revision_number,excluded.revision_number),
    receipt=public.student_task_execution_receipts.receipt||excluded.receipt,
    updated_at=now();

  if v_qualifies then
    perform public.student_apply_verified_completion(v_student_id,v_source_type,v_source_id,v_subject_id,coalesce(v_released_at,now()));
  end if;
  return NEW;
end;
$$;

revoke all on function public.student_execution_source_trigger() from public, anon, authenticated;

drop trigger if exists trg_student_complete_homework on public.homework_submissions;
drop trigger if exists trg_student_complete_exercise on public.exercise_submissions;
drop trigger if exists trg_student_complete_project on public.project_submissions;
drop trigger if exists trg_student_complete_assessment on public.assessment_attempts;

create trigger trg_student_complete_homework after insert or update of status,mark,feedback_released_at,returned_at,received_at on public.homework_submissions for each row execute function public.student_execution_source_trigger('homework');
create trigger trg_student_complete_exercise after insert or update of status,mark on public.exercise_submissions for each row execute function public.student_execution_source_trigger('exercise');
create trigger trg_student_complete_project after insert or update of status,mark on public.project_submissions for each row execute function public.student_execution_source_trigger('project');
create trigger trg_student_complete_assessment after insert or update of status,result_status,score on public.assessment_attempts for each row execute function public.student_execution_source_trigger('assessment');

drop function if exists public.student_completion_source_trigger();