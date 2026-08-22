-- Worker Engine audit-gap runtime closure. NON-ACTIVATING.
-- Wires watchdog persistence, cooldown/dedupe state, fallback approval, context sanitization,
-- structured clarification, and approval escalation into service-only database contracts.
-- access: service-only public.hq_workforce_trigger_firings
-- authorization-test: public.hq_workforce_trigger_firings anon/authenticated denied; service_role only.
-- access: service-only public.hq_workforce_clarification_requests
-- authorization-test: public.hq_workforce_clarification_requests anon/authenticated denied; service_role only.
-- access: service-only public.hq_workforce_approval_requests
-- authorization-test: public.hq_workforce_approval_requests anon/authenticated denied; service_role only.

begin;

create table if not exists public.hq_workforce_trigger_firings (
  id bigint generated always as identity primary key,
  worker_key text not null,
  trigger_key text not null,
  dedupe_key text not null,
  fired_at timestamptz not null default clock_timestamp(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object')
);
create index if not exists hq_workforce_trigger_firings_lookup_idx
  on public.hq_workforce_trigger_firings(worker_key,trigger_key,dedupe_key,fired_at desc);
alter table public.hq_workforce_trigger_firings enable row level security;
revoke all on table public.hq_workforce_trigger_firings from public,anon,authenticated;
grant select,insert on table public.hq_workforce_trigger_firings to service_role;

create table if not exists public.hq_workforce_clarification_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  from_worker_key text not null,
  to_worker_key text not null,
  work_item_id uuid,
  question_key text not null check (char_length(btrim(question_key))>0),
  required_fields jsonb not null check (jsonb_typeof(required_fields)='array' and jsonb_array_length(required_fields)>0),
  reason text not null check (char_length(btrim(reason))>0),
  response_to_envelope_id text not null,
  status text not null default 'open' check(status in ('open','answered','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  answered_at timestamptz
);
alter table public.hq_workforce_clarification_requests enable row level security;
revoke all on table public.hq_workforce_clarification_requests from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_clarification_requests to service_role;

create table if not exists public.hq_workforce_approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  worker_key text not null,
  workflow_key text not null,
  request_kind text not null check(request_kind in ('authority','fallback')),
  requested_mode text,
  approval_role text not null,
  backup_approval_role text not null,
  final_escalation_role text not null,
  escalate_after_hours integer not null check(escalate_after_hours>0),
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'),
  requested_at timestamptz not null default clock_timestamp(),
  escalated_at timestamptz,
  escalation_level smallint not null default 0 check(escalation_level between 0 and 2),
  resolved_at timestamptz
);
create index if not exists hq_workforce_approval_requests_pending_idx
  on public.hq_workforce_approval_requests(status,requested_at) where status='pending';
alter table public.hq_workforce_approval_requests enable row level security;
revoke all on table public.hq_workforce_approval_requests from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_approval_requests to service_role;

create or replace function public.hq_workforce_claim_trigger(
  p_worker_key text,p_trigger_key text,p_dedupe_key text,
  p_cooldown_seconds integer default 3600,p_dedupe_window_seconds integer default 3600,
  p_details jsonb default '{}'::jsonb
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_last timestamptz;
begin
  if nullif(btrim(p_worker_key),'') is null or nullif(btrim(p_trigger_key),'') is null or nullif(btrim(p_dedupe_key),'') is null then raise exception 'trigger_identity_required'; end if;
  if p_cooldown_seconds<0 or p_dedupe_window_seconds<0 then raise exception 'trigger_window_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_worker_key||':'||p_trigger_key||':'||p_dedupe_key,0));
  select max(fired_at) into v_last from public.hq_workforce_trigger_firings
   where worker_key=p_worker_key and trigger_key=p_trigger_key and dedupe_key=p_dedupe_key;
  if v_last is not null and v_last > clock_timestamp()-make_interval(secs=>greatest(p_cooldown_seconds,p_dedupe_window_seconds)::double precision) then return false; end if;
  insert into public.hq_workforce_trigger_firings(worker_key,trigger_key,dedupe_key,details)
  values(p_worker_key,p_trigger_key,p_dedupe_key,coalesce(p_details,'{}'::jsonb));
  return true;
end $$;

create or replace function public.hq_workforce_sanitize_context(
  p_payload jsonb,p_classification text,p_maximum_classification text,p_forbidden_keys text[] default '{}'::text[]
) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare v_rank int; v_max_rank int; v_keys text[];
begin
  v_rank:=case p_classification when 'public' then 0 when 'internal' then 1 when 'confidential' then 2 when 'restricted' then 3 else null end;
  v_max_rank:=case p_maximum_classification when 'public' then 0 when 'internal' then 1 when 'confidential' then 2 when 'restricted' then 3 else null end;
  if v_rank is null or v_max_rank is null then raise exception 'context_classification_invalid'; end if;
  if v_rank>v_max_rank then raise exception 'context_classification_blocked'; end if;
  v_keys:=array(select distinct lower(x) from unnest(array['auth_token','auth_tokens','access_token','refresh_token','service_role','service_role_key','password','secret']||coalesce(p_forbidden_keys,'{}'::text[])) x);
  return public.hq_workforce_jsonb_strip_forbidden(coalesce(p_payload,'{}'::jsonb),v_keys);
end $$;

create or replace function public.hq_workforce_jsonb_strip_forbidden(p_value jsonb,p_forbidden_keys text[])
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare v_result jsonb; r record;
begin
  if jsonb_typeof(p_value)='object' then
    v_result:='{}'::jsonb;
    for r in select key,value from jsonb_each(p_value) loop
      if not (lower(r.key)=any(p_forbidden_keys)) then v_result:=v_result||jsonb_build_object(r.key,public.hq_workforce_jsonb_strip_forbidden(r.value,p_forbidden_keys)); end if;
    end loop;
    return v_result;
  elsif jsonb_typeof(p_value)='array' then
    select coalesce(jsonb_agg(public.hq_workforce_jsonb_strip_forbidden(value,p_forbidden_keys)),'[]'::jsonb) into v_result from jsonb_array_elements(p_value);
    return v_result;
  end if;
  return p_value;
end $$;

create or replace function public.hq_workforce_request_clarification(
  p_request_key text,p_from_worker_key text,p_to_worker_key text,p_work_item_id uuid,
  p_question_key text,p_required_fields jsonb,p_reason text,p_response_to_envelope_id text
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if jsonb_typeof(p_required_fields)<>'array' or jsonb_array_length(p_required_fields)=0 then raise exception 'structured_clarification_required_fields_missing'; end if;
  insert into public.hq_workforce_clarification_requests(request_key,from_worker_key,to_worker_key,work_item_id,question_key,required_fields,reason,response_to_envelope_id)
  values(p_request_key,p_from_worker_key,p_to_worker_key,p_work_item_id,p_question_key,p_required_fields,p_reason,p_response_to_envelope_id)
  on conflict(request_key) do update set reason=excluded.reason
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_request_approval(
  p_request_key text,p_worker_key text,p_workflow_key text,p_request_kind text,p_requested_mode text,
  p_approval_role text,p_backup_approval_role text,p_final_escalation_role text,p_escalate_after_hours integer,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_request_kind not in ('authority','fallback') then raise exception 'approval_request_kind_invalid'; end if;
  if p_escalate_after_hours<1 then raise exception 'approval_escalation_window_invalid'; end if;
  insert into public.hq_workforce_approval_requests(request_key,worker_key,workflow_key,request_kind,requested_mode,approval_role,backup_approval_role,final_escalation_role,escalate_after_hours,evidence)
  values(p_request_key,p_worker_key,p_workflow_key,p_request_kind,p_requested_mode,p_approval_role,p_backup_approval_role,p_final_escalation_role,p_escalate_after_hours,coalesce(p_evidence,'{}'::jsonb))
  on conflict(request_key) do update set evidence=public.hq_workforce_approval_requests.evidence||excluded.evidence
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_escalate_pending_approvals()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n int:=0; v_role text;
begin
  for r in select * from public.hq_workforce_approval_requests where status='pending' and escalation_level<2 and requested_at + make_interval(hours=>escalate_after_hours) <= clock_timestamp() for update skip locked loop
    v_role:=case when r.escalation_level=0 then r.backup_approval_role else r.final_escalation_role end;
    update public.hq_workforce_approval_requests set escalation_level=least(2,escalation_level+1),escalated_at=clock_timestamp(),approval_role=v_role where id=r.id;
    perform public.hq_upsert_notification('workforce:approval-escalation:'||r.id::text,'workforce','warning','action_required','Worker approval escalation required','A governed Worker Engine approval exceeded its response window.','/hq','Review approval','hq_workforce_approval_requests',r.id::text,jsonb_build_object('request_id',r.id,'worker_key',r.worker_key,'workflow_key',r.workflow_key,'approval_role',v_role));
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.hq_workforce_run_independent_watchdog(
  p_maximum_telemetry_age_seconds integer default 900,
  p_maximum_heartbeat_age_seconds integer default 900
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ec public.hq_workforce_engine_contract%rowtype; v_last_telemetry timestamptz; v_last_heartbeat timestamptz; v_expect_telemetry boolean; v_expect_heartbeat boolean; v_findings jsonb:='[]'::jsonb;
begin
  if p_maximum_telemetry_age_seconds<60 or p_maximum_heartbeat_age_seconds<60 then raise exception 'watchdog_threshold_too_small'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  v_expect_heartbeat:=ec.heartbeat_enabled;
  v_expect_telemetry:=ec.runtime_execution_enabled or ec.heartbeat_enabled or (ec.shadow_enabled and ec.shadow_scheduler_enabled and not ec.shadow_global_stop);
  select max(recorded_at) into v_last_telemetry from public.hq_workforce_health_events;
  select max(coalesce(completed_at,started_at)) into v_last_heartbeat from public.hq_workforce_heartbeat_runs;

  if v_expect_telemetry and (v_last_telemetry is null or v_last_telemetry < clock_timestamp()-make_interval(secs=>p_maximum_telemetry_age_seconds::double precision)) then
    insert into public.hq_workforce_monitoring_alerts(alert_key,alert_type,severity,subject_type,subject_key,details)
    values('independent-watchdog-telemetry','TELEMETRY_STALE','critical','engine','worker-engine',jsonb_build_object('last_telemetry_at',v_last_telemetry,'maximum_age_seconds',p_maximum_telemetry_age_seconds))
    on conflict(alert_key) do update set alert_type=excluded.alert_type,severity='critical',details=excluded.details,status='open',resolved_at=null;
    v_findings:=v_findings||jsonb_build_array('TELEMETRY_STALE');
  else
    update public.hq_workforce_monitoring_alerts set status='resolved',resolved_at=clock_timestamp() where alert_key='independent-watchdog-telemetry' and status<>'resolved';
  end if;

  if v_expect_heartbeat and (v_last_heartbeat is null or v_last_heartbeat < clock_timestamp()-make_interval(secs=>p_maximum_heartbeat_age_seconds::double precision)) then
    insert into public.hq_workforce_monitoring_alerts(alert_key,alert_type,severity,subject_type,subject_key,details)
    values('independent-watchdog-heartbeat','WORKER_HEARTBEAT_STALE','critical','engine','worker-engine',jsonb_build_object('last_heartbeat_at',v_last_heartbeat,'maximum_age_seconds',p_maximum_heartbeat_age_seconds))
    on conflict(alert_key) do update set alert_type=excluded.alert_type,severity='critical',details=excluded.details,status='open',resolved_at=null;
    v_findings:=v_findings||jsonb_build_array('WORKER_HEARTBEAT_STALE');
  else
    update public.hq_workforce_monitoring_alerts set status='resolved',resolved_at=clock_timestamp() where alert_key='independent-watchdog-heartbeat' and status<>'resolved';
  end if;

  perform public.hq_generate_notification_signals();
  return jsonb_build_object('status','evaluated','expected_telemetry',v_expect_telemetry,'expected_heartbeat',v_expect_heartbeat,'last_telemetry_at',v_last_telemetry,'last_heartbeat_at',v_last_heartbeat,'findings',v_findings);
end $$;

revoke all on function public.hq_workforce_claim_trigger(text,text,text,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function public.hq_workforce_sanitize_context(jsonb,text,text,text[]) from public,anon,authenticated;
revoke all on function public.hq_workforce_jsonb_strip_forbidden(jsonb,text[]) from public,anon,authenticated;
revoke all on function public.hq_workforce_request_clarification(text,text,text,uuid,text,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_request_approval(text,text,text,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.hq_workforce_escalate_pending_approvals() from public,anon,authenticated;
revoke all on function public.hq_workforce_run_independent_watchdog(integer,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_claim_trigger(text,text,text,integer,integer,jsonb),public.hq_workforce_sanitize_context(jsonb,text,text,text[]),public.hq_workforce_jsonb_strip_forbidden(jsonb,text[]),public.hq_workforce_request_clarification(text,text,text,uuid,text,jsonb,text,text),public.hq_workforce_request_approval(text,text,text,text,text,text,text,text,integer,jsonb),public.hq_workforce_escalate_pending_approvals(),public.hq_workforce_run_independent_watchdog(integer,integer) to service_role;

commit;
