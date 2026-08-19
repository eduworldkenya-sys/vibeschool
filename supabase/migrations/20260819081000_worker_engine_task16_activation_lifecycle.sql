-- TASK 16: Worker Engine controlled activation/deactivation lifecycle.
-- NON-ACTIVATING. This migration installs governance machinery only.
-- It must be safe to apply while production remains OFF / L0 / R0 / Global Stop ON.

alter table public.hq_workforce_engine_contract
  add column if not exists runtime_state text not null default 'OFF',
  add column if not exists runtime_state_version bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hq_workforce_engine_contract'::regclass
      and conname='hq_workforce_engine_contract_runtime_state_check'
  ) then
    alter table public.hq_workforce_engine_contract
      add constraint hq_workforce_engine_contract_runtime_state_check
      check (runtime_state in ('OFF','CONTROLLED_OPERATING'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hq_workforce_engine_contract'::regclass
      and conname='hq_workforce_engine_contract_runtime_state_version_check'
  ) then
    alter table public.hq_workforce_engine_contract
      add constraint hq_workforce_engine_contract_runtime_state_version_check
      check (runtime_state_version >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hq_workforce_engine_contract'::regclass
      and conname='hq_workforce_engine_contract_runtime_projection_check'
  ) then
    alter table public.hq_workforce_engine_contract
      add constraint hq_workforce_engine_contract_runtime_projection_check
      check ((runtime_state='CONTROLLED_OPERATING') = runtime_execution_enabled);
  end if;
end $$;

update public.hq_workforce_engine_contract
set runtime_state=case when runtime_execution_enabled then 'CONTROLLED_OPERATING' else 'OFF' end
where singleton=true;

create table if not exists public.hq_workforce_runtime_transition_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  action text not null check (action in ('activate','stop','global_stop')),
  previous_state text not null check (previous_state in ('OFF','CONTROLLED_OPERATING')),
  resulting_state text not null check (resulting_state in ('OFF','CONTROLLED_OPERATING')),
  previous_version bigint not null check (previous_version >= 0),
  resulting_version bigint not null check (resulting_version >= previous_version),
  requested_envelope jsonb not null default '{}'::jsonb check (jsonb_typeof(requested_envelope)='object'),
  authority_revoked_count integer not null default 0 check (authority_revoked_count >= 0),
  jobs_contained_count integer not null default 0 check (jobs_contained_count >= 0),
  outcome text not null check (outcome in ('applied','idempotent')),
  reason text not null check (char_length(btrim(reason)) >= 3),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default clock_timestamp(),
  unique(actor_id,idempotency_key)
);

alter table public.hq_workforce_runtime_transition_events enable row level security;
revoke all on table public.hq_workforce_runtime_transition_events from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_runtime_transition_events to service_role;

create or replace function public.hq_workforce_guard_runtime_transition_event_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'runtime_transition_event_immutable';
end $$;

drop trigger if exists trg_hq_workforce_runtime_transition_event_immutable
  on public.hq_workforce_runtime_transition_events;
create trigger trg_hq_workforce_runtime_transition_event_immutable
before update or delete on public.hq_workforce_runtime_transition_events
for each row execute function public.hq_workforce_guard_runtime_transition_event_immutable();

create or replace function public.hq_workforce_owner_get_runtime_state()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active_authority integer;
  v_global_stop boolean;
begin
  perform public.hq_assert_owner();
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  select count(*) into v_active_authority
    from public.hq_workforce_capability_authority_grants
   where status='active'
     and activated_at is not null
     and expires_at>clock_timestamp();
  select exists(
    select 1 from public.hq_workforce_execution_breakers
     where scope_type='global' and scope_ref='global' and status='tripped'
  ) into v_global_stop;
  return jsonb_build_object(
    'runtime_state',ec.runtime_state,
    'runtime_state_version',ec.runtime_state_version,
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk,
    'runtime_max_concurrency',ec.runtime_max_concurrency,
    'runtime_max_executions_per_minute',ec.runtime_max_executions_per_minute,
    'heartbeat_enabled',ec.heartbeat_enabled,
    'factory_enabled',ec.factory_enabled,
    'shadow_enabled',ec.shadow_enabled,
    'shadow_scheduler_enabled',ec.shadow_scheduler_enabled,
    'shadow_global_stop',ec.shadow_global_stop,
    'global_stop_active',v_global_stop,
    'active_capability_authority',v_active_authority
  );
end $$;

create or replace function public.hq_workforce_owner_runtime_preflight(
  p_expected_version bigint,
  p_autonomy_level smallint,
  p_max_risk smallint
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  gp public.hq_workforce_runtime_policies%rowtype;
  v_authority integer:=0;
  v_global_stop boolean:=false;
  v_checks jsonb;
begin
  perform public.hq_assert_owner();
  if auth.uid() is null then raise exception 'runtime_preflight_requires_authenticated_owner'; end if;
  if p_expected_version is null or p_expected_version<0 then raise exception 'runtime_preflight_expected_version_required'; end if;
  if p_autonomy_level not between 1 and 4 then raise exception 'runtime_activation_autonomy_invalid'; end if;
  if p_max_risk not between 0 and 5 then raise exception 'runtime_activation_risk_invalid'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  select exists(
    select 1 from public.hq_workforce_execution_breakers
     where scope_type='global' and scope_ref='global' and status='tripped'
  ) into v_global_stop;
  select * into gp from public.hq_workforce_runtime_policies
   where status='active' and scope_kind='global' and scope_key='global' and enabled
   order by updated_at desc limit 1;
  select count(*) into v_authority
    from public.hq_workforce_capability_authority_grants g
   where g.status='active'
     and g.activated_at is not null
     and g.activated_by is not null
     and g.expires_at>clock_timestamp()
     and g.autonomy_level<=p_autonomy_level
     and g.risk_class<=p_max_risk;

  v_checks:=jsonb_build_object(
    'version_matches',ec.runtime_state_version=p_expected_version,
    'currently_off',ec.runtime_state='OFF' and not ec.runtime_execution_enabled,
    'global_stop_clear',not v_global_stop,
    'shadow_stopped',not ec.shadow_enabled and not ec.shadow_scheduler_enabled and ec.shadow_global_stop,
    'anomaly_clear',not ec.runtime_anomaly_paused,
    'enabled_global_policy',gp.id is not null,
    'requested_envelope_within_policy',gp.id is not null and p_autonomy_level<=gp.max_autonomy_level and p_max_risk<=gp.max_risk_class,
    'active_authority_available',v_authority>0,
    'heartbeat_disabled',not ec.heartbeat_enabled,
    'factory_disabled',not ec.factory_enabled
  );

  return jsonb_build_object(
    'ready',not (v_checks @> '{"version_matches":false}'::jsonb)
      and not (v_checks @> '{"currently_off":false}'::jsonb)
      and not (v_checks @> '{"global_stop_clear":false}'::jsonb)
      and not (v_checks @> '{"shadow_stopped":false}'::jsonb)
      and not (v_checks @> '{"anomaly_clear":false}'::jsonb)
      and not (v_checks @> '{"enabled_global_policy":false}'::jsonb)
      and not (v_checks @> '{"requested_envelope_within_policy":false}'::jsonb)
      and not (v_checks @> '{"active_authority_available":false}'::jsonb)
      and not (v_checks @> '{"heartbeat_disabled":false}'::jsonb)
      and not (v_checks @> '{"factory_disabled":false}'::jsonb),
    'runtime_state',ec.runtime_state,
    'runtime_state_version',ec.runtime_state_version,
    'checks',v_checks,
    'global_policy',case when gp.id is null then null else jsonb_build_object(
      'policy_key',gp.policy_key,
      'max_autonomy_level',gp.max_autonomy_level,
      'max_risk_class',gp.max_risk_class,
      'max_concurrency',gp.max_concurrency,
      'max_executions_per_minute',gp.max_executions_per_minute
    ) end,
    'eligible_active_authority_count',v_authority
  );
end $$;

create or replace function public.hq_workforce_owner_transition_runtime(
  p_action text,
  p_expected_version bigint,
  p_idempotency_key text,
  p_autonomy_level smallint,
  p_max_risk smallint,
  p_reason text,
  p_evidence jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  gp public.hq_workforce_runtime_policies%rowtype;
  prior public.hq_workforce_runtime_transition_events%rowtype;
  v_uid uuid;
  v_action text:=btrim(coalesce(p_action,''));
  v_key text:=btrim(coalesce(p_idempotency_key,''));
  v_reason text:=btrim(coalesce(p_reason,''));
  v_requested jsonb;
  v_authority integer:=0;
  v_grant_ids uuid[]:=array[]::uuid[];
  v_revoked integer:=0;
  v_contained integer:=0;
  v_breaker_before boolean:=false;
  v_breaker_after boolean:=false;
  v_previous_state text;
  v_previous_version bigint;
  v_resulting_version bigint;
  v_outcome text:='applied';
  v_result jsonb;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'runtime_transition_requires_authenticated_owner'; end if;
  if v_action not in ('activate','stop','global_stop') then raise exception 'runtime_transition_action_invalid'; end if;
  if p_expected_version is null or p_expected_version<0 then raise exception 'runtime_transition_expected_version_required'; end if;
  if char_length(v_key) not between 8 and 200 then raise exception 'runtime_transition_idempotency_key_invalid'; end if;
  if char_length(v_reason)<3 then raise exception 'runtime_transition_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'object' then raise exception 'runtime_transition_evidence_invalid'; end if;

  if v_action='activate' then
    if p_autonomy_level not between 1 and 4 then raise exception 'runtime_activation_autonomy_invalid'; end if;
    if p_max_risk not between 0 and 5 then raise exception 'runtime_activation_risk_invalid'; end if;
  else
    if coalesce(p_autonomy_level,0)<>0 or coalesce(p_max_risk,0)<>0 then
      raise exception 'runtime_stop_envelope_must_be_zero';
    end if;
  end if;

  v_requested:=jsonb_build_object(
    'action',v_action,'expected_version',p_expected_version,
    'autonomy_level',coalesce(p_autonomy_level,0),'max_risk',coalesce(p_max_risk,0)
  );

  select * into prior
    from public.hq_workforce_runtime_transition_events
   where actor_id=v_uid and idempotency_key=v_key;
  if found then
    if prior.action<>v_action or prior.requested_envelope<>v_requested then
      raise exception 'runtime_transition_idempotency_conflict';
    end if;
    return jsonb_build_object(
      'action',prior.action,'runtime_state',prior.resulting_state,
      'runtime_state_version',prior.resulting_version,'idempotent',true,
      'authority_revoked_count',prior.authority_revoked_count,
      'jobs_contained_count',prior.jobs_contained_count,
      'event_id',prior.id
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('worker-engine|task16|runtime-transition',0));
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  v_previous_state:=ec.runtime_state;
  v_previous_version:=ec.runtime_state_version;

  if ec.runtime_state_version<>p_expected_version then
    raise exception 'runtime_transition_stale_state:expected:%:actual:%',p_expected_version,ec.runtime_state_version;
  end if;

  select exists(
    select 1 from public.hq_workforce_execution_breakers
     where scope_type='global' and scope_ref='global' and status='tripped'
  ) into v_breaker_before;

  if v_action='activate' then
    if ec.runtime_state<>'OFF' or ec.runtime_execution_enabled then raise exception 'runtime_activation_requires_off'; end if;
    if v_breaker_before then raise exception 'runtime_activation_global_breaker_tripped'; end if;
    if ec.runtime_anomaly_paused then raise exception 'runtime_activation_anomaly_paused'; end if;
    if ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
      raise exception 'runtime_activation_requires_shadow_stopped';
    end if;
    if ec.heartbeat_enabled or ec.factory_enabled then raise exception 'runtime_activation_requires_background_paths_off'; end if;

    select * into gp from public.hq_workforce_runtime_policies
     where status='active' and scope_kind='global' and scope_key='global' and enabled
     order by updated_at desc limit 1;
    if not found then raise exception 'runtime_activation_enabled_global_policy_required'; end if;
    if p_autonomy_level>gp.max_autonomy_level or p_max_risk>gp.max_risk_class then
      raise exception 'runtime_activation_exceeds_global_policy';
    end if;

    select count(*) into v_authority
      from public.hq_workforce_capability_authority_grants g
     where g.status='active'
       and g.activated_at is not null
       and g.activated_by is not null
       and g.expires_at>clock_timestamp()
       and g.autonomy_level<=p_autonomy_level
       and g.risk_class<=p_max_risk;
    if v_authority<1 then raise exception 'runtime_activation_active_capability_authority_required'; end if;

    update public.hq_workforce_engine_contract
       set runtime_state='CONTROLLED_OPERATING',runtime_state_version=runtime_state_version+1,
           runtime_execution_enabled=true,runtime_autonomy_level=p_autonomy_level,runtime_max_risk=p_max_risk,
           runtime_max_concurrency=least(runtime_max_concurrency,gp.max_concurrency),
           runtime_max_executions_per_minute=least(runtime_max_executions_per_minute,gp.max_executions_per_minute),
           heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
     where singleton=true
     returning runtime_state_version into v_resulting_version;

  else
    select coalesce(array_agg(g.id),array[]::uuid[]),count(*)::integer
      into v_grant_ids,v_revoked
      from public.hq_workforce_capability_authority_grants g
     where g.status='active';

    if v_action='global_stop' then
      perform public.hq_workforce_trip_execution_breaker(
        'global','global','owner_global_stop','owner:'||v_uid::text,
        p_evidence||jsonb_build_object('runtime_state_version',ec.runtime_state_version,'reason',v_reason)
      );
    end if;

    if v_revoked>0 then
      update public.hq_workforce_capability_authority_grants
         set status='revoked',revoked_at=clock_timestamp(),revocation_reason=v_reason,
             lifecycle_reason=v_reason,
             lifecycle_evidence=coalesce(lifecycle_evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
               'event','runtime_shutdown_revocation','action',v_action,'actor_id',v_uid,'at',clock_timestamp(),'reason',v_reason
             ))
       where id=any(v_grant_ids) and status='active';

      update public.hq_workforce_task_contracts t
         set status=case
               when t.status='running' and exists(
                 select 1 from public.hq_workforce_execution_intents ei
                  where ei.task_id=t.id and ei.status='committed'
               ) then 'failed'
               else 'cancelled'
             end,
             completed_at=clock_timestamp(),lease_expires_at=null,
             last_error=case
               when t.status='running' and exists(
                 select 1 from public.hq_workforce_execution_intents ei
                  where ei.task_id=t.id and ei.status='committed'
               ) then 'runtime_shutdown_post_commit_verification_required'
               else 'runtime_shutdown_contained'
             end,
             execution_evidence=coalesce(t.execution_evidence,'{}'::jsonb)||jsonb_build_object(
               'runtime_shutdown',jsonb_build_object('action',v_action,'reason',v_reason,'actor_id',v_uid,'at',clock_timestamp())
             )
       where t.autonomous_authority_grant_id=any(v_grant_ids)
         and t.status in ('queued','running');
      get diagnostics v_contained=row_count;
    end if;

    select exists(
      select 1 from public.hq_workforce_execution_breakers
       where scope_type='global' and scope_ref='global' and status='tripped'
    ) into v_breaker_after;

    if ec.runtime_state='OFF' and not ec.runtime_execution_enabled and v_revoked=0
       and (v_action='stop' or v_breaker_before=v_breaker_after) then
      v_resulting_version:=ec.runtime_state_version;
      v_outcome:='idempotent';
    else
      update public.hq_workforce_engine_contract
         set runtime_state='OFF',runtime_state_version=runtime_state_version+1,
             runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
             runtime_max_concurrency=1,runtime_max_executions_per_minute=1,
             heartbeat_enabled=false,factory_enabled=false,
             shadow_enabled=false,shadow_scheduler_enabled=false,shadow_global_stop=true,
             updated_at=clock_timestamp()
       where singleton=true
       returning runtime_state_version into v_resulting_version;
    end if;
  end if;

  insert into public.hq_workforce_runtime_transition_events(
    actor_id,idempotency_key,action,previous_state,resulting_state,
    previous_version,resulting_version,requested_envelope,authority_revoked_count,
    jobs_contained_count,outcome,reason,evidence
  ) values(
    v_uid,v_key,v_action,v_previous_state,
    case when v_action='activate' then 'CONTROLLED_OPERATING' else 'OFF' end,
    v_previous_version,v_resulting_version,v_requested,v_revoked,v_contained,v_outcome,v_reason,
    p_evidence||jsonb_build_object(
      'global_stop_before',v_breaker_before,
      'global_stop_after',case when v_action='global_stop' then true else v_breaker_before end,
      'authority_cleanup_proven',v_action='activate' or v_revoked>=0,
      'background_paths_enabled',false
    )
  ) returning id into v_authority;

  v_result:=jsonb_build_object(
    'action',v_action,
    'runtime_state',case when v_action='activate' then 'CONTROLLED_OPERATING' else 'OFF' end,
    'runtime_state_version',v_resulting_version,
    'idempotent',v_outcome='idempotent',
    'authority_revoked_count',v_revoked,
    'jobs_contained_count',v_contained,
    'event_id',v_authority
  );
  return v_result;
end $$;

-- Compatibility RPC: STOP remains available; versionless activation is rejected so a
-- stale HQ tab cannot silently overwrite newer safety state. Task 15 should use the
-- versioned transition RPC for activation.
create or replace function public.hq_workforce_owner_set_runtime(
  p_enabled boolean,
  p_autonomy_level smallint,
  p_max_risk smallint,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  perform public.hq_assert_owner();
  if coalesce(p_enabled,false) then
    raise exception 'runtime_activation_requires_versioned_transition';
  end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  return public.hq_workforce_owner_transition_runtime(
    'stop',ec.runtime_state_version,
    'legacy-stop:'||ec.runtime_state_version::text,
    0,0,p_reason,'{"source":"legacy_owner_set_runtime"}'::jsonb
  );
end $$;

create or replace function public.hq_workforce_owner_global_stop(
  p_expected_version bigint,
  p_idempotency_key text,
  p_reason text,
  p_evidence jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  return public.hq_workforce_owner_transition_runtime(
    'global_stop',p_expected_version,p_idempotency_key,0,0,p_reason,p_evidence
  );
end $$;

revoke all on function public.hq_workforce_owner_get_runtime_state() from public,anon,service_role;
grant execute on function public.hq_workforce_owner_get_runtime_state() to authenticated;
revoke all on function public.hq_workforce_owner_runtime_preflight(bigint,smallint,smallint) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_runtime_preflight(bigint,smallint,smallint) to authenticated;
revoke all on function public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb) to authenticated;
revoke all on function public.hq_workforce_owner_global_stop(bigint,text,text,jsonb) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_global_stop(bigint,text,text,jsonb) to authenticated;
revoke all on function public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_set_runtime(boolean,smallint,smallint,text) to authenticated;

-- Installation is non-activating and refuses to weaken the current fail-closed posture.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'TASK16 requires engine contract'; end if;
  if ec.runtime_state<>'OFF' or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'TASK16 migration requires fail_closed_off_state';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'TASK16 migration requires zero active capability authority'; end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_transition_runtime(text,bigint,text,smallint,smallint,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_global_stop(bigint,text,text,jsonb)','EXECUTE') then
    raise exception 'TASK16 owner transition transport exposed to service_role';
  end if;
end $$;
