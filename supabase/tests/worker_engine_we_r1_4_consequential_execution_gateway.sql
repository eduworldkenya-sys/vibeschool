-- WE-R1.4.2 consequential execution gateway certification contract.
begin;

do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_task_contracts' and column_name='plan_step_id') then raise exception 'plan_step lineage missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_task_contracts' and column_name='capability_version') then raise exception 'capability version lineage missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_task_contracts' and column_name='autonomous_authority_grant_id') then raise exception 'authority lineage missing'; end if;
end $$;

do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'R1.4.2 changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'R1.4.2 introduced active capability authority'; end if;
end $$;

do $$
begin
  if to_regprocedure('public.hq_workforce_assert_consequential_task_authorized(uuid)') is null then raise exception 'consequential authorization function missing'; end if;
  if to_regprocedure('public.hq_workforce_consequential_execution_gateway(uuid)') is null then raise exception 'consequential gateway function missing'; end if;
  if to_regprocedure('public.hq_workforce_tool_gateway_execute(uuid)') is null then raise exception 'canonical tool gateway missing'; end if;
end $$;

-- A nonexistent task cannot reach any consequential side effect.
do $$
declare v_failed boolean:=false;
begin
  begin
    perform public.hq_workforce_consequential_execution_gateway(gen_random_uuid());
  exception when others then
    v_failed:=true;
  end;
  if not v_failed then raise exception 'missing task did not fail closed'; end if;
end $$;

rollback;
