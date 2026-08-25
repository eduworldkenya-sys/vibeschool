begin;

-- P0: operationalize the Chemistry fast-trust doctrine without activating runtime,
-- schedulers, publishing, payments, or additional worker authority.
-- access: service-only public.chemistry_research_packs
-- authorization-test: public.chemistry_research_packs denies public/anon/authenticated writes and permits service_role select/insert only; append-only trigger denies update/delete.
-- access: service-only public.chemistry_coverage_snapshots
-- authorization-test: public.chemistry_coverage_snapshots denies public/anon/authenticated writes and permits service_role select/insert only; append-only trigger denies update/delete.

create table public.chemistry_research_packs (
  id uuid primary key,
  item_id uuid not null references public.chemistry_worker_mission_items(id) on delete restrict,
  chapter_id uuid not null references public.vibe_chapters(id) on delete restrict,
  pack_version integer not null check(pack_version > 0),
  source_version text not null unique check(source_version like 'chemistry-research-pack:%'),
  content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
  content jsonb not null,
  source_refs text[] not null check(cardinality(source_refs) > 0),
  created_by_stage_attempt_id uuid not null references public.chemistry_worker_stage_attempts(id) on delete restrict,
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  worker_version text not null,
  cyborg_mission_id uuid not null,
  cyborg_invocation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(item_id, pack_version)
);

create index chemistry_research_packs_item_created_idx
  on public.chemistry_research_packs(item_id, created_at desc);

create table public.chemistry_coverage_snapshots (
  id uuid primary key,
  attempt_id uuid not null unique references public.chemistry_worker_stage_attempts(id) on delete restrict,
  item_id uuid not null references public.chemistry_worker_mission_items(id) on delete restrict,
  artifact_id uuid references public.chemistry_worker_artifacts(id) on delete restrict,
  research_pack_id uuid references public.chemistry_research_packs(id) on delete restrict,
  coverage_state text not null check(coverage_state in ('COMPLETE','INCOMPLETE_EVIDENCE','SOURCE_CONFLICT','COVERAGE_UNKNOWN','OMISSION_DETECTED')),
  matrix jsonb not null,
  missing_requirements text[] not null default '{}',
  created_at timestamptz not null default clock_timestamp()
);

create index chemistry_coverage_snapshots_item_created_idx
  on public.chemistry_coverage_snapshots(item_id, created_at desc);

alter table public.chemistry_research_packs enable row level security;
alter table public.chemistry_coverage_snapshots enable row level security;
revoke all on public.chemistry_research_packs, public.chemistry_coverage_snapshots
  from public, anon, authenticated, service_role;
grant select, insert on public.chemistry_research_packs, public.chemistry_coverage_snapshots
  to service_role;

create trigger chemistry_research_packs_append_only
before update or delete on public.chemistry_research_packs
for each row execute function public.hq_workforce_reject_evidence_mutation();

create trigger chemistry_coverage_snapshots_append_only
before update or delete on public.chemistry_coverage_snapshots
for each row execute function public.hq_workforce_reject_evidence_mutation();

create or replace function public.chemistry_fast_trust_contract()
returns jsonb
language sql
stable
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'contract_version',1,
    'principle','parallelize_discovery_generate_cheaply_reuse_evidence_verify_independently_detect_omissions',
    'research_pack_required_sections',jsonb_build_array(
      'curriculum_outcomes','prerequisites','terminology','core_concepts','source_provenance',
      'misconceptions','experiments_and_activities','safety','expected_observations','worked_examples',
      'assessment_blueprint','marking_guidance','differentiation_and_inclusion','source_conflicts'
    ),
    'coverage_states',jsonb_build_array('COMPLETE','INCOMPLETE_EVIDENCE','SOURCE_CONFLICT','COVERAGE_UNKNOWN','OMISSION_DETECTED'),
    'critic_omission_search_required',true,
    'targeted_repair_required',true,
    'full_regeneration_requires_scope_justification',true
  )
$$;

revoke all on function public.chemistry_fast_trust_contract() from public,anon,authenticated;
grant execute on function public.chemistry_fast_trust_contract() to service_role;

-- Extend the canonical execution packet with immutable shared research evidence and
-- the latest completed independent review so Repair can receive exact defect targets.
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
  pack public.chemistry_research_packs%rowtype;
  prior_review public.chemistry_stage_execution_receipts%rowtype;
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
  select * into pack from public.chemistry_research_packs
    where item_id=i.id order by pack_version desc limit 1;
  select * into prior_review from public.chemistry_stage_execution_receipts
    where item_id=i.id
      and attempt_id<>a.id
      and stage in ('P2_REVIEW','P3_REVIEW','FRESH_P2_REVIEW','FRESH_P3_REVIEW')
    order by created_at desc limit 1;

  return jsonb_build_object(
    'attempt',to_jsonb(a),
    'item',to_jsonb(i),
    'mission',to_jsonb(m),
    'chapter',jsonb_build_object(
      'id',c.id,'title',c.title,'strand',c.cbc_strand,
      'learning_outcomes',c.learning_outcomes,'blocks',c.blocks
    ),
    'fast_trust_contract',public.chemistry_fast_trust_contract(),
    'research_pack',case when pack.id is null then null else to_jsonb(pack) end,
    'latest_review_receipt',case when prior_review.attempt_id is null then null else to_jsonb(prior_review) end,
    'latest_artifact',case when art.id is null then null else to_jsonb(art) end,
    'existing_receipt',case when r.attempt_id is null then null else to_jsonb(r) end
  );
end $$;

revoke all on function public.chemistry_get_stage_execution_packet(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.chemistry_get_stage_execution_packet(uuid,uuid) to service_role;

create or replace function public.chemistry_enforce_fast_trust_receipt()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  q jsonb:=coalesce(new.completion_packet->'quality_evidence','{}'::jsonb);
  v integer:=coalesce(nullif(new.completion_packet->>'fast_trust_contract_version','')::integer,0);
begin
  if v<>1 then raise exception 'CHEMISTRY_FAST_TRUST_CONTRACT_VERSION_REQUIRED'; end if;

  if new.disposition='PASS' and new.stage='AUTHORING' then
    if nullif(new.completion_packet->>'research_pack_id','') is null
       or coalesce(q->>'coverage_state','')<>'COMPLETE' then
      raise exception 'CHEMISTRY_AUTHOR_PASS_REQUIRES_RESEARCH_PACK_AND_COMPLETE_COVERAGE';
    end if;
  elsif new.disposition='PASS' and new.stage in ('P2_REVIEW','FRESH_P2_REVIEW') then
    if coalesce(q->>'coverage_state','')<>'COMPLETE'
       or coalesce(nullif(q->>'missing_requirement_count','')::integer,999)>0 then
      raise exception 'CHEMISTRY_QUALITY_PASS_REQUIRES_COMPLETE_COVERAGE';
    end if;
  elsif new.disposition='PASS' and new.stage in ('P3_REVIEW','FRESH_P3_REVIEW') then
    if not coalesce((q->>'omission_search_performed')::boolean,false)
       or coalesce(q->>'coverage_state','')<>'COMPLETE'
       or coalesce(nullif(q->>'omission_count','')::integer,999)>0 then
      raise exception 'CHEMISTRY_CRITIC_PASS_REQUIRES_ZERO_OMISSIONS';
    end if;
  elsif new.disposition='PASS' and new.stage='REPAIRING' then
    if not coalesce((q->>'targeted_repair')::boolean,false)
       or coalesce(nullif(q->>'repair_target_count','')::integer,0)<=0
       or coalesce(nullif(q->>'unresolved_repair_target_count','')::integer,999)>0
       or coalesce(q->>'coverage_state','')<>'COMPLETE' then
      raise exception 'CHEMISTRY_REPAIR_PASS_REQUIRES_RESOLVED_TARGETS_AND_COMPLETE_COVERAGE';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists chemistry_enforce_fast_trust_receipt on public.chemistry_stage_execution_receipts;
create trigger chemistry_enforce_fast_trust_receipt
before insert on public.chemistry_stage_execution_receipts
for each row execute function public.chemistry_enforce_fast_trust_receipt();

-- Reconstruction-time proof: schema installation cannot commission execution.
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
    raise exception 'CHEMISTRY_FAST_TRUST_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
end $$;

commit;
