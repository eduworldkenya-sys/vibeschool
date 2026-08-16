-- Production-readiness adversarial test: service-role labels cannot become compensation authority identity.
begin;

do $$
declare d text;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_compensations' and column_name='transport_request_label') then raise exception 'compensation_transport_label_missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_compensations' and column_name='recovery_principal') then raise exception 'compensation_recovery_principal_missing'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_bind_compensation_actor()'::regprocedure)) into d;
  if position('worker-engine-recovery' in d)=0 then raise exception 'recovery_principal_not_derived'; end if;
  if position('caller_label_is_authority' in d)=0 or position('false' in d)=0 then raise exception 'transport_label_authority_boundary_missing'; end if;
  if not exists(select 1 from pg_trigger where tgname='trg_hq_workforce_bind_compensation_actor' and not tgisinternal) then raise exception 'compensation_actor_trigger_missing'; end if;
end $$;

rollback;
