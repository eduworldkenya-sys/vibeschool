begin;

-- P0: immutable bridge between Laban Chemistry stage leases and Cyborg model execution.
-- NON-ACTIVATING: no Worker runtime, heartbeat, factory, shadow scheduler, publishing,
-- payments, autonomy, risk budget, or Global Stop state is changed.
-- access: service-only public.chemistry_stage_execution_receipts
-- authorization-test: anon/authenticated have no table privileges; writes are service-only and append-only.
-- access: service-only public.chemistry_worker_artifacts
-- authorization-test: anon/authenticated have no table privileges; writes are service-only and append-only.

create table public.chemistry_stage_execution_receipts (
  attempt_id uuid primary key references public.chemistry_worker_stage_attempts(id) on delete restrict,
  item_id uuid not null references public.chemistry_worker_mission_items(id) on delete restrict,
  stage text not null check(stage in ('AUTHORING','P2_REVIEW','P3_REVIEW','REPAIRING','FRESH_P2_REVIEW','FRESH_P3_REVIEW')),
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  worker_version text not null,
  model_key text not null,
  cyborg_mission_id uuid not null,
  cyborg_invocation_id uuid not null unique,
  lineage jsonb not null,
  disposition text not null check(disposition in ('PASS','REPAIR_REQUIRED','ESCALATE','ERROR','DENIED','PAUSED')),
  completion_packet jsonb not null,
  evidence_refs text[] not null check(cardinality(evidence_refs)>0),
  created_at timestamptz not null default clock_timestamp()
);

create table public.chemistry_worker_artifacts (
  id uuid primary key,
  item_id uuid not null references public.chemistry_worker_mission_items(id) on delete restrict,
  attempt_id uuid not null unique references public.chemistry_worker_stage_attempts(id) on delete restrict,
  parent_artifact_id uuid references public.chemistry_worker_artifacts(id) on delete restrict,
  artifact_kind text not null check(artifact_kind in ('author_candidate','repair_candidate')),
  source_version text not null unique check(source_version like 'chemistry-artifact:%'),
  content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
  content jsonb not null,
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  worker_version text not null,
  cyborg_mission_id uuid not null,
  cyborg_invocation_id uuid not null,
  created_at timestamptz not null default clock_timestamp()
);

create index chemistry_worker_artifacts_item_created_idx
  on public.chemistry_worker_artifacts(item_id,created_at desc);

alter table public.chemistry_stage_execution_receipts enable row level security;
alter table public.chemistry_worker_artifacts enable row level security;
revoke all on public.chemistry_stage_execution_receipts,public.chemistry_worker_artifacts
  from public,anon,authenticated,service_role;
grant select,insert on public.chemistry_stage_execution_receipts,public.chemistry_worker_artifacts
  to service_role;

create trigger chemistry_stage_execution_receipts_append_only
before update or delete on public.chemistry_stage_execution_receipts
for each row execute function public.hq_workforce_reject_evidence_mutation();

create trigger chemistry_worker_artifacts_append_only
before update or delete on public.chemistry_worker_artifacts
for each row execute function public.hq_workforce_reject_evidence_mutation();

-- Extend the existing lease assertion to one dedicated cross-stage Chemistry executor.
-- Critic/Repair direct callers remain supported with their exact historic stage bindings.
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

  select * into a
  from public.chemistry_worker_stage_attempts
  where id=p_attempt_id;
  if not found or a.lease_token<>p_lease_token then
    raise exception 'CHEMISTRY_CYBORG_STAGE_LEASE_INVALID';
  end if;
  if a.state<>'CLAIMED' then raise exception 'CHEMISTRY_CYBORG_STAGE_NOT_CLAIMED'; end if;
  if a.lease_expires_at<=clock_timestamp() then raise exception 'CHEMISTRY_CYBORG_STAGE_LEASE_EXPIRED'; end if;

  v_expected_worker := case p_caller_service_id
    when 'edge.content-critic-worker' then 'content-critic-chemistry-v1'
    when 'edge.content-repair-worker' then 'content-repair-chemistry-v1'
    when 'edge.chemistry-stage-executor' then a.worker_key
    else null
  end;
  if v_expected_worker is null then raise exception 'CHEMISTRY_CYBORG_STAGE_CALLER_NOT_ALLOWED'; end if;
  if a.worker_key<>v_expected_worker then raise exception 'CHEMISTRY_CYBORG_STAGE_WORKER_MISMATCH'; end if;
  if p_caller_service_id='edge.content-critic-worker' and a.stage not in ('P3_REVIEW','FRESH_P3_REVIEW') then raise exception 'CHEMISTRY_CYBORG_STAGE_MISMATCH'; end if;
  if p_caller_service_id='edge.content-repair-worker' and a.stage<>'REPAIRING' then raise exception 'CHEMISTRY_CYBORG_STAGE_MISMATCH'; end if;

  select * into i from public.chemistry_worker_mission_items where id=a.item_id;
  if not found then raise exception 'CHEMISTRY_CYBORG_STAGE_ITEM_MISSING'; end if;
  if i.source_version<>a.source_version or i.source_hash<>a.source_hash then raise exception 'CHEMISTRY_CYBORG_STAGE_SOURCE_STALE'; end if;
  if i.stage<>a.stage then raise exception 'CHEMISTRY_CYBORG_STAGE_STATE_STALE'; end if;

  select * into m from public.chemistry_worker_missions where id=i.mission_id;
  if not found or m.mode<>'shadow' or m.state<>'RUNNING' then raise exception 'CHEMISTRY_CYBORG_MISSION_NOT_RUNNING'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_CYBORG_FAIL_CLOSED_POSTURE_REQUIRED';
  end if;

  return jsonb_build_object(
    'attempt_id',a.id,'mission_id',m.id,'item_id',i.id,'stage',a.stage,
    'worker_key',a.worker_key,'worker_version',a.worker_version,
    'source_version',a.source_version,'source_hash',a.source_hash,
    'lease_expires_at',a.lease_expires_at
  );
end $$;

revoke all on function public.chemistry_assert_cyborg_stage_lease(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.chemistry_assert_cyborg_stage_lease(uuid,uuid,text) to service_role;

-- Exact immutable execution packet. This never claims or completes a stage.
create or replace function public.chemistry_get_stage_execution_packet(
  p_attempt_id uuid,
  p_lease_token uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.chemistry_worker_stage_attempts%rowtype;
  i public.chemistry_worker_mission_items%rowtype;
  m public.chemistry_worker_missions%rowtype;
  c public.vibe_chapters%rowtype;
  r public.chemistry_stage_execution_receipts%rowtype;
  art public.chemistry_worker_artifacts%rowtype;
begin
  perform public.chemistry_assert_cyborg_stage_lease(
    p_attempt_id,p_lease_token,'edge.chemistry-stage-executor'
  );
  select * into a from public.chemistry_worker_stage_attempts where id=p_attempt_id;
  select * into i from public.chemistry_worker_mission_items where id=a.item_id;
  select * into m from public.chemistry_worker_missions where id=i.mission_id;
  select * into c from public.vibe_chapters where id=i.chapter_id;
  select * into r from public.chemistry_stage_execution_receipts where attempt_id=a.id;
  select * into art from public.chemistry_worker_artifacts
    where item_id=i.id order by created_at desc limit 1;

  return jsonb_build_object(
    'attempt',to_jsonb(a),
    'item',to_jsonb(i),
    'mission',to_jsonb(m),
    'chapter',jsonb_build_object(
      'id',c.id,'title',c.title,'strand',c.cbc_strand,
      'learning_outcomes',c.learning_outcomes,'blocks',c.blocks
    ),
    'latest_artifact',case when art.id is null then null else to_jsonb(art) end,
    'existing_receipt',case when r.attempt_id is null then null else to_jsonb(r) end
  );
end $$;

revoke all on function public.chemistry_get_stage_execution_packet(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.chemistry_get_stage_execution_packet(uuid,uuid) to service_role;

comment on function public.chemistry_get_stage_execution_packet(uuid,uuid) is
'Fail-closed service-only packet for one active Chemistry lease. Returns locked chapter/source, latest immutable candidate and any idempotent execution receipt; grants no authority.';

-- Reconstruction-time proof that installing this bridge cannot activate execution.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WORKFORCE_ENGINE_CONTRACT_REQUIRED'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_CYBORG_EXECUTION_BRIDGE_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
end $$;

commit;
