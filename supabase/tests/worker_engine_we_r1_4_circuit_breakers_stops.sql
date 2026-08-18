-- WE-R1.4.8 circuit-breaker / stop certification contract.
begin;

do $$
begin
  if to_regclass('public.hq_workforce_execution_breakers') is null then raise exception 'execution breakers table missing'; end if;
  if to_regclass('public.hq_workforce_execution_breaker_events') is null then raise exception 'execution breaker events table missing'; end if;
  if to_regprocedure('public.hq_workforce_trip_execution_breaker(text,text,text,text,jsonb)') is null then raise exception 'breaker trip API missing'; end if;
  if to_regprocedure('public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)') is null then raise exception 'breaker reset API missing'; end if;
  if to_regprocedure('public.hq_workforce_assert_execution_not_stopped(uuid,text)') is null then raise exception 'breaker assertion missing'; end if;
end $$;

-- Breaker state/evidence are not a direct authority or mutation surface.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_execution_breakers','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_breakers','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_breakers','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_breakers','DELETE') then raise exception 'unexpected breaker privilege for %',r; end if;
    if has_table_privilege(r,'public.hq_workforce_execution_breaker_events','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_breaker_events','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_breaker_events','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_breaker_events','DELETE') then raise exception 'unexpected breaker event privilege for %',r; end if;
  end loop;
  if not has_table_privilege('service_role','public.hq_workforce_execution_breakers','SELECT') then raise exception 'service_role breaker read missing'; end if;
  if not has_table_privilege('service_role','public.hq_workforce_execution_breaker_events','SELECT') then raise exception 'service_role breaker event read missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_breakers','INSERT') or has_table_privilege('service_role','public.hq_workforce_execution_breakers','UPDATE') or has_table_privilege('service_role','public.hq_workforce_execution_breakers','DELETE') then raise exception 'service_role breaker table must be read-only'; end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_breaker_events','INSERT') or has_table_privilege('service_role','public.hq_workforce_execution_breaker_events','UPDATE') or has_table_privilege('service_role','public.hq_workforce_execution_breaker_events','DELETE') then raise exception 'service_role breaker event table must be read-only'; end if;
  if has_function_privilege('service_role','public.hq_workforce_assert_execution_not_stopped(uuid,text)','EXECUTE') then raise exception 'internal breaker assertion exposed'; end if;
end $$;

-- Trip/reset transition semantics: reset is subtractive and cannot mutate authority.
do $$
declare bid uuid; before_active integer; after_active integer; ec_before public.hq_workforce_engine_contract%rowtype; ec_after public.hq_workforce_engine_contract%rowtype;
begin
  select count(*) into before_active from public.hq_workforce_capability_authority_grants where status='active';
  select * into ec_before from public.hq_workforce_engine_contract where singleton=true;
  bid:=public.hq_workforce_trip_execution_breaker('global','ignored','cert_test_trip','we-r1.4.8-test','{}'::jsonb);
  if not exists(select 1 from public.hq_workforce_execution_breakers where id=bid and status='tripped' and scope_type='global' and scope_ref='global') then raise exception 'global breaker did not trip'; end if;
  perform public.hq_workforce_reset_execution_breaker(bid,'we-r1.4.8-test','cert_test_reset','{}'::jsonb);
  if not exists(select 1 from public.hq_workforce_execution_breakers where id=bid and status='reset') then raise exception 'breaker did not reset'; end if;
  select count(*) into after_active from public.hq_workforce_capability_authority_grants where status='active';
  select * into ec_after from public.hq_workforce_engine_contract where singleton=true;
  if before_active<>after_active then raise exception 'breaker reset changed active authority'; end if;
  if row_to_json(ec_before)::jsonb is distinct from row_to_json(ec_after)::jsonb then raise exception 'breaker reset changed engine contract'; end if;
end $$;

-- Event history cannot be rewritten.
do $$
declare bid uuid; failed boolean:=false;
begin
  bid:=public.hq_workforce_trip_execution_breaker('capability','cert.test@1','immutable_test','we-r1.4.8-test','{}'::jsonb);
  begin update public.hq_workforce_execution_breaker_events set reason_code='rewritten' where breaker_id=bid;
  exception when others then failed:=position('execution_breaker_event_immutable' in sqlerrm)>0; end;
  if not failed then raise exception 'breaker event mutation accepted'; end if;
end $$;

-- The canonical gateway is intentionally wrapped by later R1.4 controls. Certify the
-- complete private gateway chain rather than assuming all controls remain in the outer body.
do $$
declare body text; chain_body text; p_replay integer; p_stop integer; p_budget integer; p_limits integer; p_stop2 integer; p_mut integer;
begin
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure) into body;
  if position('hq_workforce_consequential_execution_gateway_r14_approval_bound' in body)=0 then raise exception 'canonical gateway does not enter approval-bound private chain'; end if;

  select string_agg(pg_get_functiondef(p.oid), E'\n---gateway-chain---\n' order by p.proname)
    into chain_body
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.pronargs=1
     and p.proargtypes[0]='uuid'::regtype
     and (p.proname='hq_workforce_consequential_execution_gateway' or p.proname like 'hq_workforce_consequential_execution_gateway_r14%');

  if chain_body is null then raise exception 'gateway chain missing'; end if;
  p_replay:=position('idempotent_replay' in chain_body);
  p_stop:=position('pre_reservation' in chain_body);
  p_budget:=position('hq_workforce_reserve_budget' in chain_body);
  p_limits:=position('hq_workforce_reserve_capability_execution' in chain_body);
  p_stop2:=position('pre_mutation' in chain_body);
  p_mut:=position('update public.hq_work_items' in chain_body);
  if least(p_replay,p_stop,p_budget,p_limits,p_stop2,p_mut)=0 then raise exception 'gateway breaker integration incomplete'; end if;
  if position('hq_workforce_assert_execution_not_stopped' in chain_body)=0 then raise exception 'gateway chain does not enforce breaker assertion'; end if;
  select pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure) into body;
  if position('hq_workforce_consequential_execution_gateway' in body)=0 then raise exception 'alternate legacy gateway bypass restored'; end if;
end $$;

-- A tripped breaker fails closed for any task before it can become a resource consumer.
do $$
declare failed boolean:=false; bid uuid;
begin
  bid:=public.hq_workforce_trip_execution_breaker('global','global','cert_fail_closed','we-r1.4.8-test','{}'::jsonb);
  begin perform public.hq_workforce_assert_execution_not_stopped(gen_random_uuid(),'pre_reservation');
  exception when others then failed:=true; end;
  if not failed then raise exception 'breaker assertion accepted missing lineage'; end if;
  perform public.hq_workforce_reset_execution_breaker(bid,'we-r1.4.8-test','cert_cleanup','{}'::jsonb);
end $$;

-- Gate remains non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; active_count integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'R1.4.8 changed runtime safety boundary'; end if;
  select count(*) into active_count from public.hq_workforce_capability_authority_grants where status='active';
  if active_count<>0 then raise exception 'R1.4.8 introduced active authority'; end if;
end $$;

rollback;
