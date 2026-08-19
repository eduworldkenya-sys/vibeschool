begin;

-- access: owner-only public.geo_countries
-- authorization-test: public.geo_countries
create table if not exists public.geo_countries (
  id uuid primary key default gen_random_uuid(),
  iso2 char(2) not null unique,
  official_name text not null,
  normalized_name text not null,
  status text not null default 'active' check (status in ('active','historical','proposed')),
  source_key text not null,
  source_version text,
  source_checksum text,
  verification_state text not null default 'verified' check (verification_state in ('verified','unverified','conflicting','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- access: owner-only public.geo_counties
-- authorization-test: public.geo_counties
create table if not exists public.geo_counties (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.geo_countries(id) on delete restrict,
  official_code text,
  official_name text not null,
  normalized_name text not null,
  status text not null default 'active' check (status in ('active','historical','proposed')),
  source_key text not null,
  source_version text,
  source_checksum text,
  verification_state text not null default 'verified' check (verification_state in ('verified','unverified','conflicting','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country_id, normalized_name),
  unique(country_id, official_code)
);

-- access: owner-only public.geo_subcounties
-- authorization-test: public.geo_subcounties
create table if not exists public.geo_subcounties (
  id uuid primary key default gen_random_uuid(),
  county_id uuid not null references public.geo_counties(id) on delete restrict,
  official_code text,
  official_name text not null,
  normalized_name text not null,
  status text not null default 'active' check (status in ('active','historical','proposed')),
  source_key text not null,
  source_version text,
  source_checksum text,
  verification_state text not null default 'verified' check (verification_state in ('verified','unverified','conflicting','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(county_id, normalized_name),
  unique(county_id, official_code)
);

-- access: owner-only public.geo_wards
-- authorization-test: public.geo_wards
create table if not exists public.geo_wards (
  id uuid primary key default gen_random_uuid(),
  subcounty_id uuid not null references public.geo_subcounties(id) on delete restrict,
  official_code text,
  official_name text not null,
  normalized_name text not null,
  status text not null default 'active' check (status in ('active','historical','proposed')),
  source_key text not null,
  source_version text,
  source_checksum text,
  verification_state text not null default 'verified' check (verification_state in ('verified','unverified','conflicting','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subcounty_id, normalized_name),
  unique(subcounty_id, official_code)
);

-- access: owner-only public.school_geography
-- authorization-test: public.school_geography
create table if not exists public.school_geography (
  school_id uuid primary key references public.schools(id) on delete cascade,
  country_id uuid references public.geo_countries(id) on delete restrict,
  county_id uuid references public.geo_counties(id) on delete restrict,
  subcounty_id uuid references public.geo_subcounties(id) on delete restrict,
  ward_id uuid references public.geo_wards(id) on delete restrict,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_precision text check (location_precision is null or location_precision in ('exact','campus','locality','approximate')),
  verification_state text not null default 'unresolved' check (verification_state in ('verified','inferred','unresolved','conflicting')),
  source_key text,
  source_version text,
  source_ref text,
  source_checksum text,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create index if not exists school_geography_county_idx on public.school_geography(county_id, school_id);
create index if not exists school_geography_subcounty_idx on public.school_geography(subcounty_id, school_id);
create index if not exists school_geography_ward_idx on public.school_geography(ward_id, school_id);
create index if not exists school_geography_verification_idx on public.school_geography(verification_state, school_id);
create index if not exists school_geography_coordinates_idx on public.school_geography(latitude, longitude) where latitude is not null and longitude is not null;

alter table public.geo_countries enable row level security;
alter table public.geo_counties enable row level security;
alter table public.geo_subcounties enable row level security;
alter table public.geo_wards enable row level security;
alter table public.school_geography enable row level security;
revoke all on public.geo_countries, public.geo_counties, public.geo_subcounties, public.geo_wards, public.school_geography from public, anon, authenticated;

create or replace function public.hq_geography_hierarchy()
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return jsonb_build_object(
    'countries',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'code',c.iso2,'name',c.official_name,'verification_state',c.verification_state) order by c.official_name) from public.geo_countries c where c.status='active'),'[]'::jsonb),
    'counties',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'country_id',c.country_id,'code',c.official_code,'name',c.official_name,'verification_state',c.verification_state) order by c.official_name) from public.geo_counties c where c.status='active'),'[]'::jsonb),
    'subcounties',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'county_id',s.county_id,'code',s.official_code,'name',s.official_name,'verification_state',s.verification_state) order by s.official_name) from public.geo_subcounties s where s.status='active'),'[]'::jsonb),
    'wards',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'subcounty_id',w.subcounty_id,'code',w.official_code,'name',w.official_name,'verification_state',w.verification_state) order by w.official_name) from public.geo_wards w where w.status='active'),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.hq_geography_hierarchy() from public,anon;
grant execute on function public.hq_geography_hierarchy() to authenticated;

create or replace function public.hq_geography_summary(p_country_id uuid default null,p_county_id uuid default null,p_subcounty_id uuid default null,p_ward_id uuid default null,p_school_id uuid default null,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),365)); v_scope_schools uuid[];
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  if p_ward_id is not null and not exists(select 1 from public.geo_wards w where w.id=p_ward_id and (p_subcounty_id is null or w.subcounty_id=p_subcounty_id)) then raise exception 'invalid_geographic_hierarchy'; end if;
  if p_subcounty_id is not null and not exists(select 1 from public.geo_subcounties s where s.id=p_subcounty_id and (p_county_id is null or s.county_id=p_county_id)) then raise exception 'invalid_geographic_hierarchy'; end if;
  if p_county_id is not null and not exists(select 1 from public.geo_counties c where c.id=p_county_id and (p_country_id is null or c.country_id=p_country_id)) then raise exception 'invalid_geographic_hierarchy'; end if;
  select coalesce(array_agg(s.id),'{}'::uuid[]) into v_scope_schools from public.schools s left join public.school_geography sg on sg.school_id=s.id
  where s.deleted_at is null and (p_school_id is null or s.id=p_school_id) and (p_country_id is null or sg.country_id=p_country_id) and (p_county_id is null or sg.county_id=p_county_id) and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id) and (p_ward_id is null or sg.ward_id=p_ward_id);
  return jsonb_build_object(
    'scope',jsonb_build_object('country_id',p_country_id,'county_id',p_county_id,'subcounty_id',p_subcounty_id,'ward_id',p_ward_id,'school_id',p_school_id,'days',v_days),
    'schools',jsonb_build_object('total',cardinality(v_scope_schools),'verified_geography',(select count(*) from public.school_geography sg where sg.school_id=any(v_scope_schools) and sg.verification_state='verified'),'unresolved_geography',(select count(*) from unnest(v_scope_schools) x(id) left join public.school_geography sg on sg.school_id=x.id where sg.school_id is null or sg.verification_state='unresolved'),'conflicting_geography',(select count(*) from public.school_geography sg where sg.school_id=any(v_scope_schools) and sg.verification_state='conflicting'),'mapped_coordinates',(select count(*) from public.school_geography sg where sg.school_id=any(v_scope_schools) and sg.latitude is not null and sg.longitude is not null)),
    'users',jsonb_build_object('school_memberships',(select count(*) from public.school_members sm where sm.school_id=any(v_scope_schools)),'unique_staff',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=any(v_scope_schools)),'teachers',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=any(v_scope_schools) and sm.role::text='teacher'),'school_admins',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=any(v_scope_schools) and sm.role::text in ('admin','owner')),'learners',(select count(distinct sc.student_id) from public.student_classes sc where sc.school_id=any(v_scope_schools) and sc.is_current=true),'parents',(select count(distinct psl.parent_id) from public.parent_student_links psl where psl.school_id=any(v_scope_schools))),
    'activity',jsonb_build_object('events',(select count(*) from public.platform_events pe where pe.school_id=any(v_scope_schools) and pe.occurred_at>=now()-(v_days||' days')::interval),'active_schools',(select count(distinct pe.school_id) from public.platform_events pe where pe.school_id=any(v_scope_schools) and pe.occurred_at>=now()-(v_days||' days')::interval),'evidence',case when exists(select 1 from public.platform_events pe where pe.school_id=any(v_scope_schools)) then 'available' else 'insufficient_evidence' end),
    'support',jsonb_build_object('open_cases',(select count(*) from public.hq_support_cases c where c.school_id=any(v_scope_schools) and c.status not in ('resolved','closed')),'incidents',(select count(*) from public.hq_incidents i where i.status<>'resolved' and exists(select 1 from unnest(v_scope_schools) x(id) where i.evidence->>'school_id'=x.id::text))),
    'measurement',jsonb_build_object('certified_from',(select certified_from from public.product_measurement_state where singleton=true limit 1),'historical_retention_claimable',false),
    'freshness',jsonb_build_object('generated_at',now(),'activity_window_days',v_days)
  );
end;
$$;
revoke all on function public.hq_geography_summary(uuid,uuid,uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.hq_geography_summary(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;

create or replace function public.hq_geography_region_breakdown(p_parent_type text,p_parent_id uuid default null,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),365));
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  if p_parent_type not in ('country','county','subcounty') then raise exception 'invalid_parent_type'; end if;
  if p_parent_type='country' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.school_count desc,x.name) from (select c.id,c.official_name name,count(distinct sg.school_id)::bigint school_count,count(distinct sg.school_id) filter(where sg.verification_state='verified')::bigint verified_school_count,count(distinct pe.school_id) filter(where pe.occurred_at>=now()-(v_days||' days')::interval)::bigint active_school_count from public.geo_counties c left join public.school_geography sg on sg.county_id=c.id left join public.platform_events pe on pe.school_id=sg.school_id where (p_parent_id is null or c.country_id=p_parent_id) and c.status='active' group by c.id,c.official_name) x),'[]'::jsonb);
  elsif p_parent_type='county' then
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.school_count desc,x.name) from (select s.id,s.official_name name,count(distinct sg.school_id)::bigint school_count,count(distinct sg.school_id) filter(where sg.verification_state='verified')::bigint verified_school_count,count(distinct pe.school_id) filter(where pe.occurred_at>=now()-(v_days||' days')::interval)::bigint active_school_count from public.geo_subcounties s left join public.school_geography sg on sg.subcounty_id=s.id left join public.platform_events pe on pe.school_id=sg.school_id where s.county_id=p_parent_id and s.status='active' group by s.id,s.official_name) x),'[]'::jsonb);
  else
    return coalesce((select jsonb_agg(to_jsonb(x) order by x.school_count desc,x.name) from (select w.id,w.official_name name,count(distinct sg.school_id)::bigint school_count,count(distinct sg.school_id) filter(where sg.verification_state='verified')::bigint verified_school_count,count(distinct pe.school_id) filter(where pe.occurred_at>=now()-(v_days||' days')::interval)::bigint active_school_count from public.geo_wards w left join public.school_geography sg on sg.ward_id=w.id left join public.platform_events pe on pe.school_id=sg.school_id where w.subcounty_id=p_parent_id and w.status='active' group by w.id,w.official_name) x),'[]'::jsonb);
  end if;
end;
$$;
revoke all on function public.hq_geography_region_breakdown(text,uuid,integer) from public,anon;
grant execute on function public.hq_geography_region_breakdown(text,uuid,integer) to authenticated;

create or replace function public.hq_geographic_data_quality()
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return jsonb_build_object('total_schools',(select count(*) from public.schools s where s.deleted_at is null),'without_mapping',(select count(*) from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and sg.school_id is null),'without_county',(select count(*) from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and sg.county_id is null),'without_subcounty',(select count(*) from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and sg.subcounty_id is null),'without_ward',(select count(*) from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and sg.ward_id is null),'without_coordinates',(select count(*) from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and (sg.latitude is null or sg.longitude is null)),'conflicting',(select count(*) from public.school_geography sg join public.schools s on s.id=sg.school_id where s.deleted_at is null and sg.verification_state='conflicting'),'unresolved',(select count(*) from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and (sg.school_id is null or sg.verification_state='unresolved')),'legacy_text_county_only',(select count(*) from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and nullif(btrim(s.county),'') is not null and sg.county_id is null),'generated_at',now());
end;
$$;
revoke all on function public.hq_geographic_data_quality() from public,anon;
grant execute on function public.hq_geographic_data_quality() to authenticated;

create or replace function public.hq_geography_school_list(p_country_id uuid default null,p_county_id uuid default null,p_subcounty_id uuid default null,p_ward_id uuid default null,p_level text default null,p_search text default null,p_days integer default 30,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),365)); v_limit integer:=greatest(1,least(coalesce(p_limit,100),250));
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.active_events desc,x.name) from (
    select s.id,s.name,s.knec_code,s.nemis_code,s.status::text status,coalesce(sl.level,s.school_type,'Unknown') school_level,sg.verification_state geography_state,c.official_name county,sc.official_name subcounty,w.official_name ward,
      count(distinct sm.profile_id) filter(where sm.role::text='teacher')::bigint teachers,count(distinct stc.student_id) filter(where stc.is_current=true)::bigint learners,count(distinct pe.id) filter(where pe.occurred_at>=now()-(v_days||' days')::interval)::bigint active_events
    from public.schools s left join public.school_geography sg on sg.school_id=s.id left join public.geo_counties c on c.id=sg.county_id left join public.geo_subcounties sc on sc.id=sg.subcounty_id left join public.geo_wards w on w.id=sg.ward_id
    left join lateral (select string_agg(distinct l.level,', ' order by l.level) level from public.school_levels l where l.school_id=s.id) sl on true
    left join public.school_members sm on sm.school_id=s.id left join public.student_classes stc on stc.school_id=s.id left join public.platform_events pe on pe.school_id=s.id
    where s.deleted_at is null and (p_country_id is null or sg.country_id=p_country_id) and (p_county_id is null or sg.county_id=p_county_id) and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id) and (p_ward_id is null or sg.ward_id=p_ward_id)
      and (p_level is null or lower(coalesce(sl.level,s.school_type,'Unknown'))=lower(p_level))
      and (nullif(btrim(p_search),'') is null or s.name ilike '%'||btrim(p_search)||'%' or s.knec_code ilike '%'||btrim(p_search)||'%' or s.nemis_code ilike '%'||btrim(p_search)||'%' or exists(select 1 from public.school_aliases a where a.school_id=s.id and a.alias ilike '%'||btrim(p_search)||'%'))
    group by s.id,s.name,s.knec_code,s.nemis_code,s.status,sl.level,s.school_type,sg.verification_state,c.official_name,sc.official_name,w.official_name limit v_limit
  ) x),'[]'::jsonb);
end;
$$;
revoke all on function public.hq_geography_school_list(uuid,uuid,uuid,uuid,text,text,integer,integer) from public,anon;
grant execute on function public.hq_geography_school_list(uuid,uuid,uuid,uuid,text,text,integer,integer) to authenticated;

create or replace function public.hq_school_360(p_school_id uuid,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),365)); v_school public.schools%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  select * into v_school from public.schools s where s.id=p_school_id and s.deleted_at is null;
  if not found then raise exception 'school_not_found'; end if;
  return jsonb_build_object(
    'identity',jsonb_build_object('id',v_school.id,'name',v_school.name,'knec_code',v_school.knec_code,'nemis_code',v_school.nemis_code,'moe_registration_no',v_school.moe_registration_no,'status',v_school.status,'last_verified_at',v_school.last_verified_at,'aliases',coalesce((select jsonb_agg(jsonb_build_object('alias',a.alias,'source',a.source,'verified',a.verified,'confidence',a.confidence) order by a.verified desc,a.alias) from public.school_aliases a where a.school_id=p_school_id),'[]'::jsonb)),
    'institution',jsonb_build_object('school_type',v_school.school_type,'school_category',v_school.school_category,'ownership_type',v_school.ownership_type,'levels',coalesce((select jsonb_agg(jsonb_build_object('level',l.level,'source',l.source) order by l.level) from public.school_levels l where l.school_id=p_school_id),'[]'::jsonb)),
    'geography',coalesce((select jsonb_build_object('verification_state',sg.verification_state,'county',c.official_name,'subcounty',sc.official_name,'ward',w.official_name,'latitude',sg.latitude,'longitude',sg.longitude,'location_precision',sg.location_precision,'source_key',sg.source_key,'source_version',sg.source_version,'last_verified_at',sg.last_verified_at) from public.school_geography sg left join public.geo_counties c on c.id=sg.county_id left join public.geo_subcounties sc on sc.id=sg.subcounty_id left join public.geo_wards w on w.id=sg.ward_id where sg.school_id=p_school_id),jsonb_build_object('verification_state','unresolved')),
    'community',jsonb_build_object('teachers',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=p_school_id and sm.role::text='teacher'),'admins',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=p_school_id and sm.role::text in ('admin','owner')),'learners',(select count(distinct sc.student_id) from public.student_classes sc where sc.school_id=p_school_id and sc.is_current=true),'parents',(select count(distinct psl.parent_id) from public.parent_student_links psl where psl.school_id=p_school_id)),
    'engagement',jsonb_build_object('events',(select count(*) from public.platform_events pe where pe.school_id=p_school_id and pe.occurred_at>=now()-(v_days||' days')::interval),'active_users',(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=p_school_id and pe.actor_id is not null and pe.occurred_at>=now()-(v_days||' days')::interval),'teacher_events',(select count(*) from public.platform_events pe where pe.school_id=p_school_id and pe.actor_role='teacher' and pe.occurred_at>=now()-(v_days||' days')::interval),'learner_events',(select count(*) from public.platform_events pe where pe.school_id=p_school_id and pe.actor_role in ('student','learner') and pe.occurred_at>=now()-(v_days||' days')::interval),'evidence',case when exists(select 1 from public.platform_events pe where pe.school_id=p_school_id) then 'available' else 'insufficient_evidence' end),
    'operations',jsonb_build_object('open_support_cases',(select count(*) from public.hq_support_cases c where c.school_id=p_school_id and c.status not in ('resolved','closed')),'open_incidents',(select count(*) from public.hq_incidents i where i.status<>'resolved' and i.evidence->>'school_id'=p_school_id::text)),
    'freshness',jsonb_build_object('generated_at',now(),'activity_window_days',v_days,'measurement_certified_from',(select certified_from from public.product_measurement_state where singleton=true limit 1))
  );
end;
$$;
revoke all on function public.hq_school_360(uuid,integer) from public,anon;
grant execute on function public.hq_school_360(uuid,integer) to authenticated;

create or replace function public.hq_geography_growth(p_country_id uuid default null,p_county_id uuid default null,p_subcounty_id uuid default null,p_ward_id uuid default null,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),365)); v_scope uuid[];
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  select coalesce(array_agg(s.id),'{}'::uuid[]) into v_scope from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and (p_country_id is null or sg.country_id=p_country_id) and (p_county_id is null or sg.county_id=p_county_id) and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id) and (p_ward_id is null or sg.ward_id=p_ward_id);
  return jsonb_build_object('window_days',v_days,'new_schools',(select count(*) from public.schools s where s.id=any(v_scope) and s.created_at>=now()-(v_days||' days')::interval),'new_staff_accounts',(select count(distinct p.id) from public.profiles p join public.school_members sm on sm.profile_id=p.id where sm.school_id=any(v_scope) and p.created_at>=now()-(v_days||' days')::interval),'new_learner_accounts',(select count(distinct p.id) from public.profiles p join public.students st on st.profile_id=p.id join public.student_classes sc on sc.student_id=st.id where sc.school_id=any(v_scope) and sc.is_current=true and p.created_at>=now()-(v_days||' days')::interval),'active_users',(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=any(v_scope) and pe.actor_id is not null and pe.occurred_at>=now()-(v_days||' days')::interval),'previous_active_users',(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=any(v_scope) and pe.actor_id is not null and pe.occurred_at>=now()-(v_days*2||' days')::interval and pe.occurred_at<now()-(v_days||' days')::interval),'measurement_certified_from',(select certified_from from public.product_measurement_state where singleton=true limit 1),'generated_at',now());
end;
$$;
revoke all on function public.hq_geography_growth(uuid,uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.hq_geography_growth(uuid,uuid,uuid,uuid,integer) to authenticated;

create or replace function public.hq_geography_opportunities(p_country_id uuid default null,p_county_id uuid default null,p_subcounty_id uuid default null,p_ward_id uuid default null,p_days integer default 30,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),365)); v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.learners desc,x.school_name) from (
    select s.id school_id,s.name school_name,count(distinct sc.student_id) learners,count(distinct sm.profile_id) filter(where sm.role::text='teacher') teachers,count(distinct pe.actor_id) filter(where pe.actor_role='teacher' and pe.occurred_at>=now()-(v_days||' days')::interval) active_teachers,'teacher_activation' signal,'Learners are currently enrolled but no teacher activity is evidenced in the selected window.' evidence_summary
    from public.schools s left join public.school_geography sg on sg.school_id=s.id join public.student_classes sc on sc.school_id=s.id and sc.is_current=true left join public.school_members sm on sm.school_id=s.id left join public.platform_events pe on pe.school_id=s.id
    where s.deleted_at is null and (p_country_id is null or sg.country_id=p_country_id) and (p_county_id is null or sg.county_id=p_county_id) and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id) and (p_ward_id is null or sg.ward_id=p_ward_id)
    group by s.id,s.name having count(distinct sc.student_id)>0 and count(distinct pe.actor_id) filter(where pe.actor_role='teacher' and pe.occurred_at>=now()-(v_days||' days')::interval)=0 limit v_limit
  ) x),'[]'::jsonb);
end;
$$;
revoke all on function public.hq_geography_opportunities(uuid,uuid,uuid,uuid,integer,integer) from public,anon;
grant execute on function public.hq_geography_opportunities(uuid,uuid,uuid,uuid,integer,integer) to authenticated;

create or replace function public.hq_map_school_points(p_county_id uuid default null,p_subcounty_id uuid default null,p_ward_id uuid default null,p_limit integer default 2000)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from (select s.id school_id,s.name,sg.latitude,sg.longitude,sg.verification_state,sg.location_precision,c.official_name county,sc.official_name subcounty,w.official_name ward from public.school_geography sg join public.schools s on s.id=sg.school_id and s.deleted_at is null left join public.geo_counties c on c.id=sg.county_id left join public.geo_subcounties sc on sc.id=sg.subcounty_id left join public.geo_wards w on w.id=sg.ward_id where sg.latitude is not null and sg.longitude is not null and sg.verification_state='verified' and sg.location_precision in ('exact','campus','locality') and (p_county_id is null or sg.county_id=p_county_id) and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id) and (p_ward_id is null or sg.ward_id=p_ward_id) limit greatest(1,least(coalesce(p_limit,2000),5000))) x),'[]'::jsonb);
end;
$$;
revoke all on function public.hq_map_school_points(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.hq_map_school_points(uuid,uuid,uuid,integer) to authenticated;

commit;
