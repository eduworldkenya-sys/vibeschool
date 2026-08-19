begin;

create or replace function public.hq_school_360(
  p_school_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_days integer := greatest(1,least(coalesce(p_days,30),365));
  v_school public.schools%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  select * into v_school
  from public.schools s
  where s.id=p_school_id and s.deleted_at is null;

  if not found then
    raise exception 'school_not_found';
  end if;

  return jsonb_build_object(
    'identity',jsonb_build_object(
      'id',v_school.id,
      'name',v_school.name,
      'school_type',(select min(sl.level) from public.school_levels sl where sl.school_id=p_school_id),
      'levels',coalesce((select jsonb_agg(sl.level order by sl.level) from public.school_levels sl where sl.school_id=p_school_id),'[]'::jsonb),
      'institution_type',v_school.school_type,
      'school_category',v_school.school_category,
      'knec_code',v_school.knec_code,
      'nemis_code',v_school.nemis_code,
      'moe_registration_no',v_school.moe_registration_no,
      'status',v_school.status,
      'directory_source',v_school.directory_source,
      'directory_source_ref',v_school.directory_source_ref,
      'last_verified_at',v_school.last_verified_at,
      'aliases',coalesce((
        select jsonb_agg(to_jsonb(a) order by a.verified desc,a.alias)
        from (
          select sa.alias,sa.verified,sa.source
          from public.school_aliases sa
          where sa.school_id=p_school_id
          order by sa.verified desc,sa.alias
          limit 50
        ) a
      ),'[]'::jsonb)
    ),
    'geography',coalesce((
      select jsonb_build_object(
        'country',coalesce(gc.official_name,v_school.country_code),
        'county',coalesce(gco.official_name,v_school.county),
        'subcounty',coalesce(gsc.official_name,v_school.sub_county),
        'ward',coalesce(gw.official_name,v_school.ward),
        'latitude',sg.latitude,
        'longitude',sg.longitude,
        'location_precision',sg.location_precision,
        'verification_state',sg.verification_state,
        'source_key',sg.source_key,
        'source_ref',sg.source_ref,
        'last_verified_at',sg.last_verified_at
      )
      from public.school_geography sg
      left join public.geo_countries gc on gc.id=sg.country_id
      left join public.geo_counties gco on gco.id=sg.county_id
      left join public.geo_subcounties gsc on gsc.id=sg.subcounty_id
      left join public.geo_wards gw on gw.id=sg.ward_id
      where sg.school_id=p_school_id
    ),jsonb_build_object(
      'country',v_school.country_code,
      'county',v_school.county,
      'subcounty',v_school.sub_county,
      'ward',v_school.ward,
      'latitude',null,
      'longitude',null,
      'location_precision',null,
      'verification_state','unresolved',
      'source_key',null,
      'source_ref',null,
      'last_verified_at',null
    )),
    'community',jsonb_build_object(
      'students',(select count(distinct sc.student_id) from public.student_classes sc where sc.school_id=p_school_id and sc.is_current=true),
      'teachers',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=p_school_id and sm.role::text='teacher'),
      'parents',(select count(distinct psl.parent_id) from public.parent_student_links psl where psl.school_id=p_school_id),
      'admins',(select count(distinct sm.profile_id) from public.school_members sm where sm.school_id=p_school_id and sm.role::text in ('admin','owner','school_admin')),
      'membership_rows',(select count(*) from public.school_members sm where sm.school_id=p_school_id)
    ),
    'engagement',jsonb_build_object(
      'window_days',v_days,
      'event_count',(select count(*) from public.platform_events pe where pe.school_id=p_school_id and pe.occurred_at>=now()-(v_days||' days')::interval),
      'active_users',(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=p_school_id and pe.actor_id is not null and pe.occurred_at>=now()-(v_days||' days')::interval),
      'active_teachers',(select count(distinct pe.actor_id) from public.platform_events pe where pe.school_id=p_school_id and pe.actor_id is not null and pe.actor_role::text='teacher' and pe.occurred_at>=now()-(v_days||' days')::interval),
      'evidence',case when exists(select 1 from public.platform_events pe where pe.school_id=p_school_id) then 'available' else 'insufficient_evidence' end
    ),
    'operations',jsonb_build_object(
      'open_support_cases',(select count(*) from public.hq_support_cases c where c.school_id=p_school_id and c.status not in ('resolved','closed')),
      'open_identity_reviews',(select count(*) from public.school_identity_review_queue q where q.canonical_school_id=p_school_id and q.resolved_at is null),
      'open_incidents',(select count(*) from public.hq_incidents i where i.status<>'resolved' and i.evidence->>'school_id'=p_school_id::text)
    ),
    'privacy',jsonb_build_object('mode','aggregate_first','residential_geography_inferred',false),
    'freshness',jsonb_build_object('generated_at',now())
  );
end;
$$;
revoke all on function public.hq_school_360(uuid,integer) from public,anon;
grant execute on function public.hq_school_360(uuid,integer) to authenticated;

commit;
