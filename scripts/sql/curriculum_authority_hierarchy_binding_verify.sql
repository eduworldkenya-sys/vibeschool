\set ON_ERROR_STOP on
begin;

do $$
declare v_rls boolean; v_fn text; v_trigger text;
begin
  select c.relrowsecurity into v_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='curriculum_authority_hierarchy_bindings' and c.relkind='r';
  if v_rls is distinct from true then raise exception 'hierarchy binding contract: table missing/RLS disabled'; end if;
  if has_table_privilege('anon','public.curriculum_authority_hierarchy_bindings','SELECT')
     or has_table_privilege('authenticated','public.curriculum_authority_hierarchy_bindings','SELECT')
     or has_table_privilege('authenticated','public.curriculum_authority_hierarchy_bindings','INSERT') then
    raise exception 'hierarchy binding contract: raw lineage exposed';
  end if;
  if has_function_privilege('anon','public.curriculum_authority_bind_hierarchy(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.curriculum_authority_bind_hierarchy(uuid)','EXECUTE') then
    raise exception 'hierarchy binding contract: owner RPC boundary incorrect';
  end if;

  select pg_get_functiondef('public.curriculum_authority_bind_hierarchy(uuid)'::regprocedure) into v_fn;
  if v_fn not like '%hq_assert_owner%'
     or v_fn not like '%sealed_snapshot_checksum_mismatch%'
     or v_fn not like '%snapshot_reconciliation_incomplete%'
     or v_fn not like '%snapshot_has_unresolved_conflicts%'
     or v_fn not like '%public.cbc_strands%'
     or v_fn like '%insert into public.curriculum(%' then
    raise exception 'hierarchy binding contract: source/hierarchy authority incomplete';
  end if;
  if v_fn not like '%term,week,source_ref%'
     or v_fn not like '%null,null%'
     or v_fn not like '%ambiguous_unpaced_cbc_hierarchy%'
     or v_fn not like '%pacing_authority%false%' then
    raise exception 'hierarchy binding contract: unpaced/fail-closed invariant incomplete';
  end if;
  if v_fn not like '%delete from public.curriculum_authority_reconciliation%'
     or v_fn not like '%status=''sealed''%'
     or v_fn not like '%reconciled_at=null%' then
    raise exception 'hierarchy binding contract: stale reconciliation not invalidated';
  end if;

  select pg_get_triggerdef(t.oid) into v_trigger from pg_trigger t
  where t.tgrelid='public.curriculum_authority_promotions'::regclass
    and t.tgname='curriculum_authority_require_hierarchy_binding_trigger'
    and not t.tgisinternal;
  if v_trigger is null then raise exception 'hierarchy binding contract: promotion enforcement trigger missing'; end if;

  select pg_get_functiondef('public.curriculum_authority_require_hierarchy_binding()'::regprocedure) into v_fn;
  if v_fn not like '%official_promotion_requires_source_bound_hierarchy%'
     or v_fn not like '%snapshot_sha256%'
     or v_fn not like '%artifact_sha256%' then
    raise exception 'hierarchy binding contract: promotion enforcement incomplete';
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.curriculum_authority_hierarchy_bindings) then
    raise exception 'hierarchy binding contract: migration invented authority lineage';
  end if;
end $$;
rollback;
\echo 'Authoritative Curriculum Hierarchy Binding Contract: PASS'
