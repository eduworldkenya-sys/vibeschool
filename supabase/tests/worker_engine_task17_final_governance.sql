-- Task 17 final-governance side-door closure regression.
begin;

do $$
declare body text;
begin
  if to_regprocedure('public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)') is null then
    raise exception 'task17 owner breaker reset wrapper missing';
  end if;

  if has_function_privilege('service_role','public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'service_role can reset execution breaker';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_shadow_review_decision(uuid,text,text)','EXECUTE') then
    raise exception 'service_role can resolve raw shadow decision';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)','EXECUTE') then
    raise exception 'service_role can call owner breaker reset';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_review_shadow_decision(uuid,text,text)','EXECUTE') then
    raise exception 'service_role can call owner shadow review';
  end if;

  if not has_function_privilege('authenticated','public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)','EXECUTE') then
    raise exception 'authenticated owner breaker surface missing';
  end if;
  if not has_function_privilege('authenticated','public.hq_workforce_owner_review_shadow_decision(uuid,text,text)','EXECUTE') then
    raise exception 'authenticated owner shadow review surface missing';
  end if;

  select pg_get_functiondef('public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)'::regprocedure) into body;
  if position('hq_assert_owner' in body)=0
     or position('auth.uid()' in body)=0
     or position('hq_workforce_reset_execution_breaker' in body)=0
     or position('worker_authority_granted' in body)=0 then
    raise exception 'owner breaker reset governance binding incomplete';
  end if;

  select pg_get_functiondef('public.hq_workforce_owner_review_shadow_decision(uuid,text,text)'::regprocedure) into body;
  if position('hq_assert_owner' in body)=0
     or position('hq_workforce_shadow_review_decision' in body)=0 then
    raise exception 'owner shadow review governance binding incomplete';
  end if;
end $$;

-- Raw primitives must remain SECURITY DEFINER with an explicit safe search_path;
-- they are callable only by trusted definer/database-owner chains after this gate.
do $$
declare r record; cfg text[];
begin
  for r in
    select p.oid,p.proname,p.prosecdef,p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('hq_workforce_reset_execution_breaker','hq_workforce_shadow_review_decision')
  loop
    if not r.prosecdef then raise exception '% lost SECURITY DEFINER',r.proname; end if;
    cfg:=coalesce(r.proconfig,array[]::text[]);
    if not exists(select 1 from unnest(cfg) x where x like 'search_path=%public%pg_temp%') then
      raise exception '% unsafe search_path',r.proname;
    end if;
  end loop;
end $$;

-- This gate is authority-neutral.
do $$
declare active_count integer;
begin
  select count(*) into active_count
    from public.hq_workforce_capability_authority_grants
   where status='active';
  if active_count<>0 then
    raise exception 'task17 regression fixture unexpectedly contains active authority';
  end if;
end $$;

rollback;
