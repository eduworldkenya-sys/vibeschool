-- TASK 16: explicit activation envelope and trusted execution binding.
-- NON-ACTIVATING. Installation requires the Worker Engine to remain Safe OFF.

alter table public.hq_workforce_engine_contract
  add column if not exists runtime_activation_envelope_id uuid;

create table if not exists public.hq_workforce_runtime_activation_envelopes (
  id uuid primary key default gen_random_uuid(),
  activation_event_id bigint references public.hq_workforce_runtime_transition_events(id),
  owner_id uuid not null,
  runtime_state_version bigint not null check (runtime_state_version > 0),
  autonomy_level smallint not null check (autonomy_level between 1 and 4),
  max_risk smallint not null check (max_risk between 0 and 5),
  authority_grant_ids uuid[] not null check (cardinality(authority_grant_ids) > 0),
  authority_snapshot jsonb not null check (jsonb_typeof(authority_snapshot)='array'),
  policy_snapshot jsonb not null check (jsonb_typeof(policy_snapshot)='object'),
  max_concurrency integer not null check (max_concurrency > 0),
  max_executions_per_minute integer not null check (max_executions_per_minute > 0),
  status text not null check (status in ('active','stopped','global_stopped','expired')),
  activated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  stopped_at timestamptz,
  stop_reason text,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  check (expires_at > activated_at),
  check ((status='active' and stopped_at is null) or (status<>'active' and stopped_at is not null))
);

alter table public.hq_workforce_runtime_activation_envelopes enable row level security;
revoke all on table public.hq_workforce_runtime_activation_envelopes from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_runtime_activation_envelopes to service_role;

create unique index if not exists uq_hq_workforce_runtime_single_active_envelope
  on public.hq_workforce_runtime_activation_envelopes ((1)) where status='active';

-- A running engine must always identify the exact envelope that opened it.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conrelid='public.hq_workforce_engine_contract'::regclass
       and conname='hq_workforce_engine_contract_envelope_projection_check'
  ) then
    alter table public.hq_workforce_engine_contract
      add constraint hq_workforce_engine_contract_envelope_projection_check
      check (
        (runtime_state='OFF' and runtime_activation_envelope_id is null)
        or (runtime_state='CONTROLLED_OPERATING' and runtime_activation_envelope_id is not null)
      );
  end if;
end $$;

create or replace function public.hq_workforce_guard_runtime_activation_envelope_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'runtime_activation_envelope_delete_forbidden'; end if;
  if old.id<>new.id
     or old.activation_event_id is distinct from new.activation_event_id
     or old.owner_id<>new.owner_id
     or old.runtime_state_version<>new.runtime_state_version
     or old.autonomy_level<>new.autonomy_level
     or old.max_risk<>new.max_risk
     or old.authority_grant_ids<>new.authority_grant_ids
     or old.authority_snapshot<>new.authority_snapshot
     or old.policy_snapshot<>new.policy_snapshot
     or old.max_concurrency<>new.max_concurrency
     or old.max_executions_per_minute<>new.max_executions_per_minute
     or old.activated_at<>new.activated_at
     or old.expires_at<>new.expires_at then
    raise exception 'runtime_activation_envelope_governance_fields_immutable';
  end if;
  if old.status<>'active' then raise exception 'runtime_activation_envelope_terminal'; end if;
  if new.status not in ('stopped','global_stopped','expired')
     or new.stopped_at is null or char_length(btrim(coalesce(new.stop_reason,'')))<3 then
    raise exception 'runtime_activation_envelope_invalid_close';
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_runtime_activation_envelope_immutable
  on public.hq_workforce_runtime_activation_envelopes;
create trigger trg_hq_workforce_runtime_activation_envelope_immutable
before update or delete on public.hq_workforce_runtime_activation_envelopes
for each row execute function public.hq_workforce_guard_runtime_activation_envelope_immutable();

create or replace function public.hq_workforce_assert_task_in_active_envelope(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  e public.hq_workforce_runtime_activation_envelopes%rowtype;
  t public.hq_workforce_task_contracts%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found or ec.runtime_state<>'CONTROLLED_OPERATING' or not ec.runtime_execution_enabled
     or ec.runtime_activation_envelope_id is null then
    raise exception 'worker_runtime_activation_envelope_required';
  end if;
  select * into e from public.hq_workforce_runtime_activation_envelopes
   where id=ec.runtime_activation_envelope_id and status='active';
  if not found then raise exception 'worker_runtime_activation_envelope_not_active'; end if;
  if e.runtime_state_version<>ec.runtime_state_version then raise exception 'worker_runtime_activation_envelope_version_mismatch'; end if;
  if e.expires_at<=clock_timestamp() then raise exception 'worker_runtime_activation_envelope_expired'; end if;
  if e.autonomy_level<>ec.runtime_autonomy_level or e.max_risk<>ec.runtime_max_risk then
    raise exception 'worker_runtime_activation_envelope_projection_mismatch';
  end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if not found then raise exception 'worker_runtime_task_not_found'; end if;
  if t.autonomous_authority_grant_id is null
     or not (t.autonomous_authority_grant_id=any(e.authority_grant_ids)) then
    raise exception 'worker_runtime_task_outside_activation_envelope';
  end if;
  return jsonb_build_object(
    'activation_envelope_id',e.id,
    'runtime_state_version',e.runtime_state_version,
    'envelope_expires_at',e.expires_at,
    'authority_grant_id',t.autonomous_authority_grant_id
  );
end $$;

-- Bind the already-centralized runtime authorization gateway to the exact activation
-- envelope. The R1.2 internal function continues to enforce worker/capability/version/
-- scope/risk/autonomy/concurrency/rate invariants.
create or replace function public.hq_workforce_assert_runtime_task_authorized(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_envelope jsonb; v_authorization jsonb;
begin
  if not exists(
    select 1 from public.hq_workforce_runtime_policies
     where status='active' and scope_kind='global' and scope_key='global' and enabled
  ) then raise exception 'worker_runtime_explicit_global_policy_required'; end if;
  v_envelope:=public.hq_workforce_assert_task_in_active_envelope(p_task_id);
  v_authorization:=public.hq_workforce_assert_runtime_task_authorized_r12_internal(p_task_id);
  return coalesce(v_authorization,'{}'::jsonb)||v_envelope;
end $$;

create or replace function public.hq_workforce_owner_runtime_preflight_v2(
  p_expected_version bigint,
  p_autonomy_level smallint,
  p_max_risk smallint,
  p_authority_grant_ids uuid[],
  p_duration_minutes integer
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  gp public.hq_workforce_runtime_policies%rowtype;
  v_requested uuid[];
  v_requested_count integer;
  v_valid_count integer:=0;
  v_budgeted_count integer:=0;
  v_min_expiry timestamptz;
  v_global_stop boolean:=false;
  v_checks jsonb;
begin
  perform public.hq_assert_owner();
  if auth.uid() is null then raise exception 'runtime_preflight_requires_authenticated_owner'; end if;
  if p_expected_version is null or p_expected_version<0 then raise exception 'runtime_preflight_expected_version_required'; end if;
  if p_autonomy_level not between 1 and 4 then raise exception 'runtime_activation_autonomy_invalid'; end if;
  if p_max_risk not between 0 and 5 then raise exception 'runtime_activation_risk_invalid'; end if;
  if p_duration_minutes not between 1 and 60 then raise exception 'runtime_activation_duration_invalid'; end if;

  select coalesce(array_agg(x order by x),array[]::uuid[]) into v_requested
    from (select distinct unnest(coalesce(p_authority_grant_ids,array[]::uuid[])) x) q;
  v_requested_count:=cardinality(v_requested);
  if v_requested_count<1 then raise exception 'runtime_activation_explicit_authority_required'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  select exists(select 1 from public.hq_workforce_execution_breakers where scope_type='global' and scope_ref='global' and status='tripped') into v_global_stop;
  select * into gp from public.hq_workforce_runtime_policies
   where status='active' and scope_kind='global' and scope_key='global' and enabled
   order by updated_at desc limit 1;

  select count(*),min(g.expires_at) into v_valid_count,v_min_expiry
    from public.hq_workforce_capability_authority_grants g
    join public.hq_workforce_runtime_capability_allowlist a
      on a.capability_key=g.capability_key and a.capability_version=g.capability_version
     and a.operation=g.operation and a.resource_type=g.resource_type and a.enabled
   where g.id=any(v_requested)
     and g.status='active' and g.activated_at is not null and g.activated_by is not null
     and g.expires_at>clock_timestamp()+make_interval(mins=>p_duration_minutes)
     and g.permitted_worker_key is not null
     and g.autonomy_level<=p_autonomy_level and g.risk_class<=p_max_risk
     and g.autonomy_level<=a.max_autonomy_level and g.risk_class<=a.max_risk_class;

  select count(distinct g.id) into v_budgeted_count
    from public.hq_workforce_capability_authority_grants g
   where g.id=any(v_requested)
     and exists(
       select 1 from public.hq_workforce_execution_budgets b
        where b.worker_key=g.permitted_worker_key and b.status='active'
          and b.period_start<=clock_timestamp() and b.period_end>clock_timestamp()
          and (b.limit_amount-b.consumed_amount-b.reserved_amount)>0
     );

  v_checks:=jsonb_build_object(
    'version_matches',ec.runtime_state_version=p_expected_version,
    'currently_off',ec.runtime_state='OFF' and not ec.runtime_execution_enabled and ec.runtime_activation_envelope_id is null,
    'global_stop_clear',not v_global_stop,
    'shadow_stopped',not ec.shadow_enabled and not ec.shadow_scheduler_enabled and ec.shadow_global_stop,
    'anomaly_clear',not ec.runtime_anomaly_paused,
    'background_paths_disabled',not ec.heartbeat_enabled and not ec.factory_enabled,
    'enabled_global_policy',gp.id is not null,
    'requested_envelope_within_policy',gp.id is not null and p_autonomy_level<=gp.max_autonomy_level and p_max_risk<=gp.max_risk_class,
    'exact_authority_set_valid',v_valid_count=v_requested_count,
    'budget_capacity_available',v_budgeted_count=v_requested_count,
    'duration_covered',v_min_expiry is not null and v_min_expiry>clock_timestamp()+make_interval(mins=>p_duration_minutes)
  );

  return jsonb_build_object(
    'ready',not (v_checks @> '{"version_matches":false}'::jsonb)
      and not (v_checks @> '{"currently_off":false}'::jsonb)
      and not (v_checks @> '{"global_stop_clear":false}'::jsonb)
      and not (v_checks @> '{"shadow_stopped":false}'::jsonb)
      and not (v_checks @> '{"anomaly_clear":false}'::jsonb)
      and not (v_checks @> '{"background_paths_disabled":false}'::jsonb)
      and not (v_checks @> '{"enabled_global_policy":false}'::jsonb)
      and not (v_checks @> '{"requested_envelope_within_policy":false}'::jsonb)
      and not (v_checks @> '{"exact_authority_set_valid":false}'::jsonb)
      and not (v_checks @> '{"budget_capacity_available":false}'::jsonb)
      and not (v_checks @> '{"duration_covered":false}'::jsonb),
    'runtime_state',ec.runtime_state,'runtime_state_version',ec.runtime_state_version,
    'authority_grant_ids',to_jsonb(v_requested),'checks',v_checks,
    'requested_expires_at',clock_timestamp()+make_interval(mins=>p_duration_minutes),
    'authority_min_expires_at',v_min_expiry,
    'global_policy',case when gp.id is null then null else jsonb_build_object(
      'policy_key',gp.policy_key,'max_autonomy_level',gp.max_autonomy_level,'max_risk_class',gp.max_risk_class,
      'max_concurrency',gp.max_concurrency,'max_executions_per_minute',gp.max_executions_per_minute
    ) end
  );
end $$;

create or replace function public.hq_workforce_owner_transition_runtime_v2(
  p_action text,
  p_expected_version bigint,
  p_idempotency_key text,
  p_autonomy_level smallint,
  p_max_risk smallint,
  p_authority_grant_ids uuid[],
  p_duration_minutes integer,
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
  env public.hq_workforce_runtime_activation_envelopes%rowtype;
  v_uid uuid:=auth.uid();
  v_action text:=btrim(coalesce(p_action,''));
  v_key text:=btrim(coalesce(p_idempotency_key,''));
  v_reason text:=btrim(coalesce(p_reason,''));
  v_grant_ids uuid[]:=array[]::uuid[];
  v_grant_count integer:=0;
  v_valid_count integer:=0;
  v_budget_count integer:=0;
  v_revoke_count integer:=0;
  v_remaining_active integer:=0;
  v_contained integer:=0;
  v_event_id bigint;
  v_envelope_id uuid;
  v_previous_state text;
  v_previous_version bigint;
  v_resulting_version bigint;
  v_requested jsonb;
  v_authority_snapshot jsonb:='[]'::jsonb;
  v_global_stop boolean:=false;
  v_expiry timestamptz;
begin
  perform public.hq_assert_owner();
  if v_uid is null then raise exception 'runtime_transition_requires_authenticated_owner'; end if;
  if v_action not in ('activate','stop','global_stop') then raise exception 'runtime_transition_action_invalid'; end if;
  if p_expected_version is null or p_expected_version<0 then raise exception 'runtime_transition_expected_version_required'; end if;
  if char_length(v_key) not between 8 and 200 then raise exception 'runtime_transition_idempotency_key_invalid'; end if;
  if char_length(v_reason)<3 then raise exception 'runtime_transition_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'object' then raise exception 'runtime_transition_evidence_invalid'; end if;

  if v_action='activate' then
    if p_autonomy_level not between 1 and 4 or p_max_risk not between 0 and 5 then raise exception 'runtime_activation_envelope_invalid'; end if;
    if p_duration_minutes not between 1 and 60 then raise exception 'runtime_activation_duration_invalid'; end if;
    select coalesce(array_agg(x order by x),array[]::uuid[]) into v_grant_ids
      from (select distinct unnest(coalesce(p_authority_grant_ids,array[]::uuid[])) x) q;
    v_grant_count:=cardinality(v_grant_ids);
    if v_grant_count<1 then raise exception 'runtime_activation_explicit_authority_required'; end if;
  else
    if coalesce(p_autonomy_level,0)<>0 or coalesce(p_max_risk,0)<>0
       or cardinality(coalesce(p_authority_grant_ids,array[]::uuid[]))<>0
       or coalesce(p_duration_minutes,0)<>0 then
      raise exception 'runtime_stop_envelope_must_be_zero';
    end if;
  end if;

  v_requested:=jsonb_build_object(
    'action',v_action,'expected_version',p_expected_version,'autonomy_level',coalesce(p_autonomy_level,0),
    'max_risk',coalesce(p_max_risk,0),'authority_grant_ids',to_jsonb(v_grant_ids),'duration_minutes',coalesce(p_duration_minutes,0)
  );
  select * into prior from public.hq_workforce_runtime_transition_events where actor_id=v_uid and idempotency_key=v_key;
  if found then
    if prior.action<>v_action or prior.requested_envelope<>v_requested then raise exception 'runtime_transition_idempotency_conflict'; end if;
    return jsonb_build_object('action',prior.action,'runtime_state',prior.resulting_state,'runtime_state_version',prior.resulting_version,
      'idempotent',true,'event_id',prior.id,'authority_revoked_count',prior.authority_revoked_count,'jobs_contained_count',prior.jobs_contained_count);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('worker-engine|task16|runtime-transition',0));
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_state_version<>p_expected_version then raise exception 'runtime_transition_stale_state:expected:%:actual:%',p_expected_version,ec.runtime_state_version; end if;
  v_previous_state:=ec.runtime_state; v_previous_version:=ec.runtime_state_version;

  if v_action='activate' then
    if ec.runtime_state<>'OFF' or ec.runtime_execution_enabled or ec.runtime_activation_envelope_id is not null then raise exception 'runtime_activation_requires_off'; end if;
    select exists(select 1 from public.hq_workforce_execution_breakers where scope_type='global' and scope_ref='global' and status='tripped') into v_global_stop;
    if v_global_stop then raise exception 'runtime_activation_global_breaker_tripped'; end if;
    if ec.runtime_anomaly_paused then raise exception 'runtime_activation_anomaly_paused'; end if;
    if ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop or ec.heartbeat_enabled or ec.factory_enabled then
      raise exception 'runtime_activation_requires_background_paths_off';
    end if;
    select * into gp from public.hq_workforce_runtime_policies
     where status='active' and scope_kind='global' and scope_key='global' and enabled order by updated_at desc limit 1;
    if not found then raise exception 'runtime_activation_enabled_global_policy_required'; end if;
    if p_autonomy_level>gp.max_autonomy_level or p_max_risk>gp.max_risk_class then raise exception 'runtime_activation_exceeds_global_policy'; end if;

    select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'grant_id',g.id,'grant_key',g.grant_key,'worker_key',g.permitted_worker_key,
      'capability_key',g.capability_key,'capability_version',g.capability_version,'operation',g.operation,
      'resource_type',g.resource_type,'scope_type',g.scope_type,'scope_ref',g.scope_ref,
      'autonomy_level',g.autonomy_level,'risk_class',g.risk_class,'expires_at',g.expires_at,
      'max_operations_per_cycle',g.max_operations_per_cycle,'max_records_per_operation',g.max_records_per_operation,
      'max_concurrency',g.max_concurrency,'max_executions_per_minute',g.max_executions_per_minute
    ) order by g.id::text),'[]'::jsonb),min(g.expires_at)
      into v_valid_count,v_authority_snapshot,v_expiry
      from public.hq_workforce_capability_authority_grants g
      join public.hq_workforce_runtime_capability_allowlist a
        on a.capability_key=g.capability_key and a.capability_version=g.capability_version
       and a.operation=g.operation and a.resource_type=g.resource_type and a.enabled
     where g.id=any(v_grant_ids)
       and g.status='active' and g.activated_at is not null and g.activated_by is not null
       and g.expires_at>clock_timestamp()+make_interval(mins=>p_duration_minutes)
       and g.permitted_worker_key is not null
       and g.autonomy_level<=p_autonomy_level and g.risk_class<=p_max_risk
       and g.autonomy_level<=a.max_autonomy_level and g.risk_class<=a.max_risk_class;
    if v_valid_count<>v_grant_count then raise exception 'runtime_activation_authority_set_invalid'; end if;

    select count(distinct g.id) into v_budget_count
      from public.hq_workforce_capability_authority_grants g
     where g.id=any(v_grant_ids)
       and exists(select 1 from public.hq_workforce_execution_budgets b
         where b.worker_key=g.permitted_worker_key and b.status='active'
           and b.period_start<=clock_timestamp() and b.period_end>clock_timestamp()
           and (b.limit_amount-b.consumed_amount-b.reserved_amount)>0);
    if v_budget_count<>v_grant_count then raise exception 'runtime_activation_budget_capacity_required'; end if;

    v_expiry:=least(v_expiry,clock_timestamp()+make_interval(mins=>p_duration_minutes));
    v_resulting_version:=ec.runtime_state_version+1;

    -- Envelope exists before the contract points at it, but both become visible atomically.
    insert into public.hq_workforce_runtime_activation_envelopes(
      owner_id,runtime_state_version,autonomy_level,max_risk,authority_grant_ids,authority_snapshot,policy_snapshot,
      max_concurrency,max_executions_per_minute,status,expires_at,evidence
    ) values(
      v_uid,v_resulting_version,p_autonomy_level,p_max_risk,v_grant_ids,v_authority_snapshot,
      jsonb_build_object('policy_key',gp.policy_key,'max_autonomy_level',gp.max_autonomy_level,'max_risk_class',gp.max_risk_class,
        'max_concurrency',gp.max_concurrency,'max_executions_per_minute',gp.max_executions_per_minute,'captured_at',clock_timestamp()),
      least(ec.runtime_max_concurrency,gp.max_concurrency),least(ec.runtime_max_executions_per_minute,gp.max_executions_per_minute),
      'active',v_expiry,p_evidence
    ) returning id into v_envelope_id;

    update public.hq_workforce_engine_contract set
      runtime_state='CONTROLLED_OPERATING',runtime_state_version=v_resulting_version,runtime_activation_envelope_id=v_envelope_id,
      runtime_execution_enabled=true,runtime_autonomy_level=p_autonomy_level,runtime_max_risk=p_max_risk,
      runtime_max_concurrency=least(runtime_max_concurrency,gp.max_concurrency),
      runtime_max_executions_per_minute=least(runtime_max_executions_per_minute,gp.max_executions_per_minute),
      heartbeat_enabled=false,factory_enabled=false,updated_at=clock_timestamp()
    where singleton=true;

  else
    v_envelope_id:=ec.runtime_activation_envelope_id;
    select coalesce(array_agg(id),array[]::uuid[]),count(*)::integer into v_grant_ids,v_revoke_count
      from public.hq_workforce_capability_authority_grants where status='active';

    if v_action='global_stop' then
      perform public.hq_workforce_trip_execution_breaker('global','global','owner_global_stop','owner:'||v_uid::text,
        p_evidence||jsonb_build_object('runtime_state_version',ec.runtime_state_version,'reason',v_reason));
    end if;

    if v_revoke_count>0 then
      update public.hq_workforce_capability_authority_grants set
        status='revoked',revoked_at=clock_timestamp(),revocation_reason=v_reason,lifecycle_reason=v_reason,
        lifecycle_evidence=coalesce(lifecycle_evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
          'event','runtime_shutdown_revocation','action',v_action,'actor_id',v_uid,'at',clock_timestamp(),'reason',v_reason))
      where id=any(v_grant_ids) and status='active';

      update public.hq_workforce_task_contracts t set
        status=case when t.status='running' and exists(select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed') then 'failed' else 'cancelled' end,
        completed_at=clock_timestamp(),lease_expires_at=null,
        last_error=case when t.status='running' and exists(select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed') then 'runtime_shutdown_post_commit_verification_required' else 'runtime_shutdown_contained' end,
        execution_evidence=coalesce(t.execution_evidence,'{}'::jsonb)||jsonb_build_object('runtime_shutdown',jsonb_build_object('action',v_action,'reason',v_reason,'actor_id',v_uid,'at',clock_timestamp()))
      where t.autonomous_authority_grant_id=any(v_grant_ids) and t.status in ('queued','running');
      get diagnostics v_contained=row_count;
    end if;

    select count(*) into v_remaining_active from public.hq_workforce_capability_authority_grants where status='active';
    if v_remaining_active<>0 then raise exception 'runtime_shutdown_authority_cleanup_failed'; end if;

    if v_envelope_id is not null then
      update public.hq_workforce_runtime_activation_envelopes set
        status=case when v_action='global_stop' then 'global_stopped' else 'stopped' end,
        stopped_at=clock_timestamp(),stop_reason=v_reason,
        evidence=evidence||jsonb_build_object('shutdown',p_evidence,'authority_revoked_count',v_revoke_count,'jobs_contained_count',v_contained)
      where id=v_envelope_id and status='active';
    end if;

    if ec.runtime_state='OFF' and not ec.runtime_execution_enabled and ec.runtime_activation_envelope_id is null and v_revoke_count=0 then
      v_resulting_version:=ec.runtime_state_version;
    else
      v_resulting_version:=ec.runtime_state_version+1;
    end if;
    update public.hq_workforce_engine_contract set
      runtime_state='OFF',runtime_state_version=v_resulting_version,runtime_activation_envelope_id=null,
      runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,runtime_max_concurrency=1,runtime_max_executions_per_minute=1,
      heartbeat_enabled=false,factory_enabled=false,shadow_enabled=false,shadow_scheduler_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp()
    where singleton=true;
  end if;

  insert into public.hq_workforce_runtime_transition_events(
    actor_id,idempotency_key,action,previous_state,resulting_state,previous_version,resulting_version,requested_envelope,
    authority_revoked_count,jobs_contained_count,outcome,reason,evidence
  ) values(
    v_uid,v_key,v_action,v_previous_state,case when v_action='activate' then 'CONTROLLED_OPERATING' else 'OFF' end,
    v_previous_version,v_resulting_version,v_requested,v_revoke_count,v_contained,'applied',v_reason,
    p_evidence||jsonb_build_object('activation_envelope_id',v_envelope_id,'authority_cleanup_remaining_active',v_remaining_active)
  ) returning id into v_event_id;

  if v_action='activate' then
    update public.hq_workforce_runtime_activation_envelopes set activation_event_id=v_event_id where id=v_envelope_id;
  end if;

  return jsonb_build_object(
    'action',v_action,'runtime_state',case when v_action='activate' then 'CONTROLLED_OPERATING' else 'OFF' end,
    'runtime_state_version',v_resulting_version,'activation_envelope_id',case when v_action='activate' then v_envelope_id else null end,
    'idempotent',false,'event_id',v_event_id,'authority_revoked_count',v_revoke_count,'jobs_contained_count',v_contained
  );
end $$;

-- Close the unscoped activation path. Stops remain compatible and are delegated to v2.
create or replace function public.hq_workforce_owner_transition_runtime(
  p_action text,p_expected_version bigint,p_idempotency_key text,p_autonomy_level smallint,p_max_risk smallint,p_reason text,p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if btrim(coalesce(p_action,''))='activate' then raise exception 'runtime_activation_requires_explicit_envelope'; end if;
  return public.hq_workforce_owner_transition_runtime_v2(
    p_action,p_expected_version,p_idempotency_key,0,0,array[]::uuid[],0,p_reason,p_evidence
  );
end $$;

-- Preflight v1 cannot prove an explicit grant envelope; activation callers must use v2.
create or replace function public.hq_workforce_owner_runtime_preflight(
  p_expected_version bigint,p_autonomy_level smallint,p_max_risk smallint
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.hq_assert_owner();
  raise exception 'runtime_preflight_requires_explicit_envelope';
end $$;

revoke all on function public.hq_workforce_assert_task_in_active_envelope(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_assert_task_in_active_envelope(uuid) to service_role;
revoke all on function public.hq_workforce_owner_runtime_preflight_v2(bigint,smallint,smallint,uuid[],integer) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_runtime_preflight_v2(bigint,smallint,smallint,uuid[],integer) to authenticated;
revoke all on function public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb) to authenticated;
revoke all on function public.hq_workforce_guard_runtime_activation_envelope_immutable() from public,anon,authenticated,service_role;

-- Installation may never create an active envelope or weaken Safe OFF.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found or ec.runtime_state<>'OFF' or ec.runtime_execution_enabled or ec.runtime_activation_envelope_id is not null
     or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 or ec.heartbeat_enabled or ec.factory_enabled
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
    raise exception 'TASK16 envelope migration requires fail_closed_off_state';
  end if;
  select count(*) into v_active from public.hq_workforce_runtime_activation_envelopes where status='active';
  if v_active<>0 then raise exception 'TASK16 migration created active envelope'; end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb)','EXECUTE') then
    raise exception 'TASK16 explicit activation exposed to service_role';
  end if;
end $$;
