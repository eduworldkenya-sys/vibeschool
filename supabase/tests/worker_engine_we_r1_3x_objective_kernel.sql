-- WE-R1.3X X1 Objective Kernel regression/adversarial contract tests.
begin;

-- Schema and RLS must exist.
do $$
begin
  if to_regclass('public.hq_workforce_objectives') is null then raise exception 'objectives table missing'; end if;
  if to_regclass('public.hq_workforce_objective_work_items') is null then raise exception 'objective-work bridge missing'; end if;
  if to_regclass('public.hq_workforce_objective_events') is null then raise exception 'objective events missing'; end if;
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_objectives'::regclass) then raise exception 'objectives RLS disabled'; end if;
end $$;

-- Public/authenticated direct privileges must remain absent.
do $$
declare r text;
begin
  foreach r in array array['public','anon','authenticated'] loop
    if has_table_privilege(r,'public.hq_workforce_objectives','SELECT')
       or has_table_privilege(r,'public.hq_workforce_objectives','INSERT')
       or has_table_privilege(r,'public.hq_workforce_objectives','UPDATE')
       or has_table_privilege(r,'public.hq_workforce_objectives','DELETE') then
      raise exception 'unexpected objective privilege for %',r;
    end if;
  end loop;
end $$;

-- Create a valid objective with explicit provenance.
do $$
declare oid uuid;begin
  oid:=public.hq_workforce_create_objective(
    'TEST-X1-'||gen_random_uuid()::text,'test',null,'Prove objective-first planning contract','platform_internal','{}'::jsonb,
    '["no production mutation"]'::jsonb,'["objective reaches review with evidence"]'::jsonb,'["test evidence"]'::jsonb,
    50::smallint,0::smallint,null,jsonb_build_object('suite','worker_engine_we_r1_3x_objective_kernel'),null
  );
  if oid is null then raise exception 'objective create returned null'; end if;
  if (select status from public.hq_workforce_objectives where id=oid)<>'detected' then raise exception 'objective initial status wrong'; end if;
  if (select count(*) from public.hq_workforce_objective_events where objective_id=oid and event_kind='detected')<>1 then raise exception 'objective detection evidence missing'; end if;
end $$;

-- Missing provenance must fail closed.
do $$
begin
  begin
    perform public.hq_workforce_create_objective('TEST-NOPROV-'||gen_random_uuid()::text,'test',null,'Must reject missing provenance','platform_internal','{}','[]','[]','[]',50::smallint,0::smallint,null,'{}',null);
    raise exception 'missing provenance was accepted';
  exception when others then
    if sqlerrm='missing provenance was accepted' then raise; end if;
  end;
end $$;

-- Invalid lifecycle skip must fail. R1.4 deliberately removed human approval from
-- the generic transition RPC; the owner-review gateway owns approval now. Keep this
-- inherited X1 test focused on lifecycle/achievement semantics without impersonating
-- an owner identity. R1.4 suites separately prove the authenticated owner gateway and
-- immutable selected-plan binding.
do $$
declare oid uuid;begin
  oid:=public.hq_workforce_create_objective('TEST-STATE-'||gen_random_uuid()::text,'test',null,'Prove lifecycle guards','platform_internal','{}','[]','[]','[]',50::smallint,0::smallint,null,'{"suite":"x1"}',null);
  begin
    perform public.hq_workforce_transition_objective(oid,'approved','illegal skip','system',null,'[]');
    raise exception 'illegal transition accepted';
  exception when others then if sqlerrm='illegal transition accepted' then raise; end if; end;
  perform public.hq_workforce_transition_objective(oid,'planning','planning begins','system',null,'[]');
  perform public.hq_workforce_transition_objective(oid,'shadow_ready','shadow plan ready','system',null,'[]');
  perform public.hq_workforce_transition_objective(oid,'awaiting_review','human review required','system',null,'[]');

  begin
    perform public.hq_workforce_transition_objective(oid,'approved','generic transition must not impersonate owner','human','test-owner','["test:review"]');
    raise exception 'generic owner approval accepted';
  exception when others then
    if sqlerrm='generic owner approval accepted' then raise; end if;
    if sqlerrm<>'objective_review_requires_owner_identity' then raise; end if;
  end;

  -- White-box fixture only: put this transaction-local objective into the historical
  -- X1 approved state so the inherited achievement-evidence guard remains exercised.
  -- This is not an approval path and rolls back at the end of the suite.
  update public.hq_workforce_objectives
     set status='approved',updated_at=clock_timestamp()
   where id=oid;

  begin
    perform public.hq_workforce_transition_objective(oid,'achieved','cannot claim success without evidence','system',null,'[]');
    raise exception 'evidence-free achievement accepted';
  exception when others then if sqlerrm='evidence-free achievement accepted' then raise; end if; end;
  perform public.hq_workforce_transition_objective(oid,'achieved','verified test outcome','system',null,'["test:verified"]');
end $$;

-- Append-only history must reject mutation.
do $$
declare eid bigint;begin
  select id into eid from public.hq_workforce_objective_events order by id desc limit 1;
  begin
    update public.hq_workforce_objective_events set reason='tamper attempt' where id=eid;
    raise exception 'objective history mutation accepted';
  exception when others then if sqlerrm='objective history mutation accepted' then raise; end if; end;
end $$;

-- Runtime safety flags must still be OFF after X1.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'X1 changed runtime safety boundary';
  end if;
end $$;

rollback;
