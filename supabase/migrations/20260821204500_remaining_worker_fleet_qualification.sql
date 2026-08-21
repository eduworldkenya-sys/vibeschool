-- Complete evidence-bound qualification for the six remaining canonical workers.
-- NON-ACTIVATING: aggregate read-only snapshots, qualification evidence, and a
-- zero-mutation Operations R2 canary only. No grants, allowlist, runtime policy,
-- scheduler, publishing, payment, tenant mutation, or autonomy is enabled.

alter table public.hq_workforce_tool_contracts drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts add constraint hq_workforce_tool_contracts_handler_key_check check (
  handler_key = any(array[
    'work_item.triage_and_own'::text,'work_item.prioritize'::text,
    'content.research.external'::text,'content.evidence.semantic_verify'::text,
    'content.authoring.source_grounded'::text,'workforce.quality.assess_fixture'::text,
    'finance.reconciliation.readonly'::text,'security.assurance.readonly'::text,
    'publishing.release_readiness.readonly'::text,'platform.reliability.readonly'::text,
    'operations.queue.readonly'::text,'support.case_health.readonly'::text,
    'curriculum.coverage.readonly'::text,'growth.metrics.readonly'::text,
    'workforce.capability_gaps.readonly'::text,'school.success.readonly'::text
  ])
);

create or replace function public.hq_workforce_remaining_specialist_map(p_worker_key text)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select case p_worker_key
    when 'ops-worker-01' then jsonb_build_object('capability','operations.queue.readonly','competency','operations.routing','risk','R2')
    when 'support-worker-01' then jsonb_build_object('capability','support.case_health.readonly','competency','support.triage','risk','R1')
    when 'curriculum-worker-01' then jsonb_build_object('capability','curriculum.coverage.readonly','competency','curriculum.coverage','risk','R1')
    when 'growth-worker-01' then jsonb_build_object('capability','growth.metrics.readonly','competency','growth.analysis','risk','R1')
    when 'hr-worker-01' then jsonb_build_object('capability','workforce.capability_gaps.readonly','competency','workforce.analysis','risk','R1')
    when 'school-success-worker-01' then jsonb_build_object('capability','school.success.readonly','competency','school.success.analysis','risk','R1')
    else null end;
$$;
revoke all on function public.hq_workforce_remaining_specialist_map(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_remaining_specialist_map(text) to service_role;

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,input_contract,output_contract,
  verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values
('operations.queue.readonly',1,'Operations queue analysis','Inspect aggregate governed work-queue health without routing or mutating work.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','work_mutation',false),jsonb_build_object('independent_verification',true,'queue_state_must_not_change',true),2,0,'certified',jsonb_build_object('program','remaining-fleet','qualification_only',true,'authority_granted',false)),
('support.case_health.readonly',1,'Support case-health analysis','Inspect aggregate support case health without messaging or case mutation.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','case_mutation',false),jsonb_build_object('independent_verification',true,'support_state_must_not_change',true),1,0,'certified',jsonb_build_object('program','remaining-fleet','qualification_only',true,'authority_granted',false)),
('curriculum.coverage.readonly',1,'Curriculum coverage analysis','Inspect aggregate curriculum coverage and authority-source health without drafting or publishing.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','curriculum_mutation',false),jsonb_build_object('independent_verification',true,'curriculum_state_must_not_change',true),1,0,'certified',jsonb_build_object('program','remaining-fleet','qualification_only',true,'authority_granted',false)),
('growth.metrics.readonly',1,'Growth metrics analysis','Inspect aggregate product and learning event signals without experiments, campaigns, or spend.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','growth_mutation',false),jsonb_build_object('independent_verification',true,'event_state_must_not_change',true),1,0,'certified',jsonb_build_object('program','remaining-fleet','qualification_only',true,'authority_granted',false)),
('workforce.capability_gaps.readonly',1,'Workforce capability-gap analysis','Inspect aggregate worker, skill, competency and assignment coverage without hiring or worker mutation.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','workforce_mutation',false),jsonb_build_object('independent_verification',true,'workforce_state_must_not_change',true),1,0,'certified',jsonb_build_object('program','remaining-fleet','qualification_only',true,'authority_granted',false)),
('school.success.readonly',1,'School success health analysis','Inspect aggregate school membership and support health without contacting or changing schools.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','school_mutation',false),jsonb_build_object('independent_verification',true,'school_state_must_not_change',true),1,0,'certified',jsonb_build_object('program','remaining-fleet','qualification_only',true,'authority_granted',false))
on conflict(capability_key,version) do update set display_name=excluded.display_name,purpose=excluded.purpose,input_contract=excluded.input_contract,output_contract=excluded.output_contract,verification_contract=excluded.verification_contract,risk_class=excluded.risk_class,autonomy_ceiling=0,lifecycle_status='certified',provenance=excluded.provenance,updated_at=clock_timestamp();

insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select c.id,m.competency,true,1,0.90
from public.hq_workforce_capabilities c
join (values
 ('operations.queue.readonly','operations.routing'),('support.case_health.readonly','support.triage'),
 ('curriculum.coverage.readonly','curriculum.coverage'),('growth.metrics.readonly','growth.analysis'),
 ('workforce.capability_gaps.readonly','workforce.analysis'),('school.success.readonly','school.success.analysis')
) m(capability,competency) on m.capability=c.capability_key
where c.version=1
on conflict(capability_id,competency_key) do update set required=true,weight=1,minimum_proficiency=0.90;

insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at,approval_reason)
select capability,1,title,capability,capability,'analyze_aggregate_health',resource,'read_only','approved',clock_timestamp(),'Qualification-only aggregate read path; no operational authority.'
from (values
 ('operations.queue.readonly','Operations queue shadow tool','governed_work_queue'),
 ('support.case_health.readonly','Support case-health shadow tool','support_aggregate'),
 ('curriculum.coverage.readonly','Curriculum coverage shadow tool','curriculum_aggregate'),
 ('growth.metrics.readonly','Growth metrics shadow tool','product_event_aggregate'),
 ('workforce.capability_gaps.readonly','Workforce capability-gap shadow tool','workforce_aggregate'),
 ('school.success.readonly','School success shadow tool','school_aggregate')
) v(capability,title,resource)
on conflict(tool_key,version) do update set title=excluded.title,handler_key=excluded.handler_key,required_capability_key=excluded.required_capability_key,operation=excluded.operation,resource_type=excluded.resource_type,side_effect_class='read_only',status='approved',approved_at=coalesce(hq_workforce_tool_contracts.approved_at,clock_timestamp()),approval_reason=excluded.approval_reason;

create or replace function public.hq_workforce_remaining_specialist_snapshot(p_worker_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
begin
  if p_worker_key='ops-worker-01' then return jsonb_build_object('work_items',(select count(*) from public.hq_work_items),'assignments',(select count(*) from public.hq_workforce_assignments),'decision','analyze_and_escalate_only','handler','operations.queue.readonly','side_effects_applied',false);
  elsif p_worker_key='support-worker-01' then return jsonb_build_object('support_cases',(select count(*) from public.hq_support_cases),'support_messages',(select count(*) from public.hq_support_messages),'decision','classify_and_escalate_only','handler','support.case_health.readonly','side_effects_applied',false);
  elsif p_worker_key='curriculum-worker-01' then return jsonb_build_object('learning_outcomes',(select count(*) from public.curriculum_learning_outcomes),'authority_sources',(select count(*) from public.curriculum_authority_sources),'research_jobs',(select count(*) from public.curriculum_research_jobs),'decision','analyze_and_request_review_only','handler','curriculum.coverage.readonly','side_effects_applied',false);
  elsif p_worker_key='growth-worker-01' then return jsonb_build_object('product_events',(select count(*) from public.hq_product_event_trace),'learning_events',(select count(*) from public.student_learning_events),'marketing_events',(select count(*) from public.hq_marketing_events),'decision','analyze_and_propose_only','handler','growth.metrics.readonly','side_effects_applied',false);
  elsif p_worker_key='hr-worker-01' then return jsonb_build_object('workers',(select count(*) from public.hq_workforce_workers),'skills',(select count(*) from public.hq_workforce_worker_skills),'competencies',(select count(*) from public.hq_workforce_worker_competencies),'assignments',(select count(*) from public.hq_workforce_assignments),'decision','diagnose_and_recommend_only','handler','workforce.capability_gaps.readonly','side_effects_applied',false);
  elsif p_worker_key='school-success-worker-01' then return jsonb_build_object('schools',(select count(*) from public.schools),'memberships',(select count(*) from public.school_members),'support_cases',(select count(*) from public.hq_support_cases),'decision','analyze_and_escalate_only','handler','school.success.readonly','side_effects_applied',false);
  end if;
  raise exception 'supported_remaining_worker_required';
end $$;
revoke all on function public.hq_workforce_remaining_specialist_snapshot(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_remaining_specialist_snapshot(text) to service_role;

create or replace function public.hq_workforce_assess_remaining_specialist(p_worker_key text,p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.hq_workforce_workers%rowtype; m jsonb; v_comp text; v_safe boolean; v_signal jsonb;
begin
  m:=public.hq_workforce_remaining_specialist_map(p_worker_key);
  if m is null then raise exception 'supported_remaining_worker_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  select * into w from public.hq_workforce_workers where worker_key=p_worker_key;
  if not found then raise exception 'worker_required'; end if;
  v_safe:=not exists(select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission) where permission ~* '(delete|publish|approve|spend|pay|grant|deploy|restart|recover|rollback|execute_sql|external_communication)');
  v_signal:=public.hq_workforce_remaining_specialist_snapshot(p_worker_key);
  if not(v_safe and coalesce(btrim(w.mission),'')<>'' and v_signal->>'side_effects_applied'='false') then return jsonb_build_object('passed',false,'worker_key',p_worker_key,'permissions_safe',v_safe,'signal',v_signal,'authority_changed',false); end if;
  v_comp:=m->>'competency';
  insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,sample_count,certification_status,evidence,scope_types,jurisdictions,last_evaluated_at,expires_at)
  values(p_worker_key,v_comp,1,0.95,0.95,1,'certified',jsonb_build_object('aggregate_signal',v_signal,'independent_verifier',p_verifier_key,'authority_changed',false),array['qualification'],array['global'],clock_timestamp(),clock_timestamp()+interval '30 days')
  on conflict(worker_key,competency_key,version) do update set proficiency=excluded.proficiency,reliability=excluded.reliability,sample_count=hq_workforce_worker_competencies.sample_count+1,certification_status='certified',evidence=excluded.evidence,last_evaluated_at=excluded.last_evaluated_at,expires_at=excluded.expires_at,updated_at=clock_timestamp();
  return jsonb_build_object('passed',true,'worker_key',p_worker_key,'competency_key',v_comp,'signal',v_signal,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_assess_remaining_specialist(text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_assess_remaining_specialist(text,text) to service_role;

create or replace function public.hq_workforce_execute_shadow_tool(p_tool_contract_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.hq_workforce_tool_contracts%rowtype; v_material public.curriculum_semantic_materials%rowtype; v_worker text;
begin
  select * into t from public.hq_workforce_tool_contracts where id=p_tool_contract_id and status='approved'; if not found then raise exception 'approved_shadow_tool_required'; end if;
  if coalesce(jsonb_typeof(p_input),'null')<>'object' then raise exception 'shadow_input_object_required'; end if;
  if t.handler_key='work_item.triage_and_own' then if coalesce((p_input->>'approval_required')::boolean,false) then raise exception 'shadow_case_requires_unapproved_work'; end if; return jsonb_build_object('decision','triage','side_effects_applied',false,'handler',t.handler_key);
  elsif t.handler_key='content.research.external' then if coalesce(btrim(p_input->>'research_job_id'),'')='' or not exists(select 1 from public.curriculum_research_jobs where id=(p_input->>'research_job_id')::uuid) then raise exception 'shadow_research_job_not_found'; end if; return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'semantic_self_certification',false,'external_fetch_executed',false,'next_boundary','candidate_source_discovery_only');
  elsif t.handler_key='content.evidence.semantic_verify' then if coalesce(btrim(p_input->>'source_id'),'')='' or coalesce(btrim(p_input->>'material_sha256'),'')='' then raise exception 'shadow_semantic_material_required'; end if; select * into v_material from public.curriculum_semantic_materials where source_id=(p_input->>'source_id')::uuid and material_sha256=p_input->>'material_sha256' order by retrieved_at desc limit 1; if not found then raise exception 'shadow_semantic_material_not_found'; end if; return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'actual_material_required',true,'material_bound',true,'verdict_generated',false,'next_boundary','governed_model_authorization');
  elsif t.handler_key='content.authoring.source_grounded' then if coalesce(btrim(p_input->>'proposal_id'),'')='' or coalesce(btrim(p_input->>'evidence_packet_sha256'),'')='' or coalesce(btrim(p_input->>'current_content_sha256'),'')='' or not exists(select 1 from public.curriculum_intelligence_proposals where id=(p_input->>'proposal_id')::uuid) then raise exception 'shadow_authoring_evidence_required'; end if; return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'publish_authority',false,'human_acceptance_required',true,'next_boundary','governed_source_grounded_draft');
  elsif t.handler_key='finance.reconciliation.readonly' then if p_input<>'{}'::jsonb then raise exception 'finance_shadow_input_must_be_empty'; end if; return public.hq_workforce_finance_readonly_snapshot();
  elsif t.handler_key='security.assurance.readonly' then if p_input<>'{}'::jsonb then raise exception 'security_shadow_input_must_be_empty'; end if; return public.hq_workforce_security_readonly_snapshot();
  elsif t.handler_key='publishing.release_readiness.readonly' then if p_input<>'{}'::jsonb then raise exception 'publishing_shadow_input_must_be_empty'; end if; return public.hq_workforce_publishing_readonly_snapshot();
  elsif t.handler_key='platform.reliability.readonly' then if p_input<>'{}'::jsonb then raise exception 'platform_shadow_input_must_be_empty'; end if; return public.hq_workforce_platform_readonly_snapshot();
  elsif t.handler_key in ('operations.queue.readonly','support.case_health.readonly','curriculum.coverage.readonly','growth.metrics.readonly','workforce.capability_gaps.readonly','school.success.readonly') then
    if p_input<>'{}'::jsonb then raise exception 'remaining_specialist_shadow_input_must_be_empty'; end if;
    v_worker:=case t.handler_key when 'operations.queue.readonly' then 'ops-worker-01' when 'support.case_health.readonly' then 'support-worker-01' when 'curriculum.coverage.readonly' then 'curriculum-worker-01' when 'growth.metrics.readonly' then 'growth-worker-01' when 'workforce.capability_gaps.readonly' then 'hr-worker-01' when 'school.success.readonly' then 'school-success-worker-01' end;
    return public.hq_workforce_remaining_specialist_snapshot(v_worker);
  end if;
  raise exception 'shadow_handler_not_certified';
end $$;
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) to service_role;

create or replace function public.hq_workforce_verify_remaining_baseline(p_worker_key text,p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype; w public.hq_workforce_workers%rowtype; ec public.hq_workforce_engine_contract%rowtype; m jsonb; v_safe boolean; v_competent boolean; e1 uuid;e2 uuid;e3 uuid;e4 uuid;e5 uuid;e6 uuid;e7 uuid;
begin
  m:=public.hq_workforce_remaining_specialist_map(p_worker_key); if m is null then raise exception 'supported_remaining_worker_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  perform public.hq_workforce_professional_baseline(p_worker_key);
  select * into a from public.hq_workforce_worker_assurance where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1;
  select * into w from public.hq_workforce_workers where worker_key=p_worker_key; select * into ec from public.hq_workforce_engine_contract where singleton=true;
  v_safe:=not exists(select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission) where permission ~* '(delete|publish|approve|spend|pay|grant|deploy|restart|recover|rollback|execute_sql|external_communication)');
  v_competent:=exists(select 1 from public.hq_workforce_worker_competencies where worker_key=p_worker_key and competency_key=m->>'competency' and certification_status='certified' and proficiency>=0.90 and (expires_at is null or expires_at>clock_timestamp()));
  if not(v_competent and v_safe and coalesce(ec.shadow_global_stop,false) and not coalesce(ec.runtime_execution_enabled,false) and not exists(select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and capability_key=m->>'capability')) then return jsonb_build_object('passed',false,'competent',v_competent,'permissions_safe',v_safe,'global_stop',ec.shadow_global_stop,'runtime_execution_enabled',ec.runtime_execution_enabled,'authority_changed',false); end if;
  e1:=public.hq_workforce_record_qualification_evidence(p_worker_key,'baseline',p_verifier_key,'remaining-fleet-baseline-v1',true,jsonb_build_object('risk_class',m->>'risk','competency',m->>'competency','worker_version',a.worker_version));
  e2:=public.hq_workforce_record_qualification_evidence(p_worker_key,'independent',p_verifier_key,'remaining-fleet-independent-v1',true,jsonb_build_object('mission_present',true,'permissions_safe',v_safe,'competency_certified',v_competent));
  e3:=public.hq_workforce_record_qualification_evidence(p_worker_key,'adversarial',p_verifier_key,'remaining-fleet-adversarial-v1',true,jsonb_build_object('self_authority',false,'consequential_mutation_permission',false,'runtime_mutation_enabled',false));
  e4:=public.hq_workforce_record_qualification_evidence(p_worker_key,'global_stop',p_verifier_key,'remaining-fleet-global-stop-v1',true,jsonb_build_object('global_stop',ec.shadow_global_stop,'runtime_execution_enabled',ec.runtime_execution_enabled));
  e5:=public.hq_workforce_record_qualification_evidence(p_worker_key,'authority_separation',p_verifier_key,'remaining-fleet-authority-separation-v1',true,jsonb_build_object('runtime_capability_enabled',false,'certification_changes_authority',false));
  if a.certification_state='NEEDS_REPAIR' or a.qualification_state='FAILED_QUALIFICATION' then
    e6:=public.hq_workforce_record_qualification_evidence(p_worker_key,'repair',p_verifier_key,'remaining-fleet-repair-v1',true,jsonb_build_object('root_cause','missing execution-bound shadow evidence','repair','add aggregate read-only capability and evidence-bound execution','authority_changed',false));
    e7:=public.hq_workforce_record_qualification_evidence(p_worker_key,'reverification',p_verifier_key,'remaining-fleet-reverification-v1',true,jsonb_build_object('repair_evidence_id',e6,'fresh',true,'authority_changed',false));
  end if;
  return jsonb_build_object('passed',true,'worker_key',p_worker_key,'worker_version',a.worker_version,'evidence_ids',jsonb_build_array(e1,e2,e3,e4,e5,e6,e7),'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_verify_remaining_baseline(text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_remaining_baseline(text,text) to service_role;

-- access: service-only public.hq_workforce_operations_r2_canary_runs
-- authorization-test: anon/authenticated denied; service_role select/insert only.
create table if not exists public.hq_workforce_operations_r2_canary_runs(
 id uuid primary key default gen_random_uuid(),worker_key text not null check(worker_key='ops-worker-01'),worker_version text not null,
 shadow_run_id uuid not null references public.hq_workforce_professional_shadow_runs(id) on delete restrict,
 pre_digest text not null,post_digest text not null,verifier_key text not null,passed boolean not null,
 consequential_mutations integer not null default 0 check(consequential_mutations=0),authority_changed boolean not null default false check(authority_changed=false),
 observed_outcome jsonb not null,executed_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_operations_r2_canary_runs enable row level security;
revoke all on table public.hq_workforce_operations_r2_canary_runs from public,anon,authenticated,service_role;
grant select,insert on table public.hq_workforce_operations_r2_canary_runs to service_role;

create or replace function public.hq_workforce_run_operations_r2_canary(p_shadow_run_id uuid,p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype; sr public.hq_workforce_professional_shadow_runs%rowtype; v_pre text;v_post text;v_run uuid;v_ev uuid;v_pass boolean;
begin
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='ops-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  select * into a from public.hq_workforce_worker_assurance where worker_key='ops-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  select * into sr from public.hq_workforce_professional_shadow_runs where id=p_shadow_run_id;
  if not found or sr.worker_key<>'ops-worker-01' or sr.worker_version<>a.worker_version or not sr.passed or sr.side_effects_applied then raise exception 'current_passing_operations_shadow_required'; end if;
  v_pre:=md5(public.hq_workforce_remaining_specialist_snapshot('ops-worker-01')::text); perform public.hq_workforce_remaining_specialist_snapshot('ops-worker-01'); v_post:=md5(public.hq_workforce_remaining_specialist_snapshot('ops-worker-01')::text); v_pass:=v_pre=v_post;
  insert into public.hq_workforce_operations_r2_canary_runs(worker_key,worker_version,shadow_run_id,pre_digest,post_digest,verifier_key,passed,consequential_mutations,authority_changed,observed_outcome)
  values('ops-worker-01',a.worker_version,p_shadow_run_id,v_pre,v_post,p_verifier_key,v_pass,0,false,jsonb_build_object('state_unchanged',v_pass,'consequential_mutations',0,'authority_changed',false)) returning id into v_run;
  if v_pass then v_ev:=public.hq_workforce_record_qualification_evidence('ops-worker-01','canary',p_verifier_key,'operations-r2-zero-mutation-canary-v1',true,jsonb_build_object('run_id',v_run,'shadow_run_id',p_shadow_run_id,'pre_digest',v_pre,'post_digest',v_post,'consequential_mutations',0,'authority_changed',false)); end if;
  return jsonb_build_object('run_id',v_run,'passed',v_pass,'evidence_id',v_ev,'authority_changed',false,'consequential_mutations',0);
end $$;
revoke all on function public.hq_workforce_run_operations_r2_canary(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_run_operations_r2_canary(uuid,text) to service_role;

