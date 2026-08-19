begin;

create or replace function public.hq_growth_intelligence(
  p_country_id uuid default null,
  p_county_id uuid default null,
  p_subcounty_id uuid default null,
  p_ward_id uuid default null,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_days integer := greatest(1,least(coalesce(p_days,30),365));
  v_measurement_certified_from timestamptz := null;
  v_session_kernel_available boolean := false;
  v_measurement_contract_state text := 'upstream_contract_unavailable';
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  -- Measurement Kernel is an upstream-owned contract. Production may contain it before
  -- repository main does, so consume it only when present rather than making this
  -- migration depend on an unmerged migration or fabricating historical retention.
  if to_regclass('public.product_measurement_state') is not null then
    execute 'select certified_from from public.product_measurement_state where singleton=true limit 1'
      into v_measurement_certified_from;
    v_measurement_contract_state := case when v_measurement_certified_from is null then 'present_uncertified' else 'certified' end;
  end if;
  if to_regclass('public.product_account_sessions') is not null then
    v_session_kernel_available := true;
  end if;

  return (
    with scope_schools as (
      select s.id
      from public.schools s
      left join public.school_geography sg on sg.school_id=s.id
      where s.deleted_at is null
        and (p_country_id is null or sg.country_id=p_country_id)
        and (p_county_id is null or sg.county_id=p_county_id)
        and (p_subcounty_id is null or sg.subcounty_id=p_subcounty_id)
        and (p_ward_id is null or sg.ward_id=p_ward_id)
    ), linked_people as (
      select sm.profile_id from public.school_members sm join scope_schools ss on ss.id=sm.school_id
      union
      select st.profile_id from public.student_classes sc join scope_schools ss on ss.id=sc.school_id join public.students st on st.id=sc.student_id where sc.is_current=true and st.profile_id is not null
      union
      select psl.parent_id from public.parent_student_links psl join scope_schools ss on ss.id=psl.school_id
    ), current_activity as (
      select distinct pe.actor_id
      from public.platform_events pe join scope_schools ss on ss.id=pe.school_id
      where pe.actor_id is not null and pe.occurred_at>=now()-(v_days||' days')::interval
    ), previous_activity as (
      select distinct pe.actor_id
      from public.platform_events pe join scope_schools ss on ss.id=pe.school_id
      where pe.actor_id is not null
        and pe.occurred_at<now()-(v_days||' days')::interval
        and pe.occurred_at>=now()-(v_days*2||' days')::interval
    )
    select jsonb_build_object(
      'window_days',v_days,
      'institution_linked_unique_people',(select count(*) from linked_people),
      'new_linked_users',(select count(*) from linked_people lp join public.profiles p on p.id=lp.profile_id where p.created_at>=now()-(v_days||' days')::interval),
      'active_users',(select count(*) from current_activity),
      'returning_users',(select count(*) from current_activity ca join previous_activity pa using(actor_id)),
      'new_schools',(select count(*) from scope_schools ss join public.schools s on s.id=ss.id where s.created_at>=now()-(v_days||' days')::interval),
      'measurement',jsonb_build_object(
        'contract_state',v_measurement_contract_state,
        'certified_from',v_measurement_certified_from,
        'session_kernel_available',v_session_kernel_available,
        'retention_state','not_calculated_here'
      ),
      'semantics',jsonb_build_object(
        'people','unique profile/account identities linked through canonical institutional relationships',
        'activity','distinct platform_events.actor_id in scoped schools; not a substitute for certified retention',
        'returning_users','active in both selected window and immediately preceding equivalent window; not D1/D7/D30 retention',
        'residential_geography_inferred',false
      ),
      'generated_at',now()
    )
  );
end;
$$;

revoke all on function public.hq_growth_intelligence(uuid,uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.hq_growth_intelligence(uuid,uuid,uuid,uuid,integer) to authenticated;

commit;
