begin;

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
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;
  if p_parent_type not in ('country','county','subcounty') then
    raise exception 'invalid_parent_type';
  end if;

  if p_parent_type='country' then
    return coalesce((
      with school_rollup as (
        select c.id,c.official_name as name,
               count(s.id)::bigint as school_count,
               count(s.id) filter(where sg.verification_state='verified')::bigint as verified_school_count
        from public.geo_counties c
        left join public.school_geography sg on sg.county_id=c.id
        left join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where (p_parent_id is null or c.country_id=p_parent_id) and c.status='active'
        group by c.id,c.official_name
      ), event_rollup as (
        select sg.county_id as id,count(distinct pe.school_id)::bigint as active_school_count
        from public.school_geography sg
        join public.schools s on s.id=sg.school_id and s.deleted_at is null
        join public.platform_events pe on pe.school_id=s.id
        where pe.occurred_at>=now()-(v_days||' days')::interval
        group by sg.county_id
      )
      select jsonb_agg(jsonb_build_object('id',sr.id,'name',sr.name,'school_count',sr.school_count,'verified_school_count',sr.verified_school_count,'active_school_count',coalesce(er.active_school_count,0)) order by sr.school_count desc,sr.name)
      from school_rollup sr left join event_rollup er using(id)
    ),'[]'::jsonb);
  elsif p_parent_type='county' then
    return coalesce((
      with school_rollup as (
        select sc.id,sc.official_name as name,
               count(s.id)::bigint as school_count,
               count(s.id) filter(where sg.verification_state='verified')::bigint as verified_school_count
        from public.geo_subcounties sc
        left join public.school_geography sg on sg.subcounty_id=sc.id
        left join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where sc.county_id=p_parent_id and sc.status='active'
        group by sc.id,sc.official_name
      ), event_rollup as (
        select sg.subcounty_id as id,count(distinct pe.school_id)::bigint as active_school_count
        from public.school_geography sg
        join public.schools s on s.id=sg.school_id and s.deleted_at is null
        join public.platform_events pe on pe.school_id=s.id
        where sg.county_id=p_parent_id and pe.occurred_at>=now()-(v_days||' days')::interval
        group by sg.subcounty_id
      )
      select jsonb_agg(jsonb_build_object('id',sr.id,'name',sr.name,'school_count',sr.school_count,'verified_school_count',sr.verified_school_count,'active_school_count',coalesce(er.active_school_count,0)) order by sr.school_count desc,sr.name)
      from school_rollup sr left join event_rollup er using(id)
    ),'[]'::jsonb);
  else
    return coalesce((
      with school_rollup as (
        select w.id,w.official_name as name,
               count(s.id)::bigint as school_count,
               count(s.id) filter(where sg.verification_state='verified')::bigint as verified_school_count
        from public.geo_wards w
        left join public.school_geography sg on sg.ward_id=w.id
        left join public.schools s on s.id=sg.school_id and s.deleted_at is null
        where w.subcounty_id=p_parent_id and w.status='active'
        group by w.id,w.official_name
      ), event_rollup as (
        select sg.ward_id as id,count(distinct pe.school_id)::bigint as active_school_count
        from public.school_geography sg
        join public.schools s on s.id=sg.school_id and s.deleted_at is null
        join public.platform_events pe on pe.school_id=s.id
        where sg.subcounty_id=p_parent_id and pe.occurred_at>=now()-(v_days||' days')::interval
        group by sg.ward_id
      )
      select jsonb_agg(jsonb_build_object('id',sr.id,'name',sr.name,'school_count',sr.school_count,'verified_school_count',sr.verified_school_count,'active_school_count',coalesce(er.active_school_count,0)) order by sr.school_count desc,sr.name)
      from school_rollup sr left join event_rollup er using(id)
    ),'[]'::jsonb);
  end if;
end;
$$;

revoke all on function public.hq_geography_region_breakdown(text,uuid,integer) from public,anon;
grant execute on function public.hq_geography_region_breakdown(text,uuid,integer) to authenticated;

commit;
