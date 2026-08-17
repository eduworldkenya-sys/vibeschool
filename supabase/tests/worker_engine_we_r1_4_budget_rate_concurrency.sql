-- WE-R1.4.7 budget/rate/concurrency/runtime certification contract.
begin;

do $$
begin
  if to_regclass('public.hq_workforce_capability_execution_usage') is null then raise exception 'capability execution usage table missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_capability_authority_grants' and column_name='max_runtime_ms') then raise exception 'capability runtime ceiling missing'; end if;
  if to_regprocedure('public.hq_workforce_reserve_capability_execution(uuid,integer)') is null then raise exception 'capability execution reservation missing'; end if;
  if to_regprocedure('public.hq_workforce_reserve_capability_limit_token(uuid,uuid,uuid,uuid,text,integer,text,text,integer,integer)') is null then raise exception 'bounded token reservation missing'; end if;
end $$;

do $$
declare r text;
begin
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_capability_execution_usage'::regclass) then raise exception 'capability usage RLS disabled'; end if;
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_capability_execution_usage','SELECT') or has_table_privilege(r,'public.hq_workforce_capability_execution_usage','INSERT') or has_table_privilege(r,'public.hq_workforce_capability_execution_usage','UPDATE') or has_table_privilege(r,'public.hq_workforce_capability_execution_usage','DELETE') then raise exception 'unexpected usage privilege for %',r; end if;
  end loop;
  if not has_table_privilege('service_role','public.hq_workforce_capability_execution_usage','SELECT') then raise exception 'service_role usage read missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_capability_execution_usage','INSERT') or has_table_privilege('service_role','public.hq_workforce_capability_execution_usage','UPDATE') or has_table_privilege('service_role','public.hq_workforce_capability_execution_usage','DELETE') then raise exception 'service_role usage must be read-only'; end if;
  if has_function_privilege('service_role','public.hq_workforce_reserve_capability_limit_token(uuid,uuid,uuid,uuid,text,integer,text,text,integer,integer)','EXECUTE') then raise exception 'internal token allocator exposed to service_role'; end if;
end $$;

do $$ declare failed boolean:=false; begin
  begin perform public.hq_workforce_reserve_capability_execution(gen_random_uuid(),1); exception when others then failed:=true; end;
  if not failed then raise exception 'missing task passed capability limiter'; end if;
end $$;

do $$ declare failed boolean:=false; begin
  begin perform public.hq_workforce_reserve_capability_execution(gen_random_uuid(),0); exception when others then failed:=true; if position('capability_record_count_invalid' in sqlerrm)=0 then raise; end if; end;
  if not failed then raise exception 'zero record cardinality accepted'; end if;
end $$;

do $$ declare def text; begin
  select pg_get_constraintdef(c.oid) into def from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='hq_workforce_capability_authority_grants' and c.contype='c' and pg_get_constraintdef(c.oid) like '%max_runtime_ms%' limit 1;
  if def is null or def not like '%50%' or def not like '%600000%' then raise exception 'runtime ceiling bounds missing'; end if;
end $$;

do $$ begin
  if not exists(select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='hq_workforce_capability_execution_usage' and c.contype='u' and pg_get_constraintdef(c.oid) like '%authority_grant_id%limit_kind%window_key%token_ordinal%') then raise exception 'bounded window token uniqueness missing'; end if;
  if not exists(select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='hq_workforce_capability_execution_usage' and c.contype='u' and pg_get_constraintdef(c.oid) like '%task_id%limit_kind%') then raise exception 'task replay accounting uniqueness missing'; end if;
end $$;

-- Canonical gateway may be wrapped by later hardening migrations. Certify that the
-- reachable R1.4 gateway chain still contains the limiter and both runtime guards,
-- rather than requiring those implementation details to remain in the outer wrapper.
do $$
declare
  body text;
  chain text := '';
  r record;
begin
  select pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure) into body;
  chain := chain || E'\n' || body;
  for r in
    select p.oid::regprocedure as proc
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname like 'hq_workforce_consequential_execution_gateway_r14_%'
       and pg_get_function_identity_arguments(p.oid)='p_task_id uuid'
  loop
    chain := chain || E'\n' || pg_get_functiondef(r.proc);
  end loop;
  if position('hq_workforce_reserve_capability_execution' in chain)=0 then raise exception 'gateway chain does not enforce capability limits'; end if;
  if position('capability_runtime_ceiling_exceeded_before_mutation' in chain)=0 then raise exception 'gateway chain lacks pre-mutation runtime guard'; end if;
  if position('capability_runtime_ceiling_exceeded' in chain)=0 then raise exception 'gateway chain lacks post-mutation runtime rollback guard'; end if;
  select pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure) into body;
  if position('hq_workforce_consequential_execution_gateway' in body)=0 then raise exception 'legacy gateway bypass restored'; end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; active_count integer; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'R1.4.7 changed runtime safety boundary'; end if;
  select count(*) into active_count from public.hq_workforce_capability_authority_grants where status='active';
  if active_count<>0 then raise exception 'R1.4.7 introduced active authority'; end if;
end $$;

rollback;