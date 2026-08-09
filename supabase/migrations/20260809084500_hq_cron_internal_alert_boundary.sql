-- Keep the operational-alert helper internal so database Cron can execute
-- the autonomous HQ cycle without requiring an interactive owner JWT.

create or replace function public.hq_generate_operational_alerts()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_created integer := 0;
  v_backlog bigint;
  v_oldest timestamptz;
  v_today bigint;
  v_baseline numeric;
begin
  select count(*), min(submitted_at)
    into v_backlog, v_oldest
  from public.homework_submissions
  where reviewed_at is null;

  if v_backlog >= 50 and v_oldest < now() - interval '48 hours'
     and not exists (
       select 1 from public.hq_incidents
       where incident_type = 'homework_marking_backlog'
         and status <> 'resolved'
         and detected_at > now() - interval '12 hours'
     ) then
    insert into public.hq_incidents(incident_type,severity,title,summary,evidence,route)
    values ('homework_marking_backlog','warning','Homework marking backlog',
      v_backlog || ' submissions are unreviewed; the oldest is more than 48 hours old.',
      jsonb_build_object('unreviewed',v_backlog,'oldest_submitted_at',v_oldest), '/hq?view=homework');
    insert into public.hq_notifications(category,severity,title,body,route,metadata)
    values ('teaching','warning','Homework marking backlog',
      v_backlog || ' submissions currently await review.', '/hq?view=homework',
      jsonb_build_object('unreviewed',v_backlog,'oldest_submitted_at',v_oldest));
    v_created := v_created + 1;
  end if;

  select count(*) into v_today from public.lesson_plans where created_at >= date_trunc('day', now());
  select avg(day_count)::numeric into v_baseline
  from (
    select date(created_at) d, count(*) day_count
    from public.lesson_plans
    where created_at >= current_date - interval '28 days'
      and created_at < current_date
      and extract(isodow from created_at) = extract(isodow from now())
    group by date(created_at)
  ) s;

  if v_baseline is not null and v_baseline >= 5 and v_today < v_baseline * 0.35
     and localtime >= time '12:00'
     and not exists (
       select 1 from public.hq_notifications
       where metadata->>'rule' = 'lesson_plan_activity_drop'
         and created_at >= date_trunc('day', now())
     ) then
    insert into public.hq_notifications(category,severity,title,body,route,metadata)
    values ('teaching','warning','Lesson-plan activity unusually low',
      v_today || ' lesson plans today versus a same-weekday baseline of ' || round(v_baseline,1) || '.',
      '/hq?view=lesson-plans',
      jsonb_build_object('rule','lesson_plan_activity_drop','today',v_today,'baseline',round(v_baseline,1)));
    v_created := v_created + 1;
  end if;

  return v_created;
end;
$$;

revoke all on function public.hq_generate_operational_alerts() from public, anon, authenticated;
grant execute on function public.hq_generate_operational_alerts() to service_role;
