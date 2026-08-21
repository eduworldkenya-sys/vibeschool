begin;

do $$ declare d text;
begin
  foreach d in array array['hq_workforce_mission_checkpoints','hq_workforce_dependency_findings','hq_workforce_dependency_impacts','hq_workforce_dependency_revalidations'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=d and c.relrowsecurity) then raise exception 'RLS missing:%',d; end if;
    if has_table_privilege('anon','public.'||d,'SELECT') or has_table_privilege('authenticated','public.'||d,'SELECT') then raise exception 'product role can read:%',d; end if;
    if has_table_privilege('service_role','public.'||d,'INSERT') or has_table_privilege('service_role','public.'||d,'UPDATE') then raise exception 'service role bypasses dependency state machine:%',d; end if;
  end loop;
end $$;

do $$ declare x jsonb; f uuid; impact uuid;
begin
  x:=public.hq_workforce_record_dependency_interruption(
    'fixture-checkpoint','priority-2','P2','candidate-sha',
    '["gate-a"]','[]','{"action":"resume"}','["dependency certified"]','{}',array['e:checkpoint'],'executor',
    'fixture-finding',null,'mission','priority-2','component','priority-1','blocking_dependency',0.95,
    '{"cause":"contract"}','{"consumers":["priority-2"]}','{"runtime":"off"}',array['e:finding'],'investigator');
  f:=(x->>'finding_id')::uuid;
  impact:=public.hq_workforce_record_dependency_impact(f,'certificate','priority-1','CERTIFIED','at_risk',array['certification'], '["fresh assurance"]');
  if impact is null then raise exception 'dependency impact not recorded'; end if;
  if public.hq_workforce_record_dependency_revalidation(impact,'repair-sha','[{"gate":"fresh-assurance","passed":true}]',array['e:revalidation'],'independent-assurance',true) is null then raise exception 'dependency revalidation not recorded'; end if;
  begin
    perform public.hq_workforce_record_dependency_impact(f,'certificate','bad-impact','CERTIFIED','at_risk','{}','[]');
    raise exception 'at-risk impact accepted without revalidation';
  exception when others then if sqlerrm='at-risk impact accepted without revalidation' then raise; end if; end;
  begin update public.hq_workforce_mission_checkpoints set state='resumed' where id=(x->>'checkpoint_id')::uuid; raise exception 'checkpoint mutation accepted';
  exception when others then if sqlerrm='checkpoint mutation accepted' then raise; end if; end;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'dependency integrity changed fail-closed runtime posture'; end if;
end $$;

rollback;
