begin;

-- Fail-closed bridge between the Chemistry stage executor and Cyborg provider admission.
-- This function is service-role only and read-only: it cannot claim/complete stages,
-- mutate content, publish, release Global Stop, or grant worker authority.
create or replace function public.chemistry_assert_cyborg_stage_lease(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_caller_service_id text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.chemistry_worker_stage_attempts%rowtype;
  i public.chemistry_worker_mission_items%rowtype;
  m public.chemistry_worker_missions%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_expected_worker text;
begin
  if p_attempt_id is null or p_lease_token is null then
    raise exception 'CHEMISTRY_CYBORG_STAGE_LEASE_REQUIRED';
  end if;

  v_expected_worker := case p_caller_service_id
    when 'edge.content-critic-worker' then 'content-critic-chemistry-v1'
    when 'edge.content-repair-worker' then 'content-repair-chemistry-v1'
    else null
  end;
  if v_expected_worker is null then
    raise exception 'CHEMISTRY_CYBORG_STAGE_CALLER_NOT_ALLOWED';
  end if;

  select * into a
  from public.chemistry_worker_stage_attempts
  where id=p_attempt_id;
  if not found or a.lease_token<>p_lease_token then
    raise exception 'CHEMISTRY_CYBORG_STAGE_LEASE_INVALID';
  end if;
  if a.state<>'CLAIMED' then
    raise exception 'CHEMISTRY_CYBORG_STAGE_NOT_CLAIMED';
  end if;
  if a.lease_expires_at<=clock_timestamp() then
    raise exception 'CHEMISTRY_CYBORG_STAGE_LEASE_EXPIRED';
  end if;
  if a.worker_key<>v_expected_worker then
    raise exception 'CHEMISTRY_CYBORG_STAGE_WORKER_MISMATCH';
  end if;
  if p_caller_service_id='edge.content-critic-worker' and a.stage not in ('P3_REVIEW','FRESH_P3_REVIEW') then
    raise exception 'CHEMISTRY_CYBORG_STAGE_MISMATCH';
  end if;
  if p_caller_service_id='edge.content-repair-worker' and a.stage<>'REPAIRING' then
    raise exception 'CHEMISTRY_CYBORG_STAGE_MISMATCH';
  end if;

  select * into i from public.chemistry_worker_mission_items where id=a.item_id;
  if not found then raise exception 'CHEMISTRY_CYBORG_STAGE_ITEM_MISSING'; end if;
  if i.source_version<>a.source_version or i.source_hash<>a.source_hash then
    raise exception 'CHEMISTRY_CYBORG_STAGE_SOURCE_STALE';
  end if;
  if i.stage<>a.stage then
    raise exception 'CHEMISTRY_CYBORG_STAGE_STATE_STALE';
  end if;

  select * into m from public.chemistry_worker_missions where id=i.mission_id;
  if not found or m.mode<>'shadow' or m.state<>'RUNNING' then
    raise exception 'CHEMISTRY_CYBORG_MISSION_NOT_RUNNING';
  end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_CYBORG_FAIL_CLOSED_POSTURE_REQUIRED';
  end if;

  return jsonb_build_object(
    'attempt_id',a.id,
    'mission_id',m.id,
    'item_id',i.id,
    'stage',a.stage,
    'worker_key',a.worker_key,
    'worker_version',a.worker_version,
    'source_version',a.source_version,
    'source_hash',a.source_hash,
    'lease_expires_at',a.lease_expires_at
  );
end $$;

revoke all on function public.chemistry_assert_cyborg_stage_lease(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.chemistry_assert_cyborg_stage_lease(uuid,uuid,text) to service_role;

comment on function public.chemistry_assert_cyborg_stage_lease(uuid,uuid,text) is
'Fail-closed read-only Chemistry stage lease assertion used by Cyborg admission before Critic/Repair model capability issuance.';

commit;