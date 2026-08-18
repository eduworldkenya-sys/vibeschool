-- Content Factory R2.3 Source-Grounded Authoring adversarial contract.
-- Run after the full migration chain in a disposable/local Supabase.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_def text;
  v_count integer;
  v_rls boolean;
  v_runtime boolean;
  v_autonomy smallint;
  v_risk smallint;
begin
  if to_regclass('public.curriculum_authoring_drafts') is null then
    raise exception 'authoring draft ledger missing';
  end if;
  select relrowsecurity into v_rls from pg_class where oid='public.curriculum_authoring_drafts'::regclass;
  if not coalesce(v_rls,false) then raise exception 'authoring draft ledger RLS disabled'; end if;

  if has_table_privilege('anon','public.curriculum_authoring_drafts','SELECT')
     or has_table_privilege('authenticated','public.curriculum_authoring_drafts','SELECT')
     or has_table_privilege('service_role','public.curriculum_authoring_drafts','UPDATE')
     or has_table_privilege('service_role','public.curriculum_authoring_drafts','DELETE')
     or not has_table_privilege('service_role','public.curriculum_authoring_drafts','SELECT')
     or not has_table_privilege('service_role','public.curriculum_authoring_drafts','INSERT') then
    raise exception 'authoring draft privilege boundary incorrect';
  end if;

  select count(*) into v_count from pg_trigger
   where not tgisinternal and tgrelid='public.curriculum_authoring_drafts'::regclass
     and tgname='curriculum_authoring_draft_immutable_trigger';
  if v_count<>1 then raise exception 'authoring draft immutability trigger missing'; end if;

  select count(*) into v_count from public.hq_workforce_tool_contracts
   where tool_key='content.authoring.source_grounded' and version=1
     and handler_key='content.authoring.source_grounded'
     and required_capability_key='content.authoring.source_grounded'
     and operation='draft_content'
     and resource_type='curriculum_intelligence_proposal'
     and status='approved';
  if v_count<>1 then raise exception 'source-grounded authoring tool contract missing'; end if;

  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid='public.hq_workforce_tool_contracts'::regclass
     and conname='hq_workforce_tool_contracts_handler_key_check';
  if v_def is null
     or v_def not ilike '%work_item.triage_and_own%'
     or v_def not ilike '%work_item.prioritize%'
     or v_def not ilike '%content.research.external%'
     or v_def not ilike '%content.evidence.semantic_verify%'
     or v_def not ilike '%content.authoring.source_grounded%' then
    raise exception 'R2.3 narrowed certified Worker Engine handler vocabulary';
  end if;

  if has_function_privilege('anon','public.hq_content_authoring_claim(uuid,uuid,text,bigint)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_content_authoring_claim(uuid,uuid,text,bigint)','EXECUTE')
     or not has_function_privilege('service_role','public.hq_content_authoring_claim(uuid,uuid,text,bigint)','EXECUTE')
     or has_function_privilege('anon','public.hq_content_authoring_complete(uuid,uuid,uuid,text,text,jsonb,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_content_authoring_complete(uuid,uuid,uuid,text,text,jsonb,jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.hq_content_authoring_complete(uuid,uuid,uuid,text,text,jsonb,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.hq_content_authoring_fail(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_content_authoring_fail(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.hq_content_authoring_fail(uuid,uuid,text)','EXECUTE') then
    raise exception 'authoring machine RPC privilege boundary incorrect';
  end if;
  if has_function_privilege('anon','public.hq_accept_content_authoring_draft(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hq_accept_content_authoring_draft(uuid)','EXECUTE') then
    raise exception 'authoring human acceptance privilege boundary incorrect';
  end if;

  select pg_get_functiondef('public.hq_content_authoring_evidence_packet(uuid)'::regprocedure) into v_def;
  -- pg_get_functiondef preserves the stored PL/pgSQL body rather than normalizing operator
  -- whitespace, so certify the evidence_ready predicate after whitespace normalization.
  if regexp_replace(lower(v_def),'[[:space:]]+','','g') not like '%status=''evidence_ready''%'
     or v_def not ilike '%certified_semantic_verifier_v1%'
     or v_def not ilike '%curriculum_semantic_verdicts%'
     or v_def not ilike '%curriculum_semantic_materials%'
     or v_def not ilike '%authoring_unverified_source_present%'
     or v_def not ilike '%authoring_contradiction_present%'
     or v_def not ilike '%authoring_semantic_source_minimum_not_met%' then
    raise exception 'authoring evidence packet does not fail closed on R2.2 material-bound evidence';
  end if;

  select pg_get_functiondef('public.hq_content_authoring_claim(uuid,uuid,text,bigint)'::regprocedure) into v_def;
  if v_def not ilike '%verification_status<>''verified''%'
     or v_def not ilike '%hq_content_authoring_evidence_packet%'
     or v_def not ilike '%evidence_packet_sha256%'
     or v_def not ilike '%current_content_sha256%'
     or v_def not ilike '%hq_workforce_assert_consequential_task_authorized%'
     or v_def not ilike '%hq_workforce_authorize_model_call%'
     or v_def not ilike '%''unstructured_synthesis''%'
     or v_def not ilike '%worker_runtime_global_stop%' then
    raise exception 'authoring claim lacks evidence/target hash or Worker Engine authority binding';
  end if;

  select pg_get_functiondef('public.hq_content_authoring_complete(uuid,uuid,uuid,text,text,jsonb,jsonb)'::regprocedure) into v_def;
  if v_def not ilike '%authoring_evidence_or_target_changed_since_authorization%'
     or v_def not ilike '%authoring_citation_source_minimum_not_met%'
     or v_def not ilike '%authoring_citation_not_in_authorized_excerpt%'
     or v_def not ilike '%authoring_citation_not_in_bound_material%'
     or v_def not ilike '%curriculum_authoring_drafts%'
     or v_def not ilike '%hq_workforce_finalize_model_call%'
     or v_def not ilike '%editorial_status=''needs_review''%'
     or v_def ilike '%editorial_status=''prepared''%' then
    raise exception 'authoring completion can bypass immutable draft/human review boundary';
  end if;

  select pg_get_functiondef('public.hq_accept_content_authoring_draft(uuid)'::regprocedure) into v_def;
  if v_def not ilike '%is_platform_owner%'
     or v_def not ilike '%authoring_acceptance_target_stale%'
     or v_def not ilike '%editorial_status=''prepared''%'
     or v_def not ilike '%prepared_from%source_grounded_authoring_v1%'
     or v_def not ilike '%authoring_draft_accepted%'
     or v_def ilike '%status=''approved''%'
     or v_def ilike '%status=''applied''%' then
    raise exception 'human authoring acceptance bypasses editorial approval/apply separation';
  end if;

  select pg_get_functiondef('public.hq_apply_curriculum_intelligence_proposal(uuid)'::regprocedure) into v_def;
  if v_def not ilike '%p.status <> ''approved''%'
     or v_def not ilike '%p.editorial_status <> ''prepared''%' then
    raise exception 'existing editorial apply boundary no longer requires approved+prepared';
  end if;

  select pg_get_functiondef('public.hq_content_authoring_fail(uuid,uuid,text)'::regprocedure) into v_def;
  if v_def not ilike '%hq_workforce_finalize_model_call%'
     or v_def not ilike '%dead_letter%'
     or v_def not ilike '%CONTENT_AUTHORING_FAILED%' then
    raise exception 'authoring failure path lacks reservation release/dead-letter closure';
  end if;

  select runtime_execution_enabled,runtime_autonomy_level,runtime_max_risk
    into v_runtime,v_autonomy,v_risk
    from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(v_runtime,false) or coalesce(v_autonomy,0)<>0 or coalesce(v_risk,0)<>0 then
    raise exception 'R2.3 activated Worker Engine runtime/autonomy/risk';
  end if;
  select count(*) into v_count from public.hq_workforce_capability_authority_grants where status='active';
  if v_count<>0 then raise exception 'R2.3 activated capability authority'; end if;
end $$;

rollback;
