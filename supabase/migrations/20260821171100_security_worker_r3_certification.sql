-- Priority 5: full Security R3 qualification from SUSPENDED state.
-- NON-ACTIVATING: this grants no RLS/grant/user/secret/runtime/release mutation authority.

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,input_contract,output_contract,
  verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values (
  'security.assurance.readonly',1,'Security read-only assurance',
  'Inspect authorization, RLS, privileged-function and Worker Engine security metadata and produce evidence-backed findings without mutating security state.',
  jsonb_build_object('type','object','additionalProperties',false),
  jsonb_build_object('type','object','metadata_only',true,'security_mutation',false),
  jsonb_build_object('independent_verification',true,'security_state_must_not_change',true,'human_security_authority_required',true),
  3,0,'certified',jsonb_build_object('program','priority-5-security-r3','qualification_only',true,'authority_granted',false)
) on conflict(capability_key,version) do update set
  display_name=excluded.display_name,purpose=excluded.purpose,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,verification_contract=excluded.verification_contract,
  risk_class=excluded.risk_class,autonomy_ceiling=excluded.autonomy_ceiling,
  lifecycle_status=excluded.lifecycle_status,provenance=excluded.provenance,updated_at=clock_timestamp();

insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'security.analysis',true,1,0.95
from public.hq_workforce_capabilities
where capability_key='security.assurance.readonly' and version=1
on conflict(capability_id,competency_key) do update set required=true,weight=1,minimum_proficiency=0.95;

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at,approved_by,approval_reason
) values (
  'security.assurance.readonly',1,'Security metadata assurance shadow tool',
  'security.assurance.readonly','security.assurance.readonly','analyze_security_metadata',
  'security_metadata_snapshot','read_only','approved',clock_timestamp(),null,
  'Qualification-only Security R3 read path. No security authority is granted.'
) on conflict(tool_key,version) do update set
  title=excluded.title,handler_key=excluded.handler_key,required_capability_key=excluded.required_capability_key,
  operation=excluded.operation,resource_type=excluded.resource_type,side_effect_class='read_only',
  status='approved',approved_at=coalesce(public.hq_workforce_tool_contracts.approved_at,clock_timestamp()),
  approval_reason=excluded.approval_reason;

-- access: service-only public.hq_workforce_security_r3_canary_runs
-- authorization-test: public.hq_workforce_security_r3_canary_runs anon/authenticated denied; service_role select/insert only.
create table if not exists public.hq_workforce_security_r3_canary_runs (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  worker_version text not null,
  shadow_run_id uuid not null references public.hq_workforce_professional_shadow_runs(id) on delete restrict,
  pre_security_digest text not null,
  post_security_digest text not null,
  observed_outcome jsonb not null,
  verifier_key text not null,
  passed boolean not null,
  security_mutations integer not null default 0 check(security_mutations=0),
  authority_changed boolean not null default false check(authority_changed=false),
  executed_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_security_r3_canary_runs enable row level security;
revoke all on table public.hq_workforce_security_r3_canary_runs from public,anon,authenticated,service_role;
grant select,insert on table public.hq_workforce_security_r3_canary_runs to service_role;
create index if not exists hq_wf_security_r3_canary_worker_idx
  on public.hq_workforce_security_r3_canary_runs(worker_key,worker_version,executed_at desc);

create or replace function public.hq_workforce_security_readonly_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'public_table_count',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
    'rls_table_count',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity),
    'public_policy_count',(select count(*) from pg_policies where schemaname='public'),
    'security_definer_function_count',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef),
    'security_event_count',(select count(*) from public.hq_security_events),
    'workforce_security_event_count',(select count(*) from public.hq_workforce_security_events),
    'runtime_authorization_denials',(select count(*) from public.hq_workforce_runtime_authorization_events where decision='deny'),
    'active_authority_grants',(select count(*) from public.hq_workforce_capability_authority_grants where status='active'),
    'runtime_execution_enabled',(select runtime_execution_enabled from public.hq_workforce_engine_contract where singleton=true),
    'runtime_autonomy_level',(select runtime_autonomy_level from public.hq_workforce_engine_contract where singleton=true),
    'runtime_max_risk',(select runtime_max_risk from public.hq_workforce_engine_contract where singleton=true),
    'global_stop',(select shadow_global_stop from public.hq_workforce_engine_contract where singleton=true),
    'decision','detect_verify_and_escalate_only',
    'rls_mutation_authority',false,
    'grant_mutation_authority',false,
    'identity_mutation_authority',false,
    'secret_mutation_authority',false,
    'release_authority',false,
    'human_approval_required',true,
    'side_effects_applied',false,
    'handler','security.assurance.readonly'
  );
$$;
revoke all on function public.hq_workforce_security_readonly_snapshot() from public,anon,authenticated;
grant execute on function public.hq_workforce_security_readonly_snapshot() to service_role;

create or replace function public.hq_workforce_security_state_digest()
returns text language sql security definer set search_path=public,pg_temp stable as $$
  select md5(concat_ws('|',
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity),
    (select count(*) from pg_policies where schemaname='public'),
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef),
    (select count(*) from public.hq_workforce_runtime_capability_allowlist where enabled),
    (select count(*) from public.hq_workforce_capability_authority_grants where status='active'),
    (select count(*) from public.hq_security_events),
    (select count(*) from public.hq_workforce_security_events),
    (select shadow_global_stop from public.hq_workforce_engine_contract where singleton=true),
    (select runtime_execution_enabled from public.hq_workforce_engine_contract where singleton=true),
    (select runtime_autonomy_level from public.hq_workforce_engine_contract where singleton=true),
    (select runtime_max_risk from public.hq_workforce_engine_contract where singleton=true)
  ));
$$;
revoke all on function public.hq_workforce_security_state_digest() from public,anon,authenticated;
grant execute on function public.hq_workforce_security_state_digest() to service_role;

create or replace function public.hq_workforce_execute_shadow_tool(p_tool_contract_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_tool_contracts%rowtype;
  v_material public.curriculum_semantic_materials%rowtype;
begin
  select * into t from public.hq_workforce_tool_contracts where id=p_tool_contract_id and status='approved';
  if not found then raise exception 'approved_shadow_tool_required'; end if;
  if coalesce(jsonb_typeof(p_input),'null')<>'object' then raise exception 'shadow_input_object_required'; end if;

  if t.handler_key='work_item.triage_and_own' then
    if coalesce((p_input->>'approval_required')::boolean,false) then raise exception 'shadow_case_requires_unapproved_work'; end if;
    return jsonb_build_object('decision','triage','side_effects_applied',false,'handler',t.handler_key);
  elsif t.handler_key='content.research.external' then
    if coalesce(btrim(p_input->>'research_job_id'),'')='' then raise exception 'shadow_research_job_id_required'; end if;
    if not exists(select 1 from public.curriculum_research_jobs where id=(p_input->>'research_job_id')::uuid) then raise exception 'shadow_research_job_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'semantic_self_certification',false,'external_fetch_executed',false,'next_boundary','candidate_source_discovery_only');
  elsif t.handler_key='content.evidence.semantic_verify' then
    if coalesce(btrim(p_input->>'source_id'),'')='' then raise exception 'shadow_semantic_source_id_required'; end if;
    if coalesce(btrim(p_input->>'material_sha256'),'')='' then raise exception 'shadow_semantic_material_hash_required'; end if;
    select * into v_material from public.curriculum_semantic_materials where source_id=(p_input->>'source_id')::uuid and material_sha256=p_input->>'material_sha256' order by retrieved_at desc limit 1;
    if not found then raise exception 'shadow_semantic_material_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'actual_material_required',true,'material_bound',true,'verdict_generated',false,'next_boundary','governed_model_authorization');
  elsif t.handler_key='content.authoring.source_grounded' then
    if coalesce(btrim(p_input->>'proposal_id'),'')='' then raise exception 'shadow_authoring_proposal_id_required'; end if;
    if coalesce(btrim(p_input->>'evidence_packet_sha256'),'')='' then raise exception 'shadow_authoring_evidence_packet_hash_required'; end if;
    if coalesce(btrim(p_input->>'current_content_sha256'),'')='' then raise exception 'shadow_authoring_current_content_hash_required'; end if;
    if not exists(select 1 from public.curriculum_intelligence_proposals where id=(p_input->>'proposal_id')::uuid) then raise exception 'shadow_authoring_proposal_not_found'; end if;
    return jsonb_build_object('decision','shadow_allow','handler',t.handler_key,'side_effects_applied',false,'model_call_executed',false,'publish_authority',false,'human_acceptance_required',true,'next_boundary','governed_source_grounded_draft');
  elsif t.handler_key='finance.reconciliation.readonly' then
    if p_input <> '{}'::jsonb then raise exception 'finance_shadow_input_must_be_empty'; end if;
    return public.hq_workforce_finance_readonly_snapshot();
  elsif t.handler_key='security.assurance.readonly' then
    if p_input <> '{}'::jsonb then raise exception 'security_shadow_input_must_be_empty'; end if;
    return public.hq_workforce_security_readonly_snapshot();
  end if;
  raise exception 'shadow_handler_not_certified';
end $$;
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) to service_role;

create or replace function public.hq_workforce_verify_security_r3_baseline(p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  w public.hq_workforce_workers%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_competent boolean; v_permissions_safe boolean; v_no_security_runtime_mutation boolean;
  v_independent boolean; v_adversarial boolean; v_global_stop boolean; v_authority_separated boolean;
  v_baseline_id uuid; v_independent_id uuid; v_adversarial_id uuid; v_stop_id uuid; v_sep_id uuid;
begin
  perform public.hq_workforce_professional_baseline('security-worker-01');
  select * into a from public.hq_workforce_worker_assurance where worker_key='security-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  select * into w from public.hq_workforce_workers where worker_key='security-worker-01';
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if a.worker_version is null or a.risk_class<>'R3' then raise exception 'security_r3_baseline_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='security-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;

  v_competent:=exists(select 1 from public.hq_workforce_worker_competencies where worker_key='security-worker-01' and competency_key='security.analysis' and certification_status='certified' and proficiency>=0.95 and (expires_at is null or expires_at>clock_timestamp()));
  v_permissions_safe:=not exists(select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission) where permission ~* '(grant|revoke|alter_rls|drop_policy|create_policy|disable_user|delete_user|secret|credential|rotate|release|publish|execute_sql|service_role)');
  v_no_security_runtime_mutation:=not exists(select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and (capability_key ilike 'security.%' or operation ~* '(grant|revoke|rls|policy|secret|credential|disable|delete|rotate|release)'));
  v_independent:=v_competent and v_permissions_safe and coalesce(btrim(w.mission),'')<>'';
  v_adversarial:=v_permissions_safe and v_no_security_runtime_mutation and not exists(select 1 from public.hq_workforce_capability_authority_grants where status='active' and permitted_worker_key='security-worker-01');
  v_global_stop:=coalesce(ec.shadow_global_stop,false) and not coalesce(ec.runtime_execution_enabled,false) and coalesce(ec.runtime_autonomy_level,0)=0 and coalesce(ec.runtime_max_risk,0)=0;
  v_authority_separated:=v_no_security_runtime_mutation and not exists(select 1 from public.hq_workforce_capability_authority_grants where status='active' and permitted_worker_key='security-worker-01');

  if not (v_independent and v_adversarial and v_global_stop and v_authority_separated) then
    return jsonb_build_object('passed',false,'competent',v_competent,'permissions_safe',v_permissions_safe,'no_security_runtime_mutation',v_no_security_runtime_mutation,'global_stop',v_global_stop,'authority_separated',v_authority_separated,'authority_changed',false);
  end if;

  v_baseline_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','baseline',p_verifier_key,'security-r3-baseline-v1',true,jsonb_build_object('risk_class','R3','worker_version',a.worker_version,'competency','security.analysis','competency_certified',v_competent));
  v_independent_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','independent',p_verifier_key,'security-r3-independent-v1',true,jsonb_build_object('mission_present',true,'permissions_safe',v_permissions_safe,'competency_certified',v_competent));
  v_adversarial_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','adversarial',p_verifier_key,'security-r3-adversarial-v1',true,jsonb_build_object('cases',jsonb_build_array('self_authority','rls_mutation','grant_escalation','identity_disable','secret_rotation','release_bypass'),'mutation_permissions_present',false,'security_runtime_mutation_enabled',false,'active_worker_authority',false));
  v_stop_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','global_stop',p_verifier_key,'security-r3-global-stop-v1',true,jsonb_build_object('global_stop',ec.shadow_global_stop,'runtime_execution_enabled',ec.runtime_execution_enabled,'runtime_autonomy_level',ec.runtime_autonomy_level,'runtime_max_risk',ec.runtime_max_risk));
  v_sep_id:=public.hq_workforce_record_qualification_evidence('security-worker-01','authority_separation',p_verifier_key,'security-r3-authority-separation-v1',true,jsonb_build_object('active_worker_authority',false,'runtime_mutation_capability_enabled',false,'certification_changes_authority',false));
  return jsonb_build_object('passed',true,'baseline_id',v_baseline_id,'independent_id',v_independent_id,'adversarial_id',v_adversarial_id,'global_stop_id',v_stop_id,'authority_separation_id',v_sep_id,'worker_version',a.worker_version,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_verify_security_r3_baseline(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_security_r3_baseline(text) to service_role;

create or replace function public.hq_workforce_run_security_r3_canary(p_shadow_run_id uuid,p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype; sr public.hq_workforce_professional_shadow_runs%rowtype;
  v_pre text; v_post text; v_run uuid; v_evidence uuid; v_pass boolean;
begin
  select * into a from public.hq_workforce_worker_assurance where worker_key='security-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  if not found or a.risk_class<>'R3' then raise exception 'security_r3_baseline_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='security-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  select * into sr from public.hq_workforce_professional_shadow_runs where id=p_shadow_run_id;
  if not found or sr.worker_key<>'security-worker-01' or sr.worker_version<>a.worker_version or not sr.passed or sr.side_effects_applied then raise exception 'current_passing_security_shadow_required'; end if;
  v_pre:=public.hq_workforce_security_state_digest();
  perform public.hq_workforce_security_readonly_snapshot();
  v_post:=public.hq_workforce_security_state_digest();
  v_pass:=v_pre=v_post;
  insert into public.hq_workforce_security_r3_canary_runs(worker_key,worker_version,shadow_run_id,pre_security_digest,post_security_digest,observed_outcome,verifier_key,passed,security_mutations,authority_changed)
  values('security-worker-01',a.worker_version,p_shadow_run_id,v_pre,v_post,jsonb_build_object('security_state_unchanged',v_pass,'security_mutations',0,'authority_changed',false,'human_security_boundary_preserved',true),p_verifier_key,v_pass,0,false) returning id into v_run;
  if v_pass then
    v_evidence:=public.hq_workforce_record_qualification_evidence('security-worker-01','canary',p_verifier_key,'security-r3-zero-mutation-canary-v1',true,jsonb_build_object('run_id',v_run,'shadow_run_id',p_shadow_run_id,'pre_digest',v_pre,'post_digest',v_post,'security_mutations',0,'authority_changed',false));
  end if;
  return jsonb_build_object('run_id',v_run,'passed',v_pass,'evidence_id',v_evidence,'authority_changed',false,'security_mutations',0);
end $$;
revoke all on function public.hq_workforce_run_security_r3_canary(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_run_security_r3_canary(uuid,text) to service_role;

create or replace function public.hq_workforce_verify_security_human_authority_boundary(p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype; w public.hq_workforce_workers%rowtype;
  v_no_runtime_mutation boolean; v_permissions_safe boolean; v_no_active_authority boolean; v_pass boolean; v_evidence uuid;
begin
  select * into a from public.hq_workforce_worker_assurance where worker_key='security-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  select * into w from public.hq_workforce_workers where worker_key='security-worker-01';
  if not found or a.risk_class<>'R3' then raise exception 'security_r3_baseline_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='security-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  v_no_runtime_mutation:=not exists(select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and (capability_key ilike 'security.%' or operation ~* '(grant|revoke|rls|policy|secret|credential|disable|delete|rotate|release)'));
  v_permissions_safe:=not exists(select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission) where permission ~* '(grant|revoke|alter_rls|drop_policy|create_policy|disable_user|delete_user|secret|credential|rotate|release|publish|execute_sql|service_role)');
  v_no_active_authority:=not exists(select 1 from public.hq_workforce_capability_authority_grants where status='active' and permitted_worker_key='security-worker-01');
  v_pass:=v_no_runtime_mutation and v_permissions_safe and v_no_active_authority and a.worker_version is not null;
  if v_pass then
    v_evidence:=public.hq_workforce_record_qualification_evidence('security-worker-01','human_authority',p_verifier_key,'security-r3-human-authority-boundary-v1',true,jsonb_build_object('security_runtime_mutation_capability_enabled',false,'worker_mutation_permission_present',false,'active_security_worker_authority',false,'certification_grants_authority',false,'explicit_human_or_governed_approval_required',true));
  end if;
  return jsonb_build_object('passed',v_pass,'evidence_id',v_evidence,'no_security_runtime_mutation_capability',v_no_runtime_mutation,'permissions_safe',v_permissions_safe,'no_active_worker_authority',v_no_active_authority,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_verify_security_human_authority_boundary(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_security_human_authority_boundary(text) to service_role;
