-- TASK 16: fail-closed runtime watchdog.
-- Service execution may only remove authority. It cannot activate runtime, reset a
-- breaker, issue authority, or widen an operating envelope.

alter table public.hq_workforce_engine_contract
  add constraint hq_workforce_engine_contract_activation_envelope_fk
  foreign key (runtime_activation_envelope_id)
  references public.hq_workforce_runtime_activation_envelopes(id);

alter table public.hq_workforce_runtime_transition_events
  alter column actor_id drop not null;
alter table public.hq_workforce_runtime_transition_events
  add column if not exists actor_kind text not null default 'owner';

do $$ begin
  alter table public.hq_workforce_runtime_transition_events
    drop constraint if exists hq_workforce_runtime_transition_events_action_check;
  alter table public.hq_workforce_runtime_transition_events
    add constraint hq_workforce_runtime_transition_events_action_check
    check (action in ('activate','stop','global_stop','expire'));
  if not exists (
    select 1 from pg_constraint
     where conrelid='public.hq_workforce_runtime_transition_events'::regclass
       and conname='hq_workforce_runtime_transition_events_actor_check'
  ) then
    alter table public.hq_workforce_runtime_transition_events
      add constraint hq_workforce_runtime_transition_events_actor_check
      check ((actor_kind='owner' and actor_id is not null) or (actor_kind='system' and actor_id is null));
  end if;
end $$;

create unique index if not exists uq_hq_workforce_runtime_system_transition_key
  on public.hq_workforce_runtime_transition_events(idempotency_key)
  where actor_kind='system';

create or replace function public.hq_workforce_fail_closed_runtime_watchdog()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  env public.hq_workforce_runtime_activation_envelopes%rowtype;
  v_global_stop boolean:=false;
  v_reason text;
  v_action text;
  v_terminal_status text;
  v_grant_ids uuid[]:=array[]::uuid[];
  v_revoked integer:=0;
  v_remaining integer:=0;
  v_contained integer:=0;
  v_new_version bigint;
  v_event_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('worker-engine|task16|runtime-transition',0));
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;

  if ec.runtime_state='OFF' and not ec.runtime_execution_enabled and ec.runtime_activation_envelope_id is null then
    return jsonb_build_object('status','safe_off','transitioned',false,'runtime_state_version',ec.runtime_state_version);
  end if;

  select exists(
    select 1 from public.hq_workforce_execution_breakers
     where scope_type='global' and scope_ref='global' and status='tripped'
  ) into v_global_stop;

  if ec.runtime_activation_envelope_id is not null then
    select * into env from public.hq_workforce_runtime_activation_envelopes where id=ec.runtime_activation_envelope_id for update;
  end if;

  if v_global_stop then
    v_reason:='global_breaker_fail_closed_watchdog';
    v_action:='global_stop';
    v_terminal_status:='global_stopped';
  elsif ec.runtime_activation_envelope_id is null or env.id is null or env.status<>'active'
        or env.runtime_state_version<>ec.runtime_state_version then
    v_reason:='runtime_envelope_integrity_fail_closed';
    v_action:='expire';
    v_terminal_status:='expired';
  elsif env.expires_at<=clock_timestamp() then
    v_reason:='runtime_activation_envelope_expired';
    v_action:='expire';
    v_terminal_status:='expired';
  else
    return jsonb_build_object(
      'status','healthy','transitioned',false,'runtime_state',ec.runtime_state,
      'runtime_state_version',ec.runtime_state_version,'activation_envelope_id',env.id,'expires_at',env.expires_at
    );
  end if;

  select coalesce(array_agg(id),array[]::uuid[]),count(*)::integer into v_grant_ids,v_revoked
    from public.hq_workforce_capability_authority_grants where status='active';

  if v_revoked>0 then
    update public.hq_workforce_capability_authority_grants set
      status='revoked',revoked_at=clock_timestamp(),revocation_reason=v_reason,lifecycle_reason=v_reason,
      lifecycle_evidence=coalesce(lifecycle_evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
        'event','runtime_watchdog_revocation','action',v_action,'at',clock_timestamp(),'reason',v_reason
      ))
    where id=any(v_grant_ids) and status='active';

    update public.hq_workforce_task_contracts t set
      status=case when t.status='running' and exists(
        select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed'
      ) then 'failed' else 'cancelled' end,
      completed_at=clock_timestamp(),lease_expires_at=null,
      last_error=case when t.status='running' and exists(
        select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed'
      ) then 'runtime_shutdown_post_commit_verification_required' else 'runtime_watchdog_contained' end,
      execution_evidence=coalesce(t.execution_evidence,'{}'::jsonb)||jsonb_build_object(
        'runtime_watchdog',jsonb_build_object('action',v_action,'reason',v_reason,'at',clock_timestamp())
      )
    where t.autonomous_authority_grant_id=any(v_grant_ids) and t.status in ('queued','running');
    get diagnostics v_contained=row_count;
  end if;

  select count(*) into v_remaining from public.hq_workforce_capability_authority_grants where status='active';
  if v_remaining<>0 then raise exception 'runtime_watchdog_authority_cleanup_failed'; end if;

  if env.id is not null and env.status='active' then
    update public.hq_workforce_runtime_activation_envelopes set
      status=v_terminal_status,stopped_at=clock_timestamp(),stop_reason=v_reason,
      evidence=evidence||jsonb_build_object('watchdog',jsonb_build_object(
        'reason',v_reason,'authority_revoked_count',v_revoked,'jobs_contained_count',v_contained,'at',clock_timestamp()
      ))
    where id=env.id;
  end if;

  v_new_version:=ec.runtime_state_version+1;
  update public.hq_workforce_engine_contract set
    runtime_state='OFF',runtime_state_version=v_new_version,runtime_activation_envelope_id=null,
    runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,
    runtime_max_concurrency=1,runtime_max_executions_per_minute=1,
    heartbeat_enabled=false,factory_enabled=false,shadow_enabled=false,shadow_scheduler_enabled=false,shadow_global_stop=true,
    updated_at=clock_timestamp()
  where singleton=true;

  insert into public.hq_workforce_runtime_transition_events(
    actor_id,actor_kind,idempotency_key,action,previous_state,resulting_state,previous_version,resulting_version,
    requested_envelope,authority_revoked_count,jobs_contained_count,outcome,reason,evidence
  ) values(
    null,'system','watchdog:'||coalesce(env.id::text,'missing')||':'||ec.runtime_state_version::text,
    v_action,ec.runtime_state,'OFF',ec.runtime_state_version,v_new_version,
    jsonb_build_object('activation_envelope_id',ec.runtime_activation_envelope_id),v_revoked,v_contained,'applied',v_reason,
    jsonb_build_object('global_stop_active',v_global_stop,'authority_cleanup_remaining_active',v_remaining)
  ) returning id into v_event_id;

  return jsonb_build_object(
    'status','failed_closed','transitioned',true,'reason',v_reason,'runtime_state','OFF',
    'runtime_state_version',v_new_version,'authority_revoked_count',v_revoked,'jobs_contained_count',v_contained,'event_id',v_event_id
  );
end $$;

-- The minute scheduler now reconciles runtime safety before attempting queue work.
create or replace function public.hq_workforce_scheduled_bounded_runtime_queue()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_watchdog jsonb; v_queue jsonb;
begin
  v_watchdog:=public.hq_workforce_fail_closed_runtime_watchdog();
  v_queue:=public.hq_workforce_execute_bounded_runtime_queue(10,120);
  return coalesce(v_queue,'{}'::jsonb)||jsonb_build_object('runtime_watchdog',v_watchdog);
exception when others then
  return jsonb_build_object('status','failed_closed','error',sqlerrm,'processed',0,'consequential_execution',false);
end $$;

revoke all on function public.hq_workforce_fail_closed_runtime_watchdog() from public,anon,authenticated;
grant execute on function public.hq_workforce_fail_closed_runtime_watchdog() to service_role;

-- Service can invoke only the fail-closed watchdog, not owner activation or breaker reset.
do $$ begin
  if not has_function_privilege('service_role','public.hq_workforce_fail_closed_runtime_watchdog()','EXECUTE') then
    raise exception 'TASK16 watchdog unavailable to scheduler transport';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_transition_runtime_v2(text,bigint,text,smallint,smallint,uuid[],integer,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_reset_execution_breaker(uuid,bigint,text,jsonb)','EXECUTE') then
    raise exception 'TASK16 service transport gained governance authority';
  end if;
end $$;
