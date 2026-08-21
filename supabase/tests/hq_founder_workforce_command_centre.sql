begin;

do $$ declare payload jsonb; worker jsonb; ec public.hq_workforce_engine_contract%rowtype;
begin
  if has_function_privilege('anon','public.hq_workforce_get_live_readiness_map()','EXECUTE') then raise exception 'anonymous command-centre access'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'command centre activated runtime'; end if;

  -- hq_assert_owner is deliberately retained as the first runtime authorization gate.
  if position('hq_assert_owner' in pg_get_functiondef('public.hq_workforce_get_live_readiness_map()'::regprocedure))=0 then raise exception 'owner gate missing'; end if;
  if position('capability_authority_grants' in pg_get_functiondef('public.hq_workforce_get_live_readiness_map()'::regprocedure))=0 then raise exception 'authority truth missing'; end if;
  if position('founder_assignments' in pg_get_functiondef('public.hq_workforce_get_live_readiness_map()'::regprocedure))=0 then raise exception 'operational truth missing'; end if;
end $$;

rollback;
