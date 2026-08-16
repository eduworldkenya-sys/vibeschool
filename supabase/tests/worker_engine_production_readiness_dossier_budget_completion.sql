-- Production-readiness adversarial test: dossier must expose budget evidence and classify early breaker denial correctly.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_get_execution_dossier(uuid)'::regprocedure)) into d;
  if position('budget_events' in d)=0 then raise exception 'dossier_budget_evidence_missing'; end if;
  if position('telemetry_generation' in d)=0 or position('r1_4_consequential' in d)=0 then raise exception 'dossier_generation_classification_missing'; end if;
  if position('early_breaker_denial' in d)=0 or position('pre_reservation' in d)=0 then raise exception 'early_breaker_completeness_semantics_missing'; end if;
  if position('execution_intent' in d)=0 then raise exception 'early_breaker_intent_exception_not_explicit'; end if;
end $$;

do $$
begin
  if has_function_privilege('service_role','public.hq_workforce_get_execution_dossier(uuid)','EXECUTE') then raise exception 'service_role_can_execute_owner_dossier'; end if;
  if not has_function_privilege('authenticated','public.hq_workforce_get_execution_dossier(uuid)','EXECUTE') then raise exception 'owner_dossier_transport_missing'; end if;
  if has_function_privilege('authenticated','public.hq_workforce_get_execution_dossier_base(uuid)','EXECUTE') then raise exception 'base_dossier_directly_exposed'; end if;
end $$;

rollback;
