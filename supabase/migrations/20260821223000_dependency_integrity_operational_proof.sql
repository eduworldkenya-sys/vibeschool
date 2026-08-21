-- Dependency Integrity operational proof hardening.
-- Additive, non-activating control-plane repair. Runtime, schedulers, publishing,
-- payments, shadow execution, grants, and autonomy remain unchanged.
-- access: service-only public.hq_workforce_mission_checkpoint_events
-- authorization-test: public.hq_workforce_mission_checkpoint_events denies product roles and direct service writes
-- access: service-only public.content_convergence_evaluation_identities
-- authorization-test: public.content_convergence_evaluation_identities denies product roles and direct service writes

create table public.hq_workforce_mission_checkpoint_events (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.hq_workforce_mission_checkpoints(id),
  from_state text,
  to_state text not null check (to_state in ('interrupted','resume_ready','resumed','closed')),
  candidate_revision text not null,
  actor_key text not null,
  evidence_refs text[] not null,
  reason text not null,
  next_safe_action jsonb,
  created_at timestamptz not null default clock_timestamp(),
  check (cardinality(evidence_refs)>0),
  check (nullif(trim(actor_key),'') is not null),
  check (nullif(trim(candidate_revision),'') is not null),
  unique(checkpoint_id,to_state,candidate_revision)
);

create table public.content_convergence_evaluation_identities (
  evaluation_id uuid primary key references public.content_convergence_evaluations(id) on delete restrict,
  evaluator_worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  evaluator_worker_version text not null,
  evaluator_execution_id text not null,
  author_worker_key text not null,
  author_worker_version text not null,
  evidence_refs text[] not null,
  recorded_at timestamptz not null default clock_timestamp(),
  check (evaluator_worker_key<>author_worker_key),
  check (cardinality(evidence_refs)>0)
);

alter table public.hq_workforce_mission_checkpoint_events enable row level security;
alter table public.content_convergence_evaluation_identities enable row level security;

create trigger hq_workforce_mission_checkpoint_events_append_only
before update or delete on public.hq_workforce_mission_checkpoint_events
for each row execute function public.hq_workforce_reject_evidence_mutation();
create trigger content_convergence_evaluation_identities_append_only
before update or delete on public.content_convergence_evaluation_identities
for each row execute function public.hq_workforce_reject_evidence_mutation();

revoke all on table public.hq_workforce_mission_checkpoint_events,public.content_convergence_evaluation_identities from public,anon,authenticated;
revoke insert,update,delete on table public.hq_workforce_mission_checkpoint_events,public.content_convergence_evaluation_identities from service_role;
grant select on table public.hq_workforce_mission_checkpoint_events,public.content_convergence_evaluation_identities to service_role;

create or replace function public.hq_workforce_checkpoint_current_state(p_checkpoint_id uuid)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(
    (select e.to_state from public.hq_workforce_mission_checkpoint_events e where e.checkpoint_id=p_checkpoint_id order by e.created_at desc,e.id desc limit 1),
    (select c.state from public.hq_workforce_mission_checkpoints c where c.id=p_checkpoint_id)
  )
$$;

create or replace function public.hq_workforce_record_checkpoint_event(
  p_checkpoint_id uuid,p_expected_state text,p_to_state text,p_candidate_revision text,
  p_actor_key text,p_evidence_refs text[],p_reason text,p_next_safe_action jsonb default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_current text; v_id uuid;
begin
  select public.hq_workforce_checkpoint_current_state(p_checkpoint_id) into v_current;
  if v_current is null then raise exception 'dependency_checkpoint_not_found'; end if;
  if v_current<>p_expected_state then raise exception 'dependency_checkpoint_state_mismatch'; end if;
  if not ((v_current='interrupted' and p_to_state='resume_ready') or (v_current='resume_ready' and p_to_state='resumed') or (v_current='resumed' and p_to_state='closed')) then
    raise exception 'invalid_dependency_checkpoint_transition';
  end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 or nullif(trim(p_actor_key),'') is null or nullif(trim(p_candidate_revision),'') is null then
    raise exception 'dependency_checkpoint_event_evidence_required';
  end if;
  insert into public.hq_workforce_mission_checkpoint_events(checkpoint_id,from_state,to_state,candidate_revision,actor_key,evidence_refs,reason,next_safe_action)
  values(p_checkpoint_id,v_current,p_to_state,p_candidate_revision,p_actor_key,p_evidence_refs,p_reason,p_next_safe_action)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_revalidation(
  p_impact_id uuid,p_candidate_revision text,p_gate_results jsonb,p_evidence_refs text[],p_evaluator_key text,p_passed boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_discoverer text;
begin
  if jsonb_typeof(coalesce(p_gate_results,'[]'))<>'array' or jsonb_array_length(coalesce(p_gate_results,'[]'))=0 or cardinality(coalesce(p_evidence_refs,'{}'))=0 then raise exception 'dependency_revalidation_evidence_required'; end if;
  if nullif(trim(p_candidate_revision),'') is null or nullif(trim(p_evaluator_key),'') is null then raise exception 'dependency_revalidation_identity_required'; end if;
  select f.discovered_by into v_discoverer from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id where i.id=p_impact_id;
  if v_discoverer is null then raise exception 'dependency_impact_not_found'; end if;
  if p_evaluator_key=v_discoverer then raise exception 'dependency_self_revalidation_forbidden'; end if;
  if p_passed and exists(select 1 from jsonb_array_elements(p_gate_results) g where coalesce((g->>'passed')::boolean,false) is not true) then raise exception 'contradictory_dependency_revalidation'; end if;
  insert into public.hq_workforce_dependency_revalidations(impact_id,candidate_revision,gate_results,evidence_refs,evaluator_key,passed)
  values(p_impact_id,p_candidate_revision,p_gate_results,p_evidence_refs,p_evaluator_key,p_passed)
  returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_resume_dependency_mission(
  p_checkpoint_id uuid,p_expected_interrupted_revision text,p_repaired_revision text,
  p_actor_key text,p_evidence_refs text[]
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.hq_workforce_mission_checkpoints%rowtype; v_unready integer; v_resolution integer; v_ready uuid; v_resumed uuid; ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into c from public.hq_workforce_mission_checkpoints where id=p_checkpoint_id;
  if not found then raise exception 'dependency_checkpoint_not_found'; end if;
  if c.candidate_revision<>p_expected_interrupted_revision then raise exception 'stale_dependency_checkpoint'; end if;
  if public.hq_workforce_checkpoint_current_state(c.id)<>'interrupted' then raise exception 'dependency_checkpoint_not_interrupted'; end if;
  select count(*) into v_unready from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id
  where f.checkpoint_id=c.id and i.risk_state in ('at_risk','blocked','stopped')
    and not exists(select 1 from public.hq_workforce_dependency_revalidations r where r.impact_id=i.id and r.candidate_revision=p_repaired_revision and r.passed);
  if v_unready>0 then raise exception 'dependency_impacts_not_revalidated'; end if;
  select count(*) into v_resolution from public.hq_workforce_dependency_findings f
  where f.checkpoint_id=c.id and f.status='resolved' and f.repair_revision=p_repaired_revision;
  if v_resolution=0 then raise exception 'dependency_resolution_required'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'dependency_resume_requires_fail_closed_runtime'; end if;
  v_ready:=public.hq_workforce_record_checkpoint_event(c.id,'interrupted','resume_ready',p_repaired_revision,p_actor_key,p_evidence_refs,'all recorded resume conditions passed',c.next_safe_action);
  v_resumed:=public.hq_workforce_record_checkpoint_event(c.id,'resume_ready','resumed',p_repaired_revision,p_actor_key,p_evidence_refs,'mission automatically resumed from checkpoint',c.next_safe_action);
  return jsonb_build_object('checkpoint_id',c.id,'mission_key',c.mission_key,'priority_key',c.priority_key,'state','resumed','next_safe_action',c.next_safe_action,'resume_ready_event_id',v_ready,'resumed_event_id',v_resumed);
end $$;

create or replace function public.content_convergence_assert_certified_worker(p_worker_key text,p_expected_archetype text default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype;
begin
  select * into a from public.hq_workforce_worker_assurance
  where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1;
  if not found then raise exception 'CONTENT_WORKER_IDENTITY_NOT_REGISTERED'; end if;
  if a.certification_state<>'CERTIFIED' or coalesce(a.qualification_state,'')<>'CERTIFIED' or a.legacy_recertification_required or a.expires_at is null or a.expires_at<=clock_timestamp() then raise exception 'CONTENT_WORKER_CERTIFICATION_NOT_CURRENT'; end if;
  if p_expected_archetype is not null and a.archetype<>p_expected_archetype then raise exception 'CONTENT_WORKER_ARCHETYPE_MISMATCH'; end if;
  if nullif(trim(a.worker_version),'') is null then raise exception 'CONTENT_WORKER_VERSION_REQUIRED'; end if;
  return jsonb_build_object('worker_key',a.worker_key,'worker_version',a.worker_version,'archetype',a.archetype,'certified_at',a.certified_at,'expires_at',a.expires_at);
end $$;

create or replace function public.content_convergence_start(
  p_publication_id uuid,p_content_hash text,p_content_snapshot jsonb,p_worker_key text,p_worker_execution_id text,
  p_provenance jsonb,p_curriculum_identity jsonb,p_idempotency_key text,p_mode text default 'shadow'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_existing uuid; v_version uuid; v_existing_worker text; v_run uuid; v_worker jsonb;
begin
  select id into v_existing from public.content_convergence_runs where idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if not exists(select 1 from public.vibe_publications where id=p_publication_id) then raise exception 'PUBLICATION_NOT_FOUND'; end if;
  if nullif(trim(p_worker_execution_id),'') is null then raise exception 'CONTENT_WORKER_EXECUTION_ID_REQUIRED'; end if;
  v_worker:=public.content_convergence_assert_certified_worker(p_worker_key,'author');
  if p_mode not in ('shadow','draft_canary','release_candidate') then raise exception 'INVALID_CONVERGENCE_MODE'; end if;
  if p_mode<>'shadow' and exists(select 1 from public.hq_workforce_engine_contract where singleton=true and (shadow_global_stop or not runtime_execution_enabled)) then raise exception 'WORKER_ENGINE_GLOBAL_STOP_OR_RUNTIME_OFF'; end if;
  select id,worker_key into v_version,v_existing_worker from public.content_convergence_versions where publication_id=p_publication_id and content_hash=p_content_hash;
  if v_version is not null and v_existing_worker<>p_worker_key then raise exception 'CONTENT_ARTIFACT_LINEAGE_CONFLICT'; end if;
  if v_version is null then
    insert into public.content_convergence_versions(publication_id,version_number,content_hash,content_snapshot,worker_key,worker_execution_id,provenance,curriculum_identity,evaluation_lineage)
    values(p_publication_id,1,p_content_hash,coalesce(p_content_snapshot,'{}'),p_worker_key,p_worker_execution_id,coalesce(p_provenance,'{}'),coalesce(p_curriculum_identity,'{}'),jsonb_build_array(jsonb_build_object('stage','AUTHOR','identity',v_worker,'execution_id',p_worker_execution_id)))
    returning id into v_version;
  end if;
  insert into public.content_convergence_runs(publication_id,current_version_id,state,idempotency_key,mode) values(p_publication_id,v_version,'AUTHORED',p_idempotency_key,p_mode) returning id into v_run;
  insert into public.content_convergence_events(run_id,from_state,to_state,actor,execution_id,artifact_version_id,artifact_hash,reason,evidence)
  values(v_run,'DRAFT','AUTHORED',p_worker_key,p_worker_execution_id,v_version,p_content_hash,'convergence run initialized',jsonb_build_object('mode',p_mode,'worker_identity',v_worker));
  return v_run;
end $$;

create or replace function public.content_convergence_record_governed_evaluation(
  p_run_id uuid,p_version_id uuid,p_stage text,p_evaluator_worker_key text,p_worker_execution_id text,p_content_hash text,
  p_disposition text,p_quality_score numeric,p_dimensions jsonb,p_findings jsonb,p_safety_status text,p_assessment_status text,
  p_provenance_status text,p_evidence_refs text[]
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_version public.content_convergence_versions%rowtype; v_author jsonb; v_evaluator jsonb; v_id uuid;
begin
  select * into v_version from public.content_convergence_versions where id=p_version_id;
  if not found then raise exception 'CONVERGENCE_VERSION_NOT_FOUND'; end if;
  v_author:=public.content_convergence_assert_certified_worker(v_version.worker_key,'author');
  v_evaluator:=public.content_convergence_assert_certified_worker(p_evaluator_worker_key,null);
  if p_evaluator_worker_key=v_version.worker_key then raise exception 'CONTENT_SELF_EVALUATION_FORBIDDEN'; end if;
  if p_stage='P2' and (v_evaluator->>'archetype') not in ('critic','operational') then raise exception 'CONTENT_QUALITY_EVALUATOR_ARCHETYPE_REQUIRED'; end if;
  if p_stage='P3' and (v_evaluator->>'archetype')<>'critic' then raise exception 'CONTENT_CRITIC_ARCHETYPE_REQUIRED'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 then raise exception 'CONTENT_EVALUATION_EVIDENCE_REQUIRED'; end if;
  v_id:=public.content_convergence_record_evaluation(p_run_id,p_version_id,p_stage,p_worker_execution_id,p_content_hash,p_disposition,p_quality_score,p_dimensions,p_findings,p_safety_status,p_assessment_status,p_provenance_status);
  insert into public.content_convergence_evaluation_identities(evaluation_id,evaluator_worker_key,evaluator_worker_version,evaluator_execution_id,author_worker_key,author_worker_version,evidence_refs)
  values(v_id,p_evaluator_worker_key,v_evaluator->>'worker_version',p_worker_execution_id,v_version.worker_key,v_author->>'worker_version',p_evidence_refs);
  return v_id;
end $$;

create or replace function public.hq_workforce_get_dependency_integrity_packet(p_checkpoint_key text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v jsonb;
begin
  perform public.hq_assert_owner();
  select jsonb_build_object(
    'checkpoint',to_jsonb(c),'current_state',public.hq_workforce_checkpoint_current_state(c.id),
    'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]') from public.hq_workforce_mission_checkpoint_events e where e.checkpoint_id=c.id),
    'findings',(select coalesce(jsonb_agg(to_jsonb(f) order by f.discovered_at,f.id),'[]') from public.hq_workforce_dependency_findings f where f.checkpoint_id=c.id),
    'impacts',(select coalesce(jsonb_agg(to_jsonb(i) order by i.recorded_at,i.id),'[]') from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id),
    'revalidations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.evaluated_at,r.id),'[]') from public.hq_workforce_dependency_revalidations r join public.hq_workforce_dependency_impacts i on i.id=r.impact_id join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id)
  ) into v from public.hq_workforce_mission_checkpoints c where c.checkpoint_key=p_checkpoint_key;
  return v;
end $$;

revoke all on function public.hq_workforce_checkpoint_current_state(uuid),public.hq_workforce_record_checkpoint_event(uuid,text,text,text,text,text[],text,jsonb),public.hq_workforce_resume_dependency_mission(uuid,text,text,text,text[]),public.content_convergence_assert_certified_worker(text,text),public.content_convergence_record_governed_evaluation(uuid,uuid,text,text,text,text,text,numeric,jsonb,jsonb,text,text,text,text[]),public.hq_workforce_get_dependency_integrity_packet(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_checkpoint_current_state(uuid),public.hq_workforce_record_checkpoint_event(uuid,text,text,text,text,text[],text,jsonb),public.hq_workforce_resume_dependency_mission(uuid,text,text,text,text[]),public.content_convergence_assert_certified_worker(text,text),public.content_convergence_record_governed_evaluation(uuid,uuid,text,text,text,text,text,numeric,jsonb,jsonb,text,text,text,text[]) to service_role;
grant execute on function public.hq_workforce_get_dependency_integrity_packet(text) to authenticated,service_role;

-- The legacy evaluation RPC lacks evaluator identity. Keep it callable internally by
-- the governed wrapper, but remove direct service-role access.
revoke execute on function public.content_convergence_record_evaluation(uuid,uuid,text,text,text,text,numeric,jsonb,jsonb,text,text,text) from service_role;
