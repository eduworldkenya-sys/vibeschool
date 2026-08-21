-- Bind dependency assurance to the repair candidate and a narrowly scoped,
-- non-runtime assessor authorization. This migration grants no execution authority.
-- access: owner-only public.hq_workforce_dependency_assessor_authorizations
-- authorization-test: public.hq_workforce_dependency_assessor_authorizations denies product roles and direct service writes

create table public.hq_workforce_dependency_assessor_authorizations (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null,
  scope_type text not null check (scope_type in ('dependency_integrity')),
  scope_key text not null,
  authorized_by text not null,
  evidence_refs text[] not null check (cardinality(evidence_refs)>0),
  valid_from timestamptz not null default clock_timestamp(),
  valid_until timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (valid_until>valid_from),
  unique(worker_key,scope_type,scope_key,valid_from)
);
alter table public.hq_workforce_dependency_assessor_authorizations enable row level security;
create trigger hq_workforce_dependency_assessor_authorizations_append_only
before update or delete on public.hq_workforce_dependency_assessor_authorizations
for each row execute function public.hq_workforce_reject_evidence_mutation();
revoke all on table public.hq_workforce_dependency_assessor_authorizations from public,anon,authenticated;
revoke insert,update,delete on table public.hq_workforce_dependency_assessor_authorizations from service_role;
grant select on table public.hq_workforce_dependency_assessor_authorizations to service_role;

insert into public.hq_workforce_dependency_assessor_authorizations(
  worker_key,scope_type,scope_key,authorized_by,evidence_refs,valid_until
) values (
  'quality-worker-01','dependency_integrity','bd268fda-45a6-47b3-a9bb-fa6174864834',
  'dependency-integrity-proof-migration',array['mission:dep-proof-chemistry-20260821','assurance:distinct-assessor'],
  timestamptz '2026-09-21 00:00:00+00'
);

create or replace function public.hq_workforce_dependency_assessor_is_authorized(p_worker_key text,p_checkpoint_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.hq_workforce_dependency_assessor_authorizations a
    where a.worker_key=p_worker_key and a.scope_type='dependency_integrity'
      and a.scope_key in ('*',p_checkpoint_id::text)
      and a.revoked_at is null and a.valid_from<=clock_timestamp() and a.valid_until>clock_timestamp()
  )
$$;

create or replace function public.hq_workforce_record_dependency_control_result(p_impact_id uuid,p_regression_case_id uuid,p_candidate_revision text,p_passed boolean,p_observed_result jsonb,p_evidence_refs text[],p_evaluator_key text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_checkpoint_id uuid; v_expected jsonb;
begin
  select f.checkpoint_id,r.expected_result into v_checkpoint_id,v_expected
  from public.hq_workforce_dependency_impacts i
  join public.hq_workforce_dependency_findings f on f.id=i.finding_id
  join public.hq_workforce_regression_cases r on r.id=p_regression_case_id
  where i.id=p_impact_id;
  if v_checkpoint_id is null then raise exception 'dependency_control_scope_not_found'; end if;
  if not exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p_evaluator_key and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp()) or not public.hq_workforce_dependency_assessor_is_authorized(p_evaluator_key,v_checkpoint_id) then raise exception 'dependency_evaluator_not_authorized'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 or nullif(trim(p_candidate_revision),'') is null then raise exception 'dependency_control_evidence_required'; end if;
  if p_passed and p_observed_result is distinct from v_expected then raise exception 'dependency_control_observed_result_mismatch'; end if;
  insert into public.hq_workforce_dependency_control_results(impact_id,regression_case_id,candidate_revision,passed,observed_result,evidence_refs,evaluator_key) values(p_impact_id,p_regression_case_id,p_candidate_revision,p_passed,p_observed_result,p_evidence_refs,p_evaluator_key) returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_gate_evidence(p_impact_id uuid,p_candidate_revision text,p_gate_key text,p_observed text,p_passed boolean,p_evidence_digest text,p_evidence_refs text[],p_producer_key text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_checkpoint_id uuid;
begin
  select f.checkpoint_id into v_checkpoint_id from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id where i.id=p_impact_id;
  if v_checkpoint_id is null or not public.hq_workforce_dependency_assessor_is_authorized(p_producer_key,v_checkpoint_id) or not exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p_producer_key and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp()) then raise exception 'dependency_evaluator_not_authorized'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 or nullif(trim(p_gate_key),'') is null or nullif(trim(p_observed),'') is null or nullif(trim(p_evidence_digest),'') is null then raise exception 'dependency_gate_evidence_required'; end if;
  insert into public.hq_workforce_dependency_gate_evidence(impact_id,candidate_revision,gate_key,observed,passed,evidence_digest,evidence_refs,producer_key) values(p_impact_id,p_candidate_revision,p_gate_key,p_observed,p_passed,p_evidence_digest,p_evidence_refs,p_producer_key) returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_revalidation(p_impact_id uuid,p_candidate_revision text,p_gate_results jsonb,p_evidence_refs text[],p_evaluator_key text,p_passed boolean) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_discoverer text; v_checkpoint_id uuid;
begin
  if jsonb_typeof(coalesce(p_gate_results,'[]'))<>'array' or jsonb_array_length(coalesce(p_gate_results,'[]'))=0 or cardinality(coalesce(p_evidence_refs,'{}'))=0 then raise exception 'dependency_revalidation_evidence_required'; end if;
  select f.discovered_by,f.checkpoint_id into v_discoverer,v_checkpoint_id from public.hq_workforce_dependency_impacts i join public.hq_workforce_dependency_findings f on f.id=i.finding_id where i.id=p_impact_id;
  if v_discoverer is null then raise exception 'dependency_impact_not_found'; end if;
  if p_evaluator_key=v_discoverer or not public.hq_workforce_dependency_assessor_is_authorized(p_evaluator_key,v_checkpoint_id) or not exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=p_evaluator_key and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp()) then raise exception 'dependency_evaluator_not_authorized'; end if;
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
  if exists(select 1 from unnest(p_regression_case_ids||p_positive_control_ids) x(id) left join public.hq_workforce_regression_cases r on r.id=x.id where r.id is null or r.source_incident_id<>c.source_incident_id or not (r.id=any(c.regression_case_ids))) then raise exception 'dependency_controls_not_bound_to_candidate'; end if;
  if exists(select 1 from unnest(p_regression_case_ids) x(id) join public.hq_workforce_regression_cases r on r.id=x.id where r.positive_control) or exists(select 1 from unnest(p_positive_control_ids) x(id) join public.hq_workforce_regression_cases r on r.id=x.id where not r.positive_control) then raise exception 'dependency_control_type_mismatch'; end if;
  if exists(select 1 from unnest(p_regression_case_ids||p_positive_control_ids) x(id) where not exists(select 1 from public.hq_workforce_dependency_control_results cr join public.hq_workforce_dependency_impacts i on i.id=cr.impact_id join public.hq_workforce_regression_cases r on r.id=cr.regression_case_id where i.finding_id=p_finding_id and cr.regression_case_id=x.id and cr.candidate_revision=p_repair_revision and cr.passed and cr.observed_result=r.expected_result and cr.evaluator_key<>c.proposed_by)) then raise exception 'executed_dependency_controls_required'; end if;
  select count(*) into v_unready from public.hq_workforce_dependency_impacts i where i.finding_id=p_finding_id and i.risk_state in ('at_risk','blocked','stopped') and not exists(select 1 from public.hq_workforce_dependency_revalidations r where r.impact_id=i.id and r.candidate_revision=p_repair_revision and r.passed and r.evaluator_key<>c.proposed_by);
  if v_unready>0 or p_actor_key=c.proposed_by then raise exception 'dependency_independent_revalidation_required'; end if;
  insert into public.hq_workforce_dependency_findings(finding_key,incident_id,checkpoint_id,source_type,source_key,dependency_type,dependency_key,classification,causal_confidence,causal_evidence,blast_radius,containment,regression_case_ids,positive_control_ids,status,repair_candidate_id,repair_revision,evidence_refs,discovered_by) values(f.finding_key||':resolution:'||p_repair_revision,f.incident_id,f.checkpoint_id,f.source_type,f.source_key,f.dependency_type,f.dependency_key,f.classification,f.causal_confidence,f.causal_evidence,f.blast_radius,f.containment,p_regression_case_ids,p_positive_control_ids,'resolved',p_repair_candidate_id,p_repair_revision,p_revalidation_evidence,p_actor_key) returning id into v_id; return v_id;
end $$;

revoke all on function public.hq_workforce_dependency_assessor_is_authorized(text,uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_dependency_assessor_is_authorized(text,uuid) to service_role;
