-- Worker Engine P0 gap remediation.
-- Closes the real current-architecture gaps without introducing the audit's
-- hypothetical worker_execution_queue / trigger_executions tables.
--
-- P0-A: durable approval escalation state is carried in hq_work_items.evidence
-- and surfaced through the existing HQ notification signal center.
-- P0-B: trigger cooldown/idempotency is an atomic database primitive.

create table if not exists public.hq_workforce_trigger_fires (
  trigger_key text not null,
  deduplication_key text not null,
  fired_at timestamptz not null default clock_timestamp(),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  primary key (trigger_key, deduplication_key)
);

create index if not exists hq_workforce_trigger_fires_latest_idx
  on public.hq_workforce_trigger_fires(trigger_key, fired_at desc);

alter table public.hq_workforce_trigger_fires enable row level security;
revoke all on table public.hq_workforce_trigger_fires from public,anon,authenticated,service_role;

create or replace function public.hq_workforce_claim_trigger(
  p_trigger_key text,
  p_deduplication_key text,
  p_cooldown_seconds integer default 0,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_last timestamptz;
  v_now timestamptz := clock_timestamp();
  v_cooldown interval;
  v_inserted integer := 0;
begin
  if nullif(btrim(p_trigger_key),'') is null then raise exception 'trigger_key_required'; end if;
  if nullif(btrim(p_deduplication_key),'') is null then raise exception 'deduplication_key_required'; end if;
  if coalesce(p_cooldown_seconds,0) < 0 then raise exception 'cooldown_seconds_invalid'; end if;

  v_cooldown := make_interval(secs => coalesce(p_cooldown_seconds,0));
  perform pg_advisory_xact_lock(hashtextextended('worker-trigger:' || p_trigger_key,0));

  select max(fired_at) into v_last
  from public.hq_workforce_trigger_fires
  where trigger_key=p_trigger_key;

  if v_last is not null and v_last + v_cooldown > v_now then return false; end if;

  insert into public.hq_workforce_trigger_fires(trigger_key,deduplication_key,fired_at,metadata)
  values(p_trigger_key,p_deduplication_key,v_now,coalesce(p_metadata,'{}'::jsonb))
  on conflict(trigger_key,deduplication_key) do nothing;

  get diagnostics v_inserted=row_count;
  return v_inserted=1;
end;
$$;

revoke all on function public.hq_workforce_claim_trigger(text,text,integer,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.hq_workforce_claim_trigger(text,text,integer,jsonb)
  to service_role;

create or replace function public.hq_workforce_escalate_waiting_approvals(
  p_after_hours numeric default 24
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r record;
  v_level integer;
  v_count integer := 0;
  v_fingerprint text;
begin
  if coalesce(p_after_hours,24) <= 0 then raise exception 'approval_escalation_window_invalid'; end if;

  for r in
    select id,department_key,priority,title,summary,created_at,due_at,evidence
    from public.hq_work_items
    where status='waiting_approval'
      and approval_required=true
      and created_at < clock_timestamp() - make_interval(hours => p_after_hours)
    order by case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
             created_at asc
  loop
    v_level := greatest(1,coalesce((r.evidence->>'approval_escalation_level')::integer,0)+1);

    update public.hq_work_items
    set evidence = coalesce(evidence,'{}'::jsonb) || jsonb_build_object(
      'approval_escalation_level',v_level,
      'approval_escalated_at',clock_timestamp(),
      'approval_escalation_reason','approval_required exceeded configured SLA',
      'approval_escalation_owner','founder'
    ), updated_at=clock_timestamp()
    where id=r.id;

    v_fingerprint := 'workforce:approval-escalation:' || r.id::text;
    perform public.hq_upsert_notification(
      v_fingerprint,
      'workforce',
      case when r.priority='critical' then 'critical' else 'warning' end,
      case when r.priority='critical' then 'critical' else 'action_required' end,
      'Approval is overdue: ' || r.title,
      coalesce(r.summary,'Work is waiting for human approval.') ||
        ' Approval has exceeded the ' || p_after_hours || '-hour SLA; escalation level ' || v_level || '.',
      '/hq', 'Review approval', 'hq_work_item', r.id::text,
      jsonb_build_object('work_item_id',r.id,'department',r.department_key,'priority',r.priority,
        'approval_escalation_level',v_level,'due_at',r.due_at,'created_at',r.created_at)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.hq_workforce_escalate_waiting_approvals(numeric)
  from public,anon,authenticated;
grant execute on function public.hq_workforce_escalate_waiting_approvals(numeric)
  to service_role;

-- Run alongside the existing internal HQ alert cycle. Do not create a second
-- worker scheduler or modify the established bounded-runtime scheduler.
do $block$
begin
  if not exists(select 1 from cron.job where jobname='worker-engine-approval-escalation') then
    perform cron.schedule(
      'worker-engine-approval-escalation',
      '0 * * * *',
      $job$select public.hq_workforce_escalate_waiting_approvals(24)$job$
    );
  end if;
end $block$;
