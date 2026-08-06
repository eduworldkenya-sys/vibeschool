create or replace function public.student_get_home_os_brief()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  learner public.students%rowtype;
  task_feed jsonb;
  path jsonb;
  assessment_hub jsonb;
  tasks jsonb;
  next_task jsonb;
  urgent_count integer := 0;
  recent_changes jsonb := '[]'::jsonb;
  urgency jsonb;
  progress_context jsonb;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;

  select * into learner
  from public.students
  where profile_id = caller and deleted_at is null
  limit 1;

  if not found then
    raise exception 'learner_identity_not_found';
  end if;

  task_feed := public.student_list_my_tasks();
  path := public.student_refresh_personalized_path();
  assessment_hub := public.exq_get_learner_assessment_hub();
  tasks := coalesce(task_feed->'tasks', '[]'::jsonb);
  next_task := coalesce(path->'next_mission', path->'motivation'->'next_mission');

  select count(*) into urgent_count
  from jsonb_array_elements(tasks) t
  where coalesce(t->>'status','') in ('overdue','returned')
     or coalesce(t->>'priority','') = 'urgent';

  urgency := case
    when urgent_count > 0 then jsonb_build_object(
      'level','urgent',
      'headline',urgent_count::text || case when urgent_count = 1 then ' urgent item needs attention' else ' urgent items need attention' end,
      'message','Complete overdue or returned work first so nothing important is missed.'
    )
    when coalesce((task_feed->'counts'->>'in_progress')::integer,0) > 0 then jsonb_build_object(
      'level','attention',
      'headline','You have work in progress',
      'message','Resume the task you already started before opening something new.'
    )
    else jsonb_build_object(
      'level','clear',
      'headline','You are on track',
      'message','No overdue or returned work is waiting right now.'
    )
  end;

  with changes as (
    select jsonb_build_object(
      'id', x->>'id',
      'kind', case
        when x->>'event_type' = 'assessment_result' then 'result'
        when x->>'event_type' = 'homework_result' then 'feedback'
        when x->>'event_type' = 'task_completed' then 'completion'
        else 'update'
      end,
      'title', coalesce(nullif(x->>'title',''),'Learning update'),
      'summary', coalesce(x->>'summary',''),
      'occurred_at', x->>'occurred_at',
      'source_type', x->>'source_type',
      'source_id', x->>'source_id'
    ) as item,
    nullif(x->>'occurred_at','')::timestamptz as occurred_at
    from jsonb_array_elements(coalesce(path->'timeline','[]'::jsonb)) x
    where nullif(x->>'occurred_at','')::timestamptz >= now() - interval '14 days'
    union all
    select jsonb_build_object(
      'id', 'assessment:' || coalesce(r->>'attempt_id',''),
      'kind','result',
      'title', coalesce(nullif(r->>'assessment_title',''),'Assessment result'),
      'summary', case
        when nullif(r->>'percentage','') is not null then 'Score: ' || round((r->>'percentage')::numeric)::text || '%'
        else coalesce(r->>'feedback','')
      end,
      'occurred_at', r->>'released_at',
      'source_type','assessment',
      'source_id', r->>'attempt_id'
    ),
    nullif(r->>'released_at','')::timestamptz
    from jsonb_array_elements(coalesce(assessment_hub->'results','[]'::jsonb)) r
    where nullif(r->>'released_at','')::timestamptz >= now() - interval '14 days'
  ), dedup as (
    select distinct on (item->>'kind', item->>'source_type', item->>'source_id', item->>'occurred_at') item, occurred_at
    from changes
    order by item->>'kind', item->>'source_type', item->>'source_id', item->>'occurred_at', occurred_at desc
  )
  select coalesce(jsonb_agg(item order by occurred_at desc),'[]'::jsonb)
  into recent_changes
  from (select item, occurred_at from dedup order by occurred_at desc limit 8) q;

  progress_context := jsonb_build_object(
    'daily_goal', path->'motivation'->'daily_goal',
    'streak', path->'motivation'->'streak',
    'total_xp', path->'motivation'->'total_xp',
    'subject_progress', path->'motivation'->'subject_progress',
    'recommendations', path->'recommendations'
  );

  return jsonb_build_object(
    'ok', true,
    'student_id', learner.id,
    'generated_at', now(),
    'next_action', next_task,
    'urgency', urgency,
    'task_feed', task_feed,
    'recent_changes', recent_changes,
    'progress', progress_context,
    'timeline', path->'timeline',
    'assessment_hub', assessment_hub
  );
end;
$$;

revoke all on function public.student_get_home_os_brief() from public;
revoke all on function public.student_get_home_os_brief() from anon;
grant execute on function public.student_get_home_os_brief() to authenticated;
