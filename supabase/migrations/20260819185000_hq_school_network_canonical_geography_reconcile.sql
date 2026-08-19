begin;

-- Canonical Kenya county seed for the governed #306 geography dimension.
-- Source authority: Constitution of Kenya 2010, Article 6(1), First Schedule.
-- This seeds only country/county identity. It does not infer school geography,
-- sub-counties, wards, coordinates, or promote legacy school text to verified authority.
insert into public.geo_countries (
  iso2, official_name, normalized_name, status, source_key, source_version, verification_state
)
values (
  'KE', 'Kenya', 'kenya', 'active',
  'kenya_constitution_2010_first_schedule',
  'Constitution of Kenya 2010 Article 6(1) First Schedule',
  'verified'
)
on conflict (iso2) do update set
  official_name=excluded.official_name,
  normalized_name=excluded.normalized_name,
  status=excluded.status,
  source_key=excluded.source_key,
  source_version=excluded.source_version,
  verification_state=excluded.verification_state,
  updated_at=now();

with kenya as (
  select id from public.geo_countries where iso2='KE'
), counties(official_code,official_name) as (
  values
    ('001','Mombasa'),('002','Kwale'),('003','Kilifi'),('004','Tana River'),('005','Lamu'),('006','Taita/Taveta'),
    ('007','Garissa'),('008','Wajir'),('009','Mandera'),('010','Marsabit'),('011','Isiolo'),('012','Meru'),
    ('013','Tharaka-Nithi'),('014','Embu'),('015','Kitui'),('016','Machakos'),('017','Makueni'),('018','Nyandarua'),
    ('019','Nyeri'),('020','Kirinyaga'),('021','Murang''a'),('022','Kiambu'),('023','Turkana'),('024','West Pokot'),
    ('025','Samburu'),('026','Trans Nzoia'),('027','Uasin Gishu'),('028','Elgeyo/Marakwet'),('029','Nandi'),('030','Baringo'),
    ('031','Laikipia'),('032','Nakuru'),('033','Narok'),('034','Kajiado'),('035','Kericho'),('036','Bomet'),
    ('037','Kakamega'),('038','Vihiga'),('039','Bungoma'),('040','Busia'),('041','Siaya'),('042','Kisumu'),
    ('043','Homa Bay'),('044','Migori'),('045','Kisii'),('046','Nyamira'),('047','Nairobi City')
)
insert into public.geo_counties (
  country_id, official_code, official_name, normalized_name, status,
  source_key, source_version, verification_state
)
select k.id,c.official_code,c.official_name,
       lower(regexp_replace(c.official_name,'[^A-Za-z0-9]+','','g')),
       'active','kenya_constitution_2010_first_schedule',
       'Constitution of Kenya 2010 Article 6(1) First Schedule','verified'
from kenya k cross join counties c
on conflict (country_id,official_code) do update set
  official_name=excluded.official_name,
  normalized_name=excluded.normalized_name,
  status=excluded.status,
  source_key=excluded.source_key,
  source_version=excluded.source_version,
  verification_state=excluded.verification_state,
  updated_at=now();

-- National network summary: canonical county identity comes only from geo_counties.
-- Discovery-directory county text is retained as unverified discovery evidence and
-- may contribute only to known_schools, never to canonical/connected/active geography.
create or replace function public.hq_school_network_overview(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
begin
  perform public.hq_assert_owner();
  return (
    with kenya as (
      select id from public.geo_countries where iso2='KE' and status='active'
    ), counties as (
      select c.id,c.official_code,c.official_name,c.normalized_name,c.verification_state
      from public.geo_counties c join kenya k on k.id=c.country_id
      where c.status='active'
    ), canonical as (
      select sg.school_id,sg.county_id,sg.verification_state
      from public.school_geography sg
      join public.schools s on s.id=sg.school_id and s.deleted_at is null
      where sg.county_id is not null
    ), connected as (
      select distinct c.school_id,c.county_id
      from canonical c
      where exists(select 1 from public.school_members sm where sm.school_id=c.school_id)
    ), active as (
      select distinct c.school_id,c.county_id
      from connected c join public.platform_events pe on pe.school_id=c.school_id
      where pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)
    ), directory as (
      select lower(regexp_replace(trim(coalesce(d.county,'')),'[^A-Za-z0-9]+','','g')) county_key,
             count(*)::int known_schools
      from public.schools_directory d
      group by 1
    ), county_rows as (
      select c.official_code code,c.official_name name,c.verification_state,
             coalesce(d.known_schools,0)::int known_schools,
             count(distinct ca.school_id)::int canonical_schools,
             count(distinct cn.school_id)::int connected_schools,
             count(distinct ac.school_id)::int active_schools,
             count(distinct ca.school_id) filter(where ca.verification_state='verified')::int verified_school_geography,
             count(distinct ca.school_id) filter(where ca.verification_state in ('inferred','unresolved','conflicting'))::int nonverified_school_geography
      from counties c
      left join directory d on d.county_key=c.normalized_name
      left join canonical ca on ca.county_id=c.id
      left join connected cn on cn.county_id=c.id and cn.school_id=ca.school_id
      left join active ac on ac.county_id=c.id and ac.school_id=ca.school_id
      group by c.official_code,c.official_name,c.verification_state,d.known_schools
    ), unmapped as (
      select count(*)::int n
      from public.schools s left join public.school_geography sg on sg.school_id=s.id
      where s.deleted_at is null and (sg.school_id is null or sg.county_id is null)
    ), active_people as (
      select count(distinct pe.actor_id)::int n
      from public.platform_events pe join connected c on c.school_id=pe.school_id
      where pe.actor_id is not null and pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)
    ), attention as (
      select count(*)::int n from (
        select s.id
        from public.schools s
        left join lateral(select count(distinct sc.student_id)::int n from public.student_classes sc where sc.school_id=s.id and sc.is_current) l on true
        left join lateral(select count(distinct tc.teacher_id)::int n from public.teacher_classes tc where tc.school_id=s.id) t on true
        where s.deleted_at is null and coalesce(l.n,0)>0 and coalesce(t.n,0)=0
      ) x
    )
    select jsonb_build_object(
      'country',jsonb_build_object(
        'code','KE','name','Kenya','administrative_regions',(select count(*)::int from counties),
        'source','Constitution of Kenya 2010 Article 6(1) First Schedule'
      ),
      'window_days',v_days,
      'network',jsonb_build_object(
        'known_schools',(select count(*)::int from public.schools_directory),
        'canonical_schools',(select count(*)::int from public.schools s where s.deleted_at is null),
        'geographically_mapped_schools',(select count(distinct school_id)::int from canonical),
        'unmapped_canonical_schools',(select n from unmapped),
        'connected_schools',(select count(distinct school_id)::int from connected),
        'active_schools',(select count(distinct school_id)::int from active),
        'linked_users',(select count(distinct sm.profile_id)::int from public.school_members sm join connected c on c.school_id=sm.school_id),
        'active_users',(select n from active_people),
        'attention_schools',(select n from attention)
      ),
      'counties',coalesce((select jsonb_agg(to_jsonb(cr) order by cr.code) from county_rows cr),'[]'::jsonb),
      'semantics',jsonb_build_object(
        'known_schools','schools_directory discovery records; county text is unverified discovery evidence',
        'canonical_schools','all non-deleted public.schools rows regardless of geographic completeness',
        'geographically_mapped_schools','canonical schools mapped through public.school_geography to governed county IDs',
        'connected_schools','geographically mapped canonical schools with school_members relationships',
        'active_schools','connected geographically mapped schools with school-scoped platform_events in selected window',
        'unknown_is_zero',false
      ),
      'generated_at',clock_timestamp()
    )
  );
end;
$$;
revoke all on function public.hq_school_network_overview(integer) from public,anon,authenticated;
grant execute on function public.hq_school_network_overview(integer) to authenticated;

-- County detail accepts a display name for UI compatibility, but resolves that name
-- to exactly one governed county ID before any canonical school aggregation.
create or replace function public.hq_school_network_county_detail(p_county text,p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_county text:=nullif(trim(p_county),'');
  v_county_id uuid;
  v_county_name text;
begin
  perform public.hq_assert_owner();
  if v_county is null then raise exception 'county_required'; end if;

  select c.id,c.official_name into v_county_id,v_county_name
  from public.geo_counties c join public.geo_countries g on g.id=c.country_id
  where g.iso2='KE' and c.status='active'
    and c.normalized_name=lower(regexp_replace(v_county,'[^A-Za-z0-9]+','','g'));
  if v_county_id is null then raise exception 'unknown_canonical_county'; end if;

  return (
    with scoped_schools as (
      select sg.school_id id
      from public.school_geography sg join public.schools s on s.id=sg.school_id and s.deleted_at is null
      where sg.county_id=v_county_id
    ), linked_profiles as (
      select distinct sm.profile_id,sm.school_id,sm.role::text role from public.school_members sm join scoped_schools s on s.id=sm.school_id
    ), learners as (
      select count(distinct sc.student_id)::int n from public.student_classes sc join scoped_schools s on s.id=sc.school_id where sc.is_current
    ), teachers as (
      select count(distinct tc.teacher_id)::int n from public.teacher_classes tc join scoped_schools s on s.id=tc.school_id
    ), parents as (
      select count(distinct psl.parent_id)::int n from public.parent_student_links psl join scoped_schools s on s.id=psl.school_id
    ), activity as (
      select count(distinct pe.school_id)::int active_schools,count(distinct pe.actor_id)::int active_users,count(*)::int events
      from public.platform_events pe join scoped_schools s on s.id=pe.school_id
      where pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)
    ), previous_activity as (
      select count(distinct pe.actor_id)::int active_users
      from public.platform_events pe join scoped_schools s on s.id=pe.school_id
      where pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days*2)
        and pe.occurred_at<clock_timestamp()-make_interval(days=>v_days)
    ), discovery_gap as (
      select count(*)::int n from public.school_identity_candidates c
      join public.schools_directory d on d.id=c.directory_school_id
      where c.status='pending'
        and lower(regexp_replace(trim(coalesce(d.county,'')),'[^A-Za-z0-9]+','','g'))=(select normalized_name from public.geo_counties where id=v_county_id)
    )
    select jsonb_build_object(
      'county',v_county_name,'county_id',v_county_id,'window_days',v_days,
      'school_count',(select count(*)::int from scoped_schools),
      'people',jsonb_build_object(
        'linked_profiles',(select count(distinct profile_id)::int from linked_profiles),
        'teachers',(select n from teachers),'learners',(select n from learners),'parents',(select n from parents),
        'admins',(select count(distinct profile_id)::int from linked_profiles where role ilike '%admin%')
      ),
      'activity',jsonb_build_object(
        'active_schools',(select active_schools from activity),'active_users',(select active_users from activity),'events',(select events from activity),
        'previous_active_users',(select active_users from previous_activity),
        'active_user_change_pct',case when coalesce((select active_users from previous_activity),0)=0 then null else round(((select active_users from activity)-(select active_users from previous_activity))::numeric*100/(select active_users from previous_activity),1) end
      ),
      'data_quality',jsonb_build_object('pending_identity_candidates',(select n from discovery_gap)),
      'semantics',jsonb_build_object('school_scope','public.school_geography county_id','discovery_county_text','unverified matching only; never canonical authority'),
      'generated_at',clock_timestamp()
    )
  );
end;
$$;
revoke all on function public.hq_school_network_county_detail(text,integer) from public,anon,authenticated;
grant execute on function public.hq_school_network_county_detail(text,integer) to authenticated;

-- School 360 location consumes governed school_geography first. Legacy school text is
-- returned only as fallback evidence with an explicit unresolved verification state.
create or replace function public.hq_school_network_school_360(p_school_id uuid,p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_school public.schools%rowtype;
begin
  perform public.hq_assert_owner();
  select * into v_school from public.schools where id=p_school_id and deleted_at is null;
  if not found then raise exception 'school_not_found'; end if;
  return (
    with geo as (
      select sg.*,g.iso2,c.official_name county_name,sc.official_name subcounty_name,w.official_name ward_name
      from public.school_geography sg
      left join public.geo_countries g on g.id=sg.country_id
      left join public.geo_counties c on c.id=sg.county_id
      left join public.geo_subcounties sc on sc.id=sg.subcounty_id
      left join public.geo_wards w on w.id=sg.ward_id
      where sg.school_id=p_school_id
    ), members as (
      select count(distinct sm.profile_id)::int total,
             count(distinct sm.profile_id) filter(where sm.role::text ilike '%admin%')::int admins,
             count(distinct sm.profile_id) filter(where sm.role::text ilike '%teacher%')::int member_teachers
      from public.school_members sm where sm.school_id=p_school_id
    ), current_learners as (select count(distinct student_id)::int n from public.student_classes where school_id=p_school_id and is_current),
    teachers as (select count(distinct teacher_id)::int n from public.teacher_classes where school_id=p_school_id),
    parents as (select count(distinct parent_id)::int n from public.parent_student_links where school_id=p_school_id),
    activity as (
      select count(*)::int events,count(distinct actor_id)::int active_users,max(occurred_at) last_activity
      from public.platform_events where school_id=p_school_id and occurred_at>=clock_timestamp()-make_interval(days=>v_days)
    ), support as (select count(*) filter(where status not in ('resolved','closed'))::int open_cases from public.hq_support_cases where school_id=p_school_id),
    direct_orders as (
      select count(*)::int paid_orders,coalesce(sum(amount_kes),0)::bigint paid_kes,max(paid_at) last_paid_at
      from public.learning_product_orders where beneficiary_school_id=p_school_id and paid_at is not null and refunded_at is null
    ), linked_profiles as (select distinct profile_id from public.school_members where school_id=p_school_id),
    linked_orders as (
      select count(distinct o.id)::int paid_orders,coalesce(sum(o.amount_kes),0)::bigint paid_kes,max(o.paid_at) last_paid_at
      from public.learning_product_orders o where o.paid_at is not null and o.refunded_at is null
        and (o.purchaser_profile_id in(select profile_id from linked_profiles) or o.beneficiary_profile_id in(select profile_id from linked_profiles))
    ), attributed_orders as (
      select distinct o.id,o.amount_kes,o.paid_at from public.learning_product_orders o
      where o.paid_at is not null and o.refunded_at is null
        and (o.beneficiary_school_id=p_school_id or o.purchaser_profile_id in(select profile_id from linked_profiles) or o.beneficiary_profile_id in(select profile_id from linked_profiles))
    ), attributed as (select count(*)::int paid_orders,coalesce(sum(amount_kes),0)::bigint paid_kes,max(paid_at) last_paid_at from attributed_orders),
    entitlements as (
      select count(*)::int total,count(*) filter(where status='active' and revoked_at is null and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp()))::int active
      from public.learning_product_entitlements e where e.school_id=p_school_id or e.profile_id in(select profile_id from linked_profiles)
    )
    select jsonb_build_object(
      'identity',jsonb_build_object(
        'id',v_school.id,'name',v_school.name,'status',v_school.status::text,'knec_code',v_school.knec_code,'nemis_code',v_school.nemis_code,
        'moe_registration_no',v_school.moe_registration_no,'tsc_code',v_school.tsc_code,'school_type',v_school.school_type,'school_category',v_school.school_category,
        'ownership_type',v_school.ownership_type,'accommodation_type',v_school.accommodation_type,'gender_type',v_school.gender_type,
        'directory_source',v_school.directory_source,'directory_source_ref',v_school.directory_source_ref,'last_verified_at',v_school.last_verified_at
      ),
      'location',coalesce((select jsonb_build_object(
        'country_code',coalesce(iso2,v_school.country_code),'county',county_name,'sub_county',subcounty_name,'ward',ward_name,
        'latitude',latitude,'longitude',longitude,'precision',location_precision,'postal_address',v_school.postal_address,
        'verification_state',verification_state,'source_key',source_key,'source_ref',source_ref,'last_verified_at',last_verified_at
      ) from geo),jsonb_build_object(
        'country_code',coalesce(v_school.country_code,'KE'),'county',v_school.county,'sub_county',v_school.sub_county,'ward',v_school.ward,
        'latitude',null,'longitude',null,'precision',null,'postal_address',v_school.postal_address,
        'verification_state','unresolved','source_key',null,'source_ref',null,'last_verified_at',null
      )),
      'population',jsonb_build_object(
        'reported_students',null,'reported_staff',null,'linked_learners',(select n from current_learners),
        'linked_teachers',greatest((select n from teachers),(select member_teachers from members)),'linked_admins',(select admins from members),
        'linked_parents',(select n from parents),'linked_profiles',(select total from members),'penetration_claimable',false
      ),
      'activity',jsonb_build_object('window_days',v_days,'events',(select events from activity),'active_users',(select active_users from activity),'last_activity',(select last_activity from activity)),
      'revenue',jsonb_build_object(
        'currency','KES','school_attributed_orders',jsonb_build_object('paid_orders',(select paid_orders from direct_orders),'paid_kes',(select paid_kes from direct_orders),'last_paid_at',(select last_paid_at from direct_orders)),
        'linked_user_orders',jsonb_build_object('paid_orders',(select paid_orders from linked_orders),'paid_kes',(select paid_kes from linked_orders),'last_paid_at',(select last_paid_at from linked_orders)),
        'combined_unique_attribution',jsonb_build_object('paid_orders',(select paid_orders from attributed),'paid_kes',(select paid_kes from attributed),'last_paid_at',(select last_paid_at from attributed)),
        'institution_paid_claimable',false,'note','Relationship attribution is not proof that the institution itself paid.'
      ),
      'entitlements',jsonb_build_object('total',(select total from entitlements),'active',(select active from entitlements)),
      'operations',jsonb_build_object('open_support_cases',(select open_cases from support)),
      'provenance',jsonb_build_object('school','public.schools','geography','public.school_geography + governed geo dimensions','people','canonical school relationships','activity','platform_events','revenue','learning_product_orders'),
      'generated_at',clock_timestamp()
    )
  );
end;
$$;
revoke all on function public.hq_school_network_school_360(uuid,integer) from public,anon,authenticated;
grant execute on function public.hq_school_network_school_360(uuid,integer) to authenticated;

-- Canonical explorer and attention scope by governed county identity when a county
-- filter is supplied. Unmapped schools remain discoverable only when no county scope
-- is requested; this prevents text-only legacy geography from silently becoming authority.
create or replace function public.hq_school_network_explorer(
  p_state text default 'canonical',p_county text default null,p_query text default null,
  p_days integer default 30,p_offset integer default 0,p_limit integer default 50
)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_state text:=lower(coalesce(nullif(trim(p_state),''),'canonical')); v_county text:=nullif(trim(p_county),'');
  v_query text:=lower(nullif(trim(p_query),'')); v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_offset integer:=greatest(0,coalesce(p_offset,0)); v_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); v_county_id uuid;
begin
  perform public.hq_assert_owner();
  if v_state not in ('known','canonical','connected','active') then raise exception 'invalid_school_network_state'; end if;
  if v_county is not null then
    select c.id into v_county_id from public.geo_counties c join public.geo_countries g on g.id=c.country_id
    where g.iso2='KE' and c.status='active' and c.normalized_name=lower(regexp_replace(v_county,'[^A-Za-z0-9]+','','g'));
    if v_county_id is null then raise exception 'unknown_canonical_county'; end if;
  end if;
  if v_state='known' then
    return (with base as (
      select d.id,d.name,d.county,d.sub_county,d.knec_code,'DIRECTORY'::text source,null::int linked_users,null::int active_users
      from public.schools_directory d where lower(coalesce(d.status,'active'))<>'closed'
        and (v_county is null or lower(regexp_replace(trim(coalesce(d.county,'')),'[^A-Za-z0-9]+','','g'))=(select normalized_name from public.geo_counties where id=v_county_id))
        and (v_query is null or lower(d.name) like '%'||v_query||'%' or lower(coalesce(d.knec_code,''))=v_query)
    ), page as (select * from base order by name,id offset v_offset limit v_limit)
    select jsonb_build_object('state',v_state,'total',(select count(*)::int from base),'offset',v_offset,'limit',v_limit,'rows',coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),'geography_semantics','directory county text is discovery-only','generated_at',clock_timestamp()));
  end if;
  return (with base as (
    select s.id,s.name,coalesce(gc.official_name,s.county) county,coalesce(gs.official_name,s.sub_county) sub_county,s.knec_code,'CANONICAL'::text source,
      coalesce(sg.verification_state,'unresolved') geography_state,
      (select count(distinct sm.profile_id)::int from public.school_members sm where sm.school_id=s.id) linked_users,
      (select count(distinct pe.actor_id)::int from public.platform_events pe where pe.school_id=s.id and pe.actor_id is not null and pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)) active_users,
      exists(select 1 from public.school_members sm where sm.school_id=s.id) connected,
      exists(select 1 from public.platform_events pe where pe.school_id=s.id and pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)) active
    from public.schools s left join public.school_geography sg on sg.school_id=s.id
    left join public.geo_counties gc on gc.id=sg.county_id left join public.geo_subcounties gs on gs.id=sg.subcounty_id
    where s.deleted_at is null and (v_county_id is null or sg.county_id=v_county_id)
      and (v_query is null or lower(s.name) like '%'||v_query||'%' or lower(coalesce(s.knec_code,''))=v_query or lower(coalesce(s.nemis_code,''))=v_query)
  ), filtered as (
    select id,name,county,sub_county,knec_code,source,geography_state,linked_users,active_users from base
    where v_state='canonical' or (v_state='connected' and connected) or (v_state='active' and connected and active)
  ), page as (select * from filtered order by name,id offset v_offset limit v_limit)
  select jsonb_build_object('state',v_state,'total',(select count(*)::int from filtered),'offset',v_offset,'limit',v_limit,'rows',coalesce((select jsonb_agg(to_jsonb(page) order by name,id) from page),'[]'::jsonb),'generated_at',clock_timestamp()));
end;
$$;
revoke all on function public.hq_school_network_explorer(text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.hq_school_network_explorer(text,text,text,integer,integer,integer) to authenticated;

create or replace function public.hq_school_network_attention(p_county text default null,p_days integer default 30,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_county text:=nullif(trim(p_county),''); v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); v_county_id uuid;
begin
  perform public.hq_assert_owner();
  if v_county is not null then
    select c.id into v_county_id from public.geo_counties c join public.geo_countries g on g.id=c.country_id
    where g.iso2='KE' and c.status='active' and c.normalized_name=lower(regexp_replace(v_county,'[^A-Za-z0-9]+','','g'));
    if v_county_id is null then raise exception 'unknown_canonical_county'; end if;
  end if;
  return (with school_evidence as (
    select s.id,s.name,coalesce(gc.official_name,s.county) county,coalesce(sg.verification_state,'unresolved') geography_state,
      (select count(distinct sc.student_id)::int from public.student_classes sc where sc.school_id=s.id and sc.is_current) learners,
      (select count(distinct tc.teacher_id)::int from public.teacher_classes tc where tc.school_id=s.id) teachers,
      (select count(*)::int from public.attendance a where a.school_id=s.id and a.date>=current_date-(least(v_days,7)-1)) attendance_marks,
      (select count(*)::int from public.homework h where h.school_id=s.id and h.created_at>=clock_timestamp()-make_interval(days=>least(v_days,7))) homework_created,
      (select count(*)::int from public.hq_support_cases x where x.school_id=s.id and x.status not in ('resolved','closed')) open_support,
      (select max(pe.occurred_at) from public.platform_events pe where pe.school_id=s.id) last_activity
    from public.schools s left join public.school_geography sg on sg.school_id=s.id left join public.geo_counties gc on gc.id=sg.county_id
    where s.deleted_at is null and (v_county_id is null or sg.county_id=v_county_id)
  ), signals as (
    select *,array_remove(array[
      case when learners>0 and teachers=0 then 'learners_without_teacher_assignment' end,
      case when learners>0 and attendance_marks=0 then 'no_attendance_evidence_7d' end,
      case when learners>0 and homework_created=0 then 'no_homework_created_7d' end,
      case when open_support>0 then 'open_support_cases' end,
      case when last_activity is not null and last_activity<clock_timestamp()-make_interval(days=>v_days) then 'inactive_in_selected_window' end,
      case when geography_state in ('unresolved','conflicting') then 'geography_requires_review' end
    ],null) reasons from school_evidence
  ), ranked as (
    select id school_id,name school_name,county,geography_state,reasons,cardinality(reasons)::int signal_count,last_activity,open_support
    from signals where cardinality(reasons)>0 order by cardinality(reasons) desc,open_support desc,name limit v_limit
  )
  select jsonb_build_object('county',v_county,'county_id',v_county_id,'window_days',v_days,'items',coalesce((select jsonb_agg(to_jsonb(ranked) order by signal_count desc,school_name) from ranked),'[]'::jsonb),'generated_at',clock_timestamp()));
end;
$$;
revoke all on function public.hq_school_network_attention(text,integer,integer) from public,anon,authenticated;
grant execute on function public.hq_school_network_attention(text,integer,integer) to authenticated;

commit;
