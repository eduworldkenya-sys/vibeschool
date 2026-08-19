-- VIBESCHOOL TASK 15: HQ Workforce Control Room security/safety regression.
begin;

-- Required control-plane objects exist and the audit table is protected by RLS.
do $$
begin
  if to_regclass('public.hq_workforce_owner_control_events') is null then raise exception 'task15 control audit table missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_owner_control_events'::regclass) then raise exception 'task15 control audit RLS disabled'; end if;
  if to_regprocedure('public.hq_workforce_owner_control_snapshot(integer)') is null then raise exception 'task15 snapshot missing'; end if;
  if to_regprocedure('public.hq_workforce_owner_start_controlled_operations(timestamptz,smallint,smallint,text)') is null then raise exception 'task15 start missing'; end if;
  if to_regprocedure('public.hq_workforce_owner_stop_operations(timestamptz,text)') is null then raise exception 'task15 stop missing'; end if;
  if to_regprocedure('public.hq_workforce_owner_set_global_stop(boolean,text)') is null then raise exception 'task15 global stop missing'; end if;
  if to_regprocedure('public.hq_workforce_owner_configure_global_envelope(timestamptz,boolean,smallint,smallint,integer,integer,text)') is null then raise exception 'task15 envelope control missing'; end if;
  if to_regprocedure('public.hq_workforce_owner_control_authority(uuid,text,text)') is null then raise exception 'task15 authority control missing'; end if;
  if to_regprocedure('public.hq_workforce_owner_reset_breaker(uuid,text)') is null then raise exception 'task15 breaker recovery missing'; end if;
end $$;

-- Browser/product roles and service transport cannot mutate the owner audit relation directly.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated','service_role'] loop
    if has_table_privilege(r,'public.hq_workforce_owner_control_events','INSERT')
       or has_table_privilege(r,'public.hq_workforce_owner_control_events','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_owner_control_events','DELETE') then
      raise exception 'unexpected owner control audit mutation privilege for %',r;
    end if;
  end loop;
  if has_table_privilege('authenticated','public.hq_workforce_owner_control_events','SELECT') then
    raise exception 'authenticated direct owner control audit read must be denied';
  end if;
  if not has_table_privilege('service_role','public.hq_workforce_owner_control_events','SELECT') then
    raise exception 'service transport audit read missing';
  end if;
end $$;

-- Consequential owner controls are never callable by anon/public/service_role. Authenticated
-- can reach the function boundary, but every function must assert canonical owner identity.
do $$
declare sig text; r text;
begin
  foreach sig in array array[
    'public.hq_workforce_owner_start_controlled_operations(timestamptz,smallint,smallint,text)',
    'public.hq_workforce_owner_stop_operations(timestamptz,text)',
    'public.hq_workforce_owner_set_global_stop(boolean,text)',
    'public.hq_workforce_owner_configure_global_envelope(timestamptz,boolean,smallint,smallint,integer,integer,text)',
    'public.hq_workforce_owner_control_authority(uuid,text,text)',
    'public.hq_workforce_owner_reset_breaker(uuid,text)'
  ] loop
    foreach r in array array['public','anon','service_role'] loop
      if has_function_privilege(r,sig,'EXECUTE') then raise exception 'unexpected execute privilege % on %',r,sig; end if;
    end loop;
    if not has_function_privilege('authenticated',sig,'EXECUTE') then raise exception 'authenticated owner gateway execute missing on %',sig; end if;
  end loop;
end $$;

-- Every Task 15 public owner RPC must be SECURITY DEFINER and have a fixed search_path.
do $$
declare p record;
begin
  for p in
    select pr.oid,pr.proname,pr.prosecdef,coalesce(array_to_string(pr.proconfig,','),'') cfg
    from pg_proc pr join pg_namespace n on n.oid=pr.pronamespace
    where n.nspname='public' and pr.proname in (
      'hq_workforce_owner_control_snapshot','hq_workforce_owner_start_controlled_operations',
      'hq_workforce_owner_stop_operations','hq_workforce_owner_set_global_stop',
      'hq_workforce_owner_configure_global_envelope','hq_workforce_owner_control_authority',
      'hq_workforce_owner_reset_breaker'
    )
  loop
    if not p.prosecdef then raise exception '% must be SECURITY DEFINER',p.proname; end if;
    if p.cfg not like '%search_path=public, pg_temp%' and p.cfg not like '%search_path=public,pg_temp%' then
      raise exception '% fixed search_path missing: %',p.proname,p.cfg;
    end if;
    if position('hq_assert_owner' in pg_get_functiondef(p.oid))=0 then raise exception '% canonical owner assertion missing',p.proname; end if;
  end loop;
end $$;

-- Task 15 held/disposable certification lane must remain fail closed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'task15 engine contract missing'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'task15 certification lane unexpectedly active';
  end if;
end $$;

-- Structural security semantics that must survive refactors.
do $$
declare d text;
begin
  d:=pg_get_functiondef('public.hq_workforce_owner_start_controlled_operations(timestamptz,smallint,smallint,text)'::regprocedure);
  if position('control_room_stale_runtime_state' in d)=0 then raise exception 'start stale-state defense missing'; end if;
  if position('control_room_global_stop_active' in d)=0 then raise exception 'start Global Stop defense missing'; end if;

  d:=pg_get_functiondef('public.hq_workforce_owner_configure_global_envelope(timestamptz,boolean,smallint,smallint,integer,integer,text)'::regprocedure);
  if position('control_room_policy_change_requires_runtime_off' in d)=0 then raise exception 'policy runtime-off guard missing'; end if;

  d:=pg_get_functiondef('public.hq_workforce_owner_stop_operations(timestamptz,text)'::regprocedure);
  if position('hq_workforce_owner_transition_capability_authority' in d)=0 or position('status=''active''' in d)=0 or position('authority_suspended' in d)=0 then
    raise exception 'normal Stop must neutralize active authority even from OFF state';
  end if;

  d:=pg_get_functiondef('public.hq_workforce_owner_set_global_stop(boolean,text)'::regprocedure);
  if position('hq_workforce_trip_execution_breaker' in d)=0 then raise exception 'Global Stop execution breaker missing'; end if;
  if position('authority_reactivated' in d)=0 then raise exception 'Global Stop release non-reactivation evidence missing'; end if;
  if position('reason_code=''owner_global_stop''' in d)=0 then raise exception 'Global Stop release may reset unrelated global breakers'; end if;
  if position('owner_global_stop_breakers_reset' in d)=0 then raise exception 'owner Global Stop breaker recovery evidence missing'; end if;

  d:=pg_get_functiondef('public.hq_workforce_owner_control_authority(uuid,text,text)'::regprocedure);
  if position('control_room_authority_activation_global_stop_active' in d)=0 then raise exception 'direct authority activation can bypass Global Stop'; end if;

  d:=pg_get_functiondef('public.hq_workforce_owner_reset_breaker(uuid,text)'::regprocedure);
  if position('control_room_breaker_reset_requires_runtime_off' in d)=0 then raise exception 'breaker reset runtime-off guard missing'; end if;
  if position('control_room_global_breaker_release_via_global_stop_only' in d)=0 then raise exception 'global breaker recovery bypass exists'; end if;
end $$;

rollback;
