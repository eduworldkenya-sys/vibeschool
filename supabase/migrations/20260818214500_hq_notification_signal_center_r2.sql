-- HQ Notifications R2
-- Executive signal center: governed aggregation, deduplication, action classes, autonomous signal generation.
-- Research basis: actionable symptom-oriented alerting, high signal/noise, escalation only for consequential conditions.

begin;

alter table public.hq_notifications
  add column if not exists notification_class text not null default 'digest',
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists fingerprint text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists action_label text,
  add column if not exists acknowledged_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hq_notifications'::regclass
      and conname='hq_notifications_class_check'
  ) then
    alter table public.hq_notifications
      add constraint hq_notifications_class_check
      check (notification_class in ('digest','important','action_required','critical'));
  end if;
end $$;

update public.hq_notifications
set
  notification_class = case
    when severity='critical' then 'critical'
    when severity='warning' then 'action_required'
    when severity='success' then 'important'
    else 'digest'
  end,
  fingerprint = coalesce(fingerprint, 'legacy:' || id::text),
  first_seen_at = coalesce(first_seen_at, created_at),
  last_seen_at = coalesce(last_seen_at, created_at)
where fingerprint is null
   or notification_class = 'digest';

create index if not exists hq_notifications_class_status_idx
  on public.hq_notifications(notification_class,status,last_seen_at desc);
create index if not exists hq_notifications_fingerprint_idx
  on public.hq_notifications(fingerprint,status)
  where fingerprint is not null;

create or replace function public.hq_upsert_notification(
  p_fingerprint text,
  p_category text,
  p_severity text,
  p_notification_class text,
  p_title text,
  p_body text,
  p_route text default null,
  p_action_label text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(p_fingerprint),'') is null then
    raise exception 'notification fingerprint required' using errcode='22023';
  end if;
  if p_severity not in ('info','success','warning','critical') then
    raise exception 'invalid notification severity' using errcode='22023';
  end if;
  if p_notification_class not in ('digest','important','action_required','critical') then
    raise exception 'invalid notification class' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint,0));

  select id into v_id
  from public.hq_notifications
  where fingerprint=p_fingerprint
    and status <> 'resolved'
  order by created_at desc
  limit 1
  for update;

  if v_id is null then
    insert into public.hq_notifications(
      category,severity,notification_class,title,body,route,status,metadata,
      source_type,source_id,fingerprint,occurrence_count,first_seen_at,last_seen_at,
      action_label
    ) values (
      p_category,p_severity,p_notification_class,p_title,coalesce(p_body,''),p_route,'unread',
      coalesce(p_metadata,'{}'::jsonb),p_source_type,p_source_id,p_fingerprint,1,now(),now(),
      p_action_label
    )
    returning id into v_id;
  else
    update public.hq_notifications
    set
      category=p_category,
      severity=p_severity,
      notification_class=p_notification_class,
      title=p_title,
      body=coalesce(p_body,''),
      route=p_route,
      metadata=coalesce(metadata,'{}'::jsonb) || coalesce(p_metadata,'{}'::jsonb),
      source_type=coalesce(p_source_type,source_type),
      source_id=coalesce(p_source_id,source_id),
      action_label=coalesce(p_action_label,action_label),
      occurrence_count=occurrence_count+1,
      last_seen_at=now(),
      status=case when p_notification_class in ('critical','action_required') then 'unread' else status end
    where id=v_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.hq_upsert_notification(text,text,text,text,text,text,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.hq_upsert_notification(text,text,text,text,text,text,text,text,text,text,jsonb)
  to service_role;

create or replace function public.hq_emit_event(
  p_event_type text,
  p_actor_id uuid,
  p_actor_role text,
  p_school_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_event_id uuid;
  v_title text;
  v_body text;
  v_route text;
  v_action text;
  v_category text := 'operations';
  v_severity text := 'info';
  v_class text := 'digest';
  v_fingerprint text;
  v_notify boolean := true;
begin
  insert into public.platform_events(
    event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata
  ) values (
    p_event_type,p_actor_id,p_actor_role,p_school_id,p_entity_type,p_entity_id,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_event_id;

  case p_event_type
    when 'user.signup' then
      v_category:='growth';
      v_title:='New signups today';
      v_body:=coalesce(p_metadata->>'role','User') ||
        case when nullif(p_metadata->>'name','') is not null then ' · '||(p_metadata->>'name') else '' end;
      v_route:='/hq?view=users';
      v_action:='View users';
      v_class:='digest';
      v_fingerprint:='growth:user.signup:'||current_date::text;
    when 'school.created' then
      v_category:='growth';
      v_severity:='success';
      v_class:='important';
      v_title:='New school registered';
      v_body:=coalesce(p_metadata->>'name','A school joined VibeSchool');
      v_route:='/hq?view=schools';
      v_action:='View school';
      v_fingerprint:='growth:school.created:'||coalesce(p_entity_id::text,v_event_id::text);
    when 'lesson_plan.created' then
      v_notify:=false;
    when 'lesson_plan.published' then
      v_notify:=false;
    when 'lesson_plan.completed' then
      v_notify:=false;
    when 'homework.created' then
      v_notify:=false;
    when 'homework.submitted' then
      v_notify:=false;
    when 'publication.created' then
      v_notify:=false;
    when 'publication.published' then
      v_category:='content';
      v_severity:='success';
      v_class:='important';
      v_title:='Publication went live';
      v_body:=coalesce(p_metadata->>'title','Publication published');
      v_route:='/hq?view=content';
      v_action:='View content';
      v_fingerprint:='content:publication.published:'||coalesce(p_entity_id::text,v_event_id::text);
    else
      v_notify:=false;
  end case;

  if v_notify then
    perform public.hq_upsert_notification(
      v_fingerprint,v_category,v_severity,v_class,v_title,coalesce(v_body,''),
      v_route,v_action,'platform_event',v_event_id::text,
      coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('event_id',v_event_id,'event_type',p_event_type)
    );
  end if;

  return v_event_id;
end;
$$;
revoke all on function public.hq_emit_event(text,uuid,text,uuid,text,uuid,jsonb)
  from public,anon,authenticated;

create or replace function public.hq_generate_notification_signals()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_created integer:=0;
  v_count bigint;
  v_critical bigint;
  v_latest timestamptz;
  v_oldest timestamptz;
begin
  select count(*),
         count(*) filter(where severity='critical'),
         max(detected_at)
    into v_count,v_critical,v_latest
  from public.hq_incidents
  where status<>'resolved';

  if v_count>0 then
    perform public.hq_upsert_notification(
      'operations:open-incidents',
      'operations',
      case when v_critical>0 then 'critical' else 'warning' end,
      case when v_critical>0 then 'critical' else 'action_required' end,
      case when v_critical>0 then 'Critical incident requires attention' else 'Open operational incidents' end,
      v_count||' open incident'||case when v_count=1 then '' else 's' end||
        case when v_critical>0 then ' · '||v_critical||' critical' else '' end,
      '/hq',
      'Review incidents',
      'hq_incidents',
      null,
      jsonb_build_object('open_count',v_count,'critical_count',v_critical,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),max(created_at)
    into v_count,v_latest
  from public.hq_security_events
  where created_at>=now()-interval '1 hour'
    and (
      lower(coalesce(outcome,'')) not in ('','success','allowed','ok','passed')
      or lower(event_type) ~ '(denied|failed|blocked|violation|suspicious|unauthor)'
    );

  if v_count>0 then
    perform public.hq_upsert_notification(
      'security:exceptions',
      'security','critical','critical',
      'Security exception detected',
      v_count||' exceptional security event'||case when v_count=1 then '' else 's' end||' detected in the last hour.',
      '/hq',
      'Review security',
      'hq_security_events',
      null,
      jsonb_build_object('count_1h',v_count,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),
         count(*) filter(where severity='critical'),
         max(created_at)
    into v_count,v_critical,v_latest
  from public.hq_workforce_monitoring_alerts
  where status<>'resolved';

  if v_count>0 then
    perform public.hq_upsert_notification(
      'workforce:monitoring-alerts',
      'workforce',
      case when v_critical>0 then 'critical' else 'warning' end,
      case when v_critical>0 then 'critical' else 'action_required' end,
      'Worker Engine requires attention',
      v_count||' active workforce alert'||case when v_count=1 then '' else 's' end||
        case when v_critical>0 then ' · '||v_critical||' critical' else '' end,
      '/hq',
      'Open workforce',
      'hq_workforce_monitoring_alerts',
      null,
      jsonb_build_object('active_count',v_count,'critical_count',v_critical,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),max(created_at)
    into v_count,v_latest
  from public.hq_workforce_execution_breaker_events
  where created_at>=now()-interval '1 hour'
    and lower(event_kind) not in ('closed','reset','recovered');

  if v_count>0 then
    perform public.hq_upsert_notification(
      'workforce:breaker-events',
      'workforce','critical','critical',
      'Worker execution breaker triggered',
      v_count||' breaker event'||case when v_count=1 then '' else 's' end||' recorded in the last hour.',
      '/hq',
      'Inspect breaker',
      'hq_workforce_execution_breaker_events',
      null,
      jsonb_build_object('count_1h',v_count,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),max(created_at)
    into v_count,v_latest
  from public.hq_policy_failures
  where created_at>=now()-interval '1 hour';

  if v_count>0 then
    perform public.hq_upsert_notification(
      'governance:policy-failures',
      'governance','warning','action_required',
      'Governance policy failures detected',
      v_count||' policy failure'||case when v_count=1 then '' else 's' end||' recorded in the last hour.',
      '/hq',
      'Review failures',
      'hq_policy_failures',
      null,
      jsonb_build_object('count_1h',v_count,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),min(created_at)
    into v_count,v_oldest
  from public.hq_artifact_approvals
  where status in ('pending','requested','waiting');

  if v_count>0 then
    perform public.hq_upsert_notification(
      'governance:pending-approvals',
      'governance','warning','action_required',
      'HQ approval required',
      v_count||' approval'||case when v_count=1 then '' else 's' end||' waiting for a decision.',
      '/hq',
      'Review approvals',
      'hq_artifact_approvals',
      null,
      jsonb_build_object('pending_count',v_count,'oldest_at',v_oldest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),max(created_at)
    into v_count,v_latest
  from public.commerce_payment_attempts
  where created_at>=now()-interval '1 hour'
    and (
      processing_error is not null
      or lower(state) in ('failed','error','timed_out','timeout')
    );

  if v_count>0 then
    perform public.hq_upsert_notification(
      'finance:payment-failures',
      'finance','critical','critical',
      'Payment processing requires attention',
      v_count||' payment attempt'||case when v_count=1 then '' else 's' end||' failed or errored in the last hour.',
      '/hq',
      'Review payments',
      'commerce_payment_attempts',
      null,
      jsonb_build_object('count_1h',v_count,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),
         count(*) filter(where status='failed'),
         max(coalesce(completed_at,started_at))
    into v_count,v_critical,v_latest
  from public.content_engine_orchestration_runs
  where coalesce(completed_at,started_at)>=now()-interval '24 hours'
    and (
      status in ('failed','blocked')
      or (jsonb_typeof(blockers)='array' and jsonb_array_length(blockers)>0)
    );

  if v_count>0 then
    perform public.hq_upsert_notification(
      'content:factory-blockers',
      'content',
      case when v_critical>0 then 'warning' else 'info' end,
      case when v_critical>0 then 'action_required' else 'important' end,
      case when v_critical>0 then 'Content Factory has failed runs' else 'Content Factory blockers detected' end,
      v_count||' blocked/failed run'||case when v_count=1 then '' else 's' end||' in the last 24 hours'||
        case when v_critical>0 then ' · '||v_critical||' failed' else '' end||'.',
      '/hq?view=content',
      'Review content',
      'content_engine_orchestration_runs',
      null,
      jsonb_build_object('blocked_or_failed_24h',v_count,'failed_24h',v_critical,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),
         count(*) filter(where lower(severity) in ('critical','high')),
         max(last_detected_at)
    into v_count,v_critical,v_latest
  from public.curriculum_content_health_signals
  where status not in ('resolved','closed');

  if v_count>0 then
    perform public.hq_upsert_notification(
      'content:health-signals',
      'content',
      case when v_critical>0 then 'warning' else 'info' end,
      case when v_critical>0 then 'action_required' else 'important' end,
      'Content health signals need review',
      v_count||' open content-health signal'||case when v_count=1 then '' else 's' end||
        case when v_critical>0 then ' · '||v_critical||' high/critical' else '' end,
      '/hq?view=content',
      'Review health',
      'curriculum_content_health_signals',
      null,
      jsonb_build_object('open_count',v_count,'high_or_critical',v_critical,'latest_at',v_latest)
    );
    v_created:=v_created+1;
  end if;

  select count(*),min(created_at)
    into v_count,v_oldest
  from public.school_identity_review_queue
  where resolved_at is null;

  if v_count>0 then
    perform public.hq_upsert_notification(
      'schools:identity-review',
      'schools','warning','action_required',
      'School identity review required',
      v_count||' school identit'||case when v_count=1 then 'y' else 'ies' end||' waiting for review.',
      '/hq?view=schools',
      'Review schools',
      'school_identity_review_queue',
      null,
      jsonb_build_object('pending_count',v_count,'oldest_at',v_oldest)
    );
    v_created:=v_created+1;
  end if;

  return v_created;
end;
$$;
revoke all on function public.hq_generate_notification_signals() from public,anon,authenticated;
grant execute on function public.hq_generate_notification_signals() to service_role;

create or replace function public.hq_list_notifications(p_limit integer default 60)
returns table(
  id uuid,
  category text,
  severity text,
  notification_class text,
  title text,
  body text,
  route text,
  action_label text,
  status text,
  occurrence_count integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  acknowledged_at timestamptz,
  source_type text,
  source_id text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.hq_assert_owner();
  return query
  select
    n.id,n.category,n.severity,n.notification_class,n.title,n.body,n.route,n.action_label,
    n.status,n.occurrence_count,n.first_seen_at,n.last_seen_at,n.acknowledged_at,
    n.source_type,n.source_id,n.metadata,n.created_at
  from public.hq_notifications n
  order by
    case n.notification_class
      when 'critical' then 0
      when 'action_required' then 1
      when 'important' then 2
      else 3
    end,
    case when n.status='unread' then 0 else 1 end,
    n.last_seen_at desc
  limit greatest(1,least(coalesce(p_limit,60),200));
end;
$$;
revoke all on function public.hq_list_notifications(integer) from public,anon;
grant execute on function public.hq_list_notifications(integer) to authenticated;

create or replace function public.hq_acknowledge_notification(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.hq_assert_owner();
  update public.hq_notifications
  set
    status=case when status='unread' then 'read' else status end,
    read_at=coalesce(read_at,now()),
    acknowledged_at=coalesce(acknowledged_at,now())
  where id=p_id
    and status<>'resolved';
  return found;
end;
$$;
revoke all on function public.hq_acknowledge_notification(uuid) from public,anon;
grant execute on function public.hq_acknowledge_notification(uuid) to authenticated;

do $$
declare
  v_job record;
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    for v_job in select jobid from cron.job where jobname='hq-notification-signals-r2'
    loop
      perform cron.unschedule(v_job.jobid);
    end loop;
    perform cron.schedule(
      'hq-notification-signals-r2',
      '*/15 * * * *',
      'select public.hq_generate_notification_signals();'
    );
  end if;
end $$;

select public.hq_generate_notification_signals();

commit;
