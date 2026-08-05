create or replace function public.student_list_my_tasks()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
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
           when hs.status='submitted' then 'awaiting_marking'
           when h.due_date<current_date then 'overdue'
           else 'ready' end as status,
      '/student/homework/'||h.id::text as action_url,
      case when hs.mark is not null or hs.status='marked' then 'View feedback'
           when hs.status='returned' then 'Revise and resubmit'
           when hs.status='submitted' then 'Submitted'
           else 'Start homework' end as action_label,
      hs.mark::numeric as score,
      null::numeric as max_score,
      hs.feedback,
      case when hs.status in ('submitted','marked') or hs.mark is not null then 100 else 0 end as progress
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
           when at.status in ('submitted','auto_marked','teacher_review','marked') then 'awaiting_marking'
           when at.status='in_progress' then 'in_progress'
           when aa.opens_at>now() then 'upcoming'
           when aa.closes_at<=now() and at.id is null then 'closed'
           when aa.closes_at<now() then 'overdue'
           else 'ready' end,
      '/student/assessment/'||aa.id::text,
      case when at.result_status='released' then 'View result'
           when at.status in ('submitted','auto_marked','teacher_review','marked') then 'Awaiting marking'
           when at.status='in_progress' then 'Continue assessment'
           when aa.opens_at>now() then 'Opens soon'
           when aa.closes_at<=now() then 'Closed'
           else 'Start assessment' end,
      case when aa.show_score_policy='immediate' or at.result_status='released' then at.score else null end,
      case when aa.show_score_policy='immediate' or at.result_status='released' then at.max_score else null end,
      case when at.result_status='released' then at.feedback else null end,
      case when at.result_status='released' or at.status in ('submitted','auto_marked','teacher_review','marked') then 100
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
           when es.status='submitted' then 'awaiting_marking' else 'ready' end,
      '/student/exercises',
      case when es.mark is not null or es.status='marked' then 'View feedback'
           when es.status='submitted' then 'Submitted' else 'Open exercise' end,
      es.mark,e.max_score,es.feedback,
      case when es.status in ('submitted','marked') or es.mark is not null then 100 else 0 end
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
           when p.start_date>current_date then 'upcoming'
           when p.due_date<current_date then 'overdue' else 'ready' end,
      '/student/projects',
      case when ps.mark is not null or ps.status='marked' then 'View feedback'
           when ps.status='submitted' then 'Submitted' else 'Open project' end,
      ps.mark,null::numeric,ps.feedback,
      case when ps.status in ('submitted','marked') or ps.mark is not null then 100 else 0 end
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

revoke all on function public.student_list_my_tasks() from public,anon;
grant execute on function public.student_list_my_tasks() to authenticated,service_role;
