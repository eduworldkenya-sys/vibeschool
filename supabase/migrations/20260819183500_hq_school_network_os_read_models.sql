-- HQ Schools Network Operating System read models.
-- Read-only, owner-authorized, fail-closed. Reuses canonical school/user/activity/commerce sources.

create or replace function public.hq_school_network_overview(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  perform public.hq_assert_owner();

  return (
    with counties(name, sort_order) as (
      values
        ('Baringo',1),('Bomet',2),('Bungoma',3),('Busia',4),('Elgeyo-Marakwet',5),('Embu',6),('Garissa',7),('Homa Bay',8),('Isiolo',9),('Kajiado',10),('Kakamega',11),('Kericho',12),('Kiambu',13),('Kilifi',14),('Kirinyaga',15),('Kisii',16),('Kisumu',17),('Kitui',18),('Kwale',19),('Laikipia',20),('Lamu',21),('Machakos',22),('Makueni',23),('Mandera',24),('Marsabit',25),('Meru',26),('Migori',27),('Mombasa',28),('Murang''a',29),('Nairobi',30),('Nakuru',31),('Nandi',32),('Narok',33),('Nyamira',34),('Nyandarua',35),('Nyeri',36),('Samburu',37),('Siaya',38),('Taita-Taveta',39),('Tana River',40),('Tharaka-Nithi',41),('Trans Nzoia',42),('Turkana',43),('Uasin Gishu',44),('Vihiga',45),('Wajir',46),('West Pokot',47)
    ),
    directory as (
      select regexp_replace(upper(trim(coalesce(county,''))), '[^A-Z0-9]+', '', 'g') county_key,
             count(*)::int known_schools
      from public.schools_directory
      group by 1
    ),
    canonical as (
      select regexp_replace(upper(trim(coalesce(county,''))), '[^A-Z0-9]+', '', 'g') county_key,
             count(*) filter (where deleted_at is null)::int canonical_schools,
             count(*) filter (where deleted_at is null and status::text='active')::int active_canonical
      from public.schools
      group by 1
    ),
    connected as (
      select s.id school_id,
             regexp_replace(upper(trim(coalesce(s.county,''))), '[^A-Z0-9]+', '', 'g') county_key
      from public.schools s
      where s.deleted_at is null
        and exists (select 1 from public.school_members sm where sm.school_id=s.id)
    ),
    active_school as (
      select distinct pe.school_id
      from public.platform_events pe
      where pe.school_id is not null
        and pe.occurred_at >= clock_timestamp() - make_interval(days => v_days)
    ),
    county_rows as (
      select c.name,
             c.sort_order,
             coalesce(d.known_schools,0) known_schools,
             coalesce(k.canonical_schools,0) canonical_schools,
             count(distinct cn.school_id)::int connected_schools,
             count(distinct cn.school_id) filter (where a.school_id is not null)::int active_schools
      from counties c
      left join directory d on d.county_key=regexp_replace(upper(c.name),'[^A-Z0-9]+','','g')
      left join canonical k on k.county_key=regexp_replace(upper(c.name),'[^A-Z0-9]+','','g')
      left join connected cn on cn.county_key=regexp_replace(upper(c.name),'[^A-Z0-9]+','','g')
      left join active_school a on a.school_id=cn.school_id
      group by c.name,c.sort_order,d.known_schools,k.canonical_schools
    ),
    linked_people as (
      select count(distinct sm.profile_id)::int linked_users from public.school_members sm
    ),
    active_people as (
      select count(distinct pe.actor_id)::int active_users
      from public.platform_events pe
      where pe.school_id is not null and pe.actor_id is not null
        and pe.occurred_at >= clock_timestamp() - make_interval(days => v_days)
    ),
    risk as (
      select count(*)::int attention_schools
      from (
        select s.id
        from public.schools s
        left join lateral (select count(distinct sc.student_id)::int n from public.student_classes sc where sc.school_id=s.id and sc.is_current) learners on true
        left join lateral (select count(distinct tc.teacher_id)::int n from public.teacher_classes tc where tc.school_id=s.id) teachers on true
        where s.deleted_at is null
          and coalesce(learners.n,0)>0
          and coalesce(teachers.n,0)=0
      ) x
    )
    select jsonb_build_object(
      'country', jsonb_build_object('code','KE','name','Kenya','administrative_regions',47),
      'window_days',v_days,
      'network', jsonb_build_object(
        'known_schools',(select count(*)::int from public.schools_directory),
        'canonical_schools',(select count(*)::int from public.schools where deleted_at is null),
        'connected_schools',(select count(*)::int from connected),
        'active_schools',(select count(*)::int from active_school a join public.schools s on s.id=a.school_id and s.deleted_at is null),
        'linked_users',(select linked_users from linked_people),
        'active_users',(select active_users from active_people),
        'attention_schools',(select attention_schools from risk)
      ),
      'counties',(select jsonb_agg(jsonb_build_object(
          'name',name,
          'known_schools',known_schools,
          'canonical_schools',canonical_schools,
          'connected_schools',connected_schools,
          'active_schools',active_schools
        ) order by sort_order) from county_rows),
      'semantics',jsonb_build_object(
        'known_schools','schools_directory records; not canonical institutions',
        'canonical_schools','non-deleted public.schools rows',
        'connected_schools','canonical schools with at least one school_members relationship',
        'active_schools','canonical schools with school-scoped platform_events in the selected window',
        'unknown_is_zero',false
      ),
      'generated_at',clock_timestamp()
    )
  );
end;
$$;

revoke all on function public.hq_school_network_overview(integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_overview(integer) to authenticated;

create or replace function public.hq_school_network_school_360(p_school_id uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days,30),365));
  v_school public.schools%rowtype;
begin
  perform public.hq_assert_owner();

  select * into v_school from public.schools where id=p_school_id and deleted_at is null;
  if not found then raise exception 'school_not_found'; end if;

  return (
    with current_learners as (
      select count(distinct sc.student_id)::int n from public.student_classes sc where sc.school_id=p_school_id and sc.is_current
    ), teachers as (
      select count(distinct tc.teacher_id)::int n from public.teacher_classes tc where tc.school_id=p_school_id
    ), members as (
      select count(distinct sm.profile_id)::int total,
             count(distinct sm.profile_id) filter (where sm.role::text ilike '%admin%')::int admins,
             count(distinct sm.profile_id) filter (where sm.role::text ilike '%teacher%')::int member_teachers
      from public.school_members sm where sm.school_id=p_school_id
    ), parents as (
      select count(distinct psl.parent_id)::int n from public.parent_student_links psl where psl.school_id=p_school_id
    ), activity as (
      select count(*)::int events,
             count(distinct pe.actor_id)::int active_users,
             max(pe.occurred_at) last_activity
      from public.platform_events pe
      where pe.school_id=p_school_id
        and pe.occurred_at >= clock_timestamp()-make_interval(days=>v_days)
    ), support as (
      select count(*) filter (where status not in ('resolved','closed'))::int open_cases
      from public.hq_support_cases where school_id=p_school_id
    ), direct_orders as (
      select count(*)::int paid_orders,
             coalesce(sum(amount_kes),0)::bigint paid_kes,
             max(paid_at) last_paid_at
      from public.learning_product_orders
      where beneficiary_school_id=p_school_id and paid_at is not null and refunded_at is null
    ), linked_profiles as (
      select distinct profile_id from public.school_members where school_id=p_school_id
    ), linked_orders as (
      select count(distinct o.id)::int paid_orders,
             coalesce(sum(o.amount_kes),0)::bigint paid_kes,
             max(o.paid_at) last_paid_at
      from public.learning_product_orders o
      where o.paid_at is not null and o.refunded_at is null
        and (o.purchaser_profile_id in (select profile_id from linked_profiles)
          or o.beneficiary_profile_id in (select profile_id from linked_profiles))
    ), all_attributed_orders as (
      select distinct o.id,o.amount_kes,o.paid_at
      from public.learning_product_orders o
      where o.paid_at is not null and o.refunded_at is null
        and (o.beneficiary_school_id=p_school_id
          or o.purchaser_profile_id in (select profile_id from linked_profiles)
          or o.beneficiary_profile_id in (select profile_id from linked_profiles))
    ), attributed as (
      select count(*)::int paid_orders,coalesce(sum(amount_kes),0)::bigint paid_kes,max(paid_at) last_paid_at from all_attributed_orders
    ), entitlements as (
      select count(*)::int total,
             count(*) filter (where status='active' and revoked_at is null and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp()))::int active
      from public.learning_product_entitlements e
      where e.school_id=p_school_id or e.profile_id in (select profile_id from linked_profiles)
    )
    select jsonb_build_object(
      'identity',jsonb_build_object(
        'id',v_school.id,'name',v_school.name,'status',v_school.status::text,
        'knec_code',v_school.knec_code,'nemis_code',v_school.nemis_code,'moe_registration_no',v_school.moe_registration_no,'tsc_code',v_school.tsc_code,
        'school_type',v_school.school_type,'school_category',v_school.school_category,'ownership_type',v_school.ownership_type,
        'accommodation_type',v_school.accommodation_type,'gender_type',v_school.gender_type,'directory_source',v_school.directory_source,
        'directory_source_ref',v_school.directory_source_ref,'last_verified_at',v_school.last_verified_at
      ),
      'location',jsonb_build_object(
        'country_code',coalesce(v_school.country_code,'KE'),'county',v_school.county,'sub_county',v_school.sub_county,'ward',v_school.ward,
        'latitude',v_school.gps_lat,'longitude',v_school.gps_lng,'precision',v_school.location_precision,'postal_address',v_school.postal_address
      ),
      'population',jsonb_build_object(
        'reported_students',null,'reported_staff',null,
        'linked_learners',(select n from current_learners),
        'linked_teachers',greatest((select n from teachers),(select member_teachers from members)),
        'linked_admins',(select admins from members),
        'linked_parents',(select n from parents),
        'linked_profiles',(select total from members),
        'penetration_claimable',false
      ),
      'activity',jsonb_build_object(
        'window_days',v_days,'events',(select events from activity),'active_users',(select active_users from activity),'last_activity',(select last_activity from activity)
      ),
      'revenue',jsonb_build_object(
        'currency','KES',
        'school_attributed_orders',jsonb_build_object('paid_orders',(select paid_orders from direct_orders),'paid_kes',(select paid_kes from direct_orders),'last_paid_at',(select last_paid_at from direct_orders)),
        'linked_user_orders',jsonb_build_object('paid_orders',(select paid_orders from linked_orders),'paid_kes',(select paid_kes from linked_orders),'last_paid_at',(select last_paid_at from linked_orders)),
        'combined_unique_attribution',jsonb_build_object('paid_orders',(select paid_orders from attributed),'paid_kes',(select paid_kes from attributed),'last_paid_at',(select last_paid_at from attributed)),
        'institution_paid_claimable',false,
        'note','School-attributed and linked-user revenue are relationship attribution, not proof that the institution itself paid.'
      ),
      'entitlements',jsonb_build_object('total',(select total from entitlements),'active',(select active from entitlements)),
      'operations',jsonb_build_object('open_support_cases',(select open_cases from support)),
      'provenance',jsonb_build_object(
        'school','public.schools','people','school_members + teacher_classes + student_classes + parent_student_links',
        'activity','platform_events','revenue','learning_product_orders','entitlements','learning_product_entitlements'
      ),
      'generated_at',clock_timestamp()
    )
  );
end;
$$;

revoke all on function public.hq_school_network_school_360(uuid,integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_school_360(uuid,integer) to authenticated;

-- Restore browser execution for existing owner-gated School Identity operations.
-- Authorization remains inside each SECURITY DEFINER function via is_platform_owner().
revoke all on function public.hq_list_school_identity_queue(text,integer) from public, anon;
grant execute on function public.hq_list_school_identity_queue(text,integer) to authenticated;
revoke all on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) from public, anon;
grant execute on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) to authenticated;
revoke all on function public.hq_resolve_school_discovery_request(uuid,text,uuid,text,text,text) from public, anon;
grant execute on function public.hq_resolve_school_discovery_request(uuid,text,uuid,text,text,text) to authenticated;
revoke all on function public.hq_school_identity_coverage_by_county() from public, anon;
grant execute on function public.hq_school_identity_coverage_by_county() to authenticated;
