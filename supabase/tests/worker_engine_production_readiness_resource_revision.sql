-- Production-readiness adversarial test: monotonic consequential resource revision / ABA closure.
begin;

-- hq_work_items must expose a DB-owned monotonic revision.
do $$
declare d text;
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hq_work_items' and column_name='resource_revision'
      and data_type='bigint' and is_nullable='NO'
  ) then raise exception 'resource_revision_missing_or_nullable'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_bump_work_item_revision()'::regprocedure)) into d;
  if position('old.resource_revision + 1' in d)=0 then raise exception 'revision_not_monotonic'; end if;
  if not exists(
    select 1 from pg_trigger tg
    join pg_class c on c.oid=tg.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='hq_work_items'
      and tg.tgname='trg_hq_workforce_bump_work_item_revision' and not tg.tgisinternal
  ) then raise exception 'revision_trigger_missing'; end if;
end $$;

-- Canary execution must bind to resource_revision and perform revision CAS.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_consequential_execution_gateway(uuid)'::regprocedure)) into d;
  if position('resource_revision' in d)=0 then raise exception 'gateway_revision_binding_missing'; end if;
  if position('work_item_precondition_revision_changed' in d)=0 then raise exception 'gateway_revision_stale_check_missing'; end if;
  if position('resource_revision=v_expected_revision' in replace(d,' ',''))=0 then raise exception 'gateway_revision_cas_missing'; end if;
  if position('resource_revision'',wi.resource_revision+1' in d)=0 then raise exception 'gateway_expected_revision_snapshot_missing'; end if;
end $$;

-- Verification must prove the exact post-mutation revision.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_verify_consequential_execution(uuid,text)'::regprocedure)) into d;
  if position('resource_revision' in d)=0 then raise exception 'verification_revision_evidence_missing'; end if;
  if position('jsonb_object_length(i.expected_after_state)<>2' in replace(d,' ',''))=0 then raise exception 'verification_expected_state_not_revision_bound'; end if;
end $$;

-- Compensation must compare-and-restore against revision and keep revisions monotonic.
do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_compensate_consequential_execution(uuid,text,text)'::regprocedure)) into d;
  if position('current_priority_or_revision_diverged' in d)=0 then raise exception 'compensation_revision_collision_evidence_missing'; end if;
  if position('priority_canary_compensation_revision_compare_and_set_failed' in d)=0 then raise exception 'compensation_revision_cas_missing'; end if;
  if position('''aba_safe'',true' in d)=0 then raise exception 'compensation_aba_contract_missing'; end if;
end $$;

-- Prove A->B->A cannot recreate an old revision even if the value returns to the same state.
do $$
declare wid uuid; r0 bigint; r1 bigint; r2 bigint;
begin
  insert into public.hq_work_items(title,description,source_type,work_type,department_key,priority,status)
  values('ABA revision test','rollback-scoped','manual','internal_test','operations','normal','open')
  returning id,resource_revision into wid,r0;

  update public.hq_work_items set priority='high' where id=wid;
  select resource_revision into r1 from public.hq_work_items where id=wid;
  update public.hq_work_items set priority='normal' where id=wid;
  select resource_revision into r2 from public.hq_work_items where id=wid;

  if r1<>r0+1 or r2<>r1+1 then raise exception 'resource_revision_not_monotonic: %,%,%',r0,r1,r2; end if;
  if r2=r0 then raise exception 'aba_revision_recreated'; end if;
end $$;

-- Engineering remains non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'revision test changed runtime boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'revision test activated authority'; end if;
end $$;

rollback;
