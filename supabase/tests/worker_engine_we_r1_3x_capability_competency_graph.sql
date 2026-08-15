-- WE-R1.3X X3 Capability + Competency Graph adversarial/regression tests.
begin;

-- Tables exist, RLS enabled, direct product-role access denied.
do $$
declare t text; r text;
begin
  foreach t in array array['hq_workforce_capabilities','hq_workforce_capability_edges','hq_workforce_skill_capabilities','hq_workforce_worker_competencies'] loop
    if to_regclass('public.'||t) is null then raise exception 'missing table %',t; end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then raise exception 'RLS disabled on %',t; end if;
    foreach r in array array['public','anon','authenticated'] loop
      if has_table_privilege(r,'public.'||t,'SELECT') or has_table_privilege(r,'public.'||t,'INSERT') or has_table_privilege(r,'public.'||t,'UPDATE') or has_table_privilege(r,'public.'||t,'DELETE') then
        raise exception 'unexpected privilege % on %',r,t;
      end if;
    end loop;
  end loop;
end $$;

-- Capability is a separate ontology object; it is not a skill alias.
do $$
declare c1 uuid; c2 uuid;
begin
  insert into public.hq_workforce_capabilities(capability_key,display_name,purpose,lifecycle_status,provenance)
  values('test.inspect-auth','Inspect auth state','Read and interpret governed auth state','certified','{"suite":"x3"}') returning id into c1;
  insert into public.hq_workforce_capabilities(capability_key,display_name,purpose,lifecycle_status,provenance)
  values('test.verify-transition','Verify transition','Verify an expected state transition independently','certified','{"suite":"x3"}') returning id into c2;
  if c1=c2 then raise exception 'capability identity collision'; end if;
  if exists(select 1 from public.hq_workforce_skill_manifests where id=c1) then
    raise exception 'capability incorrectly aliases skill identity';
  end if;
end $$;

-- Self-cycle edges must fail structurally.
do $$
declare c uuid;
begin
  select id into c from public.hq_workforce_capabilities where capability_key='test.inspect-auth';
  begin
    insert into public.hq_workforce_capability_edges(from_capability_id,to_capability_id,relation_type,enabled) values(c,c,'requires',true);
    raise exception 'self-edge accepted';
  exception when check_violation then null;
  end;
end $$;

-- Create a worker and certified competency, then prove routing is competency-driven rather than department-equality driven.
do $$
declare wk text:='x3-worker-'||substr(gen_random_uuid()::text,1,8); matched integer;
begin
  insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status)
  values(wk,'digital','X3 Test Worker','unrelated-department','Prove competency routing','active');
  insert into public.hq_workforce_worker_competencies(worker_key,competency_key,proficiency,reliability,sample_count,certification_status,evidence,scope_types,jurisdictions)
  values(wk,'auth-diagnosis',0.91,0.88,42,'certified','{"suite":"x3"}',array['platform_internal'],array['global']);
  select matched_competencies into matched
  from public.hq_workforce_rank_workers_by_competency(array['auth-diagnosis'],'platform_internal','global',10)
  where worker_key=wk;
  if coalesce(matched,0)<>1 then raise exception 'competency router failed independent of department'; end if;
end $$;

-- Expired or revoked competencies must not route.
do $$
declare wk text:='x3-expired-'||substr(gen_random_uuid()::text,1,8); n integer;
begin
  insert into public.hq_workforce_workers(worker_key,worker_kind,title,department_key,mission,status)
  values(wk,'digital','Expired Test Worker','quality','Prove expiry filter','active');
  insert into public.hq_workforce_worker_competencies(worker_key,competency_key,proficiency,reliability,sample_count,certification_status,evidence,scope_types,jurisdictions,expires_at)
  values(wk,'auth-diagnosis',1,1,100,'certified','{"suite":"x3"}',array['platform_internal'],array['global'],clock_timestamp()-interval '1 second');
  select count(*) into n from public.hq_workforce_rank_workers_by_competency(array['auth-diagnosis'],'platform_internal','global',10) where worker_key=wk;
  if n<>0 then raise exception 'expired competency routed'; end if;
end $$;

-- Runtime must remain fully fail-closed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
    or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
   raise exception 'X3 changed runtime safety boundary';
 end if;
end $$;

rollback;
