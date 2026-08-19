begin;

-- This migration extends the isolated HQ geographic foundation with bounded,
-- owner-authorized analytical read models. It does not mutate canonical school,
-- user, membership, identity, telemetry, or measurement truth.

create or replace function public.hq_geography_region_breakdown(
  p_parent_type text,
  p_parent_id uuid default null,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_days integer := greatest(1,least(coalesce(p_days,30),365));
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  if p_parent_type not in ('country','county','subcounty') then raise exception 'invalid_parent_type'; end if;

  if p_parent_type='country' then
    return coalesce((
      with school_rollup as (
        select c.id,c.official_name as name,count(sg.school_id)::bigint as school_count,count(sg.school_id) filter(where sg.verification_state='verified')::bigint as verified_school_count
        from public.geo_counties c left join public.school_geography sg on sg.county_id=c.id left join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where (p_parent_id is null or c.country_id=p_parent_id) and c.status='active' group by c.id,c.official_name
      ), event_rollup as (
        select sg.county_id as id,count(distinct pe.school_id)::bigint as active_school_count
        from public.school_geography sg join public.platform_events pe on pe.school_id=sg.school_id join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where pe.occurred_at>=now()-(v_days||' days')::interval group by sg.county_id
      )
      select jsonb_agg(jsonb_build_object('id',sr.id,'name',sr.name,'school_count',sr.school_count,'verified_school_count',sr.verified_school_count,'active_school_count',coalesce(er.active_school_count,0)) order by sr.school_count desc,sr.name)
      from school_rollup sr left join event_rollup er using(id)
    ),'[]'::jsonb);
  elsif p_parent_type='county' then
    return coalesce((
      with school_rollup as (
        select sc.id,sc.official_name as name,count(sg.school_id)::bigint as school_count,count(sg.school_id) filter(where sg.verification_state='verified')::bigint as verified_school_count
        from public.geo_subcounties sc left join public.school_geography sg on sg.subcounty_id=sc.id left join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where sc.county_id=p_parent_id and sc.status='active' group by sc.id,sc.official_name
      ), event_rollup as (
        select sg.subcounty_id as id,count(distinct pe.school_id)::bigint as active_school_count
        from public.school_geography sg join public.platform_events pe on pe.school_id=sg.school_id join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where sg.county_id=p_parent_id and pe.occurred_at>=now()-(v_days||' days')::interval group by sg.subcounty_id
      )
      select jsonb_agg(jsonb_build_object('id',sr.id,'name',sr.name,'school_count',sr.school_count,'verified_school_count',sr.verified_school_count,'active_school_count',coalesce(er.active_school_count,0)) order by sr.school_count desc,sr.name)
      from school_rollup sr left join event_rollup er using(id)
    ),'[]'::jsonb);
  else
    return coalesce((
      with school_rollup as (
        select w.id,w.official_name as name,count(sg.school_id)::bigint as school_count,count(sg.school_id) filter(where sg.verification_state='verified')::bigint as verified_school_count
        from public.geo_wards w left join public.school_geography sg on sg.ward_id=w.id left join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where w.subcounty_id=p_parent_id and w.status='active' group by w.id,w.official_name
      ), event_rollup as (
        select sg.ward_id as id,count(distinct pe.school_id)::bigint as active_school_count
        from public.school_geography sg join public.platform_events pe on pe.school_id=sg.school_id join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where sg.subcounty_id=p_parent_id and pe.occurred_at>=now()-(v_days||' days')::interval group by sg.ward_id
      )
      select jsonb_agg(jsonb_build_object('id',sr.id,'name',sr.name,'school_count',sr.school_count,'verified_school_count',sr.verified_school_count,'active_school_count',coalesce(er.active_school_count,0)) order by sr.school_count desc,sr.name)
      from school_rollup sr left join event_rollup er using(id)
    ),'[]'::jsonb);
  end if;
end;
$$;
revoke all on function public.hq_geography_region_breakdown(text,uuid,integer) from public,anon;
grant execute on function public.hq_geography_region_breakdown(text,uuid,integer) to authenticated;

create or replace function public.hq_school_360(p_school_id uuid,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer := greatest(1,least(coalesce(p_days,30),365)); v_school public.schools%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  select * into v_school from public.schools s where s.id=p_school_id and s.deleted_at is null;
  if not found then raise exception 'school_not_found'; end if;
  return jsonb_build_object(
    'identity',jsonb_build_object('id',v_school.id,'name',v_school.name,'knec_code',v_school.knec_code,'nemis_code',v_school.nemis_code,'moe_registration_no',v_school.moe_registration_no,'status',v_school.status,'school_type',v_school.school_type,'school_category',v_school.school_category,'directory_source',v_school.directory_source,'directory_source_ref',v_school.directory_source_ref,'last_verified_at',v_school.last_verified_at,'aliases',coalesce((select jsonb_agg(jsonb_build_object('alias',a.alias,'verified',a.verified,'source',a.source) order by a.verified desc,a.alias) from public.school_aliases a where a.school_id=p_school_id),'[]'::jsonb)),
    'geography',coalesce((select jsonb_build_object('country',coalesce(gc.official_name,v_school.country_code),'county',coalesce(gco.official_name,v_school.county),'subcounty',coalesce(gsc.official_name,v_school.sub_county),'ward',coalesce(gw.official_name,v_school.ward),'latitude',sg.latitude,'longitude',sg.longitude,'location_precision',sg.location_precision,'verification_state',sg.verification_state,'source_key',sg.source_key,'source_ref',sg.source_ref,'last_verified_at',sg.last_verified_at) from public.school_geography sg left join public.geo_countries gc on gc.id=sg.country_id left join public.geo_counties gco on gco.id=sg.county_id left join public.geo_subcounties gsc on gsc.id=sg.subcounty_id left join public.geo_wards gw on gw.id=sg.ward_id where sg.school_id=p_school_id),jsonb_build_object('country',v_school.country_code,'county',v_school.county,'subcounty',v_school.sub_county,'ward',v_school.ward,'latitude',null,'longitude',null,'location_precision',null,'verification_state','unresolved','source_key',null,'source_ref',null,'last_verified_at',null)),
    'community',jsonb_build_object('students',(select count(distinct sc.student_id) from public.student_classes sc where sc.school_id=p_school_id and sc.is_current=true),'teachers',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=p_school_id and sm.role::text='teacher'),'parents',(select count(distinct psl.parent_id) from public.parent_student_links psl where psl.school_id=p_school_id),'admins',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=p_school_id and sm.role::text in ('admin','owner')),'membership_rows',(select count(*) from public.school_members sm where sm.school_id=p_school_id)),
    'engagement',jsonb_build_object('window_days',v_days,'event_count',(select count(*) from public.platform_events pe where pe.school_id=p_school_id and pe.occurred_at>=now()-(v_days||' days')::interval),'active_users',(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=p_school_id and pe.actor_id is not null and pe.occurred_at>=now()-(v_days||' days')::interval),'active_teachers',(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=p_school_id and pe.actor_id is not null and pe.actor_role::text='teacher' and pe.occurred_at>=now()-(v_days||' days')::interval),'evidence',case when exists(select 1 from public.platform_events pe where pe.school_id=p_school_id) then 'available' else 'insufficient_evidence' end),
    'operations',jsonb_build_object('open_support_cases',(select count(*) from public.hq_support_cases c where c.school_id=p_school_id and c.status not in ('resolved','closed')),'open_identity_reviews',(select count(*) from public.school_identity_review_queue q where q.canonical_school_id=p_school_id and q.resolved_at is null),'open_incidents',(select count(*) from public.hq_incidents i where i.status<>'resolved' and i.evidence->>'school_id'=p_school_id::text)),
    'privacy',jsonb_build_object('mode','aggregate_first','residential_geography_inferred',false),'freshness',jsonb_build_object('generated_at',now())
  );
end;
$$;
revoke all on function public.hq_school_360(uuid,integer) from public,anon;
grant execute on function public.hq_school_360(uuid,integer) to authenticated;

create or replace function public.hq_growth_intelligence(p_country_id uuid default null,p_county_id uuid default null,p_subcounty_id uuid default null,p_ward_id uuid default null,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer := greatest(1,least(coalesce(p_days,30),365));
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return (with scope_schools as (select s.id from public.schools s left join public.school_geography sg on sg.school_id=s.id where s.deleted_at is null and (p_country_id is null or sg.country_id=p_country_id) and (p_county_id is null or sg.county_id=p_county_id) and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id) and (p_ward_id is null or sg.ward_id=p_ward_id)), linked_people as (select sm.profile_id from public.school_members sm join scope_schools ss on ss.id=sm.school_id union select st.profile_id from public.student_classes sc join scope_schools ss on ss.id=sc.school_id join public.students st on st.id=sc.student_id where sc.is_current=true and st.profile_id is not null union select psl.parent_id from public.parent_student_links psl join scope_schools ss on ss.id=psl.school_id), current_activity as (select distinct pe.actor_id from public.platform_events pe join scope_schools ss on ss.id=pe.school_id where pe.actor_id is not null and pe.occurred_at>=now()-(v_days||' days')::interval), previous_activity as (select distinct pe.actor_id from public.platform_events pe join scope_schools ss on ss.id=pe.school_id where pe.actor_id is not null and pe.occurred_at<now()-(v_days||' days')::interval and pe.occurred_at>=now()-(v_days*2||' days')::interval) select jsonb_build_object('window_days',v_days,'institution_linked_unique_people',(select count(*) from linked_people),'new_linked_users',(select count(*) from linked_people lp join public.profiles p on p.id=lp.profile_id where p.created_at>=now()-(v_days||' days')::interval),'active_users',(select count(*) from current_activity),'returning_users',(select count(*) from current_activity ca join previous_activity pa using(actor_id)),'new_schools',(select count(*) from scope_schools ss join public.schools s on s.id=ss.id where s.created_at>=now()-(v_days||' days')::interval),'measurement',jsonb_build_object('certified_from',(select certified_from from public.product_measurement_state where singleton=true limit 1),'session_kernel_available',exists(select 1 from public.product_account_sessions limit 1),'retention_state','not_calculated_here'),'semantics',jsonb_build_object('people','unique profile/account identities linked through canonical institutional relationships','activity','distinct platform_events.actor_id in scoped schools','residential_geography_inferred',false),'generated_at',now()));
end;
$$;
revoke all on function public.hq_growth_intelligence(uuid,uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.hq_growth_intelligence(uuid,uuid,uuid,uuid,integer) to authenticated;

create or replace function public.hq_geographic_opportunities(p_country_id uuid default null,p_county_id uuid default null,p_subcounty_id uuid default null,p_ward_id uuid default null,p_days integer default 30,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_days integer := greatest(1,least(coalesce(p_days,30),365)); v_limit integer := greatest(1,least(coalesce(p_limit,100),500));
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  return coalesce((with scope_schools as (select s.id,s.name,sg.verification_state,gco.official_name as county,gsc.official_name as subcounty,gw.official_name as ward from public.schools s left join public.school_geography sg on sg.school_id=s.id left join public.geo_counties gco on gco.id=sg.county_id left join public.geo_subcounties gsc on gsc.id=sg.subcounty_id left join public.geo_wards gw on gw.id=sg.ward_id where s.deleted_at is null and (p_country_id is null or sg.country_id=p_country_id) and (p_county_id is null or sg.county_id=p_county_id) and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id) and (p_ward_id is null or sg.ward_id=p_ward_id)), evidence as (select ss.*,(select count(distinct sc.student_id) from public.student_classes sc where sc.school_id=ss.id and sc.is_current=true) as learners,(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=ss.id and sm.role::text='teacher') as teachers,(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=ss.id and pe.actor_id is not null and pe.actor_role::text='teacher' and pe.occurred_at>=now()-(v_days||' days')::interval) as active_teachers from scope_schools ss), signals as (select 'teacher_activation'::text as signal_type,id as school_id,name as school_name,county,subcounty,ward,'attention'::text as state,jsonb_build_object('learners',learners,'teachers',teachers,'active_teachers',active_teachers,'window_days',v_days) as evidence,'Inspect school onboarding and teacher activation.'::text as recommended_investigation from evidence where learners>0 and active_teachers=0 union all select 'geography_gap',id,name,county,subcounty,ward,'unknown'::text,jsonb_build_object('verification_state',coalesce(verification_state,'unmapped')),'Inspect school identity/geography evidence; do not auto-repair ambiguous geography.'::text from evidence where verification_state is null or verification_state in ('unresolved','conflicting')) select jsonb_agg(jsonb_build_object('signal_type',signal_type,'school_id',school_id,'school_name',school_name,'county',county,'subcounty',subcounty,'ward',ward,'state',state,'evidence',evidence,'recommended_investigation',recommended_investigation) order by signal_type,school_name) from (select * from signals limit v_limit) x),'[]'::jsonb);
end;
$$;
revoke all on function public.hq_geographic_opportunities(uuid,uuid,uuid,uuid,integer,integer) from public,anon;
grant execute on function public.hq_geographic_opportunities(uuid,uuid,uuid,uuid,integer,integer) to authenticated;

commit;
