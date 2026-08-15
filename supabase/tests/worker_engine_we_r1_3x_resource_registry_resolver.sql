-- WE-R1.3X X4 Resource Registry/Resolver adversarial tests.
begin;

do $$
declare t text; r text;
begin
 foreach t in array array['hq_workforce_resources','hq_workforce_capability_resources','hq_workforce_resource_resolution_events'] loop
   if to_regclass('public.'||t) is null then raise exception 'missing table %',t; end if;
   if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then raise exception 'RLS disabled on %',t; end if;
   foreach r in array array['public','anon','authenticated'] loop
     if has_table_privilege(r,'public.'||t,'SELECT') or has_table_privilege(r,'public.'||t,'INSERT') or has_table_privilege(r,'public.'||t,'UPDATE') or has_table_privilege(r,'public.'||t,'DELETE') then raise exception 'unexpected privilege % on %',r,t; end if;
   end loop;
 end loop;
end $$;

-- Resolver must prefer least authority/risk/cost while respecting reliability.
do $$
declare cap uuid; cheap uuid; powerful uuid; unhealthy uuid; result jsonb;
begin
 insert into public.hq_workforce_capabilities(capability_key,display_name,purpose,lifecycle_status,provenance)
 values('x4.read-fact','Read governed fact','Test resource resolution','certified','{"suite":"x4"}') returning id into cap;
 insert into public.hq_workforce_resources(resource_key,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
 values('x4.cheap-safe','data_source','Safe local facts',true,true,'healthy',.95,.01,0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x4"}') returning id into cheap;
 insert into public.hq_workforce_resources(resource_key,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
 values('x4.powerful','model','Powerful model',true,true,'healthy',.99,10,1,2,array['platform_internal'],array['global'],array['internal'],'{"suite":"x4"}') returning id into powerful;
 insert into public.hq_workforce_resources(resource_key,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
 values('x4.unhealthy','internal_api','Broken API',true,true,'unavailable',1,0,0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x4"}') returning id into unhealthy;
 insert into public.hq_workforce_capability_resources(capability_id,resource_id,access_mode,minimum_reliability,priority) values
   (cap,cheap,'read',.8,100),(cap,powerful,'read',.8,100),(cap,unhealthy,'read',.8,100);
 result:=public.hq_workforce_resolve_resource(cap,'platform_internal','global','internal','read',0::smallint,0::smallint,true,null);
 if result->>'status'<>'selected' then raise exception 'safe resource not selected:%',result; end if;
 if (result->>'selected_resource_id')::uuid<>cheap then raise exception 'resolver did not select least sufficient resource:%',result; end if;
 if result->'considered' @> jsonb_build_array(jsonb_build_object('resource_id',unhealthy,'eligibility','eligible')) then raise exception 'unhealthy resource treated eligible'; end if;
end $$;

-- Classification mismatch must fail closed.
do $$
declare cap uuid; restricted uuid; result jsonb;
begin
 insert into public.hq_workforce_capabilities(capability_key,display_name,purpose,lifecycle_status,provenance)
 values('x4.restricted','Read restricted fact','Test classification guard','certified','{"suite":"x4"}') returning id into cap;
 insert into public.hq_workforce_resources(resource_key,resource_kind,display_name,enabled,shadow_capable,health_status,reliability,cost_per_unit,required_autonomy,risk_class,allowed_scope_types,jurisdictions,allowed_data_classifications,provenance)
 values('x4.internal-only','data_source','Internal only',true,true,'healthy',1,0,0,0,array['platform_internal'],array['global'],array['internal'],'{"suite":"x4"}') returning id into restricted;
 insert into public.hq_workforce_capability_resources(capability_id,resource_id,access_mode,minimum_reliability) values(cap,restricted,'read',.5);
 result:=public.hq_workforce_resolve_resource(cap,'platform_internal','global','learner_pii','read',0::smallint,0::smallint,true,null);
 if result->>'status'<>'no_eligible_resource' then raise exception 'classification mismatch did not fail closed:%',result; end if;
end $$;

-- Model gateway registration must be inert and deterministic-first.
do $$
declare rid uuid; r public.hq_workforce_resources%rowtype;
begin
 rid:=public.hq_workforce_register_model_gateway_resource('x4.model-gateway','Test Model Gateway','test-provider','test-model',.9,.001,'token');
 select * into r from public.hq_workforce_resources where id=rid;
 if r.enabled then raise exception 'model gateway resource auto-enabled'; end if;
 if r.interface_contract->>'gateway'<>'hq_workforce_authorize_model_call' or coalesce((r.interface_contract->>'deterministic_first')::boolean,false)<>true then raise exception 'WE-L5 contract not preserved'; end if;
end $$;

-- Resolution evidence is append-only.
do $$
declare eid bigint;
begin
 select id into eid from public.hq_workforce_resource_resolution_events order by id desc limit 1;
 begin
   update public.hq_workforce_resource_resolution_events set resolution_status='denied' where id=eid;
   raise exception 'resource resolution evidence mutation accepted';
 exception when others then if sqlerrm='resource resolution evidence mutation accepted' then raise; end if; end;
end $$;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'X4 changed runtime safety boundary'; end if;
end $$;

rollback;
