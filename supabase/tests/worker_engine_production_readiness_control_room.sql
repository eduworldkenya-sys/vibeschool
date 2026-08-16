-- Production-readiness adversarial test: Control Room must expose R1.4 evidence without becoming a mutation gateway.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_get_control_room_snapshot(integer)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('control_room_authenticated_owner_required' in d)=0 then raise exception 'control_room_not_owner_bound'; end if;
  if position('evidence_completeness' in d)=0 or position('active_authority_grants' in d)=0
     or position('failed_verifications' in d)=0 or position('compensation_conflicts' in d)=0
     or position('breaker_block_count' in d)=0 then raise exception 'control_room_r1_4_surfaces_incomplete'; end if;
  if has_function_privilege('service_role','public.hq_workforce_get_control_room_snapshot(integer)','EXECUTE') then raise exception 'service_role_can_invoke_owner_control_room'; end if;
  if not has_function_privilege('authenticated','public.hq_workforce_get_control_room_snapshot(integer)','EXECUTE') then raise exception 'owner_control_room_transport_unavailable'; end if;
  if has_function_privilege('authenticated','public.hq_workforce_get_control_room_snapshot_r1_3(integer)','EXECUTE') then raise exception 'legacy_control_room_rpc_still_directly_exposed'; end if;
end $$;

-- Read model must not contain DML against governed business/authority state.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_get_control_room_snapshot(integer)'::regprocedure)) into d;
  if d ~ '\m(insert|update|delete)\M' then raise exception 'control_room_contains_mutation_statement'; end if;
end $$;

rollback;
