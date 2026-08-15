-- WE-R1.3X X1 objective semantics: provenance, lifecycle evidence, hierarchy and fail-closed safety.
begin;

-- Objective schema must carry canonical reasoning metadata.
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_objectives' and column_name='provenance') then raise exception 'objective provenance missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_objectives' and column_name='success_criteria') then raise exception 'objective success criteria missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_objectives' and column_name='evidence_requirements') then raise exception 'objective evidence requirements missing'; end if;
  if to_regclass('public.hq_workforce_objective_events') is null then raise exception 'objective event history missing'; end if;
end $$;

-- Direct compatibility insert must be normalized rather than silently provenance-free.
do $$ declare oid uuid; p jsonb; begin
  insert into public.hq_workforce_objectives(objective_key,statement,required_competencies,desired_outcome,constraints,risk_ceiling,autonomy_ceiling,status)
  values('x1-test-'||gen_random_uuid()::text,'Verify provenance-first objective semantics',array['quality.analysis'],jsonb_build_object('verified',true),'{}',0,0,'detected') returning id,provenance into oid,p;
  if p='{}'::jsonb or p->>'mode'<>'compatibility_inferred' then raise exception 'compatibility objective was not provenance marked'; end if;
  if not exists(select 1 from public.hq_workforce_objective_events where objective_id=oid and event_kind='detected') then raise exception 'objective detection event missing'; end if;
end $$;

-- Explicit hierarchy must reject self-parenting and preserve source metadata.
do $$ declare parent_id uuid; child_id uuid; begin
  insert into public.hq_workforce_objectives(objective_key,statement,source_type,source_ref,provenance,required_competencies,desired_outcome,constraints,success_criteria,evidence_requirements,risk_ceiling,autonomy_ceiling,status)
  values('x1-parent-'||gen_random_uuid()::text,'Parent objective','test','parent',jsonb_build_object('suite','x1'),array['quality.analysis'],'{}','{}','[]','[]',0,0,'detected') returning id into parent_id;
  insert into public.hq_workforce_objectives(objective_key,parent_objective_id,statement,source_type,source_ref,provenance,required_competencies,desired_outcome,constraints,risk_ceiling,autonomy_ceiling,status)
  values('x1-child-'||gen_random_uuid()::text,parent_id,'Child objective','test','child',jsonb_build_object('suite','x1'),array['quality.analysis'],'{}','{}',0,0,'detected') returning id into child_id;
  begin
    update public.hq_workforce_objectives set parent_objective_id=child_id where id=child_id;
    raise exception 'self parent accepted';
  exception when check_violation then null; end;
end $$;

-- Status changes must leave append-only evidence.
do $$ declare oid uuid; eid bigint; begin
  insert into public.hq_workforce_objectives(objective_key,statement,source_type,provenance,required_competencies,desired_outcome,constraints,risk_ceiling,autonomy_ceiling,status)
  values('x1-state-'||gen_random_uuid()::text,'Lifecycle audit objective','test',jsonb_build_object('suite','x1'),array['quality.analysis'],'{}','{}',0,0,'detected') returning id into oid;
  update public.hq_workforce_objectives set status='planning',updated_at=clock_timestamp() where id=oid;
  if not exists(select 1 from public.hq_workforce_objective_events where objective_id=oid and from_status='detected' and to_status='planning') then raise exception 'objective transition evidence missing'; end if;
  select id into eid from public.hq_workforce_objective_events where objective_id=oid order by id desc limit 1;
  begin
    update public.hq_workforce_objective_events set reason='tamper' where id=eid;
    raise exception 'objective event mutation accepted';
  exception when others then
    if sqlerrm='objective event mutation accepted' then raise; end if;
  end;
end $$;

-- No consumer may see blank provenance after hardening.
do $$ begin
  if exists(select 1 from public.hq_workforce_objectives where source_type is null or provenance='{}'::jsonb) then raise exception 'provenance-free objective exists'; end if;
end $$;

-- RLS/direct-user isolation remains mandatory.
do $$ declare role_name text; begin
  if not (select relrowsecurity from pg_class where oid='public.hq_workforce_objective_events'::regclass) then raise exception 'objective event RLS disabled'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    if has_table_privilege(role_name,'public.hq_workforce_objective_events','SELECT') or has_table_privilege(role_name,'public.hq_workforce_objective_events','INSERT') then
      raise exception 'objective events exposed to %',role_name;
    end if;
  end loop;
end $$;

-- Runtime safety must remain unchanged.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'X1 altered runtime safety boundary'; end if;
end $$;

rollback;
