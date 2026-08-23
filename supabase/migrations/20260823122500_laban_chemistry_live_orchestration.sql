begin;

-- Canonical live read-model + bounded commander handoff for Laban → Chemistry.
-- NON-ACTIVATING: no Worker runtime, scheduler, publishing, payments, or Global Stop changes.
-- authorization-test: all RPCs below require hq_assert_owner(); direct execution is denied to public/anon.

create or replace function public.hq_laban_claim_chemistry_stage(
  p_item_id uuid,
  p_expected_queued_stage text,
  p_lease_seconds integer default 120
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_mission_id uuid;
  v_command_id uuid;
  v_claim jsonb;
begin
  perform public.hq_assert_owner();

  select i.mission_id into v_mission_id
  from public.chemistry_worker_mission_items i
  where i.id=p_item_id;
  if v_mission_id is null then raise exception 'CHEMISTRY_ITEM_NOT_FOUND'; end if;

  select b.command_mission_id into v_command_id
  from public.chemistry_laban_command_bindings b
  where b.chemistry_mission_id=v_mission_id;
  if v_command_id is null then raise exception 'LABAN_CHEMISTRY_BINDING_REQUIRED'; end if;

  update public.hq_workforce_command_missions
  set state='active',updated_at=clock_timestamp()
  where id=v_command_id and state='planned';

  v_claim:=public.chemistry_claim_stage(
    p_item_id,
    p_expected_queued_stage,
    'laban-command',
    p_lease_seconds
  );

  perform public.hq_workforce_command_append_event(
    v_command_id,
    'laban',
    'chemistry.stage.delegated',
    jsonb_build_object(
      'chemistry_mission_id',v_mission_id,
      'item_id',p_item_id,
      'queued_stage',p_expected_queued_stage,
      'attempt_id',v_claim->>'attempt_id',
      'worker_key',v_claim->>'worker_key',
      'worker_version',v_claim->>'worker_version',
      'source_version',v_claim->>'source_version',
      'source_hash',v_claim->>'source_hash',
      'side_effects_allowed',false
    )
  );

  return v_claim||jsonb_build_object(
    'commander_key','laban',
    'command_mission_id',v_command_id
  );
end $$;

create or replace function public.hq_get_laban_chemistry_mission_dashboard(p_mission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
  perform public.hq_assert_owner();

  select jsonb_build_object(
    'mission',to_jsonb(m),
    'binding',case when b.chemistry_mission_id is null then null else jsonb_build_object(
      'command_mission_id',b.command_mission_id,
      'commander_key',b.commander_key,
      'command_state',cmd.state,
      'command_title',cmd.title,
      'risk_budget',cmd.risk_budget,
      'bound_at',b.created_at
    ) end,
    'runtime',jsonb_build_object(
      'runtime_execution_enabled',ec.runtime_execution_enabled,
      'shadow_enabled',ec.shadow_enabled,
      'shadow_scheduler_enabled',ec.shadow_scheduler_enabled,
      'global_stop',ec.shadow_global_stop
    ),
    'items',coalesce((
      select jsonb_agg(
        to_jsonb(i)||jsonb_build_object(
          'chapter_title',c.title,
          'attempts',coalesce((
            select jsonb_agg(to_jsonb(a) order by a.claimed_at)
            from public.chemistry_worker_stage_attempts a
            where a.item_id=i.id
          ),'[]'::jsonb),
          'latest_evidence',coalesce((
            select jsonb_agg(jsonb_build_object(
              'attempt_id',e.attempt_id,
              'event_type',e.event_type,
              'actor_key',e.actor_key,
              'evidence_refs',e.evidence_refs,
              'payload',e.payload,
              'created_at',e.created_at
            ) order by e.created_at desc)
            from public.chemistry_worker_stage_events e
            join public.chemistry_worker_stage_attempts a2 on a2.id=e.attempt_id
            where a2.item_id=i.id
          ),'[]'::jsonb)
        ) order by i.created_at
      )
      from public.chemistry_worker_mission_items i
      join public.vibe_chapters c on c.id=i.chapter_id
      where i.mission_id=m.id
    ),'[]'::jsonb),
    'command_events',coalesce((
      select jsonb_agg(to_jsonb(e) order by e.id desc)
      from public.hq_workforce_command_ledger e
      where e.mission_id=b.command_mission_id
    ),'[]'::jsonb)
  ) into v
  from public.chemistry_worker_missions m
  left join public.chemistry_laban_command_bindings b on b.chemistry_mission_id=m.id
  left join public.hq_workforce_command_missions cmd on cmd.id=b.command_mission_id
  left join public.hq_workforce_engine_contract ec on ec.singleton=true
  where m.id=p_mission_id;

  return v;
end $$;

revoke all on function public.hq_laban_claim_chemistry_stage(uuid,text,integer),public.hq_get_laban_chemistry_mission_dashboard(uuid) from public,anon;
grant execute on function public.hq_laban_claim_chemistry_stage(uuid,text,integer),public.hq_get_laban_chemistry_mission_dashboard(uuid) to authenticated,service_role;

commit;
