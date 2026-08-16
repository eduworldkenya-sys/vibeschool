-- Worker Engine production-readiness hardening: event-driven consequential execution alerts.
-- NON-ACTIVATING. Alert creation is evidence-only and grants no execution authority.

create or replace function public.hq_workforce_emit_execution_alert()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_task_id uuid;
  v_intent_id uuid;
  v_execution_id uuid;
  v_type text;
  v_severity text;
  v_subject text;
  v_details jsonb;
begin
  if tg_table_name='hq_workforce_execution_verifications' then
    if new.passed then return new; end if;
    v_task_id:=new.task_id; v_intent_id:=new.intent_id;
    v_type:='EXECUTION_VERIFICATION_FAILED'; v_severity:='critical'; v_subject:=new.id::text;
    v_details:=jsonb_build_object('verification_id',new.id,'intent_id',new.intent_id,'verifier_key',new.verifier_key,'expected',new.expected_outcome,'observed',new.observed_outcome);
  elsif tg_table_name='hq_workforce_execution_compensations' then
    if new.outcome='compensated' then return new; end if;
    v_task_id:=new.task_id; v_intent_id:=new.intent_id;
    v_type:=case when new.outcome='conflict_escalated' then 'EXECUTION_COMPENSATION_CONFLICT' else 'EXECUTION_COMPENSATION_DENIED' end;
    v_severity:='critical'; v_subject:=new.id::text;
    v_details:=jsonb_build_object('compensation_id',new.id,'intent_id',new.intent_id,'outcome',new.outcome,'evidence',new.evidence);
  elsif tg_table_name='hq_workforce_execution_escalations' then
    v_task_id:=new.task_id; v_intent_id:=new.intent_id;
    v_type:='EXECUTION_ESCALATION_CREATED'; v_severity:='critical'; v_subject:=new.id::text;
    v_details:=jsonb_build_object('escalation_id',new.id,'intent_id',new.intent_id,'category',new.category,'reason_code',new.reason_code,'human_intervention_required',new.human_intervention_required);
  elsif tg_table_name='hq_workforce_execution_breaker_events' then
    if new.event_kind not in ('tripped','execution_blocked') then return new; end if;
    v_task_id:=new.task_id;
    select id into v_intent_id from public.hq_workforce_execution_intents where task_id=new.task_id;
    v_type:=case when new.event_kind='tripped' then 'EXECUTION_BREAKER_TRIPPED' else 'EXECUTION_BLOCKED_BY_BREAKER' end;
    v_severity:=case when new.event_kind='tripped' then 'critical' else 'high' end; v_subject:=new.id::text;
    v_details:=jsonb_build_object('breaker_event_id',new.id,'breaker_id',new.breaker_id,'event_kind',new.event_kind,'reason_code',new.reason_code,'evidence',new.evidence);
  else
    return new;
  end if;

  if v_task_id is not null then
    select id into v_execution_id from public.hq_workforce_execution_envelopes where task_id=v_task_id;
  end if;
  v_details:=coalesce(v_details,'{}'::jsonb)||jsonb_build_object('execution_id',v_execution_id,'task_id',v_task_id,'intent_id',v_intent_id);

  insert into public.hq_workforce_monitoring_alerts(alert_key,alert_type,severity,subject_type,subject_key,details)
  values('we-r1-4-'||lower(v_type)||'-'||v_subject,v_type,v_severity,'execution',coalesce(v_execution_id::text,v_subject),v_details)
  on conflict(alert_key) do nothing;
  return new;
end $$;

revoke all on function public.hq_workforce_emit_execution_alert() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_alert_verification on public.hq_workforce_execution_verifications;
create trigger trg_hq_workforce_alert_verification
after insert on public.hq_workforce_execution_verifications
for each row execute function public.hq_workforce_emit_execution_alert();

drop trigger if exists trg_hq_workforce_alert_compensation on public.hq_workforce_execution_compensations;
create trigger trg_hq_workforce_alert_compensation
after insert on public.hq_workforce_execution_compensations
for each row execute function public.hq_workforce_emit_execution_alert();

drop trigger if exists trg_hq_workforce_alert_escalation on public.hq_workforce_execution_escalations;
create trigger trg_hq_workforce_alert_escalation
after insert on public.hq_workforce_execution_escalations
for each row execute function public.hq_workforce_emit_execution_alert();

drop trigger if exists trg_hq_workforce_alert_breaker on public.hq_workforce_execution_breaker_events;
create trigger trg_hq_workforce_alert_breaker
after insert on public.hq_workforce_execution_breaker_events
for each row execute function public.hq_workforce_emit_execution_alert();

-- No runtime activation is permitted as a side effect of observability.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) then
    raise exception 'execution alert migration changed runtime boundary';
  end if;
end $$;
