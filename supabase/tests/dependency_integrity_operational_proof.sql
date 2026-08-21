begin;

do $$ declare d text;
begin
  foreach d in array array['hq_workforce_mission_checkpoint_events','content_convergence_evaluation_identities'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=d and c.relrowsecurity) then raise exception 'RLS missing:%',d; end if;
    if has_table_privilege('anon','public.'||d,'SELECT') or has_table_privilege('authenticated','public.'||d,'SELECT') then raise exception 'product role can read:%',d; end if;
    if has_table_privilege('service_role','public.'||d,'INSERT') or has_table_privilege('service_role','public.'||d,'UPDATE') then raise exception 'service role bypasses governed write:%',d; end if;
  end loop;
  if has_function_privilege('service_role','public.content_convergence_record_evaluation(uuid,uuid,text,text,text,text,numeric,jsonb,jsonb,text,text,text)','EXECUTE') then raise exception 'legacy ungoverned evaluation rpc remains executable'; end if;
end $$;

do $$ declare i uuid; neg uuid; pos uuid; candidate uuid; unrelated_i uuid; unrelated_neg uuid; x jsonb; f uuid; impact uuid; resumed jsonb; authz uuid;
begin
  i:=public.hq_workforce_record_improvement_incident(
    'dependency-proof-incident','quality-worker-01',null,null,'blocked','high',
    '{"dependency_loop":"operational"}','{"production_schema":"missing"}','integration',1,
    '{"base":"52bbec1a"}','{"users_exposed":false}',array['repo:52bbec1a','production:migration-ledger']);
  neg:=public.hq_workforce_register_regression_case('dependency-proof-negative',1,i,'engine','dependency-integrity',false,'independent-assurance','v1','{"case":"missing migration and stale certificate"}','{"decision":"block and checkpoint"}');
  pos:=public.hq_workforce_register_regression_case('dependency-proof-positive',1,i,'engine','dependency-integrity',true,'independent-assurance','v1','{"case":"unaffected concurrent mission"}','{"decision":"continue"}');
  candidate:=public.hq_workforce_propose_improvement_candidate('dependency-proof-candidate',i,'policy','dependency-integrity','52bbec1a','proof-repair','base-hash','repair-hash','dependency-repair',array[neg,pos]);
  x:=public.hq_workforce_record_dependency_interruption(
    'dependency-proof-checkpoint','chemistry-convergence','P5','52bbec1a','["artifact-authored"]','["author-lineage"]',
    '{"action":"decide_p2_eligibility","run_id":"87fe234d-df2a-4599-bddb-cd588418f834"}',
    '[{"key":"migration-parity","expected":"PASS"},{"key":"lineage-gate","expected":"PASS"},{"key":"fresh-assurance","expected":"PASS"}]',
    '{"branch":"feat/dependency-integrity-operational-proof","last_safe_state":"AUTHORED","budgets":{"deployments":0}}',
    array['content-run:87fe234d-df2a-4599-bddb-cd588418f834','version:844be6e0-64b4-4733-9589-b8158986feef'],'dependency-investigator',
    'dependency-proof-finding',i,'content_mission','chemistry-convergence','control_plane','dependency-integrity','certification_at_risk',1,
    '{"facts":["production migration absent","author identity unregistered"]}',
    '{"blocked":["chemistry-p2"],"unaffected":["runtime","payments","published-content","other-certificates"]}',
    '{"runtime":"off","global_stop":"on","publication":"draft"}',array['schema-query','content-lineage-query'],'dependency-investigator');
  f:=(x->>'finding_id')::uuid;
  impact:=public.hq_workforce_record_dependency_impact(f,'content_version','844be6e0-64b4-4733-9589-b8158986feef','AUTHORED','at_risk',array['author-lineage','P2','P3'],'["canonical guard","independent revalidation"]');
  if not exists(select 1 from public.hq_workforce_dependency_invalidations where impact_id=impact and invalidation_state='CERTIFICATION AT RISK') then raise exception 'affected decision was not automatically invalidated'; end if;
  begin
    perform public.hq_workforce_resume_dependency_mission((x->>'checkpoint_id')::uuid,'52bbec1a','proof-repair','resume-controller',array['premature']);
    raise exception 'premature resume accepted';
  exception when others then if sqlerrm='premature resume accepted' then raise; end if; end;
  begin
    perform public.hq_workforce_record_dependency_revalidation(impact,'proof-repair','[{"gate":"lineage-gate","observed":"FAIL","passed":false}]',array['contradictory'],'quality-worker-01',true);
    raise exception 'contradictory revalidation accepted';
  exception when others then if sqlerrm='contradictory revalidation accepted' then raise; end if; end;
  begin
    perform public.hq_workforce_record_dependency_revalidation(impact,'proof-repair','[{"gate":"lineage","passed":true}]',array['self'],'dependency-investigator',true);
    raise exception 'self revalidation accepted';
  exception when others then if sqlerrm='self revalidation accepted' then raise; end if; end;
  begin
    perform public.hq_workforce_record_dependency_gate_evidence(impact,'proof-repair','unauthorized','PASS',true,'digest:unauthorized',array['unauthorized:test'],'quality-worker-01');
    raise exception 'unauthorized assessor accepted';
  exception when others then if sqlerrm='unauthorized assessor accepted' then raise; end if; end;
  insert into public.hq_workforce_dependency_assessor_authorizations(worker_key,scope_type,scope_key,authorized_by,evidence_refs,valid_from,valid_until) values('quality-worker-01','dependency_integrity',(x->>'checkpoint_id'),'owner-test',array['owner:test'],clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour');
  if public.hq_workforce_dependency_assessor_is_authorized('quality-worker-01',(x->>'checkpoint_id')::uuid) then raise exception 'expired assessor authorization accepted'; end if;
  insert into public.hq_workforce_dependency_assessor_authorizations(worker_key,scope_type,scope_key,authorized_by,evidence_refs,valid_until) values('quality-worker-01','dependency_integrity',(x->>'checkpoint_id'),'owner-test',array['owner:test'],clock_timestamp()+interval '1 hour') returning id into authz;
  if not public.hq_workforce_dependency_assessor_is_authorized('quality-worker-01',(x->>'checkpoint_id')::uuid) then raise exception 'scoped assessor authorization not effective'; end if;
  begin update public.hq_workforce_dependency_assessor_authorizations set authorized_by='mutated' where id=authz; raise exception 'assessor authorization mutation accepted'; exception when others then if sqlerrm='assessor authorization mutation accepted' then raise; end if; end;
  perform public.hq_workforce_record_dependency_gate_evidence(impact,'proof-repair','migration-parity','PASS',true,'digest:migration',array['migration:test'],'quality-worker-01');
  perform public.hq_workforce_record_dependency_gate_evidence(impact,'proof-repair','lineage-gate','PASS',true,'digest:lineage',array['lineage:test'],'quality-worker-01');
  perform public.hq_workforce_record_dependency_gate_evidence(impact,'proof-repair','fresh-assurance','PASS',true,'digest:assurance',array['assurance:test'],'quality-worker-01');
  begin
    perform public.hq_workforce_record_dependency_control_result(impact,neg,'proof-repair',true,'{"decision":"continue"}',array['negative:test'],'quality-worker-01');
    raise exception 'contradictory control result accepted';
  exception when others then if sqlerrm='contradictory control result accepted' then raise; end if; end;
  perform public.hq_workforce_record_dependency_control_result(impact,neg,'proof-repair',true,'{"decision":"block and checkpoint"}',array['negative:test'],'quality-worker-01');
  perform public.hq_workforce_record_dependency_control_result(impact,pos,'proof-repair',true,'{"decision":"continue"}',array['positive:test'],'quality-worker-01');
  perform public.hq_workforce_record_dependency_revalidation(impact,'proof-repair','[{"gate":"migration-parity","observed":"PASS","passed":true},{"gate":"lineage-gate","observed":"PASS","passed":true},{"gate":"fresh-assurance","observed":"PASS","passed":true}]',array['independent:raw-evidence'],'quality-worker-01',true);
  unrelated_i:=public.hq_workforce_record_improvement_incident('dependency-proof-unrelated','quality-worker-01',null,null,'blocked','low','{}','{}','integration',1,'{}','{}',array['unrelated']);
  unrelated_neg:=public.hq_workforce_register_regression_case('dependency-proof-unrelated-negative',1,unrelated_i,'engine','other',false,'independent-assurance','v1','{}','{"decision":"block and checkpoint"}');
  begin perform public.hq_workforce_record_dependency_resolution(f,'open',candidate,'proof-repair',array[unrelated_neg],array[pos],array['independent:raw-evidence'],'resolution-controller'); raise exception 'unrelated candidate control accepted'; exception when others then if sqlerrm='unrelated candidate control accepted' then raise; end if; end;
  perform public.hq_workforce_record_dependency_resolution(f,'open',candidate,'proof-repair',array[neg],array[pos],array['independent:raw-evidence'],'resolution-controller');
  begin
    perform public.hq_workforce_resume_dependency_mission((x->>'checkpoint_id')::uuid,'stale-revision','proof-repair','resume-controller',array['stale']);
    raise exception 'stale checkpoint accepted';
  exception when others then if sqlerrm='stale checkpoint accepted' then raise; end if; end;
  resumed:=public.hq_workforce_resume_dependency_mission((x->>'checkpoint_id')::uuid,'52bbec1a','proof-repair','resume-controller',array['independent:raw-evidence','runtime:fail-closed']);
  if resumed->>'state'<>'resumed' or resumed->'next_safe_action'->>'action'<>'decide_p2_eligibility' then raise exception 'checkpoint did not resume from next safe action'; end if;
  begin
    perform public.hq_workforce_resume_dependency_mission((x->>'checkpoint_id')::uuid,'52bbec1a','proof-repair','resume-controller',array['duplicate']);
    raise exception 'duplicate resume accepted';
  exception when others then if sqlerrm='duplicate resume accepted' then raise; end if; end;
  insert into public.hq_workforce_dependency_assessor_revocations(authorization_id,reason,revoked_by,evidence_refs) values(authz,'test revocation','owner-test',array['owner:test']);
  if public.hq_workforce_dependency_assessor_is_authorized('quality-worker-01',(x->>'checkpoint_id')::uuid) then raise exception 'revoked assessor authorization accepted'; end if;
end $$;

do $$ declare x jsonb;
begin
  x:=public.hq_workforce_record_dependency_interruption('cycle-a','cycle-a','P1','r1','[]','[]','{"action":"resume"}','[{"key":"cycle-clear","expected":"PASS"}]','{}',array['a'],'investigator','cycle-a-finding',null,'component','A','component','B','blocking_dependency',1,'{}','{}','{}',array['a'],'investigator');
  begin
    perform public.hq_workforce_record_dependency_interruption('cycle-b','cycle-b','P1','r1','[]','[]','{"action":"resume"}','[{"key":"cycle-clear","expected":"PASS"}]','{}',array['b'],'investigator','cycle-b-finding',null,'component','B','component','A','blocking_dependency',1,'{}','{}','{}',array['b'],'investigator');
    raise exception 'dependency cycle accepted';
  exception when others then if sqlerrm='dependency cycle accepted' then raise; end if; end;
end $$;

do $$ begin
  begin
    perform public.hq_workforce_record_dependency_interruption('nonblocking','nonblocking','P2','r1','[]','[]','{"action":"continue"}','[{"key":"debt-owned","expected":"PASS"}]','{}',array['debt'],'investigator','nonblocking-finding',null,'mission','later','component','earlier','non_blocking_debt',1,'{}','{}','{}',array['debt'],'investigator');
    raise exception 'non-blocking debt interrupted mission';
  exception when others then if sqlerrm='non-blocking debt interrupted mission' then raise; end if; end;
end $$;

do $$ declare a jsonb; ec public.hq_workforce_engine_contract%rowtype;
begin
  begin
    perform public.content_convergence_assert_certified_worker('p5-shadow-bootstrap','author');
    raise exception 'unregistered content author accepted';
  exception when others then if sqlerrm='unregistered content author accepted' then raise; end if; end;
  a:=public.content_convergence_assert_certified_worker('content-factory-r2-canary-01','author');
  if a->>'worker_version' is null then raise exception 'certified author positive control failed'; end if;
  if pg_get_functiondef('public.content_convergence_release_gate(uuid)'::regprocedure) not ilike '%content_convergence_evaluation_identities%' or to_regprocedure('public.content_convergence_release_identity_current(uuid,uuid,uuid)') is null then raise exception 'release gate accepts unidentified evaluations'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'operational proof changed fail-closed runtime posture'; end if;
end $$;

rollback;
