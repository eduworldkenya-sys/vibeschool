create or replace function public.student_list_my_tasks()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid:=auth.uid();
  learner_id uuid;
  payload jsonb;
  counts jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select id into learner_id from public.students
  where profile_id=caller and deleted_at is null limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  with my_classes as (
    select class_id,school_id from public.student_classes
    where student_id=learner_id and is_current=true
  ),
  my_groups as (
    select group_id from public.class_group_members where student_id=learner_id
  ),
  homework_tasks as (
    select
      'homework:'||h.id::text as task_id,
      'homework'::text as task_type,
      h.id as source_id,
      coalesce(nullif(btrim(h.title),''),'Homework') as title,
      coalesce(nullif(btrim(h.subject),''),'General') as subject,
      h.class_id,
      h.created_at as assigned_at,
      null::timestamptz as opens_at,
      h.due_date::timestamptz as due_at,
      case when hs.mark is not null or hs.status='marked' then 'released'
           when hs.status='returned' then 'returned'
           when hs.status in ('submitted','received','under_review') then 'awaiting_marking'
           when hs.status='draft' then 'in_progress'
           when h.due_date<current_date then 'overdue'
           else 'ready' end as status,
      '/student/homework/'||h.id::text as action_url,
      case when hs.mark is not null or hs.status='marked' then 'View feedback'
           when hs.status='returned' then 'Revise and resubmit'
           when hs.status in ('submitted','received','under_review') then 'View submission'
           when hs.status='draft' then 'Continue homework'
           else 'Start homework' end as action_label,
      hs.mark::numeric as score,
      null::numeric as max_score,
      hs.feedback,
      case when hs.status in ('submitted','received','under_review','marked') or hs.mark is not null then 100
           when hs.status='draft' then 50 else 0 end as progress
    from public.homework h
    join my_classes mc on mc.class_id=h.class_id and mc.school_id=h.school_id
    left join lateral (
      select x.* from public.homework_submissions x
      where x.homework_id=h.id and x.student_id=learner_id
      order by x.revision_number desc,x.updated_at desc limit 1
    ) hs on true
    where h.target_group_id is null or exists(select 1 from my_groups g where g.group_id=h.target_group_id)
  ),
  assessment_tasks as (
    select
      'assessment:'||aa.id::text,
      case when ad.intervention_id is not null then 'remedial' else ad.assessment_type end,
      aa.id,
      ad.title,
      coalesce(s.name,'Assessment'),
      aa.class_id,
      coalesce(aa.assigned_at,aa.created_at),
      aa.opens_at,
      aa.closes_at,
      case when at.result_status='released' then 'released'
           when at.status in ('submitted','auto_marked','teacher_review','marked','released') then 'awaiting_marking'
           when at.status='in_progress' then 'in_progress'
           when aa.opens_at>now() then 'upcoming'
           when aa.closes_at<=now() and at.id is null then 'closed'
           when aa.closes_at<now() then 'overdue'
           else 'ready' end,
      '/student/assessment/'||aa.id::text,
      case when at.result_status='released' then 'View result'
           when at.status in ('submitted','auto_marked','teacher_review','marked','released') then 'Awaiting marking'
           when at.status='in_progress' then 'Continue assessment'
           when aa.opens_at>now() then 'Opens soon'
           when aa.closes_at<=now() then 'Closed'
           else 'Start assessment' end,
      case when aa.show_score_policy='immediate' or at.result_status='released' then at.score else null end,
      case when aa.show_score_policy='immediate' or at.result_status='released' then at.max_score else null end,
      case when at.result_status='released' then at.feedback else null end,
      case when at.result_status='released' or at.status in ('submitted','auto_marked','teacher_review','marked','released') then 100
           when at.status='in_progress' then 50 else 0 end
    from public.assessment_assignments aa
    join public.assessment_definitions ad on ad.id=aa.assessment_id
    join my_classes mc on mc.class_id=aa.class_id and mc.school_id=aa.school_id
    left join public.subjects s on s.id=ad.subject_id
    left join lateral (
      select x.* from public.assessment_attempts x
      where x.assignment_id=aa.id and x.student_id=learner_id
      order by x.attempt_number desc limit 1
    ) at on true
    where aa.status in ('assigned','open','closed')
      and (aa.target_group_id is null or exists(select 1 from my_groups g where g.group_id=aa.target_group_id))
  ),
  exercise_tasks as (
    select
      'exercise:'||e.id::text,'exercise',e.id,
      coalesce(nullif(btrim(e.title),''),'Class exercise'),'Exercise',e.class_id,
      e.created_at,e.created_at,null::timestamptz,
      case when es.mark is not null or es.status='marked' then 'released'
           when es.status='submitted' then 'awaiting_marking'
           when es.status='pending' then 'in_progress' else 'ready' end,
      '/student/exercises',
      case when es.mark is not null or es.status='marked' then 'View feedback'
           when es.status='submitted' then 'View submission'
           when es.status='pending' then 'Continue exercise' else 'Open exercise' end,
      es.mark,e.max_score,es.feedback,
      case when es.status in ('submitted','marked') or es.mark is not null then 100
           when es.status='pending' then 50 else 0 end
    from public.exercises e
    join my_classes mc on mc.class_id=e.class_id and (e.school_id is null or e.school_id=mc.school_id)
    left join lateral (
      select x.* from public.exercise_submissions x
      where x.exercise_id=e.id and x.student_id=learner_id
      order by x.created_at desc limit 1
    ) es on true
    where e.homework_id is null
  ),
  project_tasks as (
    select
      'project:'||p.id::text,'project',p.id,p.title,'Project',p.class_id,
      coalesce(p.start_date::timestamptz,p.created_at),p.start_date::timestamptz,p.due_date::timestamptz,
      case when ps.mark is not null or ps.status='marked' then 'released'
           when ps.status='submitted' then 'awaiting_marking'
           when ps.status='pending' then 'in_progress'
           when p.start_date>current_date then 'upcoming'
           when p.due_date<current_date then 'overdue' else 'ready' end,
      '/student/projects',
      case when ps.mark is not null or ps.status='marked' then 'View feedback'
           when ps.status='submitted' then 'View submission'
           when ps.status='pending' then 'Continue project' else 'Open project' end,
      ps.mark,null::numeric,ps.feedback,
      case when ps.status in ('submitted','marked') or ps.mark is not null then 100
           when ps.status='pending' then 50 else 0 end
    from public.projects p
    join my_classes mc on mc.class_id=p.class_id and (p.school_id is null or p.school_id=mc.school_id)
    left join lateral (
      select x.* from public.project_submissions x
      where x.project_id=p.id and x.student_id=learner_id
      order by x.created_at desc limit 1
    ) ps on true
    where lower(p.status) not in ('draft','archived','cancelled')
  ),
  tasks as (
    select * from homework_tasks
    union all select * from assessment_tasks
    union all select * from exercise_tasks
    union all select * from project_tasks
  ),
  normalized as (
    select *,case
      when status in ('overdue','in_progress','returned') then 0
      when status='ready' and due_at::date=current_date then 1
      when status='ready' then 2
      when status='upcoming' then 3
      when status='awaiting_marking' then 4
      when status='released' then 5
      else 6 end as sort_rank
    from tasks
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'task_id',task_id,'task_type',task_type,'source_id',source_id,
      'title',title,'subject',subject,'class_id',class_id,
      'assigned_at',assigned_at,'opens_at',opens_at,'due_at',due_at,
      'status',status,'priority',case when sort_rank=0 then 'urgent' when sort_rank=1 then 'high' else 'normal' end,
      'progress',progress,'action_url',action_url,'action_label',action_label,
      'score',score,'max_score',max_score,'feedback',feedback
    ) order by sort_rank,due_at asc nulls last,assigned_at desc),'[]'::jsonb),
    jsonb_build_object(
      'to_do',count(*) filter(where status in ('ready','overdue','returned')),
      'in_progress',count(*) filter(where status='in_progress'),
      'submitted',count(*) filter(where status='awaiting_marking'),
      'results',count(*) filter(where status='released'),
      'upcoming',count(*) filter(where status='upcoming'),
      'overdue',count(*) filter(where status='overdue')
    )
  into payload,counts from normalized;

  return jsonb_build_object('ok',true,'student_id',learner_id,'tasks',payload,'counts',counts);
end;
$$;

revoke all on function public.student_list_my_tasks() from public, anon;
grant execute on function public.student_list_my_tasks() to authenticated;

create or replace function public.student_apply_verified_completion(
  p_student_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_subject_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_previous_date date;
  v_current integer;
  v_new_streak integer;
  v_task_id text;
begin
  if p_student_id is null or p_source_id is null then return null; end if;
  if p_source_type not in ('homework','exercise','project','assessment','revision') then raise exception 'unsupported_source_type'; end if;

  insert into public.student_learning_events(student_id,event_type,source_type,source_id,subject_id,xp_awarded,occurred_at)
  values(p_student_id,'task_completed',p_source_type,p_source_id,p_subject_id,20,coalesce(p_occurred_at,now()))
  on conflict(student_id,event_type,source_type,source_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.student_learning_events
    where student_id=p_student_id and event_type='task_completed' and source_type=p_source_type and source_id=p_source_id;
    return v_event_id;
  end if;

  insert into public.funhub_xp_ledger(student_id,amount,source,reference_id)
  values(p_student_id,20,'bonus',v_event_id);

  select last_active_date,current_streak into v_previous_date,v_current
  from public.student_learning_streaks where student_id=p_student_id;
  v_new_streak := case
    when v_previous_date=current_date then coalesce(v_current,1)
    when v_previous_date=current_date-1 then coalesce(v_current,0)+1
    else 1 end;

  insert into public.student_learning_streaks(student_id,current_streak,longest_streak,last_active_date)
  values(p_student_id,v_new_streak,v_new_streak,current_date)
  on conflict(student_id) do update set
    current_streak=v_new_streak,
    longest_streak=greatest(public.student_learning_streaks.longest_streak,v_new_streak),
    last_active_date=current_date,
    updated_at=now();

  v_task_id := case when p_source_type='assessment' then 'assessment:'||p_source_id::text else p_source_type||':'||p_source_id::text end;
  insert into public.student_task_execution_receipts(student_id,task_id,source_type,source_id,lifecycle,completed_at,revision_number,receipt,updated_at)
  values(p_student_id,v_task_id,p_source_type,p_source_id,'completed',coalesce(p_occurred_at,now()),1,jsonb_build_object('completion_event_id',v_event_id),now())
  on conflict(student_id,task_id) do update set
    lifecycle='completed',
    completed_at=coalesce(public.student_task_execution_receipts.completed_at,excluded.completed_at),
    receipt=public.student_task_execution_receipts.receipt||excluded.receipt,
    updated_at=now();

  return v_event_id;
end;
$$;

revoke all on function public.student_apply_verified_completion(uuid,text,uuid,uuid,timestamptz) from public, anon, authenticated;

create or replace function public.student_completion_source_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_type text := TG_ARGV[0];
  v_source_id uuid;
  v_student_id uuid;
  v_subject_id uuid;
  v_qualifies boolean := false;
  v_at timestamptz := now();
begin
  if TG_TABLE_NAME='homework_submissions' then
    v_source_id := NEW.homework_id;
    v_student_id := NEW.student_id;
    v_qualifies := NEW.status='marked' or NEW.mark is not null;
    v_at := coalesce(NEW.feedback_released_at,NEW.reviewed_at,NEW.updated_at,now());
    select s.id into v_subject_id from public.homework h left join public.subjects s on lower(s.name)=lower(h.subject) and s.school_id=h.school_id where h.id=NEW.homework_id limit 1;
  elsif TG_TABLE_NAME='exercise_submissions' then
    v_source_id := NEW.exercise_id;
    v_student_id := NEW.student_id;
    v_qualifies := NEW.status='marked' or NEW.mark is not null;
    v_at := coalesce(NEW.submitted_at,NEW.created_at,now());
    select e.subject_id into v_subject_id from public.exercises e where e.id=NEW.exercise_id;
  elsif TG_TABLE_NAME='project_submissions' then
    v_source_id := NEW.project_id;
    v_student_id := NEW.student_id;
    v_qualifies := NEW.status='marked' or NEW.mark is not null;
    v_at := coalesce(NEW.submitted_at,NEW.created_at,now());
    select p.subject_id into v_subject_id from public.projects p where p.id=NEW.project_id;
  elsif TG_TABLE_NAME='assessment_attempts' then
    v_source_id := NEW.assignment_id;
    v_student_id := NEW.student_id;
    v_qualifies := NEW.result_status='released';
    v_at := coalesce(NEW.updated_at,NEW.teacher_reviewed_at,NEW.submitted_at,now());
    select ad.subject_id into v_subject_id from public.assessment_assignments aa join public.assessment_definitions ad on ad.id=aa.assessment_id where aa.id=NEW.assignment_id;
  end if;

  if v_qualifies then
    perform public.student_apply_verified_completion(v_student_id,v_source_type,v_source_id,v_subject_id,v_at);
  end if;
  return NEW;
end;
$$;

revoke all on function public.student_completion_source_trigger() from public, anon, authenticated;

drop trigger if exists trg_student_complete_homework on public.homework_submissions;
create trigger trg_student_complete_homework after insert or update of status,mark,feedback_released_at on public.homework_submissions for each row execute function public.student_completion_source_trigger('homework');

drop trigger if exists trg_student_complete_exercise on public.exercise_submissions;
create trigger trg_student_complete_exercise after insert or update of status,mark on public.exercise_submissions for each row execute function public.student_completion_source_trigger('exercise');

drop trigger if exists trg_student_complete_project on public.project_submissions;
create trigger trg_student_complete_project after insert or update of status,mark on public.project_submissions for each row execute function public.student_completion_source_trigger('project');

drop trigger if exists trg_student_complete_assessment on public.assessment_attempts;
create trigger trg_student_complete_assessment after insert or update of status,result_status,score on public.assessment_attempts for each row execute function public.student_completion_source_trigger('assessment');

create or replace function public.student_record_verified_task_completion(p_source_type text,p_source_id uuid,p_subject_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid:=auth.uid();
  learner public.students%rowtype;
  v_source_type text;
  v_event_before uuid;
  v_event_after uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into learner from public.students where profile_id=caller and deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  v_source_type := case when p_source_type in ('quiz','cat','exam','remedial') then 'assessment' else p_source_type end;
  if v_source_type not in ('homework','exercise','project','assessment','revision') then raise exception 'unsupported_source_type'; end if;

  if v_source_type='homework' and not exists(select 1 from public.homework_submissions hs where hs.homework_id=p_source_id and hs.student_id=learner.id and (hs.status='marked' or hs.mark is not null)) then raise exception 'completion_not_verified'; end if;
  if v_source_type='exercise' and not exists(select 1 from public.exercise_submissions es where es.exercise_id=p_source_id and es.student_id=learner.id and (es.status='marked' or es.mark is not null)) then raise exception 'completion_not_verified'; end if;
  if v_source_type='project' and not exists(select 1 from public.project_submissions ps where ps.project_id=p_source_id and ps.student_id=learner.id and (ps.status='marked' or ps.mark is not null)) then raise exception 'completion_not_verified'; end if;
  if v_source_type='assessment' and not exists(select 1 from public.assessment_attempts aa where aa.assignment_id=p_source_id and aa.student_id=learner.id and aa.result_status='released') then raise exception 'completion_not_verified'; end if;

  select id into v_event_before from public.student_learning_events where student_id=learner.id and event_type='task_completed' and source_type=v_source_type and source_id=p_source_id;
  v_event_after := public.student_apply_verified_completion(learner.id,v_source_type,p_source_id,p_subject_id,now());
  return public.student_refresh_motivation_summary() || jsonb_build_object('awarded',v_event_before is null and v_event_after is not null,'xp_awarded',case when v_event_before is null and v_event_after is not null then 20 else 0 end);
end;
$$;

revoke all on function public.student_record_verified_task_completion(text,uuid,uuid) from public, anon;
grant execute on function public.student_record_verified_task_completion(text,uuid,uuid) to authenticated;