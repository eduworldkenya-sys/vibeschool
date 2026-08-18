-- Content Factory R2.2 Semantic Verifier adversarial contract.
-- Run after the full migration chain in a disposable/local Supabase.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_def text;
  v_count int;
  v_runtime boolean;
  v_paused boolean;
  v_autonomy smallint;
  v_risk smallint;
  v_rls boolean;
begin
  -- Immutable source material and verdict ledgers must exist and be RLS protected.
  if to_regclass('public.curriculum_semantic_materials') is null then
    raise exception 'semantic material ledger missing';
  end if;
  if to_regclass('public.curriculum_semantic_verdicts') is null then
    raise exception 'semantic verdict ledger missing';
  end if;

  select relrowsecurity into v_rls from pg_class where oid='public.curriculum_semantic_materials'::regclass;
  if not coalesce(v_rls,false) then raise exception 'semantic material ledger RLS disabled'; end if;
  select relrowsecurity into v_rls from pg_class where oid='public.curriculum_semantic_verdicts'::regclass;
  if not coalesce(v_rls,false) then raise exception 'semantic verdict ledger RLS disabled'; end if;

  if has_table_privilege('anon','public.curriculum_semantic_materials','SELECT')
     or has_table_privilege('authenticated','public.curriculum_semantic_materials','SELECT')
     or has_table_privilege('anon','public.curriculum_semantic_verdicts','SELECT')
     or has_table_privilege('authenticated','public.curriculum_semantic_verdicts','SELECT') then
    raise exception 'semantic evidence ledger exposed to browser roles';
  end if;
  if not has_table_privilege('service_role','public.curriculum_semantic_materials','SELECT')
     or not has_table_privilege('service_role','public.curriculum_semantic_materials','INSERT')
     or has_table_privilege('service_role','public.curriculum_semantic_materials','UPDATE')
     or has_table_privilege('service_role','public.curriculum_semantic_materials','DELETE')
     or not has_table_privilege('service_role','public.curriculum_semantic_verdicts','SELECT')
     or not has_table_privilege('service_role','public.curriculum_semantic_verdicts','INSERT')
     or has_table_privilege('service_role','public.curriculum_semantic_verdicts','UPDATE')
     or has_table_privilege('service_role','public.curriculum_semantic_verdicts','DELETE') then
    raise exception 'semantic evidence ledger service privilege boundary incorrect';
  end if;

  -- Immutability triggers must be installed on both evidence ledgers.
  select count(*) into v_count
    from pg_trigger t
   where not t.tgisinternal
     and t.tgrelid in ('public.curriculum_semantic_materials'::regclass,'public.curriculum_semantic_verdicts'::regclass)
     and t.tgname in ('curriculum_semantic_material_immutable_trigger','curriculum_semantic_verdict_immutable_trigger');
  if v_count<>2 then raise exception 'semantic evidence immutability triggers missing'; end if;

  -- The verifier must extend, never narrow, the already-certified Worker Engine handlers.
  select count(*) into v_count
    from public.hq_workforce_tool_contracts
   where tool_key='content.evidence.semantic_verify'
     and version=1
     and handler_key='content.evidence.semantic_verify'
     and required_capability_key='content.evidence.semantic_verify'
     and operation='verify_semantics'
     and resource_type='curriculum_intelligence_source'
     and status='approved';
  if v_count<>1 then raise exception 'semantic verifier tool contract missing'; end if;

  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid='public.hq_workforce_tool_contracts'::regclass
     and conname='hq_workforce_tool_contracts_handler_key_check';
  if v_def is null
     or v_def not ilike '%work_item.triage_and_own%'
     or v_def not ilike '%work_item.prioritize%'
     or v_def not ilike '%content.research.external%'
     or v_def not ilike '%content.evidence.semantic_verify%' then
    raise exception 'semantic verifier narrowed certified Worker Engine handler vocabulary';
  end if;

  -- Only the material-bound RPC overloads may be executable by service_role.
  if has_function_privilege('anon','public.hq_content_semantic_verifier_claim(uuid,uuid,text,text,text,bigint)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_content_semantic_verifier_claim(uuid,uuid,text,text,text,bigint)','EXECUTE')
     or not has_function_privilege('service_role','public.hq_content_semantic_verifier_claim(uuid,uuid,text,text,text,bigint)','EXECUTE')
     or has_function_privilege('anon','public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,uuid,text,numeric,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,uuid,text,numeric,text,text,jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,uuid,text,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'material-bound semantic verifier RPC privilege boundary incorrect';
  end if;
  if has_function_privilege('service_role','public.hq_content_semantic_verifier_claim(uuid,uuid,text,bigint)','EXECUTE')
     or has_function_privilege('service_role','public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,text,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'legacy snippet-bound semantic verifier overload remains callable';
  end if;

  -- Claim must hash the retrieved material inside PostgreSQL before model authorization and
  -- bind task, source, material and claim hashes into Worker Engine deterministic evidence.
  select pg_get_functiondef('public.hq_content_semantic_verifier_claim(uuid,uuid,text,text,text,bigint)'::regprocedure) into v_def;
  if v_def not ilike '%digest(convert_to(p_material_text%'
     or v_def not ilike '%curriculum_semantic_materials%'
     or v_def not ilike '%hq_workforce_assert_consequential_task_authorized%'
     or v_def not ilike '%hq_workforce_authorize_model_call%'
     or v_def not ilike '%material_sha256%'
     or v_def not ilike '%claim_sha256%'
     or v_def not ilike '%worker_runtime_global_stop%' then
    raise exception 'semantic verifier claim lacks material hash / Worker Engine authority binding';
  end if;

  -- Completion must reject model hallucinated quotations and cross-material/cross-task replay.
  select pg_get_functiondef('public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,uuid,text,numeric,text,text,jsonb)'::regprocedure) into v_def;
  if v_def not ilike '%semantic_verifier_material_binding_mismatch%'
     or v_def not ilike '%semantic_verifier_model_material_evidence_mismatch%'
     or v_def not ilike '%semantic_verifier_excerpt_not_grounded_in_material%'
     or v_def not ilike '%position(v_excerpt_norm in v_material_norm)=0%'
     or v_def not ilike '%hq_workforce_finalize_model_call%'
     or v_def not ilike '%verification_method=''certified_semantic_verifier_v1''%' then
    raise exception 'semantic verifier completion lacks material grounding/replay protection';
  end if;

  -- Failure must release the model reservation and follow Worker Engine retry/dead-letter semantics.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='hq_content_semantic_verifier_fail' limit 1;
  if v_def is null
     or v_def not ilike '%hq_workforce_finalize_model_call%'
     or v_def not ilike '%dead_letter%'
     or v_def not ilike '%CONTENT_SEMANTIC_VERIFY_FAILED%' then
    raise exception 'semantic verifier failure path lacks reservation release/dead-letter closure';
  end if;

  -- R2.1 evidence gate must recognize this verifier but no unknown/no-method source may self-certify.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='finalize_research_job' limit 1;
  if v_def is null
     or v_def not ilike '%certified_semantic_verifier_v1%'
     or v_def not ilike '%verification_method is null%' then
    raise exception 'research finalizer does not preserve semantic verification provenance boundary';
  end if;

  -- Installation must remain fail-closed and must not activate any capability authority.
  select runtime_execution_enabled,runtime_anomaly_paused,runtime_autonomy_level,runtime_max_risk
    into v_runtime,v_paused,v_autonomy,v_risk
    from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(v_runtime,false) or coalesce(v_autonomy,0)<>0 or coalesce(v_risk,0)<>0 then
    raise exception 'R2.2 semantic verifier activated Worker Engine runtime/autonomy/risk';
  end if;
  select count(*) into v_count from public.hq_workforce_capability_authority_grants where status='active';
  if v_count<>0 then raise exception 'R2.2 semantic verifier activated capability authority'; end if;
end $$;

rollback;
