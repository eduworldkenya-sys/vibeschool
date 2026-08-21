-- Worker Engine dependency integrity: checkpoint, repair, revalidate, resume.
-- Architecture only. This migration does not enable runtime, schedulers, shadow,
-- publishing, payments, authority grants, or autonomous mission switching.

create table public.hq_workforce_mission_checkpoints (
  id uuid primary key default gen_random_uuid(),
  checkpoint_key text not null unique,
  mission_key text not null,
  priority_key text not null,
  candidate_revision text not null,
  state text not null check (state in ('active','interrupted','resume_ready','resumed','closed')),
  completed_gates jsonb not null default '[]'::jsonb check (jsonb_typeof(completed_gates)='array'),
  open_findings jsonb not null default '[]'::jsonb check (jsonb_typeof(open_findings)='array'),
  next_safe_action jsonb not null,
  resume_conditions jsonb not null check (jsonb_typeof(resume_conditions)='array'),
  context_snapshot jsonb not null default '{}'::jsonb,
  evidence_refs text[] not null,
  checkpointed_by text not null,
  checkpointed_at timestamptz not null default now(),
  resumed_at timestamptz,
  check (cardinality(evidence_refs)>0),
  check (nullif(trim(checkpointed_by),'') is not null)
);

create table public.hq_workforce_dependency_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null unique,
  incident_id uuid references public.hq_workforce_improvement_incidents(id),
  checkpoint_id uuid not null references public.hq_workforce_mission_checkpoints(id),
  source_type text not null,
  source_key text not null,
  dependency_type text not null,
  dependency_key text not null,
  classification text not null check (classification in ('blocking_dependency','certification_at_risk','security_or_data_integrity','non_blocking_debt','not_a_defect')),
  causal_confidence numeric not null check (causal_confidence between 0 and 1),
  causal_evidence jsonb not null,
  blast_radius jsonb not null,
  containment jsonb not null default '{}'::jsonb,
  regression_case_ids uuid[] not null default '{}',
  positive_control_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open','contained','repairing','revalidating','resume_ready','resolved','escalated','rejected')),
  repair_candidate_id uuid references public.hq_workforce_improvement_candidates(id),
  repair_revision text,
  evidence_refs text[] not null,
  discovered_by text not null,
  discovered_at timestamptz not null default now(),
  check (source_type<>dependency_type or source_key<>dependency_key),
  check (cardinality(evidence_refs)>0)
);

create table public.hq_workforce_dependency_impacts (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.hq_workforce_dependency_findings(id),
  affected_type text not null,
  affected_key text not null,
  prior_state text not null,
  risk_state text not null check (risk_state in ('unaffected','at_risk','blocked','stopped')),
  invalidated_gate_keys text[] not null default '{}',
  revalidation_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(revalidation_requirements)='array'),
  disposition_evidence text[] not null default '{}',
  recorded_at timestamptz not null default now(),
  unique(finding_id,affected_type,affected_key)
);

create table public.hq_workforce_dependency_revalidations (
  id uuid primary key default gen_random_uuid(),
  impact_id uuid not null references public.hq_workforce_dependency_impacts(id),
  candidate_revision text not null,
  gate_results jsonb not null check (jsonb_typeof(gate_results)='array'),
  evidence_refs text[] not null,
  evaluator_key text not null,
  passed boolean not null,
  evaluated_at timestamptz not null default now(),
  check (cardinality(evidence_refs)>0),
  unique(impact_id,candidate_revision,evaluator_key)
);

alter table public.hq_workforce_mission_checkpoints enable row level security;
alter table public.hq_workforce_dependency_findings enable row level security;
alter table public.hq_workforce_dependency_impacts enable row level security;
alter table public.hq_workforce_dependency_revalidations enable row level security;

create trigger hq_workforce_mission_checkpoints_append_only before update or delete on public.hq_workforce_mission_checkpoints for each row execute function public.hq_workforce_reject_evidence_mutation();
create trigger hq_workforce_dependency_findings_append_only before update or delete on public.hq_workforce_dependency_findings for each row execute function public.hq_workforce_reject_evidence_mutation();
create trigger hq_workforce_dependency_impacts_append_only before update or delete on public.hq_workforce_dependency_impacts for each row execute function public.hq_workforce_reject_evidence_mutation();
create trigger hq_workforce_dependency_revalidations_append_only before update or delete on public.hq_workforce_dependency_revalidations for each row execute function public.hq_workforce_reject_evidence_mutation();

create or replace function public.hq_workforce_record_dependency_interruption(
  p_checkpoint_key text,p_mission_key text,p_priority_key text,p_candidate_revision text,
  p_completed_gates jsonb,p_open_findings jsonb,p_next_safe_action jsonb,p_resume_conditions jsonb,
  p_context_snapshot jsonb,p_evidence_refs text[],p_checkpointed_by text,
  p_finding_key text,p_incident_id uuid,p_source_type text,p_source_key text,
  p_dependency_type text,p_dependency_key text,p_classification text,p_causal_confidence numeric,
  p_causal_evidence jsonb,p_blast_radius jsonb,p_containment jsonb,p_finding_evidence_refs text[],p_discovered_by text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_checkpoint uuid; v_finding uuid;
begin
  if p_classification in ('blocking_dependency','certification_at_risk','security_or_data_integrity') and jsonb_array_length(coalesce(p_resume_conditions,'[]'))=0 then raise exception 'blocking_dependency_requires_resume_conditions'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 or cardinality(coalesce(p_finding_evidence_refs,'{}'))=0 then raise exception 'dependency_evidence_required'; end if;
  if exists(
    with recursive dependency_path(node_type,node_key,depth,visited) as (
      select p_dependency_type,p_dependency_key,0,array[p_dependency_type||':'||p_dependency_key]
      union all
      select d.dependency_type,d.dependency_key,p.depth+1,p.visited||(d.dependency_type||':'||d.dependency_key)
      from dependency_path p
      join public.hq_workforce_dependency_findings d on d.source_type=p.node_type and d.source_key=p.node_key
      where p.depth<32 and not (d.dependency_type||':'||d.dependency_key)=any(p.visited)
    ) select 1 from dependency_path where node_type=p_source_type and node_key=p_source_key
  ) then raise exception 'dependency_cycle_detected'; end if;
  insert into public.hq_workforce_mission_checkpoints(checkpoint_key,mission_key,priority_key,candidate_revision,state,completed_gates,open_findings,next_safe_action,resume_conditions,context_snapshot,evidence_refs,checkpointed_by)
  values(p_checkpoint_key,p_mission_key,p_priority_key,p_candidate_revision,'interrupted',coalesce(p_completed_gates,'[]'),coalesce(p_open_findings,'[]'),p_next_safe_action,p_resume_conditions,coalesce(p_context_snapshot,'{}'),p_evidence_refs,p_checkpointed_by)
  returning id into v_checkpoint;
  insert into public.hq_workforce_dependency_findings(finding_key,incident_id,checkpoint_id,source_type,source_key,dependency_type,dependency_key,classification,causal_confidence,causal_evidence,blast_radius,containment,evidence_refs,discovered_by)
  values(p_finding_key,p_incident_id,v_checkpoint,p_source_type,p_source_key,p_dependency_type,p_dependency_key,p_classification,p_causal_confidence,p_causal_evidence,p_blast_radius,coalesce(p_containment,'{}'),p_finding_evidence_refs,p_discovered_by)
  returning id into v_finding;
  return jsonb_build_object('checkpoint_id',v_checkpoint,'finding_id',v_finding);
end $$;

create or replace function public.hq_workforce_record_dependency_revalidation(
  p_impact_id uuid,p_candidate_revision text,p_gate_results jsonb,p_evidence_refs text[],p_evaluator_key text,p_passed boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if jsonb_array_length(coalesce(p_gate_results,'[]'))=0 or cardinality(coalesce(p_evidence_refs,'{}'))=0 then raise exception 'dependency_revalidation_evidence_required'; end if;
  if nullif(trim(p_candidate_revision),'') is null or nullif(trim(p_evaluator_key),'') is null then raise exception 'dependency_revalidation_identity_required'; end if;
  insert into public.hq_workforce_dependency_revalidations(impact_id,candidate_revision,gate_results,evidence_refs,evaluator_key,passed)
  values(p_impact_id,p_candidate_revision,p_gate_results,p_evidence_refs,p_evaluator_key,p_passed)
  returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_impact(
  p_finding_id uuid,p_affected_type text,p_affected_key text,p_prior_state text,p_risk_state text,
  p_invalidated_gate_keys text[],p_revalidation_requirements jsonb,p_disposition_evidence text[] default '{}'
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_risk_state in ('at_risk','blocked','stopped') and jsonb_array_length(coalesce(p_revalidation_requirements,'[]'))=0 then raise exception 'affected_dependency_requires_revalidation'; end if;
  insert into public.hq_workforce_dependency_impacts(finding_id,affected_type,affected_key,prior_state,risk_state,invalidated_gate_keys,revalidation_requirements,disposition_evidence)
  values(p_finding_id,p_affected_type,p_affected_key,p_prior_state,p_risk_state,coalesce(p_invalidated_gate_keys,'{}'),coalesce(p_revalidation_requirements,'[]'),coalesce(p_disposition_evidence,'{}'))
  returning id into v_id; return v_id;
end $$;

create or replace function public.hq_workforce_record_dependency_resolution(
  p_finding_id uuid,p_expected_finding_status text,p_repair_candidate_id uuid,p_repair_revision text,
  p_regression_case_ids uuid[],p_positive_control_ids uuid[],p_revalidation_evidence text[],p_actor_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.hq_workforce_dependency_findings%rowtype; v_id uuid; v_unready integer;
begin
  select * into f from public.hq_workforce_dependency_findings where id=p_finding_id;
  if not found then raise exception 'dependency_finding_not_found'; end if;
  if f.status<>p_expected_finding_status then raise exception 'dependency_finding_status_mismatch'; end if;
  if p_repair_candidate_id is null or nullif(trim(p_repair_revision),'') is null then raise exception 'dependency_repair_lineage_required'; end if;
  if cardinality(coalesce(p_regression_case_ids,'{}'))=0 or cardinality(coalesce(p_positive_control_ids,'{}'))=0 then raise exception 'dependency_controls_required'; end if;
  if cardinality(coalesce(p_revalidation_evidence,'{}'))=0 or nullif(trim(p_actor_key),'') is null then raise exception 'dependency_revalidation_evidence_required'; end if;
  select count(*) into v_unready
  from public.hq_workforce_dependency_impacts i
  where i.finding_id=p_finding_id and i.risk_state in ('at_risk','blocked','stopped')
    and not exists(select 1 from public.hq_workforce_dependency_revalidations r where r.impact_id=i.id and r.passed);
  if v_unready>0 then raise exception 'dependency_impacts_not_revalidated'; end if;
  insert into public.hq_workforce_dependency_findings(finding_key,incident_id,checkpoint_id,source_type,source_key,dependency_type,dependency_key,classification,causal_confidence,causal_evidence,blast_radius,containment,regression_case_ids,positive_control_ids,status,repair_candidate_id,repair_revision,evidence_refs,discovered_by)
  values(f.finding_key||':resolution:'||p_repair_revision,f.incident_id,f.checkpoint_id,f.source_type,f.source_key,f.dependency_type,f.dependency_key,f.classification,f.causal_confidence,f.causal_evidence,f.blast_radius,f.containment,p_regression_case_ids,p_positive_control_ids,'resolved',p_repair_candidate_id,p_repair_revision,p_revalidation_evidence,p_actor_key)
  returning id into v_id; return v_id;
end $$;

revoke all on table public.hq_workforce_mission_checkpoints,public.hq_workforce_dependency_findings,public.hq_workforce_dependency_impacts,public.hq_workforce_dependency_revalidations from public,anon,authenticated;
revoke insert,update,delete on table public.hq_workforce_mission_checkpoints,public.hq_workforce_dependency_findings,public.hq_workforce_dependency_impacts,public.hq_workforce_dependency_revalidations from service_role;
revoke all on function public.hq_workforce_record_dependency_interruption(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text[],text,text,uuid,text,text,text,text,text,numeric,jsonb,jsonb,jsonb,text[],text) from public,anon,authenticated;
revoke all on function public.hq_workforce_record_dependency_impact(uuid,text,text,text,text,text[],jsonb,text[]) from public,anon,authenticated;
revoke all on function public.hq_workforce_record_dependency_revalidation(uuid,text,jsonb,text[],text,boolean) from public,anon,authenticated;
revoke all on function public.hq_workforce_record_dependency_resolution(uuid,text,uuid,text,uuid[],uuid[],text[],text) from public,anon,authenticated;
grant select on table public.hq_workforce_mission_checkpoints,public.hq_workforce_dependency_findings,public.hq_workforce_dependency_impacts,public.hq_workforce_dependency_revalidations to service_role;
grant execute on function public.hq_workforce_record_dependency_interruption(text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text[],text,text,uuid,text,text,text,text,text,numeric,jsonb,jsonb,jsonb,text[],text) to service_role;
grant execute on function public.hq_workforce_record_dependency_impact(uuid,text,text,text,text,text[],jsonb,text[]) to service_role;
grant execute on function public.hq_workforce_record_dependency_revalidation(uuid,text,jsonb,text[],text,boolean) to service_role;
grant execute on function public.hq_workforce_record_dependency_resolution(uuid,text,uuid,text,uuid[],uuid[],text[],text) to service_role;
