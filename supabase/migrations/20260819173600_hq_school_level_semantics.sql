begin;

create or replace function public.hq_school_explorer_list(
  p_country_id uuid default null,
  p_county_id uuid default null,
  p_subcounty_id uuid default null,
  p_ward_id uuid default null,
  p_school_level text default null,
  p_search text default null,
  p_days integer default 30,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_days integer := greatest(1,least(coalesce(p_days,30),365));
  v_limit integer := greatest(1,least(coalesce(p_limit,100),500));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_level text := case upper(btrim(coalesce(p_school_level,'')))
    when '' then null
    when 'JUNIOR SCHOOL' then 'JUNIOR'
    when 'SECONDARY' then 'SENIOR_SECONDARY'
    when 'SENIOR SCHOOL' then 'SENIOR_SECONDARY'
    else upper(btrim(coalesce(p_school_level,'')))
  end;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.active_users desc,x.name)
    from (
      select s.id,
             s.name,
             (select min(sl.level) from public.school_levels sl where sl.school_id=s.id) as school_type,
             s.school_type as institution_type,
             s.school_category as institution_category,
             coalesce((select jsonb_agg(sl.level order by sl.level) from public.school_levels sl where sl.school_id=s.id),'[]'::jsonb) as levels,
             s.knec_code,
             s.nemis_code,
             s.status,
             coalesce(sg.verification_state,'unresolved') as geography_state,
             gco.official_name as county,
             gsc.official_name as subcounty,
             gw.official_name as ward,
             (sg.latitude is not null and sg.longitude is not null) as has_coordinates,
             (select count(distinct sc.student_id) from public.student_classes sc where sc.school_id=s.id and sc.is_current=true)::bigint as learners,
             (select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=s.id and sm.role::text='teacher')::bigint as teachers,
             (select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=s.id and pe.actor_id is not null and pe.occurred_at>=now()-(v_days||' days')::interval)::bigint as active_users,
             (select count(*) from public.hq_support_cases c where c.school_id=s.id and c.status not in ('resolved','closed'))::bigint as open_support_cases
      from public.schools s
      left join public.school_geography sg on sg.school_id=s.id
      left join public.geo_counties gco on gco.id=sg.county_id
      left join public.geo_subcounties gsc on gsc.id=sg.subcounty_id
      left join public.geo_wards gw on gw.id=sg.ward_id
      where s.deleted_at is null
        and (p_country_id is null or sg.country_id=p_country_id)
        and (p_county_id is null or sg.county_id=p_county_id)
        and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id)
        and (p_ward_id is null or sg.ward_id=p_ward_id)
        and (
          v_level is null
          or (v_level='UNKNOWN' and not exists(select 1 from public.school_levels sl where sl.school_id=s.id))
          or exists(select 1 from public.school_levels sl where sl.school_id=s.id and upper(sl.level)=v_level)
        )
        and (
          v_search is null
          or s.name ilike '%'||v_search||'%'
          or s.knec_code ilike '%'||v_search||'%'
          or s.nemis_code ilike '%'||v_search||'%'
          or exists(select 1 from public.school_aliases a where a.school_id=s.id and a.alias ilike '%'||v_search||'%')
        )
      limit v_limit
    ) x
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.hq_school_explorer_list(uuid,uuid,uuid,uuid,text,text,integer,integer) from public,anon;
grant execute on function public.hq_school_explorer_list(uuid,uuid,uuid,uuid,text,text,integer,integer) to authenticated;

commit;
