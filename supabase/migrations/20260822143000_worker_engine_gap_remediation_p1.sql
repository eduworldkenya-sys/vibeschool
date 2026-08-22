-- Worker Engine P1 hardening.
-- Extends the existing workforce tables; no parallel execution system.

alter table public.hq_worker_messages
  drop constraint if exists hq_worker_messages_message_type_check;

alter table public.hq_worker_messages
  add constraint hq_worker_messages_message_type_check
  check (message_type in ('assign','request','consult','request_missing_data','review','escalate','approve','reject','inform','handoff','verify'));

alter table public.hq_worker_messages
  add column if not exists expires_at timestamptz;

create index if not exists hq_worker_messages_expiry_idx
  on public.hq_worker_messages(status, expires_at)
  where expires_at is not null;

create table if not exists public.hq_worker_fallback_admissions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.hq_workers(id) on delete cascade,
  work_item_id uuid references public.hq_work_items(id) on delete set null,
  workflow_key text not null,
  original_mode text not null check (original_mode in ('deterministic','local_ai','human','external_ai')),
  fallback_mode text not null check (fallback_mode in ('deterministic','local_ai','human','external_ai')),
  original_risk text not null check (original_risk in ('low','normal','high','critical')),
  fallback_risk text not null check (fallback_risk in ('low','normal','high','critical')),
  fallback_depth integer not null check (fallback_depth > 0),
  decision text not null check (decision in ('allow','approval_required','blocked')),
  reason text not null,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists hq_worker_fallback_admissions_worker_idx
  on public.hq_worker_fallback_admissions(worker_id, created_at desc);

alter table public.hq_worker_fallback_admissions enable row level security;
revoke all on table public.hq_worker_fallback_admissions from public,anon,authenticated,service_role;

create or replace function public.hq_workforce_record_fallback_admission(
  p_worker_id uuid,
  p_work_item_id uuid,
  p_workflow_key text,
  p_original_mode text,
  p_fallback_mode text,
  p_original_risk text,
  p_fallback_risk text,
  p_fallback_depth integer,
  p_require_approval_on_risk_increase boolean default true,
  p_max_fallback_depth integer default 1,
  p_allowed_fallback_modes text[] default null
) returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_decision text := 'allow';
  v_reason text := 'fallback_authorized';
  v_original_rank integer;
  v_fallback_rank integer;
begin
  if p_fallback_depth is null or p_fallback_depth < 1 then
    v_decision := 'blocked'; v_reason := 'fallback_depth_invalid';
  elsif p_fallback_depth > coalesce(p_max_fallback_depth,1) then
    v_decision := 'blocked'; v_reason := 'fallback_depth_exceeded';
  elsif p_allowed_fallback_modes is not null and not (p_fallback_mode = any(p_allowed_fallback_modes)) then
    v_decision := 'blocked'; v_reason := 'fallback_mode_not_allowed';
  else
    v_original_rank := case p_original_risk when 'low' then 0 when 'normal' then 1 when 'high' then 2 when 'critical' then 3 else 99 end;
    v_fallback_rank := case p_fallback_risk when 'low' then 0 when 'normal' then 1 when 'high' then 2 when 'critical' then 3 else 99 end;
    if v_fallback_rank > v_original_rank and coalesce(p_require_approval_on_risk_increase,true) then
      v_decision := 'approval_required'; v_reason := 'fallback_risk_increased';
    end if;
  end if;

  insert into public.hq_worker_fallback_admissions(
    worker_id,work_item_id,workflow_key,original_mode,fallback_mode,
    original_risk,fallback_risk,fallback_depth,decision,reason
  ) values (
    p_worker_id,p_work_item_id,p_workflow_key,p_original_mode,p_fallback_mode,
    p_original_risk,p_fallback_risk,p_fallback_depth,v_decision,v_reason
  );

  return v_decision;
end;
$$;

revoke all on function public.hq_workforce_record_fallback_admission(uuid,uuid,text,text,text,text,text,integer,boolean,integer,text[])
  from public,anon,authenticated,service_role;
grant execute on function public.hq_workforce_record_fallback_admission(uuid,uuid,text,text,text,text,text,integer,boolean,integer,text[])
  to service_role;

create or replace function public.hq_workforce_metric_is_fresh(
  p_worker_id uuid,
  p_metric_key text,
  p_max_age_seconds integer default 900
) returns boolean
language sql
security definer
set search_path=public,pg_temp
stable
as $$
  select exists (
    select 1
    from public.hq_worker_kpis k
    where k.worker_id = p_worker_id
      and k.metric_key = p_metric_key
      and k.current_value is not null
      and k.measured_at is not null
      and k.measured_at >= clock_timestamp() - make_interval(secs => greatest(0,coalesce(p_max_age_seconds,900)))
  );
$$;

revoke all on function public.hq_workforce_metric_is_fresh(uuid,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.hq_workforce_metric_is_fresh(uuid,text,integer)
  to service_role;

create or replace function public.hq_workforce_expire_stale_consultations()
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_count integer := 0;
begin
  update public.hq_worker_messages
  set status='failed'
  where status in ('pending','claimed')
    and expires_at is not null
    and expires_at < clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.hq_workforce_expire_stale_consultations() from public,anon,authenticated;
grant execute on function public.hq_workforce_expire_stale_consultations() to service_role;

do $block$
begin
  if not exists(select 1 from cron.job where jobname='worker-engine-consultation-expiry') then
    perform cron.schedule(
      'worker-engine-consultation-expiry',
      '*/15 * * * *',
      $job$select public.hq_workforce_expire_stale_consultations()$job$
    );
  end if;
end $block$;
