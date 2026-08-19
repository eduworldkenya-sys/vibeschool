-- VibeSchool HQ National Intelligence structural/security regression contract.
-- Intended for clean/disposable reconstructed databases only.
begin;

do $$
declare t text;
begin
  foreach t in array array['geo_countries','geo_counties','geo_subcounties','geo_wards','school_geography'] loop
    if to_regclass('public.'||t) is null then raise exception 'missing HQ geography relation %',t; end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then raise exception 'RLS disabled on %',t; end if;
    if has_table_privilege('anon','public.'||t,'SELECT') or has_table_privilege('authenticated','public.'||t,'SELECT') then
      raise exception 'unexpected direct browser read on %',t;
    end if;
  end loop;
end $$;

do $$
declare sig text; r text; p record;
begin
  foreach sig in array array[
    'public.hq_geography_hierarchy()',
    'public.hq_geography_summary(uuid,uuid,uuid,uuid,uuid,integer)',
    'public.hq_geography_region_breakdown(text,uuid,integer)',
    'public.hq_geographic_data_quality()',
    'public.hq_map_school_points(uuid,uuid,uuid,integer)',
    'public.hq_school_360(uuid,integer)',
    'public.hq_growth_intelligence(uuid,uuid,uuid,uuid,integer)',
    'public.hq_geographic_opportunities(uuid,uuid,uuid,uuid,integer,integer)',
    'public.hq_school_explorer_list(uuid,uuid,uuid,uuid,text,text,integer,integer)'
  ] loop
    if to_regprocedure(sig) is null then raise exception 'missing HQ intelligence RPC %',sig; end if;
    foreach r in array array['public','anon'] loop
      if has_function_privilege(r,sig,'EXECUTE') then raise exception 'unexpected % execute on %',r,sig; end if;
    end loop;
    if not has_function_privilege('authenticated',sig,'EXECUTE') then raise exception 'authenticated transport execute missing on %',sig; end if;

    select pr.prosecdef,coalesce(array_to_string(pr.proconfig,','),'') cfg,pg_get_functiondef(pr.oid) def
      into p
      from pg_proc pr where pr.oid=to_regprocedure(sig);
    if not p.prosecdef then raise exception '% must be SECURITY DEFINER',sig; end if;
    if p.cfg not like '%search_path=public, extensions, pg_temp%' and p.cfg not like '%search_path=public,extensions,pg_temp%' then
      raise exception '% fixed search_path missing: %',sig,p.cfg;
    end if;
    if position('is_platform_owner' in p.def)=0 then raise exception '% owner assertion missing',sig; end if;
  end loop;
end $$;

-- Semantic contracts bound to the current RPC source. These ensure a future replacement
-- function cannot silently diverge from the deterministic fixture expectations below.
do $$
declare d text; normalized text;
begin
  d:=pg_get_functiondef('public.hq_geography_region_breakdown(text,uuid,integer)'::regprocedure);
  if position('count(s.id)' in d)=0 then raise exception 'regional school totals must count eligible canonical schools'; end if;
  if position('count(distinct pe.school_id)' in d)=0 then raise exception 'regional active schools must be distinct'; end if;
  if position('s.deleted_at is null' in d)=0 then raise exception 'regional totals must exclude deleted schools'; end if;
  if position('event_rollup' in d)=0 then raise exception 'regional event aggregation must remain isolated from school rollup'; end if;

  d:=pg_get_functiondef('public.hq_school_explorer_list(uuid,uuid,uuid,uuid,text,text,integer,integer)'::regprocedure);
  if position('public.school_levels' in d)=0 then raise exception 'school level must use canonical school_levels'; end if;
  if position('JUNIOR SCHOOL' in d)=0 or position('SENIOR_SECONDARY' in d)=0 then raise exception 'Founder school-level normalization missing'; end if;
  if position('school_aliases' in d)=0 then raise exception 'canonical alias search missing'; end if;
  if position('full_name' in d)>0 or position('phone' in d)>0 or position('date_of_birth' in d)>0 then raise exception 'school explorer exposes user PII'; end if;

  d:=pg_get_functiondef('public.hq_school_360(uuid,integer)'::regprocedure);
  if position('aggregate_first' in d)=0 or position('residential_geography_inferred' in d)=0 then raise exception 'School 360 privacy contract missing'; end if;
  if position('public.school_levels' in d)=0 then raise exception 'School 360 canonical level source missing'; end if;
  if position('full_name' in d)>0 or position('phone' in d)>0 or position('date_of_birth' in d)>0 then raise exception 'School 360 exposes user PII'; end if;

  d:=pg_get_functiondef('public.hq_growth_intelligence(uuid,uuid,uuid,uuid,integer)'::regprocedure);
  normalized:=lower(regexp_replace(d,'\s+','','g'));
  if position('product_measurement_state' in d)=0 then raise exception 'growth intelligence must expose certified Measurement Kernel boundary'; end if;
  if position('not_calculated_here' in d)=0 then raise exception 'retention must not be fabricated by geographic read model'; end if;
  if position('residential_geography_inferred' in d)=0 then raise exception 'institutional-vs-residential semantic guard missing'; end if;
  if position('unionselect' in normalized)=0 then raise exception 'linked people must use set semantics across institutional relationships'; end if;
  if position('count(*)fromlinked_people' in normalized)=0 then raise exception 'national linked-person metric must count de-duplicated identities'; end if;

  d:=pg_get_functiondef('public.hq_geographic_opportunities(uuid,uuid,uuid,uuid,integer,integer)'::regprocedure);
  normalized:=lower(regexp_replace(d,'\s+','','g'));
  if position('learners>0andactive_teachers=0' in normalized)=0 then
    raise exception 'teacher activation opportunity must require learner evidence and zero active teachers';
  end if;
  if position('recommended_investigation' in d)=0 then raise exception 'opportunity evidence must remain investigatory, not consequential authority'; end if;
end $$;

-- Deterministic aggregate fixture: repeated events must never multiply school totals,
-- and soft-deleted schools must not re-enter either school or active-school counts.
do $$
declare v_school_count bigint; v_verified_count bigint; v_active_count bigint;
begin
  with schools(id,deleted) as (
    values ('00000000-0000-0000-0000-000000000101'::uuid,false),
           ('00000000-0000-0000-0000-000000000102'::uuid,true)
  ), geography(school_id,verified) as (
    values ('00000000-0000-0000-0000-000000000101'::uuid,true),
           ('00000000-0000-0000-0000-000000000102'::uuid,true)
  ), events(school_id) as (
    values ('00000000-0000-0000-0000-000000000101'::uuid),
           ('00000000-0000-0000-0000-000000000101'::uuid),
           ('00000000-0000-0000-0000-000000000101'::uuid),
           ('00000000-0000-0000-0000-000000000102'::uuid),
           ('00000000-0000-0000-0000-000000000102'::uuid)
  ), school_rollup as (
    select count(s.id)::bigint as school_count,
           count(s.id) filter(where g.verified)::bigint as verified_count
    from geography g left join schools s on s.id=g.school_id and not s.deleted
  ), event_rollup as (
    select count(distinct e.school_id)::bigint as active_count
    from events e join schools s on s.id=e.school_id and not s.deleted
  )
  select sr.school_count,sr.verified_count,er.active_count
    into v_school_count,v_verified_count,v_active_count
    from school_rollup sr cross join event_rollup er;

  if v_school_count<>1 or v_verified_count<>1 or v_active_count<>1 then
    raise exception 'aggregate fixture failed: schools %, verified %, active %',v_school_count,v_verified_count,v_active_count;
  end if;
end $$;

-- Deterministic multi-school fixture: a person linked to two schools is one unique person,
-- while membership-row semantics remain explicitly different.
do $$
declare v_unique_people bigint; v_memberships bigint;
begin
  with relationships(profile_id,school_id) as (
    values ('00000000-0000-0000-0000-000000000201'::uuid,'00000000-0000-0000-0000-000000000301'::uuid),
           ('00000000-0000-0000-0000-000000000201'::uuid,'00000000-0000-0000-0000-000000000302'::uuid),
           ('00000000-0000-0000-0000-000000000202'::uuid,'00000000-0000-0000-0000-000000000301'::uuid)
  )
  select count(distinct profile_id),count(*) into v_unique_people,v_memberships from relationships;
  if v_unique_people<>2 or v_memberships<>3 then
    raise exception 'multi-school counting fixture failed: unique %, memberships %',v_unique_people,v_memberships;
  end if;
end $$;

-- Deterministic opportunity fixture: learner evidence with zero active teachers is the
-- teacher-activation signal. A zero-user school is not the same signal.
do $$
declare v_count bigint; v_school text;
begin
  with evidence(school_name,learners,active_teachers) as (
    values ('School A',100::bigint,0::bigint),
           ('School B',0::bigint,0::bigint),
           ('School C',20::bigint,1::bigint)
  ), signals as (
    select school_name from evidence where learners>0 and active_teachers=0
  )
  select count(*),min(school_name) into v_count,v_school from signals;
  if v_count<>1 or v_school<>'School A' then
    raise exception 'teacher activation fixture failed: count %, school %',v_count,v_school;
  end if;
end $$;

-- Deterministic Unknown semantics: unresolved or absent geography remains a data-quality
-- gap and is not converted into a false verified/healthy state.
do $$
declare v_gaps bigint; v_verified bigint;
begin
  with evidence(school_name,verification_state) as (
    values ('Mapped School','verified'::text),
           ('Unresolved School','unresolved'::text),
           ('Unmapped School',null::text)
  )
  select count(*) filter(where verification_state is null or verification_state in ('unresolved','conflicting')),
         count(*) filter(where verification_state='verified')
    into v_gaps,v_verified from evidence;
  if v_gaps<>2 or v_verified<>1 then
    raise exception 'Unknown geography fixture failed: gaps %, verified %',v_gaps,v_verified;
  end if;
end $$;

rollback;
