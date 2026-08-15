-- WE-R1.4.1 capability-scoped authority regression/adversarial tests.
begin;

-- Schema and RLS must exist.
do $$
begin
  if to_regclass('public.hq_workforce_capability_authority_grants') is null then
    raise exception 'capability authority grants table missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_capability_authority_grants'::regclass) then
    raise exception 'capability authority grants RLS disabled';
  end if;
end $$;

-- Product roles must have zero direct access. service_role must be read-only so authority cannot be self-issued through table DML.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_capability_authority_grants','SELECT')
       or has_table_privilege(r,'public.hq_workforce_capability_authority_grants','INSERT')
       or has_table_privilege(r,'public.hq_workforce_capability_authority_grants','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_capability_authority_grants','DELETE') then
      raise exception 'unexpected capability authority privilege for %',r;
    end if;
  end loop;
  if not has_table_privilege('service_role','public.hq_workforce_capability_authority_grants','SELECT') then
    raise exception 'service_role capability authority read missing';
  end if;
  if has_table_privilege('service_role','public.hq_workforce_capability_authority_grants','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_capability_authority_grants','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_capability_authority_grants','DELETE') then
    raise exception 'service_role must not directly mutate capability authority';
  end if;
end $$;

-- Only the draft issuer is callable by service_role; ordinary product roles cannot call authority functions.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    if has_function_privilege(r,'public.hq_workforce_issue_capability_authority_draft(text,text,integer,uuid,uuid,text,text,text,text,jsonb,smallint,smallint,integer,integer,integer,integer,boolean,boolean,boolean,text,jsonb,jsonb,timestamptz)','EXECUTE') then
      raise exception 'unexpected draft authority issuer execute for %',r;
    end if;
    if has_function_privilege(r,'public.hq_workforce_resolve_active_capability_authority(text,text,integer,uuid,uuid,text,text,text,jsonb,smallint,smallint)','EXECUTE') then
      raise exception 'unexpected authority resolver execute for %',r;
    end if;
  end loop;
  if not has_function_privilege('service_role','public.hq_workforce_issue_capability_authority_draft(text,text,integer,uuid,uuid,text,text,text,text,jsonb,smallint,smallint,integer,integer,integer,integer,boolean,boolean,boolean,text,jsonb,jsonb,timestamptz)','EXECUTE') then
    raise exception 'service_role draft authority issuer missing';
  end if;
end $$;

-- R1.4.1 is structurally non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'R1.4.1 changed runtime safety boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'R1.4.1 introduced active autonomous authority'; end if;
end $$;

-- Resolver must fail closed when no active exact capability-version envelope exists.
do $$
begin
  begin
    perform public.hq_workforce_resolve_active_capability_authority(
      'nonexistent-worker','internal.work_queue.prioritize',1,gen_random_uuid(),gen_random_uuid(),
      'prioritize','worker_engine_internal_queue','platform_internal','{}'::jsonb,1::smallint,1::smallint
    );
    raise exception 'missing autonomous authority was accepted';
  exception when others then
    if sqlerrm='missing autonomous authority was accepted' then raise; end if;
  end;
end $$;

-- Active authority requires certification, activation time and governance evidence at the row contract itself.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='hq_workforce_capability_authority_grants'
      and c.contype='c' and pg_get_constraintdef(c.oid) like '%status%active%governance_evidence%'
  ) then
    raise exception 'active capability authority governance check missing';
  end if;
end $$;

rollback;
