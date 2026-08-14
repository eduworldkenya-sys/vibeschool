-- WE-R1.3X foundation acceptance: resource discovery, competency routing, graph isolation and L0 boundary.
begin;

do $$
begin
  if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_resources') then raise exception 'missing_resource_registry'; end if;
  if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_worker_competencies') then raise exception 'missing_competency_graph'; end if;
  if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_capability_edges') then raise exception 'missing_capability_graph'; end if;
  if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='hq_workforce_skill_resources') then raise exception 'missing_skill_resource_bindings'; end if;
end $$;

insert into public.hq_workforce_resources(resource_key,version,resource_type,display_name,trust_tier,allowed_scope_types,allowed_operations,health_status,enabled,shadow_capable)
values
 ('test.safe.resource',1,'dataset','Safe test resource',5,array['global'],array['read'],'healthy',true,true),
 ('test.disabled.resource',1,'dataset','Disabled test resource',5,array['global'],array['read'],'healthy',false,true),
 ('test.highrisk.resource',1,'api','High-risk test resource',5,array['global'],array['read'],'healthy',true,true)
on conflict(resource_key,version) do nothing;
update public.hq_workforce_resources set risk_class=5 where resource_key='test.highrisk.resource';

do $$
declare n integer;
begin
  select count(*) into n from public.hq_workforce_discover_shadow_resources('global','global','read',25) where resource_key like 'test.%';
  if n<>1 then raise exception 'resource_resolver_did_not_fail_closed expected=1 actual=%',n; end if;
end $$;

insert into public.hq_workforce_worker_competencies(worker_key,competency_key,version,proficiency,reliability,certification_status,allowed_scope_types,jurisdictions)
values
 ('test-worker-a','quality.analysis',1,0.95,0.90,'certified',array['global'],array['global']),
 ('test-worker-b','quality.analysis',1,0.80,0.99,'certified',array['global'],array['global']),
 ('test-worker-draft','quality.analysis',1,1.00,1.00,'draft',array['global'],array['global'])
on conflict(worker_key,competency_key,version) do nothing;

do $$
declare winner text;
begin
  select worker_key into winner from public.hq_workforce_rank_workers_by_competency(array['quality.analysis'],'global','global',10) limit 1;
  if winner<>'test-worker-a' then raise exception 'competency_router_wrong_winner %',winner; end if;
  if exists(select 1 from public.hq_workforce_rank_workers_by_competency(array['quality.analysis'],'global','global',10) where worker_key='test-worker-draft') then raise exception 'uncertified_competency_routed'; end if;
end $$;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
    raise exception 'R1.3X acceptance found consequential runtime enabled';
  end if;
end $$;

rollback;