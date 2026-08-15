-- WE-R1.4.5 exact-state compensation hardening certification.
begin;

do $$
declare d text;
begin
  if to_regprocedure('public.hq_workforce_capture_execution_authoritative_after_state()') is null then
    raise exception 'authoritative after-state capture function missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.hq_work_items'::regclass
      and tgname='trg_hq_workforce_capture_execution_authoritative_after_state'
      and not tgisinternal
  ) then raise exception 'authoritative after-state trigger missing'; end if;

  select lower(pg_get_functiondef('public.hq_workforce_capture_execution_authoritative_after_state()'::regprocedure)) into d;
  if position($q$status='reserved'$q$ in d)=0 then raise exception 'after-state capture is not reservation-scoped'; end if;
  if position($q$resource_identity->>'work_item_id'=new.id::text$q$ in d)=0 then raise exception 'after-state capture resource binding missing'; end if;
  if position($q$'action_taken'$q$ in d)=0 or position($q$'acted_at'$q$ in d)=0 or position($q$'updated_at'$q$ in d)=0 then
    raise exception 'exact authoritative after-state fields missing';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_compensate_consequential_execution(uuid,text,text)'::regprocedure)) into d;
  if position('compensation_authoritative_after_state_incomplete' in d)=0 then raise exception 'incomplete after-state fail-closed gate missing'; end if;
  if position('compensation_authority_lineage_mismatch' in d)=0 then raise exception 'compensation authority lineage revalidation missing'; end if;
  if position($q$'action_taken'$q$ in d)=0 or position($q$'acted_at'$q$ in d)=0 or position($q$'updated_at'$q$ in d)=0 then
    raise exception 'compensation exact current-state comparison fields missing';
  end if;
  if position('aba_safe' in d)=0 then raise exception 'ABA-safe divergence evidence missing'; end if;
  if position('exact_state_match' in d)=0 then raise exception 'exact-state success evidence missing'; end if;
  if position($q$status='committed'$q$ in d)=0 then raise exception 'double-compensation transition guard missing'; end if;
end $$;

-- Trigger helper is never an alternate mutation gateway.
do $$
begin
  if has_function_privilege('public','public.hq_workforce_capture_execution_authoritative_after_state()','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_capture_execution_authoritative_after_state()','EXECUTE')
     or has_function_privilege('authenticated','public.hq_workforce_capture_execution_authoritative_after_state()','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_capture_execution_authoritative_after_state()','EXECUTE') then
    raise exception 'after-state trigger helper is directly executable';
  end if;
  if has_function_privilege('public','public.hq_workforce_compensate_consequential_execution(uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','public.hq_workforce_compensate_consequential_execution(uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.hq_workforce_compensate_consequential_execution(uuid,text,text)','EXECUTE') then
    raise exception 'compensation exposed to product roles';
  end if;
  if not has_function_privilege('service_role','public.hq_workforce_compensate_consequential_execution(uuid,text,text)','EXECUTE') then
    raise exception 'governed compensation execution grant missing';
  end if;
end $$;

-- Engineering state remains fail closed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'engine contract missing'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'exact-state hardening changed runtime safety boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'exact-state hardening introduced active authority'; end if;
end $$;

rollback;
