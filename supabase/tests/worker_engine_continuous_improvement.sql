begin;

do $$ declare d text;
begin
  foreach d in array array['hq_workforce_improvement_incidents','hq_workforce_regression_cases','hq_workforce_improvement_candidates','hq_workforce_health_events'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=d and c.relrowsecurity) then raise exception 'RLS missing:%',d; end if;
    if has_table_privilege('anon','public.'||d,'SELECT') or has_table_privilege('authenticated','public.'||d,'SELECT') then raise exception 'product role can read:%',d; end if;
  end loop;
  if has_table_privilege('service_role','public.hq_workforce_improvement_incidents','INSERT') then raise exception 'service_role can forge incident evidence'; end if;
  if has_table_privilege('service_role','public.hq_workforce_regression_cases','UPDATE') then raise exception 'service_role can mutate protected regression'; end if;
  if has_table_privilege('service_role','public.hq_workforce_improvement_candidates','UPDATE') then raise exception 'service_role bypasses candidate state machine'; end if;
end $$;

do $$ declare i uuid; r uuid; c uuid; v text;
begin
  i:=public.hq_workforce_record_improvement_incident('contract-fixture-incident','quality-worker-01',null,null,'failed','high','{"approved":true}','{"approved":false}','policy',0.9,'{"skill":"v1"}','{"scope":"fixture"}',array['evidence:fixture']);
  if i<>public.hq_workforce_record_improvement_incident('contract-fixture-incident','quality-worker-01',null,null,'failed','high','{"approved":true}','{"approved":false}','policy',0.9,'{"skill":"v1"}','{"scope":"fixture"}',array['evidence:fixture']) then raise exception 'incident idempotency failed'; end if;
  r:=public.hq_workforce_register_regression_case('contract-negative',1,i,'worker','quality-worker-01',false,'independent-critic','v1','{"input":"bad"}','{"decision":"block"}');
  c:=public.hq_workforce_propose_improvement_candidate('contract-candidate',i,'skill','quality-worker','v1','v2','base','candidate','repair-worker',array[r]);
  begin perform public.hq_workforce_transition_improvement_candidate(c,'candidate','testing','repair-worker',null,'{}',array['e:test'],''); exception when others then raise exception 'valid testing transition failed:%',sqlerrm; end;
  begin perform public.hq_workforce_transition_improvement_candidate(c,'candidate','assurance_pending','repair-worker','repair-worker','{}',array['e:self'],''); raise exception 'self evaluation accepted'; exception when others then if sqlerrm='self evaluation accepted' then raise; end if; end;
  v:=public.hq_workforce_transition_improvement_candidate(c,'candidate','assurance_pending','independent-critic','independent-critic','{"regression_pass_rate":1}',array['e:independent'],null);
  if v<>'assurance_pending' then raise exception 'independent transition failed'; end if;
  begin update public.hq_workforce_improvement_incidents set severity='low' where id=i; raise exception 'append-only mutation accepted'; exception when others then if sqlerrm='append-only mutation accepted' then raise; end if; end;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'continuous improvement changed fail-closed runtime posture'; end if;
end $$;

rollback;
