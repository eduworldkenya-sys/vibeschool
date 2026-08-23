-- Laban Command Kernel structural/adversarial proof.
begin;

do $$begin
 if not exists(select 1 from pg_proc where proname='hq_workforce_consequential_execution_gateway') then raise exception 'canonical_r14_gateway_missing';end if;
 if pg_get_functiondef('public.hq_workforce_tool_gateway_execute(uuid)'::regprocedure) not like '%hq_workforce_consequential_execution_gateway%' then raise exception 'legacy_gateway_not_bridged_to_r14';end if;
 if pg_get_functiondef('public.hq_workforce_command_assert_delegation(uuid)'::regprocedure) like '%update public.hq_%' then raise exception 'command_delegation_must_not_mutate_business_state';end if;
 if pg_get_functiondef('public.hq_workforce_command_complete_mission(uuid,text,text)'::regprocedure) not like '%commander_cannot_self_certify%' then raise exception 'self_certification_guard_missing';end if;
 if pg_get_functiondef('public.hq_workforce_command_record_challenge(uuid,text,text,text,text,jsonb)'::regprocedure) not like '%state=''reopened''%' then raise exception 'contradiction_reopen_guard_missing';end if;
 if has_function_privilege('authenticated','public.hq_workforce_command_assert_delegation(uuid)','EXECUTE') then raise exception 'authenticated_command_execution_leak';end if;
 if has_function_privilege('anon','public.hq_workforce_command_complete_mission(uuid,text,text)','EXECUTE') then raise exception 'anon_command_certification_leak';end if;
end$$;

-- Permanent negative-space check: command kernel must not issue/certify/activate authority grants.
do $$declare r record;body text;begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'hq_workforce_command_%' loop
  body:=pg_get_functiondef(r.sig);
  if body ~* '(insert|update)[[:space:]]+(into[[:space:]]+)?public\.hq_workforce_capability_authority_grants' then raise exception 'command_kernel_authority_self_grant_surface:%',r.sig;end if;
 end loop;
end$$;

-- Non-activation remains an invariant.
do $$declare ec public.hq_workforce_engine_contract%rowtype;begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'runtime_not_fail_closed';end if;
end$$;

rollback;
