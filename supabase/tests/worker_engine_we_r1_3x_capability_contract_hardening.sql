-- WE-R1.3X.3 adversarial acceptance: capability contracts are complete and fail closed.
begin;

insert into public.hq_workforce_resources(resource_key,version,resource_type,display_name,trust_tier,allowed_scope_types,allowed_operations,health_status,enabled,shadow_capable,risk_class)
values ('test.x3.resource',1,'dataset','X3 safe resource',5,array['global'],array['read'],'healthy',true,true,0);

insert into public.hq_workforce_skill_manifests(
 skill_key,version,tool_contract_id,autonomy_required,risk_class,allowed_scope_types,allowed_data_classes,
 max_records_affected,max_attempts,max_runtime_ms,requires_human_approval,verification_required,
 compensation_strategy,owner_key,certification_status,certified_at,purpose,input_contract,output_contract,
 resource_contract,preconditions,expected_outcome,verification_contract,failure_handling,retry_policy,
 escalation_contract,compensation_contract,jurisdiction_contract,shadow_capable,immutable_version_key,capability_mode
) values (
 'test.x3.reason',1,null,0,0,array['global'],array['internal'],1,2,30000,true,true,
 'manual_review','platform_governance','certified',clock_timestamp(),'reason safely','{}','{}','{}','[]',
 '{}','{}','{}','{"max_attempts":2}','{}','{}','{"allowed":["global"]}',true,'test.x3.reason@1','shadow_reasoning'
),(
 'test.x3.invalid',1,null,1,0,array['global'],array['internal'],1,2,30000,false,false,
 'none','platform_governance','certified',clock_timestamp(),'invalid reasoning capability','{}','{}','{}','[]',
 '{}','{}','{}','{}','{}','{}','{"allowed":["global"]}',true,'test.x3.invalid@1','shadow_reasoning'
);

insert into public.hq_workforce_skill_resources(skill_manifest_id,resource_id,usage_role,required,operation)
select s.id,r.id,'input',true,'read'
from public.hq_workforce_skill_manifests s cross join public.hq_workforce_resources r
where s.skill_key='test.x3.reason' and r.resource_key='test.x3.resource';

do $$ declare v jsonb; begin
 v:=public.hq_workforce_validate_capability_contract((select id from public.hq_workforce_skill_manifests where skill_key='test.x3.reason'));
 if not (v->>'valid')::boolean then raise exception 'valid_capability_contract_rejected %',v; end if;
 v:=public.hq_workforce_validate_capability_contract((select id from public.hq_workforce_skill_manifests where skill_key='test.x3.invalid'));
 if (v->>'valid')::boolean then raise exception 'unsafe_reasoning_capability_accepted %',v; end if;
 if not ((v->'errors') ? 'reasoning_capability_must_be_l0') then raise exception 'missing_l0_failure %',v; end if;
 if not ((v->'errors') ? 'reasoning_capability_requires_human_review') then raise exception 'missing_human_review_failure %',v; end if;
 if not ((v->'errors') ? 'shadow_capability_requires_verification') then raise exception 'missing_verification_failure %',v; end if;
 if not ((v->'errors') ? 'registered_resource_binding_missing') then raise exception 'missing_resource_failure %',v; end if;
end $$;

-- Certified nodes alone are insufficient: graph composition validates both endpoint contracts.
insert into public.hq_workforce_capability_edges(from_skill_manifest_id,to_skill_manifest_id,relation_type,enabled)
select a.id,b.id,'requires',true
from public.hq_workforce_skill_manifests a cross join public.hq_workforce_skill_manifests b
where a.skill_key='test.x3.reason' and b.skill_key='test.x3.invalid';

do $$ declare v jsonb; begin
 v:=public.hq_workforce_validate_capability_edge((select id from public.hq_workforce_capability_edges e join public.hq_workforce_skill_manifests s on s.id=e.from_skill_manifest_id where s.skill_key='test.x3.reason' limit 1));
 if (v->>'valid')::boolean then raise exception 'invalid_capability_graph_edge_accepted %',v; end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
   raise exception 'X3 acceptance found consequential runtime enabled';
 end if;
end $$;

rollback;
