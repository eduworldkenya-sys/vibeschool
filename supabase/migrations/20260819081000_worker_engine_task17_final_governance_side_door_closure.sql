-- VIBESCHOOL TASK 17: final Worker Engine governance hardening.
-- NON-ACTIVATING / HOLD-GATE SAFE.
--
-- Invariant: infrastructure possession (service_role) is not authority to clear a
-- safety breaker or to resolve an owner review. These are owner-control-plane
-- actions. Raw primitives remain available only to database-owner/SECURITY
-- DEFINER call chains; worker/service callers cannot invoke them directly.

-- P0 closure 1: a worker/service path must never be able to reset a breaker.
revoke all on function public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.hq_workforce_owner_reset_execution_breaker(
  p_breaker_id uuid,
  p_reason text,
  p_evidence jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then
    raise exception 'execution_breaker_reset_requires_authenticated_owner';
  end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'execution_breaker_reset_reason_required';
  end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'object' then
    raise exception 'execution_breaker_evidence_invalid';
  end if;

  return public.hq_workforce_reset_execution_breaker(
    p_breaker_id,
    'owner:'||v_uid::text,
    btrim(p_reason),
    p_evidence||jsonb_build_object(
      'owner_id',v_uid,
      'governance_action','breaker_reset',
      'worker_authority_granted',false
    )
  );
end $$;

revoke all on function public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)
  from public, anon, service_role;
grant execute on function public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)
  to authenticated;

-- P0 closure 2: the low-level shadow decision transition cannot be called by a
-- worker/service path. The existing owner wrapper remains the only application
-- entrypoint and invokes this primitive under its SECURITY DEFINER identity.
revoke all on function public.hq_workforce_shadow_review_decision(uuid,text,text)
  from public, anon, authenticated, service_role;

-- Reassert the owner application surface explicitly in case earlier grants drift.
revoke all on function public.hq_workforce_owner_review_shadow_decision(uuid,text,text)
  from public, anon, service_role;
grant execute on function public.hq_workforce_owner_review_shadow_decision(uuid,text,text)
  to authenticated;

comment on function public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb) is
  'Task 17 internal breaker-reset primitive. Not executable by service_role/application roles; use owner-gated hq_workforce_owner_reset_execution_breaker.';
comment on function public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb) is
  'Task 17 owner-only circuit-breaker recovery control. Reset is subtractive and never grants Worker Engine authority.';
comment on function public.hq_workforce_shadow_review_decision(uuid,text,text) is
  'Task 17 internal shadow-decision transition primitive. Not worker/service callable; owner review must use the owner-gated wrapper.';

-- Hold-gate invariant: this migration must not activate or widen runtime/authority.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'task17_engine_contract_missing'; end if;

  -- Never mutate runtime state here. The assertion intentionally accepts either
  -- currently-safe production posture or a disposable test posture; it only
  -- proves this migration did not itself require activation.
  if has_function_privilege('service_role','public.hq_workforce_reset_execution_breaker(uuid,text,text,jsonb)','EXECUTE') then
    raise exception 'task17_worker_breaker_reset_side_door_open';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_shadow_review_decision(uuid,text,text)','EXECUTE') then
    raise exception 'task17_worker_shadow_review_side_door_open';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_owner_reset_execution_breaker(uuid,text,jsonb)','EXECUTE') then
    raise exception 'task17_owner_breaker_reset_exposed_to_service_role';
  end if;
end $$;
