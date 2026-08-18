-- Content Factory R2.1 Research Worker contract.
-- Run after all migrations in a disposable/local Supabase.
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
begin
  -- Domain queue is bridged, not replaced.
  select count(*) into v_count
    from information_schema.columns
   where table_schema='public' and table_name='curriculum_research_jobs'
     and column_name in ('workforce_task_id','workforce_budget_reservation_id','executor_version','execution_metadata');
  if v_count<>4 then raise exception 'research job Worker Engine bridge columns missing'; end if;

  select count(*) into v_count
    from public.hq_workforce_tool_contracts
   where tool_key='content.research.external'
     and version=1
     and handler_key='content.research.external'
     and required_capability_key='content.research.execute'
     and operation='research'
     and resource_type='curriculum_research_job'
     and status='approved';
  if v_count<>1 then raise exception 'governed content research tool contract missing'; end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='hq_content_research_claim' limit 1;
  if v_def is null then raise exception 'hq_content_research_claim missing'; end if;
  if v_def not ilike '%hq_workforce_assert_consequential_task_authorized%'
     or v_def not ilike '%hq_workforce_reserve_budget%'
     or v_def not ilike '%worker_runtime_global_stop%' then
    raise exception 'research claim bypasses Worker Engine authority/budget/runtime stop';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='hq_content_research_fail' limit 1;
  if v_def is null
     or v_def not ilike '%hq_workforce_release_budget%'
     or v_def not ilike '%hq_workforce_dead_letters%'
     or v_def not ilike '%needs_human%' then
    raise exception 'research failure path lacks budget release/dead-letter/human escalation';
  end if;

  -- Most important adversarial invariant: old supports_claim=true rows are NOT trusted unless
  -- a recognized semantic verifier is named. Search discovery alone cannot certify a claim.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='finalize_research_job' limit 1;
  if v_def is null then raise exception 'finalize_research_job missing'; end if;
  if v_def not ilike '%manual_verified%'
     or v_def not ilike '%certified_semantic_verifier_v1%'
     or v_def not ilike '%verification_method is null%'
     or v_def not ilike '%supporting_n<j.required_source_count%' then
    raise exception 'research evidence trust boundary is not fail-closed';
  end if;

  -- Service-only executor/finalizer surface.
  if exists(
    select 1 from information_schema.routine_privileges rp
     where rp.specific_schema='public'
       and rp.routine_name in ('hq_content_research_claim','hq_content_research_complete','hq_content_research_fail','finalize_research_job')
       and rp.grantee in ('anon','authenticated')
       and rp.privilege_type='EXECUTE'
  ) then raise exception 'content research execution RPC exposed to product clients'; end if;

  -- Installation must remain non-activating.
  select runtime_execution_enabled,runtime_anomaly_paused,runtime_autonomy_level,runtime_max_risk
    into v_runtime,v_paused,v_autonomy,v_risk
    from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(v_runtime,false) or coalesce(v_autonomy,0)<>0 or coalesce(v_risk,0)<>0 then
    raise exception 'R2 research migration activated Worker Engine runtime';
  end if;
  select count(*) into v_count from public.hq_workforce_capability_authority_grants where status='active';
  if v_count<>0 then raise exception 'R2 research migration activated capability authority'; end if;
end $$;

rollback;
