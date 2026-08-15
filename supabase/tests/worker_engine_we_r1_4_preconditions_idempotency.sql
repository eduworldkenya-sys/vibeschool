-- WE-R1.4.3 transactional preconditions + database-owned idempotency certification.
begin;

-- Execution intents are service-readable evidence, never a direct mutation surface.
do $$
declare r text;
begin
  if to_regclass('public.hq_workforce_execution_intents') is null then raise exception 'execution intents table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_execution_intents'::regclass) then raise exception 'execution intents RLS disabled'; end if;
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_execution_intents','SELECT')
       or has_table_privilege(r,'public.hq_workforce_execution_intents','INSERT')
       or has_table_privilege(r,'public.hq_workforce_execution_intents','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_execution_intents','DELETE') then
      raise exception 'unexpected execution-intent privilege for %',r;
    end if;
  end loop;
  if not has_table_privilege('service_role','public.hq_workforce_execution_intents','SELECT') then raise exception 'service_role execution-intent read missing'; end if;
  if has_table_privilege('service_role','public.hq_workforce_execution_intents','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_intents','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_intents','DELETE') then
    raise exception 'service_role must not directly mutate execution intents';
  end if;
end $$;

-- Database ownership of idempotency requires unique logical dedupe and one intent per task.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='hq_workforce_execution_intents'
      and c.contype='u' and pg_get_constraintdef(c.oid) like '%dedupe_key%'
  ) then raise exception 'execution intent dedupe uniqueness missing'; end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='hq_workforce_execution_intents'
      and c.contype='u' and pg_get_constraintdef(c.oid) like '%task_id%'
  ) then raise exception 'one-intent-per-task uniqueness missing'; end if;
end $$;

-- Product roles cannot invoke reservation/commit controls.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    if has_function_privilege(r,'public.hq_workforce_reserve_execution_intent(uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') then raise exception 'unexpected reserve intent execute for %',r; end if;
    if has_function_privilege(r,'public.hq_workforce_commit_execution_intent(uuid,jsonb)','EXECUTE') then raise exception 'unexpected commit intent execute for %',r; end if;
  end loop;
end $$;

-- Gateway must structurally reserve an intent and enforce a locked target precondition before mutation.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into d;
  if position('hq_workforce_reserve_execution_intent' in d)=0 then raise exception 'gateway idempotency reservation missing'; end if;
  if position('for update' in d)=0 then raise exception 'gateway target lock missing'; end if;
  if position('work_item_precondition_status_changed' in d)=0 then raise exception 'gateway status precondition missing'; end if;
  if position('work_item_precondition_version_changed' in d)=0 then raise exception 'gateway version precondition missing'; end if;
  if position('hq_workforce_commit_execution_intent' in d)=0 then raise exception 'gateway intent commit missing'; end if;
end $$;

-- Missing intent inputs must fail closed without requiring fixtures.
do $$
begin
  begin
    perform public.hq_workforce_reserve_execution_intent(gen_random_uuid(),gen_random_uuid(),'{}'::jsonb,'{}'::jsonb,'{}'::jsonb);
    raise exception 'empty execution intent inputs accepted';
  exception when others then
    if sqlerrm='empty execution intent inputs accepted' then raise; end if;
  end;
end $$;

-- Engineering gate remains non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'R1.4.3 changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'R1.4.3 introduced active capability authority'; end if;
end $$;

rollback;
