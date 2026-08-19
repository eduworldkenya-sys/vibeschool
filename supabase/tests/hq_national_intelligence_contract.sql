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

-- Semantic contracts independent of current fixture population.
do $$
declare d text;
begin
  d:=pg_get_functiondef('public.hq_geography_region_breakdown(text,uuid,integer)'::regprocedure);
  if position('count(s.id)' in d)=0 then raise exception 'regional school totals must count eligible canonical schools'; end if;
  if position('count(distinct pe.school_id)' in d)=0 then raise exception 'regional active schools must be distinct'; end if;
  if position('s.deleted_at is null' in d)=0 then raise exception 'regional totals must exclude deleted schools'; end if;

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
  if position('product_measurement_state' in d)=0 then raise exception 'growth intelligence must expose certified Measurement Kernel boundary'; end if;
  if position('not_calculated_here' in d)=0 then raise exception 'retention must not be fabricated by geographic read model'; end if;
  if position('residential_geography_inferred' in d)=0 then raise exception 'institutional-vs-residential semantic guard missing'; end if;

  d:=pg_get_functiondef('public.hq_geographic_opportunities(uuid,uuid,uuid,uuid,integer,integer)'::regprocedure);
  if position('learners>0 and active_teachers=0' in replace(d,' ',''))=0 and position('learners > 0 AND active_teachers = 0' in d)=0 then
    raise exception 'teacher activation opportunity must require learner evidence and zero active teachers';
  end if;
  if position('recommended_investigation' in d)=0 then raise exception 'opportunity evidence must remain investigatory, not consequential authority'; end if;
end $$;

rollback;
