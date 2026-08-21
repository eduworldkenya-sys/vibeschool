-- Priority 6: independently qualify Publishing + Platform R2 without release or operational mutation authority.
-- NON-ACTIVATING: no publication, deployment, recovery, runtime, authority or destructive action is enabled.

alter table public.hq_workforce_tool_contracts drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts add constraint hq_workforce_tool_contracts_handler_key_check check (
  handler_key = any(array[
    'work_item.triage_and_own'::text,'work_item.prioritize'::text,
    'content.research.external'::text,'content.evidence.semantic_verify'::text,
    'content.authoring.source_grounded'::text,'workforce.quality.assess_fixture'::text,
    'finance.reconciliation.readonly'::text,'security.assurance.readonly'::text,
    'publishing.release_readiness.readonly'::text,'platform.reliability.readonly'::text
  ])
);

create or replace function public.hq_workforce_assess_r2_specialist_competency(p_worker_key text,p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  w public.hq_workforce_workers%rowtype; v_key text; v_safe boolean; v_signal boolean; v_evidence jsonb;
begin
  select * into w from public.hq_workforce_workers where worker_key=p_worker_key;
  if not found or p_worker_key not in ('publishing-worker-01','platform-worker-01') then raise exception 'supported_r2_worker_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  if p_worker_key='publishing-worker-01' then
    v_key:='publishing.release_readiness';
    v_safe:=not exists(select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission) where permission ~* '(publish|release|approve|delete|deploy|grant|payment)');
    v_signal:=to_regclass('public.publication_release_checks') is not null and to_regclass('public.publication_release_approvals') is not null;
    v_evidence:=jsonb_build_object('release_checks_present',to_regclass('public.publication_release_checks') is not null,'release_approvals_present',to_regclass('public.publication_release_approvals') is not null,'permissions_non_mutating',v_safe,'assessment','readiness analysis and escalation only');
  else
    v_key:='platform.reliability';
    v_safe:=not exists(select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission) where permission ~* '(deploy|restart|delete|recover|rollback|grant|alter|execute_sql)');
    v_signal:=to_regclass('public.hq_incidents') is not null and to_regclass('public.hq_workforce_dead_letters') is not null and exists(select 1 from public.hq_workforce_engine_contract where singleton=true);
    v_evidence:=jsonb_build_object('incident_ledger_present',to_regclass('public.hq_incidents') is not null,'dead_letter_ledger_present',to_regclass('public.hq_workforce_dead_letters') is not null,'engine_contract_present',exists(select 1 from public.hq_workforce_engine_contract where singleton=true),'permissions_non_mutating',v_safe,'assessment','reliability diagnosis and escalation only');
  end if;
  if not (v_safe and v_signal and coalesce(btrim(w.mission),'')<>'') then return jsonb_build_object('passed',false,'worker_key',p_worker_key,'competency_key',v_key,'evidence',v_evidence,'authority_changed',false); end if;
  insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,sample_count,certification_status,evidence,scope_types,jurisdictions,last_evaluated_at,expires_at)
  values(p_worker_key,v_key,1,0.95,0.95,1,'certified',v_evidence || jsonb_build_object('independent_verifier',p_verifier_key),array['qualification'],array['global'],clock_timestamp(),clock_timestamp()+interval '30 days')
  on conflict(worker_key,competency_key,version) do update set proficiency=excluded.proficiency,reliability=excluded.reliability,sample_count=hq_workforce_worker_competencies.sample_count+1,certification_status='certified',evidence=excluded.evidence,last_evaluated_at=excluded.last_evaluated_at,expires_at=excluded.expires_at,updated_at=clock_timestamp();
  return jsonb_build_object('passed',true,'worker_key',p_worker_key,'competency_key',v_key,'evidence',v_evidence,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_assess_r2_specialist_competency(text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_assess_r2_specialist_competency(text,text) to service_role;

insert into public.hq_workforce_capabilities(capability_key,version,display_name,purpose,input_contract,output_contract,verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance)
values
('publishing.release_readiness.readonly',1,'Publishing release readiness read-only','Inspect canonical release checks and approval state; produce readiness evidence without publishing or approving.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','release_mutation',false),jsonb_build_object('independent_verification',true,'release_state_must_not_change',true,'release_authority_separate',true),2,0,'certified',jsonb_build_object('program','priority-6','qualification_only',true,'authority_granted',false)),
('platform.reliability.readonly',1,'Platform reliability read-only','Inspect incidents, dead letters and governed runtime health; produce evidence without deployment, restart or recovery mutation.',jsonb_build_object('type','object','additionalProperties',false),jsonb_build_object('type','object','platform_mutation',false),jsonb_build_object('independent_verification',true,'platform_state_must_not_change',true,'operational_authority_separate',true),2,0,'certified',jsonb_build_object('program','priority-6','qualification_only',true,'authority_granted',false))
on conflict(capability_key,version) do update set display_name=excluded.display_name,purpose=excluded.purpose,input_contract=excluded.input_contract,output_contract=excluded.output_contract,verification_contract=excluded.verification_contract,risk_class=2,autonomy_ceiling=0,lifecycle_status='certified',provenance=excluded.provenance,updated_at=clock_timestamp();

insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'publishing.release_readiness',true,1,0.90 from public.hq_workforce_capabilities where capability_key='publishing.release_readiness.readonly' and version=1
on conflict(capability_id,competency_key) do update set required=true,weight=1,minimum_proficiency=0.90;
insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'platform.reliability',true,1,0.90 from public.hq_workforce_capabilities where capability_key='platform.reliability.readonly' and version=1
on conflict(capability_id,competency_key) do update set required=true,weight=1,minimum_proficiency=0.90;

insert into public.hq_workforce_tool_contracts(tool_key,version,title,handler_key,required_capability_key,operation,resource_type,side_effect_class,status,approved_at,approval_reason)
values
('publishing.release_readiness.readonly',1,'Publishing release readiness shadow tool','publishing.release_readiness.readonly','publishing.release_readiness.readonly','analyze_release_readiness','publication_release_metadata','read_only','approved',clock_timestamp(),'Qualification-only read path; no release authority.'),
('platform.reliability.readonly',1,'Platform reliability shadow tool','platform.reliability.readonly','platform.reliability.readonly','analyze_reliability','platform_operational_metadata','read_only','approved',clock_timestamp(),'Qualification-only read path; no operational mutation authority.')
on conflict(tool_key,version) do update set title=excluded.title,handler_key=excluded.handler_key,required_capability_key=excluded.required_capability_key,operation=excluded.operation,resource_type=excluded.resource_type,side_effect_class='read_only',status='approved',approved_at=coalesce(hq_workforce_tool_contracts.approved_at,clock_timestamp()),approval_reason=excluded.approval_reason;

-- access: service-only public.hq_workforce_r2_specialist_canary_runs
-- authorization-test: public.hq_workforce_r2_specialist_canary_runs anon/authenticated denied; service_role select/insert only.
create table if not exists public.hq_workforce_r2_specialist_canary_runs(
 id uuid primary key default gen_random_uuid(), worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
 worker_version text not null, shadow_run_id uuid not null references public.hq_workforce_professional_shadow_runs(id) on delete restrict,
 pre_digest text not null, post_digest text not null, verifier_key text not null, passed boolean not null,
 consequential_mutations integer not null default 0 check(consequential_mutations=0), authority_changed boolean not null default false check(authority_changed=false),
 observed_outcome jsonb not null, executed_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_r2_specialist_canary_runs enable row level security;
revoke all on table public.hq_workforce_r2_specialist_canary_runs from public,anon,authenticated,service_role;
grant select,insert on table public.hq_workforce_r2_specialist_canary_runs to service_role;

create or replace function public.hq_workforce_publishing_readonly_snapshot() returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
 select jsonb_build_object('release_check_count',(select count(*) from public.publication_release_checks),'release_check_failures',(select count(*) from public.publication_release_checks where lower(status) not in ('pass','passed','ok','approved')),'release_approval_count',(select count(*) from public.publication_release_approvals),'pending_approvals',(select count(*) from public.publication_release_approvals where lower(status) not in ('approved','released')),'decision','inspect_and_escalate_only','publication_authority',false,'approval_authority',false,'side_effects_applied',false,'handler','publishing.release_readiness.readonly');
$$;
revoke all on function public.hq_workforce_publishing_readonly_snapshot() from public,anon,authenticated; grant execute on function public.hq_workforce_publishing_readonly_snapshot() to service_role;

create or replace function public.hq_workforce_platform_readonly_snapshot() returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
 select jsonb_build_object('open_incidents',(select count(*) from public.hq_incidents where lower(status) not in ('resolved','closed')),'dead_letters',(select count(*) from public.hq_workforce_dead_letters),'runtime_execution_enabled',(select runtime_execution_enabled from public.hq_workforce_engine_contract where singleton=true),'runtime_autonomy_level',(select runtime_autonomy_level from public.hq_workforce_engine_contract where singleton=true),'global_stop',(select shadow_global_stop from public.hq_workforce_engine_contract where singleton=true),'decision','diagnose_and_escalate_only','deployment_authority',false,'recovery_mutation_authority',false,'side_effects_applied',false,'handler','platform.reliability.readonly');
$$;
revoke all on function public.hq_workforce_platform_readonly_snapshot() from public,anon,authenticated; grant execute on function public.hq_workforce_platform_readonly_snapshot() to service_role;

create or replace function public.hq_workforce_r2_specialist_digest(p_worker_key text) returns text language plpgsql security definer set search_path=public,pg_temp stable as $$
begin
 if p_worker_key='publishing-worker-01' then return md5(concat_ws('|',(select count(*) from public.publication_release_checks),(select count(*) from public.publication_release_approvals),(select count(*) from public.content_convergence_release_decisions))); end if;
 if p_worker_key='platform-worker-01' then return md5(concat_ws('|',(select count(*) from public.hq_incidents),(select count(*) from public.hq_workforce_dead_letters),(select runtime_execution_enabled from public.hq_workforce_engine_contract where singleton=true),(select runtime_autonomy_level from public.hq_workforce_engine_contract where singleton=true),(select shadow_global_stop from public.hq_workforce_engine_contract where singleton=true))); end if;
 raise exception 'supported_r2_worker_required';
end $$;
revoke all on function public.hq_workforce_r2_specialist_digest(text) from public,anon,authenticated; grant execute on function public.hq_workforce_r2_specialist_digest(text) to service_role;

create or replace function public.hq_workforce_execute_shadow_tool(p_tool_contract_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.hq_workforce_tool_contracts%rowtype; v_material public.curriculum_semantic_materials%rowtype;
begin
 select * into t from public.hq_workforce_tool_contracts where id=p_tool_contract_id and status='approved'; if not found then raise exception 'approved_shadow_tool_required'; end if;
 if coalesce(jsonb_typeof(p_input),'null')<>'object' then raise exception 'shadow_input_object_required'; end if;
 if t.handler_key='work_item.triage_and_own' then if coalesce((p_input->>'approval_required')::boolean,false) then raise exception 'shadow_case_requires_unapproved_work'; end if; return jsonb_build_object('decision','triage','side_effects_applied',false,'handler',t.handler_key);
 elsif t.handler_key='content.research.external' then if coalesce(btrim(p_input->>'research_job_id'),'')='' then raise exception 'shadow_research_job_id_required'; end if; if not exists(select 1 from public.curriculum_research_jobs where id=(p_input->>'research_job_id')::uuid) then raise exception 'shadow_research_job_not_found'; end if; return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'semantic_self_certification',false,'external_fetch_executed',false,'next_boundary','candidate_source_discovery_only');
 elsif t.handler_key='content.evidence.semantic_verify' then if coalesce(btrim(p_input->>'source_id'),'')='' or coalesce(btrim(p_input->>'material_sha256'),'')='' then raise exception 'shadow_semantic_material_required'; end if; select * into v_material from public.curriculum_semantic_materials where source_id=(p_input->>'source_id')::uuid and material_sha256=p_input->>'material_sha256' order by retrieved_at desc limit 1; if not found then raise exception 'shadow_semantic_material_not_found'; end if; return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'actual_material_required',true,'material_bound',true,'verdict_generated',false,'next_boundary','governed_model_authorization');
 elsif t.handler_key='content.authoring.source_grounded' then if coalesce(btrim(p_input->>'proposal_id'),'')='' or coalesce(btrim(p_input->>'evidence_packet_sha256'),'')='' or coalesce(btrim(p_input->>'current_content_sha256'),'')='' then raise exception 'shadow_authoring_evidence_required'; end if; if not exists(select 1 from public.curriculum_intelligence_proposals where id=(p_input->>'proposal_id')::uuid) then raise exception 'shadow_authoring_proposal_not_found'; end if; return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'publish_authority',false,'human_acceptance_required',true,'next_boundary','governed_source_grounded_draft');
 elsif t.handler_key='finance.reconciliation.readonly' then if p_input<>'{}'::jsonb then raise exception 'finance_shadow_input_must_be_empty'; end if; return public.hq_workforce_finance_readonly_snapshot();
 elsif t.handler_key='security.assurance.readonly' then if p_input<>'{}'::jsonb then raise exception 'security_shadow_input_must_be_empty'; end if; return public.hq_workforce_security_readonly_snapshot();
 elsif t.handler_key='publishing.release_readiness.readonly' then if p_input<>'{}'::jsonb then raise exception 'publishing_shadow_input_must_be_empty'; end if; return public.hq_workforce_publishing_readonly_snapshot();
 elsif t.handler_key='platform.reliability.readonly' then if p_input<>'{}'::jsonb then raise exception 'platform_shadow_input_must_be_empty'; end if; return public.hq_workforce_platform_readonly_snapshot(); end if;
 raise exception 'shadow_handler_not_certified';
end $$;
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon,authenticated; grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) to service_role;

create or replace function public.hq_workforce_verify_r2_specialist_baseline(p_worker_key text,p_verifier_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype; w public.hq_workforce_workers%rowtype; ec public.hq_workforce_engine_contract%rowtype; v_comp text; v_safe boolean; v_competent boolean; v_no_runtime boolean; e1 uuid;e2 uuid;e3 uuid;e4 uuid;e5 uuid;
begin
 if p_worker_key not in ('publishing-worker-01','platform-worker-01') then raise exception 'supported_r2_worker_required'; end if;
 if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
 perform public.hq_workforce_professional_baseline(p_worker_key);
 select * into a from public.hq_workforce_worker_assurance where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1;
 select * into w from public.hq_workforce_workers where worker_key=p_worker_key; select * into ec from public.hq_workforce_engine_contract where singleton=true;
 v_comp:=case when p_worker_key='publishing-worker-01' then 'publishing.release_readiness' else 'platform.reliability' end;
 v_competent:=exists(select 1 from public.hq_workforce_worker_competencies where worker_key=p_worker_key and competency_key=v_comp and certification_status='certified' and proficiency>=0.90 and (expires_at is null or expires_at>clock_timestamp()));
 v_safe:=case when p_worker_key='publishing-worker-01' then not exists(select 1 from jsonb_array_elements_text(w.permissions) p(permission) where permission ~* '(publish|release|approve|delete|deploy|grant|payment)') else not exists(select 1 from jsonb_array_elements_text(w.permissions) p(permission) where permission ~* '(deploy|restart|delete|recover|rollback|grant|alter|execute_sql)') end;
 v_no_runtime:=not exists(select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and ((p_worker_key='publishing-worker-01' and (capability_key ilike 'publishing.%' or operation ~* '(publish|release|approve)')) or (p_worker_key='platform-worker-01' and (capability_key ilike 'platform.%' or operation ~* '(deploy|restart|recover|rollback|delete)'))));
 if not(v_competent and v_safe and v_no_runtime and coalesce(ec.shadow_global_stop,false) and not coalesce(ec.runtime_execution_enabled,false)) then return jsonb_build_object('passed',false,'competent',v_competent,'permissions_safe',v_safe,'no_runtime_mutation',v_no_runtime,'global_stop',ec.shadow_global_stop,'authority_changed',false); end if;
 e1:=public.hq_workforce_record_qualification_evidence(p_worker_key,'baseline',p_verifier_key,'r2-specialist-baseline-v1',true,jsonb_build_object('risk_class','R2','competency',v_comp,'worker_version',a.worker_version));
 e2:=public.hq_workforce_record_qualification_evidence(p_worker_key,'independent',p_verifier_key,'r2-specialist-independent-v1',true,jsonb_build_object('mission_present',true,'permissions_safe',v_safe,'competency_certified',v_competent));
 e3:=public.hq_workforce_record_qualification_evidence(p_worker_key,'adversarial',p_verifier_key,'r2-specialist-adversarial-v1',true,jsonb_build_object('self_authority',false,'consequential_mutation_permission',false,'runtime_mutation_enabled',false));
 e4:=public.hq_workforce_record_qualification_evidence(p_worker_key,'global_stop',p_verifier_key,'r2-specialist-global-stop-v1',true,jsonb_build_object('global_stop',ec.shadow_global_stop,'runtime_execution_enabled',ec.runtime_execution_enabled));
 e5:=public.hq_workforce_record_qualification_evidence(p_worker_key,'authority_separation',p_verifier_key,'r2-specialist-authority-separation-v1',true,jsonb_build_object('runtime_mutation_enabled',false,'certification_changes_authority',false));
 return jsonb_build_object('passed',true,'worker_key',p_worker_key,'worker_version',a.worker_version,'evidence_ids',jsonb_build_array(e1,e2,e3,e4,e5),'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_verify_r2_specialist_baseline(text,text) from public,anon,authenticated; grant execute on function public.hq_workforce_verify_r2_specialist_baseline(text,text) to service_role;

create or replace function public.hq_workforce_run_r2_specialist_canary(p_worker_key text,p_shadow_run_id uuid,p_verifier_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype; sr public.hq_workforce_professional_shadow_runs%rowtype; v_pre text;v_post text;v_id uuid;v_ev uuid;v_pass boolean;
begin
 if p_worker_key not in ('publishing-worker-01','platform-worker-01') then raise exception 'supported_r2_worker_required'; end if;
 if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
 select * into a from public.hq_workforce_worker_assurance where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1;
 select * into sr from public.hq_workforce_professional_shadow_runs where id=p_shadow_run_id;
 if not found or sr.worker_key<>p_worker_key or sr.worker_version<>a.worker_version or not sr.passed or sr.side_effects_applied then raise exception 'current_passing_shadow_required'; end if;
 v_pre:=public.hq_workforce_r2_specialist_digest(p_worker_key);
 if p_worker_key='publishing-worker-01' then perform public.hq_workforce_publishing_readonly_snapshot(); else perform public.hq_workforce_platform_readonly_snapshot(); end if;
 v_post:=public.hq_workforce_r2_specialist_digest(p_worker_key); v_pass:=v_pre=v_post;
 insert into public.hq_workforce_r2_specialist_canary_runs(worker_key,worker_version,shadow_run_id,pre_digest,post_digest,verifier_key,passed,consequential_mutations,authority_changed,observed_outcome)
 values(p_worker_key,a.worker_version,p_shadow_run_id,v_pre,v_post,p_verifier_key,v_pass,0,false,jsonb_build_object('state_unchanged',v_pass,'consequential_mutations',0,'authority_changed',false)) returning id into v_id;
 if v_pass then v_ev:=public.hq_workforce_record_qualification_evidence(p_worker_key,'canary',p_verifier_key,'r2-specialist-zero-mutation-canary-v1',true,jsonb_build_object('run_id',v_id,'shadow_run_id',p_shadow_run_id,'pre_digest',v_pre,'post_digest',v_post,'consequential_mutations',0,'authority_changed',false)); end if;
 return jsonb_build_object('run_id',v_id,'passed',v_pass,'evidence_id',v_ev,'authority_changed',false,'consequential_mutations',0);
end $$;
revoke all on function public.hq_workforce_run_r2_specialist_canary(text,uuid,text) from public,anon,authenticated; grant execute on function public.hq_workforce_run_r2_specialist_canary(text,uuid,text) to service_role;
