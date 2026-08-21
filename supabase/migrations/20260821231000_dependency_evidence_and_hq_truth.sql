-- Final assurance hardening: executed controls, authoritative gate evidence,
-- effective invalidation truth, and HQ readiness overlay. Non-activating.
-- access: service-only public.hq_workforce_dependency_control_results
-- authorization-test: public.hq_workforce_dependency_control_results denies product roles and direct service writes
-- access: service-only public.hq_workforce_dependency_gate_evidence
-- authorization-test: public.hq_workforce_dependency_gate_evidence denies product roles and direct service writes

create table public.hq_workforce_dependency_control_results (
  id uuid primary key default gen_random_uuid(), impact_id uuid not null references public.hq_workforce_dependency_impacts(id),
  regression_case_id uuid not null references public.hq_workforce_regression_cases(id), candidate_revision text not null,
  passed boolean not null, observed_result jsonb not null, evidence_refs text[] not null, evaluator_key text not null,
  evaluated_at timestamptz not null default clock_timestamp(), check(cardinality(evidence_refs)>0),
  unique(impact_id,regression_case_id,candidate_revision,evaluator_key)
);
create table public.hq_workforce_dependency_gate_evidence (
  id uuid primary key default gen_random_uuid(), impact_id uuid not null references public.hq_workforce_dependency_impacts(id),
  candidate_revision text not null, gate_key text not null, observed text not null, passed boolean not null,
  evidence_digest text not null, evidence_refs text[] not null, producer_key text not null,
  observed_at timestamptz not null default clock_timestamp(), check(cardinality(evidence_refs)>0),
  unique(impact_id,candidate_revision,gate_key,producer_key)
);
alter table public.hq_workforce_dependency_control_results enable row level security;
alter table public.hq_workforce_dependency_gate_evidence enable row level security;
create trigger hq_workforce_dependency_control_results_append_only before update or delete on public.hq_workforce_dependency_control_results for each row execute function public.hq_workforce_reject_evidence_mutation();
create trigger hq_workforce_dependency_gate_evidence_append_only before update or delete on public.hq_workforce_dependency_gate_evidence for each row execute function public.hq_workforce_reject_evidence_mutation();
revoke all on table public.hq_workforce_dependency_control_results,public.hq_workforce_dependency_gate_evidence from public,anon,authenticated;
revoke insert,update,delete on table public.hq_workforce_dependency_control_results,public.hq_workforce_dependency_gate_evidence from service_role;
grant select on table public.hq_workforce_dependency_control_results,public.hq_workforce_dependency_gate_evidence to service_role;

create or replace function public.hq_workforce_record_dependency_control_result(p_impact_id uuid,p_regression_case_id uuid,p_candidate_revision text,p_passed boolean,p_observed_result jsonb,p_evidence_refs text[],p_evaluator_key text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p_evaluator_key and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp()) then raise exception 'dependency_evaluator_not_current_certified_machine'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 or nullif(trim(p_candidate_revision),'') is null then raise exception 'dependency_control_evidence_required'; end if;
  insert into public.hq_workforce_dependency_control_results(impact_id,regression_case_id,candidate_revision,passed,observed_result,evidence_refs,evaluator_key) values(p_impact_id,p_regression_case_id,p_candidate_revision,p_passed,p_observed_result,p_evidence_refs,p_evaluator_key) returning id into v_id; return v_id;
end $$;
create or replace function public.hq_workforce_record_dependency_gate_evidence(p_impact_id uuid,p_candidate_revision text,p_gate_key text,p_observed text,p_passed boolean,p_evidence_digest text,p_evidence_refs text[],p_producer_key text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p_producer_key and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp()) then raise exception 'dependency_evaluator_not_current_certified_machine'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 or nullif(trim(p_gate_key),'') is null or nullif(trim(p_observed),'') is null or nullif(trim(p_evidence_digest),'') is null then raise exception 'dependency_gate_evidence_required'; end if;
  insert into public.hq_workforce_dependency_gate_evidence(impact_id,candidate_revision,gate_key,observed,passed,evidence_digest,evidence_refs,producer_key) values(p_impact_id,p_candidate_revision,p_gate_key,p_observed,p_passed,p_evidence_digest,p_evidence_refs,p_producer_key) returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_revalidation(p_impact_id uuid,p_candidate_revision text,p_gate_results jsonb,p_evidence_refs text[],p_evaluator_key text,p_passed boolean) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_discoverer text;
begin
  if jsonb_typeof(coalesce(p_gate_results,'[]'))<>'array' or jsonb_array_length(coalesce(p_gate_results,'[]'))=0 or cardinality(coalesce(p_evidence_refs,'{}'))=0 then raise exception 'dependency_revalidation_evidence_required'; end if;
  select f.discovered_by into v_discoverer from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id where i.id=p_impact_id;
  if v_discoverer is null then raise exception 'dependency_impact_not_found'; end if;
  if p_evaluator_key=v_discoverer or not exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p_evaluator_key and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp()) then raise exception 'dependency_evaluator_not_current_certified_machine'; end if;
  if p_passed and exists(select 1 from jsonb_array_elements(p_gate_results) g where coalesce((g->>'passed')::boolean,false) is not true) then raise exception 'contradictory_dependency_revalidation'; end if;
  if exists(select 1 from jsonb_array_elements(p_gate_results) g where not exists(select 1 from public.hq_workforce_dependency_gate_evidence e where e.impact_id=p_impact_id and e.candidate_revision=p_candidate_revision and e.gate_key=g->>'gate' and e.observed=g->>'observed' and e.passed=coalesce((g->>'passed')::boolean,false) and e.producer_key=p_evaluator_key)) then raise exception 'authoritative_dependency_gate_evidence_missing'; end if;
  insert into public.hq_workforce_dependency_revalidations(impact_id,candidate_revision,gate_results,evidence_refs,evaluator_key,passed) values(p_impact_id,p_candidate_revision,p_gate_results,p_evidence_refs,p_evaluator_key,p_passed) returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_resolution(p_finding_id uuid,p_expected_finding_status text,p_repair_candidate_id uuid,p_repair_revision text,p_regression_case_ids uuid[],p_positive_control_ids uuid[],p_revalidation_evidence text[],p_actor_key text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.hq_workforce_dependency_findings%rowtype; c public.hq_workforce_improvement_candidates%rowtype; v_id uuid; v_unready integer;
begin
  select * into f from public.hq_workforce_dependency_findings where id=p_finding_id; if not found then raise exception 'dependency_finding_not_found'; end if;
  if f.status<>p_expected_finding_status then raise exception 'dependency_finding_status_mismatch'; end if;
  select * into c from public.hq_workforce_improvement_candidates where id=p_repair_candidate_id; if not found or c.candidate_version<>p_repair_revision then raise exception 'dependency_repair_candidate_revision_mismatch'; end if;
  if cardinality(coalesce(p_regression_case_ids,'{}'))=0 or cardinality(coalesce(p_positive_control_ids,'{}'))=0 then raise exception 'dependency_controls_required'; end if;
  if exists(select 1 from unnest(p_regression_case_ids) x(id) left join public.hq_workforce_regression_cases r on r.id=x.id where r.id is null or r.positive_control) or exists(select 1 from unnest(p_positive_control_ids) x(id) left join public.hq_workforce_regression_cases r on r.id=x.id where r.id is null or not r.positive_control) then raise exception 'dependency_control_type_mismatch'; end if;
  if exists(select 1 from unnest(p_regression_case_ids||p_positive_control_ids) x(id) where not exists(select 1 from public.hq_workforce_dependency_control_results cr join public.hq_workforce_dependency_impacts i on i.id=cr.impact_id where i.finding_id=p_finding_id and cr.regression_case_id=x.id and cr.candidate_revision=p_repair_revision and cr.passed and cr.evaluator_key<>c.proposed_by)) then raise exception 'executed_dependency_controls_required'; end if;
  select count(*) into v_unready from public.hq_workforce_dependency_impacts i where i.finding_id=p_finding_id and i.risk_state in ('at_risk','blocked','stopped') and not exists(select 1 from public.hq_workforce_dependency_revalidations r where r.impact_id=i.id and r.candidate_revision=p_repair_revision and r.passed and r.evaluator_key<>c.proposed_by);
  if v_unready>0 or p_actor_key=c.proposed_by then raise exception 'dependency_independent_revalidation_required'; end if;
  insert into public.hq_workforce_dependency_findings(finding_key,incident_id,checkpoint_id,source_type,source_key,dependency_type,dependency_key,classification,causal_confidence,causal_evidence,blast_radius,containment,regression_case_ids,positive_control_ids,status,repair_candidate_id,repair_revision,evidence_refs,discovered_by) values(f.finding_key||':resolution:'||p_repair_revision,f.incident_id,f.checkpoint_id,f.source_type,f.source_key,f.dependency_type,f.dependency_key,f.classification,f.causal_confidence,f.causal_evidence,f.blast_radius,f.containment,p_regression_case_ids,p_positive_control_ids,'resolved',p_repair_candidate_id,p_repair_revision,p_revalidation_evidence,p_actor_key) returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_dependency_invalidation_state(p_impact_id uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$
  select case when exists(select 1 from public.hq_workforce_dependency_revalidations r join public.hq_workforce_dependency_impacts i on i.id=r.impact_id join public.hq_workforce_dependency_findings f on f.id=i.finding_id where r.impact_id=p_impact_id and r.passed and exists(select 1 from public.hq_workforce_dependency_findings rf where rf.checkpoint_id=f.checkpoint_id and rf.status='resolved' and rf.repair_revision=r.candidate_revision)) then 'RESTORED BY FRESH DECISION' else d.invalidation_state end from public.hq_workforce_dependency_invalidations d where d.impact_id=p_impact_id
$$;
create or replace function public.hq_workforce_effective_certification_state(p_worker_key text,p_stored_state text) returns text language sql stable security definer set search_path=public,pg_temp as $$
  select case when exists(select 1 from public.hq_workforce_dependency_invalidations d where d.affected_type in ('worker','worker_assurance','worker_certificate') and d.affected_key=p_worker_key and public.hq_workforce_dependency_invalidation_state(d.impact_id)<>'RESTORED BY FRESH DECISION') then 'CERTIFICATION AT RISK' else p_stored_state end
$$;

alter function public.hq_workforce_get_live_readiness_map() rename to hq_workforce_get_live_readiness_map_pre_dependency;
create function public.hq_workforce_get_live_readiness_map() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b jsonb; w jsonb;
begin
  b:=public.hq_workforce_get_live_readiness_map_pre_dependency();
  select coalesce(jsonb_agg(case when public.hq_workforce_effective_certification_state(x->>'worker_key',x->>'certification_state')='CERTIFICATION AT RISK' then jsonb_set(jsonb_set(x,'{certification_state}','"CERTIFICATION AT RISK"'::jsonb),'{repair_action}','"Open dependency incident and re-certify"'::jsonb) else x end),'[]') into w from jsonb_array_elements(coalesce(b->'workers','[]')) x;
  return jsonb_set(b,'{workers}',w);
end $$;

create or replace function public.hq_workforce_get_dependency_integrity_packet(p_checkpoint_key text) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v jsonb; begin perform public.hq_assert_owner();
select jsonb_build_object('checkpoint',to_jsonb(c),'current_state',public.hq_workforce_checkpoint_current_state(c.id),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]') from public.hq_workforce_mission_checkpoint_events e where e.checkpoint_id=c.id),'findings',(select coalesce(jsonb_agg(to_jsonb(f) order by f.discovered_at,f.id),'[]') from public.hq_workforce_dependency_findings f where f.checkpoint_id=c.id),'impacts',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('effective_invalidation_state',public.hq_workforce_dependency_invalidation_state(i.id)) order by i.recorded_at,i.id),'[]') from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id),'invalidations',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('effective_state',public.hq_workforce_dependency_invalidation_state(d.impact_id)) order by d.invalidated_at,d.id),'[]') from public.hq_workforce_dependency_invalidations d join public.hq_workforce_dependency_impacts i on i.id=d.impact_id join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id),'control_results',(select coalesce(jsonb_agg(to_jsonb(cr) order by cr.evaluated_at,cr.id),'[]') from public.hq_workforce_dependency_control_results cr join public.hq_workforce_dependency_impacts i on i.id=cr.impact_id join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id),'gate_evidence',(select coalesce(jsonb_agg(to_jsonb(g) order by g.observed_at,g.id),'[]') from public.hq_workforce_dependency_gate_evidence g join public.hq_workforce_dependency_impacts i on i.id=g.impact_id join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id),'revalidations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.evaluated_at,r.id),'[]') from public.hq_workforce_dependency_revalidations r join public.hq_workforce_dependency_impacts i on i.id=r.impact_id join public.hq_workforce_dependency_findings f on f.id=i.finding_id where f.checkpoint_id=c.id)) into v from public.hq_workforce_mission_checkpoints c where c.checkpoint_key=p_checkpoint_key; return v; end $$;

revoke all on function public.hq_workforce_record_dependency_control_result(uuid,uuid,text,boolean,jsonb,text[],text),public.hq_workforce_record_dependency_gate_evidence(uuid,text,text,text,boolean,text,text[],text),public.hq_workforce_dependency_invalidation_state(uuid),public.hq_workforce_effective_certification_state(text,text),public.hq_workforce_get_live_readiness_map_pre_dependency() from public,anon,authenticated;
grant execute on function public.hq_workforce_record_dependency_control_result(uuid,uuid,text,boolean,jsonb,text[],text),public.hq_workforce_record_dependency_gate_evidence(uuid,text,text,text,boolean,text,text[],text),public.hq_workforce_dependency_invalidation_state(uuid),public.hq_workforce_effective_certification_state(text,text) to service_role;
revoke all on function public.hq_workforce_get_live_readiness_map(),public.hq_workforce_get_dependency_integrity_packet(text) from public,anon;
grant execute on function public.hq_workforce_get_live_readiness_map(),public.hq_workforce_get_dependency_integrity_packet(text) to authenticated,service_role;
