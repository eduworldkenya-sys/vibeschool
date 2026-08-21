-- Independent-assurance repair: fail closed on interruption, invalidation,
-- evaluator identity, depth bounds, and deterministic resume conditions.
-- access: service-only public.hq_workforce_dependency_invalidations
-- authorization-test: public.hq_workforce_dependency_invalidations denies product roles and direct service writes

create table public.hq_workforce_dependency_invalidations (
  id uuid primary key default gen_random_uuid(),
  impact_id uuid not null unique references public.hq_workforce_dependency_impacts(id),
  affected_type text not null,
  affected_key text not null,
  prior_decision text not null,
  invalidation_state text not null check(invalidation_state in ('CERTIFICATION AT RISK','BLOCKED','STOPPED')),
  invalidated_gate_keys text[] not null,
  evidence_refs text[] not null,
  invalidated_at timestamptz not null default clock_timestamp(),
  check(cardinality(evidence_refs)>0)
);
alter table public.hq_workforce_dependency_invalidations enable row level security;
create trigger hq_workforce_dependency_invalidations_append_only before update or delete on public.hq_workforce_dependency_invalidations for each row execute function public.hq_workforce_reject_evidence_mutation();
revoke all on table public.hq_workforce_dependency_invalidations from public,anon,authenticated;
revoke insert,update,delete on table public.hq_workforce_dependency_invalidations from service_role;
grant select on table public.hq_workforce_dependency_invalidations to service_role;

create or replace function public.hq_workforce_auto_invalidate_dependency_impact() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.hq_workforce_dependency_findings%rowtype;
begin
  if new.risk_state='unaffected' then return new; end if;
  select * into f from public.hq_workforce_dependency_findings where id=new.finding_id;
  insert into public.hq_workforce_dependency_invalidations(impact_id,affected_type,affected_key,prior_decision,invalidation_state,invalidated_gate_keys,evidence_refs)
  values(new.id,new.affected_type,new.affected_key,new.prior_state,case new.risk_state when 'at_risk' then 'CERTIFICATION AT RISK' when 'blocked' then 'BLOCKED' else 'STOPPED' end,new.invalidated_gate_keys,f.evidence_refs);
  return new;
end $$;
create trigger hq_workforce_dependency_impacts_auto_invalidate after insert on public.hq_workforce_dependency_impacts for each row execute function public.hq_workforce_auto_invalidate_dependency_impact();

create or replace function public.hq_workforce_record_dependency_interruption(
  p_checkpoint_key text,p_mission_key text,p_priority_key text,p_candidate_revision text,
  p_completed_gates jsonb,p_open_findings jsonb,p_next_safe_action jsonb,p_resume_conditions jsonb,
  p_context_snapshot jsonb,p_evidence_refs text[],p_checkpointed_by text,
  p_finding_key text,p_incident_id uuid,p_source_type text,p_source_key text,
  p_dependency_type text,p_dependency_key text,p_classification text,p_causal_confidence numeric,
  p_causal_evidence jsonb,p_blast_radius jsonb,p_containment jsonb,p_finding_evidence_refs text[],p_discovered_by text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_checkpoint uuid; v_finding uuid; v_overflow boolean;
begin
  if p_classification not in ('blocking_dependency','certification_at_risk','security_or_data_integrity') then raise exception 'classification_does_not_authorize_interruption'; end if;
  if jsonb_typeof(coalesce(p_resume_conditions,'[]'))<>'array' or jsonb_array_length(coalesce(p_resume_conditions,'[]'))=0 or exists(select 1 from jsonb_array_elements(p_resume_conditions) c where nullif(c->>'key','') is null or nullif(c->>'expected','') is null) then raise exception 'structured_resume_conditions_required'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 or cardinality(coalesce(p_finding_evidence_refs,'{}'))=0 then raise exception 'dependency_evidence_required'; end if;
  if exists(
    with recursive dependency_path(node_type,node_key,depth,visited) as (
      select p_dependency_type,p_dependency_key,0,array[p_dependency_type||':'||p_dependency_key]
      union all select d.dependency_type,d.dependency_key,p.depth+1,p.visited||(d.dependency_type||':'||d.dependency_key)
      from dependency_path p join public.hq_workforce_dependency_findings d on d.source_type=p.node_type and d.source_key=p.node_key
      where p.depth<32 and not (d.dependency_type||':'||d.dependency_key)=any(p.visited)
    ) select 1 from dependency_path where node_type=p_source_type and node_key=p_source_key
  ) then raise exception 'dependency_cycle_detected'; end if;
  select exists(
    with recursive dependency_path(node_type,node_key,depth,visited) as (
      select p_dependency_type,p_dependency_key,0,array[p_dependency_type||':'||p_dependency_key]
      union all select d.dependency_type,d.dependency_key,p.depth+1,p.visited||(d.dependency_type||':'||d.dependency_key)
      from dependency_path p join public.hq_workforce_dependency_findings d on d.source_type=p.node_type and d.source_key=p.node_key
      where p.depth<32 and not (d.dependency_type||':'||d.dependency_key)=any(p.visited)
    ) select 1 from dependency_path p where p.depth=32 and exists(select 1 from public.hq_workforce_dependency_findings d where d.source_type=p.node_type and d.source_key=p.node_key and not (d.dependency_type||':'||d.dependency_key)=any(p.visited))
  ) into v_overflow;
  if v_overflow then raise exception 'dependency_depth_limit_exceeded'; end if;
  insert into public.hq_workforce_mission_checkpoints(checkpoint_key,mission_key,priority_key,candidate_revision,state,completed_gates,open_findings,next_safe_action,resume_conditions,context_snapshot,evidence_refs,checkpointed_by)
  values(p_checkpoint_key,p_mission_key,p_priority_key,p_candidate_revision,'interrupted',coalesce(p_completed_gates,'[]'),coalesce(p_open_findings,'[]'),p_next_safe_action,p_resume_conditions,coalesce(p_context_snapshot,'{}'),p_evidence_refs,p_checkpointed_by) returning id into v_checkpoint;
  insert into public.hq_workforce_dependency_findings(finding_key,incident_id,checkpoint_id,source_type,source_key,dependency_type,dependency_key,classification,causal_confidence,causal_evidence,blast_radius,containment,evidence_refs,discovered_by)
  values(p_finding_key,p_incident_id,v_checkpoint,p_source_type,p_source_key,p_dependency_type,p_dependency_key,p_classification,p_causal_confidence,p_causal_evidence,p_blast_radius,coalesce(p_containment,'{}'),p_finding_evidence_refs,p_discovered_by) returning id into v_finding;
  return jsonb_build_object('checkpoint_id',v_checkpoint,'finding_id',v_finding);
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
  if not exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p_evaluator_key and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp()) then raise exception 'dependency_evaluator_not_current_certified_machine'; end if;
  if p_passed and exists(select 1 from jsonb_array_elements(p_gate_results) g where coalesce((g->>'passed')::boolean,false) is not true) then raise exception 'contradictory_dependency_revalidation'; end if;
  insert into public.hq_workforce_dependency_revalidations(impact_id,candidate_revision,gate_results,evidence_refs,evaluator_key,passed) values(p_impact_id,p_candidate_revision,p_gate_results,p_evidence_refs,p_evaluator_key,p_passed) returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_resolution(
  p_finding_id uuid,p_expected_finding_status text,p_repair_candidate_id uuid,p_repair_revision text,
  p_regression_case_ids uuid[],p_positive_control_ids uuid[],p_revalidation_evidence text[],p_actor_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.hq_workforce_dependency_findings%rowtype; c public.hq_workforce_improvement_candidates%rowtype; v_id uuid; v_unready integer;
begin
  select * into f from public.hq_workforce_dependency_findings where id=p_finding_id; if not found then raise exception 'dependency_finding_not_found'; end if;
  if f.status<>p_expected_finding_status then raise exception 'dependency_finding_status_mismatch'; end if;
  select * into c from public.hq_workforce_improvement_candidates where id=p_repair_candidate_id;
  if not found or c.candidate_version<>p_repair_revision then raise exception 'dependency_repair_candidate_revision_mismatch'; end if;
  if cardinality(coalesce(p_regression_case_ids,'{}'))=0 or cardinality(coalesce(p_positive_control_ids,'{}'))=0 then raise exception 'dependency_controls_required'; end if;
  if exists(select 1 from unnest(p_regression_case_ids) x(id) left join public.hq_workforce_regression_cases r on r.id=x.id where r.id is null or r.positive_control) then raise exception 'dependency_negative_regression_invalid'; end if;
  if exists(select 1 from unnest(p_positive_control_ids) x(id) left join public.hq_workforce_regression_cases r on r.id=x.id where r.id is null or not r.positive_control) then raise exception 'dependency_positive_control_invalid'; end if;
  select count(*) into v_unready from public.hq_workforce_dependency_impacts i where i.finding_id=p_finding_id and i.risk_state in ('at_risk','blocked','stopped') and not exists(select 1 from public.hq_workforce_dependency_revalidations r where r.impact_id=i.id and r.candidate_revision=p_repair_revision and r.passed and r.evaluator_key<>c.proposed_by);
  if v_unready>0 or p_actor_key=c.proposed_by then raise exception 'dependency_independent_revalidation_required'; end if;
  insert into public.hq_workforce_dependency_findings(finding_key,incident_id,checkpoint_id,source_type,source_key,dependency_type,dependency_key,classification,causal_confidence,causal_evidence,blast_radius,containment,regression_case_ids,positive_control_ids,status,repair_candidate_id,repair_revision,evidence_refs,discovered_by)
  values(f.finding_key||':resolution:'||p_repair_revision,f.incident_id,f.checkpoint_id,f.source_type,f.source_key,f.dependency_type,f.dependency_key,f.classification,f.causal_confidence,f.causal_evidence,f.blast_radius,f.containment,p_regression_case_ids,p_positive_control_ids,'resolved',p_repair_candidate_id,p_repair_revision,p_revalidation_evidence,p_actor_key) returning id into v_id;
  return v_id;
end $$;

create or replace function public.hq_workforce_resume_dependency_mission(
  p_checkpoint_id uuid,p_expected_interrupted_revision text,p_repaired_revision text,p_actor_key text,p_evidence_refs text[]
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.hq_workforce_mission_checkpoints%rowtype; v_unready integer; v_resolution public.hq_workforce_dependency_findings%rowtype; v_candidate public.hq_workforce_improvement_candidates%rowtype; v_missing text[]; v_ready uuid; v_resumed uuid; ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into c from public.hq_workforce_mission_checkpoints where id=p_checkpoint_id; if not found then raise exception 'dependency_checkpoint_not_found'; end if;
  if c.candidate_revision<>p_expected_interrupted_revision then raise exception 'stale_dependency_checkpoint'; end if;
  if public.hq_workforce_checkpoint_current_state(c.id)<>'interrupted' then raise exception 'dependency_checkpoint_not_interrupted'; end if;
  select * into v_resolution from public.hq_workforce_dependency_findings f where f.checkpoint_id=c.id and f.status='resolved' and f.repair_revision=p_repaired_revision order by f.discovered_at desc limit 1;
  if not found then raise exception 'dependency_resolution_required'; end if;
  select * into v_candidate from public.hq_workforce_improvement_candidates where id=v_resolution.repair_candidate_id;
  if not found or v_candidate.candidate_version<>p_repaired_revision then raise exception 'dependency_repair_candidate_revision_mismatch'; end if;
  select count(*) into v_unready from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id and i.risk_state in ('at_risk','blocked','stopped') and not exists(select 1 from public.hq_workforce_dependency_revalidations r where r.impact_id=i.id and r.candidate_revision=p_repaired_revision and r.passed and r.evaluator_key<>v_candidate.proposed_by);
  if v_unready>0 then raise exception 'dependency_impacts_not_revalidated'; end if;
  select array_agg(cond->>'key') into v_missing from jsonb_array_elements(c.resume_conditions) cond where not exists(
    select 1 from public.hq_workforce_dependency_revalidations r join public.hq_workforce_dependency_impacts i on i.id=r.impact_id join public.hq_workforce_dependency_findings f on f.id=i.finding_id, jsonb_array_elements(r.gate_results) g
    where f.checkpoint_id=c.id and r.candidate_revision=p_repaired_revision and r.passed and g->>'gate'=cond->>'key' and g->>'observed'=cond->>'expected' and coalesce((g->>'passed')::boolean,false));
  if cardinality(coalesce(v_missing,'{}'))>0 then raise exception 'dependency_resume_conditions_missing:%',array_to_string(v_missing,','); end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'dependency_resume_requires_fail_closed_runtime'; end if;
  v_ready:=public.hq_workforce_record_checkpoint_event(c.id,'interrupted','resume_ready',p_repaired_revision,p_actor_key,p_evidence_refs,'all authoritative resume conditions passed',c.next_safe_action);
  v_resumed:=public.hq_workforce_record_checkpoint_event(c.id,'resume_ready','resumed',p_repaired_revision,p_actor_key,p_evidence_refs,'mission automatically resumed from checkpoint',c.next_safe_action);
  return jsonb_build_object('checkpoint_id',c.id,'mission_key',c.mission_key,'priority_key',c.priority_key,'state','resumed','next_safe_action',c.next_safe_action,'resume_ready_event_id',v_ready,'resumed_event_id',v_resumed);
end $$;

revoke all on table public.hq_workforce_dependency_invalidations from public,anon,authenticated;
revoke all on function public.hq_workforce_auto_invalidate_dependency_impact(),public.hq_workforce_record_dependency_interruption(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text[],text,text,uuid,text,text,text,text,text,numeric,jsonb,jsonb,jsonb,text[],text),public.hq_workforce_record_dependency_revalidation(uuid,text,jsonb,text[],text,boolean),public.hq_workforce_record_dependency_resolution(uuid,text,uuid,text,uuid[],uuid[],text[],text),public.hq_workforce_resume_dependency_mission(uuid,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.hq_workforce_record_dependency_interruption(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text[],text,text,uuid,text,text,text,text,text,numeric,jsonb,jsonb,jsonb,text[],text),public.hq_workforce_record_dependency_revalidation(uuid,text,jsonb,text[],text,boolean),public.hq_workforce_record_dependency_resolution(uuid,text,uuid,text,uuid[],uuid[],text[],text),public.hq_workforce_resume_dependency_mission(uuid,text,text,text,text[]) to service_role;
