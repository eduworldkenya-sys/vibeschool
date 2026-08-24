begin;

-- A Chemistry mission can legitimately be RUNNING after Laban has claimed work.
-- Re-opening/restarting the same owner command must reuse the existing durable
-- binding rather than reject the already-running mission as "not ready".
-- New bindings remain READY-only; this does not broaden activation authority.
create or replace function public.hq_bind_laban_chemistry_mission(p_chemistry_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  cm public.chemistry_worker_missions%rowtype;
  p public.vibe_publications%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  command_id uuid;
  existing_id uuid;
begin
  perform public.hq_assert_owner();

  select * into cm from public.chemistry_worker_missions where id=p_chemistry_mission_id for update;
  if not found then raise exception 'CHEMISTRY_MISSION_NOT_FOUND'; end if;
  if cm.mode <> 'shadow' then raise exception 'CHEMISTRY_MISSION_SHADOW_REQUIRED'; end if;

  select command_mission_id into existing_id
  from public.chemistry_laban_command_bindings
  where chemistry_mission_id=p_chemistry_mission_id;

  -- Existing binding is the canonical identity. RUNNING/WAITING/COMPLETED are
  -- valid replay states and must not manufacture a second command mission.
  if existing_id is not null then
    return jsonb_build_object(
      'chemistry_mission_id',p_chemistry_mission_id,
      'command_mission_id',existing_id,
      'commander_key','laban',
      'chemistry_state',cm.state,
      'state','BOUND'
    );
  end if;

  -- Only a brand-new binding requires the readiness transition point.
  if cm.state <> 'READY' then raise exception 'CHEMISTRY_MISSION_NOT_READY:%',cm.state; end if;

  select * into p from public.vibe_publications where id=cm.publication_id;
  if not found then raise exception 'CHEMISTRY_PUBLICATION_NOT_FOUND'; end if;
  if lower(coalesce(p.cbc_subject,'')) <> 'chemistry' and lower(coalesce(p.title,'')) not like '%chemistry%' then
    raise exception 'CHEMISTRY_PUBLICATION_REQUIRED';
  end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WORKFORCE_ENGINE_CONTRACT_REQUIRED'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'LABAN_CHEMISTRY_BINDING_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON';
  end if;

  if not exists(
    select 1 from public.hq_workforce_workers
    where worker_key='laban' and status in ('active','restricted')
  ) then raise exception 'LABAN_COMMANDER_NOT_AVAILABLE'; end if;

  insert into public.hq_workforce_command_missions(
    commander_key,title,success_criteria,risk_budget,state
  ) values (
    'laban',
    'Bounded Grade 10 Chemistry mission: '||coalesce(p.title,p.id::text),
    jsonb_build_array(
      'Author uses only database-authorized evidence through Cyborg',
      'Quality independently evaluates the exact artifact version',
      'Critic independently evaluates the exact artifact version through a valid Chemistry stage lease',
      'Repair executes only against an independently verified finding through a valid Chemistry stage lease',
      'Any repaired candidate receives fresh Quality and fresh Critic review',
      'No publication or release occurs without human approval',
      'Laban cannot self-certify or mint authority'
    ),
    jsonb_build_object(
      'mode','shadow','max_iterations',cm.iteration_budget,
      'publication_authority',false,'payment_authority',false,
      'runtime_activation_authority',false,'scheduler_authority',false,
      'global_stop_must_remain_on',true,
      'chemistry_mission_id',cm.id,'publication_id',cm.publication_id
    ),
    'planned'
  ) returning id into command_id;

  insert into public.chemistry_laban_command_bindings(
    chemistry_mission_id,command_mission_id,commander_key
  ) values (cm.id,command_id,'laban');

  perform public.hq_workforce_command_append_event(
    command_id,'laban','chemistry.mission.bound',
    jsonb_build_object(
      'chemistry_mission_id',cm.id,'publication_id',cm.publication_id,
      'chemistry_state',cm.state,'mode',cm.mode,'runtime_posture',cm.runtime_posture
    )
  );

  return jsonb_build_object(
    'chemistry_mission_id',cm.id,'command_mission_id',command_id,
    'commander_key','laban','chemistry_state',cm.state,'state','BOUND'
  );
end $$;

revoke all on function public.hq_bind_laban_chemistry_mission(uuid) from public,anon;
grant execute on function public.hq_bind_laban_chemistry_mission(uuid) to authenticated,service_role;

comment on function public.hq_bind_laban_chemistry_mission(uuid) is
'Owner-gated idempotent Laban binding. Existing durable bindings replay safely for RUNNING/WAITING/COMPLETED missions; only new bindings require READY.';

commit;
