-- Autopilot production commissioning: breaker reset authority closure.
-- NON-ACTIVATING. Tripping remains service-transport callable because it only subtracts
-- authority. Resetting removes a prohibition and is therefore Founder/owner governed.

create or replace function public.hq_workforce_owner_reset_execution_breaker(
  p_breaker_id uuid,
  p_reason_code text,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_uid uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'execution_breaker_reset_requires_authenticated_owner'; end if;
  if char_length(btrim(coalesce(p_reason_code,''))) not between 3 and 240 then
    raise exception 'execution_breaker_reset_reason_required';
  end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'object' then
    raise exception 'execution_breaker_evidence_invalid';
  end if;
  return public.hq_workforce_reset_execution_breaker(
    p_breaker_id,
    'owner:'||v_uid::text,
    btrim(p_reason_code),
    p_evidence||jsonb_build_object('owner_id',v_uid,'authority','founder_breaker_reset')
  );
end $$;

-- The legacy primitive becomes internal-only. No transport/user role may remove a stop.
revoke all on function public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)
  to authenticated;

do $$
declare d text; ec public.hq_workforce_engine_contract%rowtype;
begin
  if has_function_privilege('service_role','public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'breaker_reset_legacy_transport_exposed';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)','EXECUTE') then
    raise exception 'breaker_reset_owner_rpc_transport_exposed';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('auth.uid()' in d)=0 then
    raise exception 'breaker_reset_owner_binding_missing';
  end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'breaker_reset_hardening_changed_runtime_posture';
  end if;
end $$;
