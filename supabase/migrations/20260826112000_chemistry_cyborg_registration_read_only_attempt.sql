begin;

-- P0: hq_cyborg_register_capability is SECURITY INVOKER and is executed by
-- service_role. Chemistry stage attempts are intentionally SELECT-only for that
-- role. A SELECT ... FOR UPDATE therefore demanded UPDATE table privilege and
-- caused Cyborg admission to fail after the dedicated lease assertion had
-- already succeeded. Capability registration never mutates the stage attempt;
-- replay protection lives in hq_cyborg_source_authorizations.
do $$
declare
  v_definition text;
  v_old text := E'where id=p_source_authority_ref::uuid\n      for update;';
  v_new text := E'where id=p_source_authority_ref::uuid;';
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='hq_cyborg_register_capability'
    and pg_get_function_identity_arguments(p.oid)='p_nonce uuid, p_invocation_id uuid, p_mission_id uuid, p_chat_session_id uuid, p_mission_revision text, p_caller_service_id text, p_provider text, p_model text, p_operation text, p_request_hash text, p_source_authority_kind text, p_source_authority_ref text, p_source_authority_token text, p_risk_class text, p_authority_scope jsonb, p_tool_scope jsonb, p_data_classification text, p_policy_version text, p_max_tokens integer, p_token_hash text, p_issued_at timestamp with time zone, p_not_before timestamp with time zone, p_expires_at timestamp with time zone';

  if v_definition is null then raise exception 'CHEMISTRY_CYBORG_REGISTER_CAPABILITY_FUNCTION_MISSING'; end if;
  if position(v_old in v_definition)>0 then
    execute replace(v_definition,v_old,v_new);
  elsif position(v_new in v_definition)=0 then
    raise exception 'CHEMISTRY_CYBORG_REGISTER_CAPABILITY_LOCK_CONTRACT_DRIFT';
  end if;
end $$;

-- Least privilege is the invariant: registration may read the lease but may not
-- mutate a Chemistry attempt.
revoke insert,update,delete,truncate,references,trigger
  on public.chemistry_worker_stage_attempts from service_role;
grant select on public.chemistry_worker_stage_attempts to service_role;

commit;
