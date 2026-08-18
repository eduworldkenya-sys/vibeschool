\set ON_ERROR_STOP on

begin;

do $$
declare
  v_rls boolean;
  v_def text;
begin
  foreach v_def in array array[
    'curriculum_authority_sources',
    'curriculum_authority_artifacts',
    'curriculum_authority_snapshots',
    'curriculum_authority_observations',
    'curriculum_authority_reconciliation',
    'curriculum_authority_promotions'
  ]
  loop
    select c.relrowsecurity into v_rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=v_def and c.relkind='r';
    if v_rls is distinct from true then
      raise exception 'curriculum authority contract: % missing or RLS disabled',v_def;
    end if;
    if has_table_privilege('anon','public.'||v_def,'SELECT')
       or has_table_privilege('authenticated','public.'||v_def,'SELECT')
       or has_table_privilege('authenticated','public.'||v_def,'INSERT') then
      raise exception 'curriculum authority contract: raw table % exposed to browser roles',v_def;
    end if;
  end loop;

  if not has_function_privilege(
      'authenticated',
      'public.curriculum_authority_register_source(text,text,text,uuid,text,text,date,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.curriculum_authority_register_source(text,text,text,uuid,text,text,date,jsonb)',
      'EXECUTE'
    ) then
    raise exception 'curriculum authority contract: source approval boundary incorrect';
  end if;

  if not has_function_privilege('authenticated','public.curriculum_authority_promote_snapshot(uuid)','EXECUTE')
     or has_function_privilege('anon','public.curriculum_authority_promote_snapshot(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.curriculum_authority_get_snapshot_review(uuid)','EXECUTE')
     or has_function_privilege('anon','public.curriculum_authority_get_snapshot_review(uuid)','EXECUTE') then
    raise exception 'curriculum authority contract: HQ owner RPC boundary incorrect';
  end if;

  if has_function_privilege('authenticated','public.curriculum_authority_register_artifact(uuid,text,text,date,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.curriculum_authority_create_snapshot(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.curriculum_authority_seal_snapshot(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.curriculum_authority_reconcile_snapshot(uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.curriculum_authority_reconcile_snapshot(uuid)','EXECUTE') then
    raise exception 'curriculum authority contract: service staging boundary incorrect';
  end if;

  select pg_get_functiondef('public.curriculum_authority_reconcile_snapshot(uuid)'::regprocedure)
  into v_def;
  if v_def not like '%public.cbc_strands%'
     or v_def like '%insert into public.curriculum(%'
     or v_def not like '%missing_hierarchy%'
     or v_def not like '%official_conflict%'
     or v_def not like '%scope_mismatch%'
     or v_def not like '%creator_claimed_replacement_candidate%'
     or v_def not like '%cs.term is null and cs.week is null%' then
    raise exception 'curriculum authority contract: deterministic hierarchy reconciliation incomplete';
  end if;

  if v_def ilike '%levenshtein%'
     or v_def ilike '%similarity(%'
     or v_def ilike '%limit 1%cbc_strands%' then
    raise exception 'curriculum authority contract: fuzzy/row-order hierarchy authority detected';
  end if;

  select pg_get_functiondef('public.curriculum_authority_promote_snapshot(uuid)'::regprocedure)
  into v_def;
  if v_def not like '%hq_assert_owner%'
     or v_def not like '%sealed_snapshot_checksum_mismatch%'
     or v_def not like '%snapshot_reconciliation_incomplete%'
     or v_def not like '%snapshot_has_unresolved_conflicts%'
     or v_def not like '%snapshot_requires_hierarchy_resolution%'
     or v_def not like '%hierarchy_changed_since_reconciliation%'
     or v_def not like '%official_outcome_conflict_at_promotion%' then
    raise exception 'curriculum authority contract: promotion fail-closed gates incomplete';
  end if;

  if v_def not like '%source_type%'
     or v_def not like '%''official''%'
     or v_def not like '%sub_strand_id%'
     or v_def like '%update public.curriculum_learning_outcomes%creator_claimed%'
     or v_def like '%delete from public.curriculum_learning_outcomes%' then
    raise exception 'curriculum authority contract: official promotion/history preservation incomplete';
  end if;

  if v_def like '%insert into public.curriculum(%'
     or v_def like '%update public.curriculum %'
     or v_def like '%term=%'
     or v_def like '%week=%' then
    raise exception 'curriculum authority contract: school pacing authority leaked into source promotion';
  end if;

  select pg_get_functiondef('public.curriculum_authority_register_source(text,text,text,uuid,text,text,date,jsonb)'::regprocedure)
  into v_def;
  if v_def not like '%hq_assert_owner%'
     or v_def not like '%school_id is not null%'
     or v_def not like '%canonical_global_subject_required%' then
    raise exception 'curriculum authority contract: canonical subject/source approval incomplete';
  end if;
end $$;

do $$
begin
  if exists(select 1 from public.curriculum_authority_sources)
     or exists(select 1 from public.curriculum_authority_artifacts)
     or exists(select 1 from public.curriculum_authority_snapshots)
     or exists(select 1 from public.curriculum_authority_observations)
     or exists(select 1 from public.curriculum_authority_reconciliation)
     or exists(select 1 from public.curriculum_authority_promotions) then
    raise exception 'curriculum authority contract: migration invented authority evidence or claims';
  end if;
end $$;

rollback;

\echo 'Authoritative Curriculum Source Pipeline Contract: PASS'
