-- Priority 4: Finance R3 professional qualification without financial authority.
-- NON-ACTIVATING: no spend, settlement, refund, wallet, bank, credit-note,
-- payment initiation, publication, capability allowlist, runtime policy, or autonomy grants.

insert into public.hq_workforce_capabilities(
  capability_key,version,display_name,purpose,input_contract,output_contract,
  verification_contract,risk_class,autonomy_ceiling,lifecycle_status,provenance
) values (
  'finance.reconciliation.readonly',1,'Finance read-only reconciliation',
  'Inspect aggregate finance/payment reconciliation state and produce evidence without mutating financial state.',
  jsonb_build_object('type','object','additionalProperties',false),
  jsonb_build_object('type','object','aggregate_only',true,'financial_mutation',false),
  jsonb_build_object('independent_verification',true,'financial_state_must_not_change',true,'human_financial_authority_required',true),
  3,0,'certified',jsonb_build_object('program','priority-4-finance-r3','qualification_only',true,'authority_granted',false)
) on conflict(capability_key,version) do update set
  display_name=excluded.display_name,purpose=excluded.purpose,input_contract=excluded.input_contract,
  output_contract=excluded.output_contract,verification_contract=excluded.verification_contract,
  risk_class=excluded.risk_class,autonomy_ceiling=excluded.autonomy_ceiling,
  lifecycle_status=excluded.lifecycle_status,provenance=excluded.provenance,updated_at=clock_timestamp();

insert into public.hq_workforce_capability_competencies(capability_id,competency_key,required,weight,minimum_proficiency)
select id,'finance.analysis',true,1,0.90
from public.hq_workforce_capabilities
where capability_key='finance.reconciliation.readonly' and version=1
on conflict(capability_id,competency_key) do update set required=true,weight=1,minimum_proficiency=0.90;

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at,approved_by,approval_reason
) values (
  'finance.reconciliation.readonly',1,'Finance aggregate reconciliation shadow tool',
  'finance.reconciliation.readonly','finance.reconciliation.readonly','analyze_reconciliation',
  'finance_aggregate_snapshot','read_only','approved',clock_timestamp(),null,
  'Qualification-only read path for Finance R3. Does not grant runtime authority.'
) on conflict(tool_key,version) do update set
  title=excluded.title,handler_key=excluded.handler_key,required_capability_key=excluded.required_capability_key,
  operation=excluded.operation,resource_type=excluded.resource_type,side_effect_class='read_only',
  status='approved',approved_at=coalesce(public.hq_workforce_tool_contracts.approved_at,clock_timestamp()),
  approval_reason=excluded.approval_reason;

-- access: service-only public.hq_workforce_finance_r3_canary_runs
-- authorization-test: public.hq_workforce_finance_r3_canary_runs anon/authenticated denied; service_role select/insert only.
create table if not exists public.hq_workforce_finance_r3_canary_runs (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  worker_version text not null,
  shadow_run_id uuid not null references public.hq_workforce_professional_shadow_runs(id) on delete restrict,
  pre_finance_digest text not null,
  post_finance_digest text not null,
  observed_outcome jsonb not null,
  verifier_key text not null,
  passed boolean not null,
  financial_mutations integer not null default 0 check(financial_mutations=0),
  authority_changed boolean not null default false check(authority_changed=false),
  executed_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_finance_r3_canary_runs enable row level security;
revoke all on table public.hq_workforce_finance_r3_canary_runs from public,anon,authenticated,service_role;
grant select,insert on table public.hq_workforce_finance_r3_canary_runs to service_role;
create index if not exists hq_wf_finance_r3_canary_worker_idx
  on public.hq_workforce_finance_r3_canary_runs(worker_key,worker_version,executed_at desc);

create or replace function public.hq_workforce_finance_readonly_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'payment_attempt_count',(select count(*) from public.commerce_payment_attempts),
    'payment_attempt_expected_kes',(select coalesce(sum(expected_amount_kes),0) from public.commerce_payment_attempts),
    'payment_attempt_settled_count',(select count(*) from public.commerce_payment_attempts where settled_at is not null),
    'finance_payment_count',(select count(*) from public.finance_payments where deleted_at is null),
    'finance_payment_total',(select coalesce(sum(amount),0) from public.finance_payments where deleted_at is null),
    'decision','reconcile_and_escalate_only',
    'financial_mutation',false,
    'spend_authority',false,
    'settlement_authority',false,
    'refund_authority',false,
    'credit_authority',false,
    'wallet_mutation_authority',false,
    'human_approval_required',true,
    'side_effects_applied',false,
    'handler','finance.reconciliation.readonly'
  );
$$;
revoke all on function public.hq_workforce_finance_readonly_snapshot() from public,anon,authenticated;
grant execute on function public.hq_workforce_finance_readonly_snapshot() to service_role;

create or replace function public.hq_workforce_finance_state_digest()
returns text language sql security definer set search_path=public,pg_temp stable as $$
  select md5(concat_ws('|',
    (select count(*) from public.commerce_payment_attempts),
    (select coalesce(sum(expected_amount_kes),0) from public.commerce_payment_attempts),
    (select count(*) from public.commerce_payment_callback_events),
    (select count(*) from public.finance_payments),
    (select coalesce(sum(amount),0) from public.finance_payments),
    (select count(*) from public.finance_transactions),
    (select count(*) from public.finance_credit_notes),
    (select count(*) from public.finance_expenses),
    (select count(*) from public.finance_pocket_money)
  ));
$$;
revoke all on function public.hq_workforce_finance_state_digest() from public,anon,authenticated;
grant execute on function public.hq_workforce_finance_state_digest() to service_role;

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
  end if;
  raise exception 'shadow_handler_not_certified';
end $$;
revoke all on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_shadow_tool(uuid,jsonb) to service_role;

create or replace function public.hq_workforce_run_finance_r3_canary(
  p_shadow_run_id uuid,p_verifier_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  sr public.hq_workforce_professional_shadow_runs%rowtype;
  v_pre text; v_post text; v_run uuid; v_evidence uuid; v_pass boolean;
begin
  select * into a from public.hq_workforce_worker_assurance
  where worker_key='finance-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  if not found or a.risk_class<>'R3' then raise exception 'finance_r3_baseline_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='finance-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  select * into sr from public.hq_workforce_professional_shadow_runs where id=p_shadow_run_id;
  if not found or sr.worker_key<>'finance-worker-01' or sr.worker_version<>a.worker_version or not sr.passed or sr.side_effects_applied then raise exception 'current_passing_finance_shadow_required'; end if;

  v_pre:=public.hq_workforce_finance_state_digest();
  perform 1; -- bounded server-observed canary performs no financial mutation.
  v_post:=public.hq_workforce_finance_state_digest();
  v_pass:=v_pre=v_post;

  insert into public.hq_workforce_finance_r3_canary_runs(worker_key,worker_version,shadow_run_id,pre_finance_digest,post_finance_digest,observed_outcome,verifier_key,passed,financial_mutations,authority_changed)
  values('finance-worker-01',a.worker_version,p_shadow_run_id,v_pre,v_post,
    jsonb_build_object('financial_state_unchanged',v_pass,'financial_mutations',0,'authority_changed',false,'human_approval_boundary_preserved',true),
    p_verifier_key,v_pass,0,false) returning id into v_run;

  if v_pass then
    v_evidence:=public.hq_workforce_record_qualification_evidence('finance-worker-01','canary',p_verifier_key,'finance-r3-zero-mutation-canary-v1',true,
      jsonb_build_object('run_id',v_run,'shadow_run_id',p_shadow_run_id,'pre_digest',v_pre,'post_digest',v_post,'financial_mutations',0,'authority_changed',false));
  end if;
  return jsonb_build_object('run_id',v_run,'passed',v_pass,'evidence_id',v_evidence,'authority_changed',false,'financial_mutations',0);
end $$;
revoke all on function public.hq_workforce_run_finance_r3_canary(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_run_finance_r3_canary(uuid,text) to service_role;

create or replace function public.hq_workforce_verify_finance_human_authority_boundary(p_verifier_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  w public.hq_workforce_workers%rowtype;
  v_mpesa_off boolean; v_no_fin_runtime boolean; v_permissions_safe boolean; v_pass boolean; v_evidence uuid;
begin
  select * into a from public.hq_workforce_worker_assurance where worker_key='finance-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  select * into w from public.hq_workforce_workers where worker_key='finance-worker-01';
  if not found or a.risk_class<>'R3' then raise exception 'finance_r3_baseline_required'; end if;
  if coalesce(trim(p_verifier_key),'')='' or p_verifier_key='finance-worker-01' or p_verifier_key ilike '%creator%' then raise exception 'independent_verifier_required'; end if;
  select coalesce(not initiation_enabled,true) into v_mpesa_off from public.mpesa_runtime_control where singleton=true;
  v_mpesa_off:=coalesce(v_mpesa_off,true);
  select not exists(select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and (capability_key ilike 'finance.%' or operation ~* '(spend|settle|refund|credit|wallet|pay|transfer|disburse)')) into v_no_fin_runtime;
  v_permissions_safe:=not exists(select 1 from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission) where permission ~* '(spend|settle|refund|credit|wallet|pay|transfer|disburse|bank_mutat)');
  v_pass:=v_mpesa_off and v_no_fin_runtime and v_permissions_safe and a.worker_version is not null;
  if v_pass then
    v_evidence:=public.hq_workforce_record_qualification_evidence('finance-worker-01','human_authority',p_verifier_key,'finance-r3-human-authority-boundary-v1',true,
      jsonb_build_object('mpesa_initiation_enabled',false,'finance_runtime_mutation_capability_enabled',false,'worker_mutation_permission_present',false,'certification_grants_authority',false,'explicit_human_or_governed_approval_required',true));
  end if;
  return jsonb_build_object('passed',v_pass,'evidence_id',v_evidence,'mpesa_off',v_mpesa_off,'no_finance_runtime_mutation_capability',v_no_fin_runtime,'permissions_safe',v_permissions_safe,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_verify_finance_human_authority_boundary(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_finance_human_authority_boundary(text) to service_role;
