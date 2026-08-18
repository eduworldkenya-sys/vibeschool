-- HQ Signal Center R3 — founder operations
-- Adds SLA/ownership, workroom escalation, opportunity detection, founder brief,
-- feedback learning and a service-only external-delivery outbox.
-- access: service-only public.hq_notification_delivery_outbox
-- authorization-test: public.hq_notification_delivery_outbox

begin;

alter table public.hq_notifications
  add column if not exists owner_department text,
  add column if not exists due_at timestamptz,
  add column if not exists escalation_level integer not null default 0,
  add column if not exists escalated_at timestamptz,
  add column if not exists work_item_id uuid references public.hq_work_items(id) on delete set null,
  add column if not exists feedback text,
  add column if not exists feedback_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hq_notifications'::regclass
      and conname='hq_notifications_feedback_check'
  ) then
    alter table public.hq_notifications
      add constraint hq_notifications_feedback_check
      check (feedback is null or feedback in ('useful','noise'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hq_notifications'::regclass
      and conname='hq_notifications_escalation_level_check'
  ) then
    alter table public.hq_notifications
      add constraint hq_notifications_escalation_level_check
      check (escalation_level between 0 and 3);
  end if;
end $$;

create index if not exists hq_notifications_due_idx
  on public.hq_notifications(status,due_at)
  where status <> 'resolved' and due_at is not null;
create index if not exists hq_notifications_work_item_idx
  on public.hq_notifications(work_item_id)
  where work_item_id is not null;

create table if not exists public.hq_notification_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.hq_notifications(id) on delete cascade,
  channel text not null check (channel in ('push','email','sms','whatsapp')),
  status text not null default 'queued' check (status in ('queued','sent','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  unique(dedupe_key)
);
alter table public.hq_notification_delivery_outbox enable row level security;
revoke all on table public.hq_notification_delivery_outbox from public,anon,authenticated;
grant all on table public.hq_notification_delivery_outbox to service_role;
comment on table public.hq_notification_delivery_outbox is
  'Service-only delivery requests. Queued does not mean delivered; adapters must record sent/failed evidence.';

create or replace function public.hq_notification_department(p_category text)
returns text language sql immutable set search_path=public as $$
  select case lower(coalesce(p_category,''))
    when 'security' then 'security_identity'
    when 'finance' then 'finance'
    when 'content' then 'content'
    when 'growth' then 'growth'
    when 'schools' then 'partnerships'
    when 'workforce' then 'engineering'
    when 'governance' then 'executive'
    when 'operations' then 'executive'
    else 'executive'
  end
$$;

create or replace function public.hq_notification_sla_minutes(p_class text)
returns integer language sql immutable as $$
  select case p_class
    when 'critical' then 15
    when 'action_required' then 240
    when 'important' then 1440
    else null
  end
$$;

-- Replace the R2 upsert so new signals receive owner/SLA metadata and prior noise
-- feedback can demote only non-actionable Important signals. Critical and Action
-- Required signals are never automatically suppressed or downgraded.
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
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_changed boolean;
  v_class text := p_notification_class;
  v_department text;
  v_sla integer;
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

  if p_notification_class='important' and exists(
    select 1 from public.hq_notifications
    where fingerprint=p_fingerprint and feedback='noise'
      and feedback_at>=now()-interval '30 days'
  ) then
    v_class := 'digest';
  end if;

  v_department := public.hq_notification_department(p_category);
  v_sla := public.hq_notification_sla_minutes(v_class);
  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint,0));

  select id into v_id
  from public.hq_notifications
  where fingerprint=p_fingerprint and status<>'resolved'
  order by created_at desc limit 1 for update;

  if v_id is null then
    insert into public.hq_notifications(
      category,severity,notification_class,title,body,route,status,metadata,
      source_type,source_id,fingerprint,occurrence_count,first_seen_at,last_seen_at,
      action_label,owner_department,due_at
    ) values (
      p_category,p_severity,v_class,p_title,coalesce(p_body,''),p_route,'unread',
      coalesce(p_metadata,'{}'::jsonb),p_source_type,p_source_id,p_fingerprint,1,now(),now(),
      p_action_label,v_department,case when v_sla is null then null else now()+make_interval(mins=>v_sla) end
    ) returning id into v_id;
  else
    select coalesce(metadata,'{}'::jsonb) is distinct from coalesce(p_metadata,'{}'::jsonb)
      into v_changed from public.hq_notifications where id=v_id;
    update public.hq_notifications
    set category=p_category,severity=p_severity,notification_class=v_class,title=p_title,
        body=coalesce(p_body,''),route=p_route,
        source_type=coalesce(p_source_type,source_type),source_id=coalesce(p_source_id,source_id),
        action_label=coalesce(p_action_label,action_label),owner_department=v_department,
        occurrence_count=occurrence_count+case when v_changed then 1 else 0 end,
        last_seen_at=case when v_changed then now() else last_seen_at end,
        status=case when v_changed and v_class in ('critical','action_required') then 'unread' else status end,
        due_at=case when v_changed and v_sla is not null then now()+make_interval(mins=>v_sla) else due_at end,
        metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb)
    where id=v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.hq_upsert_notification(text,text,text,text,text,text,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.hq_upsert_notification(text,text,text,text,text,text,text,text,text,text,jsonb)
  to service_role;

create or replace function public.hq_ensure_notification_work_item(p_notification_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare n public.hq_notifications%rowtype; v_id uuid; v_priority text;
begin
  select * into n from public.hq_notifications where id=p_notification_id for update;
  if n.id is null then raise exception 'Notification not found'; end if;
  if n.work_item_id is not null then return n.work_item_id; end if;
  if n.notification_class not in ('critical','action_required') then return null; end if;

  v_priority := case when n.notification_class='critical' then 'critical' else 'high' end;
  insert into public.hq_work_items(
    department_key,work_type,priority,status,title,summary,source_type,source_id,route,
    approval_required,due_at,evidence
  ) values (
    coalesce(n.owner_department,public.hq_notification_department(n.category)),
    'signal_response',v_priority,'open',n.title,n.body,'hq_notification',n.id,n.route,false,n.due_at,
    jsonb_build_object('notification_id',n.id,'fingerprint',n.fingerprint,'class',n.notification_class,'source_type',n.source_type,'source_id',n.source_id)
  ) returning id into v_id;

  update public.hq_notifications set work_item_id=v_id where id=n.id;
  insert into public.hq_work_item_updates(work_item_id,update_type,body,metadata)
  values(v_id,'system','Created automatically from an HQ Signal Center escalation.',jsonb_build_object('notification_id',n.id));
  return v_id;
end;
$$;
revoke all on function public.hq_ensure_notification_work_item(uuid) from public,anon,authenticated;
grant execute on function public.hq_ensure_notification_work_item(uuid) to service_role;

create or replace function public.hq_process_notification_escalations()
returns integer language plpgsql security definer set search_path=public as $$
declare n record; v_changed integer:=0; v_work uuid;
begin
  for n in
    select id,notification_class,status,acknowledged_at,due_at,escalation_level,title,body,route,category,fingerprint
    from public.hq_notifications
    where status<>'resolved' and notification_class in ('critical','action_required')
      and due_at is not null and due_at<=now()
    order by due_at
    for update skip locked
  loop
    v_work := public.hq_ensure_notification_work_item(n.id);
    if n.escalation_level=0 then
      update public.hq_notifications set escalation_level=1,escalated_at=now() where id=n.id;
      v_changed:=v_changed+1;
    elsif n.notification_class='critical' and n.acknowledged_at is null and n.escalation_level<2
      and n.due_at<=now()-interval '15 minutes' then
      update public.hq_notifications set escalation_level=2,escalated_at=now() where id=n.id;
      insert into public.hq_notification_delivery_outbox(notification_id,channel,payload,dedupe_key)
      values(n.id,'push',jsonb_build_object('title',n.title,'body',n.body,'route',n.route,'class','critical'),n.id::text||':push:l2')
      on conflict(dedupe_key) do nothing;
      v_changed:=v_changed+1;
    end if;
  end loop;
  return v_changed;
end;
$$;
revoke all on function public.hq_process_notification_escalations() from public,anon,authenticated;
grant execute on function public.hq_process_notification_escalations() to service_role;

create or replace function public.hq_detect_founder_opportunities()
returns integer language plpgsql security definer set search_path=public as $$
declare v_today bigint; v_baseline numeric; v_id uuid; r record; v_count integer:=0;
begin
  select count(*) into v_today from public.profiles where created_at>=date_trunc('day',now());
  select greatest(1,count(*)::numeric/7) into v_baseline
  from public.profiles
  where created_at>=date_trunc('day',now())-interval '7 days'
    and created_at<date_trunc('day',now());

  if v_today>=10 and v_today>=v_baseline*2 then
    perform public.hq_upsert_notification(
      'opportunity:signup-momentum:'||current_date::text,'growth','success','important',
      'Signup momentum is unusually strong',
      v_today||' users joined today versus a recent daily baseline of '||round(v_baseline,1)||'.',
      '/hq?view=users','Inspect growth','profiles',null,
      jsonb_build_object('opportunity_type','signup_momentum','today',v_today,'baseline',v_baseline)
    );
    v_count:=v_count+1;
  end if;

  for r in
    select p.school_id,s.name,count(*) as new_users
    from public.profiles p join public.schools s on s.id=p.school_id
    where p.school_id is not null and p.created_at>=now()-interval '7 days' and s.deleted_at is null
    group by p.school_id,s.name having count(*)>=5
    order by count(*) desc limit 10
  loop
    perform public.hq_upsert_notification(
      'opportunity:school-momentum:'||r.school_id::text||':'||date_trunc('week',now())::date::text,
      'growth','success','important','School adoption opportunity',
      r.new_users||' new users from '||r.name||' joined in the last 7 days.',
      '/hq?view=schools','Review school','schools',r.school_id::text,
      jsonb_build_object('opportunity_type','school_momentum','school_id',r.school_id,'school_name',r.name,'new_users_7d',r.new_users)
    );
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.hq_detect_founder_opportunities() from public,anon,authenticated;
grant execute on function public.hq_detect_founder_opportunities() to service_role;

create or replace function public.hq_get_founder_brief()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; v_today bigint; v_previous bigint;
begin
  perform public.hq_assert_owner();
  select count(*) into v_today from public.profiles where created_at>=date_trunc('day',now());
  select count(*) into v_previous from public.profiles where created_at>=date_trunc('day',now())-interval '1 day' and created_at<date_trunc('day',now());
  select jsonb_build_object(
    'generated_at',now(),
    'headline',jsonb_build_object(
      'new_users_today',v_today,
      'new_users_yesterday',v_previous,
      'active_critical',(select count(*) from public.hq_notifications where status<>'resolved' and notification_class='critical'),
      'action_required',(select count(*) from public.hq_notifications where status<>'resolved' and notification_class='action_required'),
      'overdue',(select count(*) from public.hq_notifications where status<>'resolved' and due_at<now()),
      'opportunities',(select count(*) from public.hq_notifications where status<>'resolved' and metadata->>'opportunity_type' is not null),
      'open_incidents',(select count(*) from public.hq_incidents where status<>'resolved'),
      'payment_failures_24h',(select count(*) from public.commerce_payment_attempts where created_at>=now()-interval '24 hours' and (processing_error is not null or lower(state) in ('failed','error','timed_out','timeout')))
    ),
    'priorities',coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id',id,'class',notification_class,'category',category,'title',title,'body',body,'route',route,'due_at',due_at,'owner_department',owner_department,'work_item_id',work_item_id) x
      from public.hq_notifications where status<>'resolved' and notification_class in ('critical','action_required')
      order by case notification_class when 'critical' then 0 else 1 end,due_at nulls last,last_seen_at desc limit 8
    ) q),'[]'::jsonb),
    'opportunities',coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('id',id,'title',title,'body',body,'route',route,'metadata',metadata) x
      from public.hq_notifications where status<>'resolved' and metadata->>'opportunity_type' is not null
      order by last_seen_at desc limit 6
    ) q),'[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.hq_get_founder_brief() from public,anon;
grant execute on function public.hq_get_founder_brief() to authenticated;

create or replace function public.hq_set_notification_feedback(p_id uuid,p_feedback text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform public.hq_assert_owner();
  if p_feedback not in ('useful','noise') then raise exception 'Invalid feedback'; end if;
  update public.hq_notifications set feedback=p_feedback,feedback_at=now() where id=p_id;
  return found;
end;
$$;
revoke all on function public.hq_set_notification_feedback(uuid,text) from public,anon;
grant execute on function public.hq_set_notification_feedback(uuid,text) to authenticated;

create or replace function public.hq_open_notification_workroom(p_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
  perform public.hq_assert_owner();
  select work_item_id into v from public.hq_notifications where id=p_id;
  if v is null then
    -- owner calls the internal helper through this explicitly owner-gated facade
    v := public.hq_ensure_notification_work_item(p_id);
  end if;
  return v;
end;
$$;
revoke all on function public.hq_open_notification_workroom(uuid) from public,anon;
grant execute on function public.hq_open_notification_workroom(uuid) to authenticated;

-- Expand the owner reader contract with founder-ops fields.
drop function if exists public.hq_list_notifications(integer);
create function public.hq_list_notifications(p_limit integer default 60)
returns table(
  id uuid,category text,severity text,notification_class text,title text,body text,route text,action_label text,
  status text,occurrence_count integer,first_seen_at timestamptz,last_seen_at timestamptz,acknowledged_at timestamptz,
  source_type text,source_id text,metadata jsonb,owner_department text,due_at timestamptz,escalation_level integer,
  escalated_at timestamptz,work_item_id uuid,feedback text,feedback_at timestamptz,created_at timestamptz
) language plpgsql security definer set search_path=public as $$
begin
  perform public.hq_assert_owner();
  return query select n.id,n.category,n.severity,n.notification_class,n.title,n.body,n.route,n.action_label,
    n.status,n.occurrence_count,n.first_seen_at,n.last_seen_at,n.acknowledged_at,n.source_type,n.source_id,n.metadata,
    n.owner_department,n.due_at,n.escalation_level,n.escalated_at,n.work_item_id,n.feedback,n.feedback_at,n.created_at
  from public.hq_notifications n
  order by case when n.status='resolved' then 1 else 0 end,
    case n.notification_class when 'critical' then 0 when 'action_required' then 1 when 'important' then 2 else 3 end,
    case when n.due_at is not null and n.due_at<now() then 0 else 1 end,
    case when n.status='unread' then 0 else 1 end,n.last_seen_at desc
  limit greatest(1,least(coalesce(p_limit,60),250));
end;
$$;
revoke all on function public.hq_list_notifications(integer) from public,anon;
grant execute on function public.hq_list_notifications(integer) to authenticated;

-- Backfill owner/SLA for active R2/legacy signals.
update public.hq_notifications
set owner_department=coalesce(owner_department,public.hq_notification_department(category)),
    due_at=coalesce(due_at,case when public.hq_notification_sla_minutes(notification_class) is null then null else last_seen_at+make_interval(mins=>public.hq_notification_sla_minutes(notification_class)) end)
where status<>'resolved';

-- Compact legacy signup noise into a single daily digest per UTC day, preserving rows as resolved history.
do $$
declare d date; c bigint; v_first timestamptz; v_last timestamptz;
begin
  for d in select distinct created_at::date from public.hq_notifications where title='New signup' and category='growth' and fingerprint like 'legacy:%'
  loop
    select count(*),min(created_at),max(created_at) into c,v_first,v_last
    from public.hq_notifications where title='New signup' and category='growth' and fingerprint like 'legacy:%' and created_at::date=d;
    if c>1 then
      perform public.hq_upsert_notification('growth:legacy-signups:'||d::text,'growth','info','digest','Signups · '||d::text,c||' users joined VibeSchool.','/hq?view=users','View users','legacy_signup_compaction',null,jsonb_build_object('signup_count',c,'date',d));
      update public.hq_notifications set status='resolved',read_at=coalesce(read_at,now()),resolved_at=coalesce(resolved_at,now())
      where title='New signup' and category='growth' and fingerprint like 'legacy:%' and created_at::date=d;
    end if;
  end loop;
end $$;

do $$ declare j record; begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    for j in select jobid from cron.job where jobname in ('hq-signal-escalations-r3','hq-founder-opportunities-r3') loop perform cron.unschedule(j.jobid); end loop;
    perform cron.schedule('hq-signal-escalations-r3','*/5 * * * *','select public.hq_process_notification_escalations();');
    perform cron.schedule('hq-founder-opportunities-r3','7 * * * *','select public.hq_detect_founder_opportunities();');
  end if;
end $$;

select public.hq_detect_founder_opportunities();
select public.hq_process_notification_escalations();

commit;
