-- HQ Schools Network OS analytical read models.
-- Bounded, owner-authorized and read-only. No source-of-truth duplication.

create or replace function public.hq_school_network_trend(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := greatest(7, least(coalesce(p_days,30),365));
begin
  perform public.hq_assert_owner();
  return (
    with connected as (
      select s.id school_id,min(sm.joined_at)::date first_connected
      from public.schools s
      join public.school_members sm on sm.school_id=s.id
      where s.deleted_at is null
      group by s.id
    ), days as (
      select generate_series(current_date-(v_days-1),current_date,interval '1 day')::date as bucket_date
    ), event_daily as (
      select pe.occurred_at::date as bucket_date,
             count(distinct pe.school_id)::int active_schools,
             count(distinct pe.actor_id) filter(where pe.actor_id is not null)::int active_users
      from public.platform_events pe
      join connected c on c.school_id=pe.school_id
      where pe.occurred_at>=current_date-(v_days-1)
        and pe.occurred_at<current_date+1
      group by pe.occurred_at::date
    )
    select jsonb_build_object(
      'window_days',v_days,
      'series',jsonb_agg(jsonb_build_object(
        'date',d.bucket_date,
        'connected_schools',(select count(*)::int from connected c where c.first_connected<=d.bucket_date),
        'active_schools',coalesce(e.active_schools,0),
        'active_users',coalesce(e.active_users,0)
      ) order by d.bucket_date),
      'semantics',jsonb_build_object(
        'connected_schools','cumulative canonical schools from first school_members joined_at',
        'active_schools','connected schools with school-scoped platform_events on that date',
        'active_users','distinct platform_event actors in connected schools on that date'
      ),
      'generated_at',clock_timestamp()
    )
    from days d left join event_daily e on e.bucket_date=d.bucket_date
  );
end;
$$;
revoke all on function public.hq_school_network_trend(integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_trend(integer) to authenticated;

create or replace function public.hq_school_network_county_detail(p_county text,p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_county text:=nullif(trim(p_county),'');
begin
  perform public.hq_assert_owner();
  if v_county is null then raise exception 'county_required'; end if;
  return (
    with scoped_schools as (
      select s.id
      from public.schools s
      where s.deleted_at is null and lower(trim(coalesce(s.county,'')))=lower(v_county)
    ), linked_profiles as (
      select distinct sm.profile_id,sm.school_id,sm.role::text role
      from public.school_members sm join scoped_schools s on s.id=sm.school_id
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
    ), direct_orders as (
      select distinct o.id,o.amount_kes
      from public.learning_product_orders o join scoped_schools s on s.id=o.beneficiary_school_id
      where o.paid_at is not null and o.refunded_at is null
    ), linked_orders as (
      select distinct o.id,o.amount_kes
      from public.learning_product_orders o
      where o.paid_at is not null and o.refunded_at is null
        and (o.purchaser_profile_id in(select profile_id from linked_profiles) or o.beneficiary_profile_id in(select profile_id from linked_profiles))
    ), attributed as (
      select id,amount_kes from direct_orders union select id,amount_kes from linked_orders
    ), identity_gap as (
      select count(*)::int n from public.school_identity_candidates c join public.schools_directory d on d.id=c.directory_school_id where c.status='pending' and lower(trim(coalesce(d.county,'')))=lower(v_county)
    )
    select jsonb_build_object(
      'county',v_county,
      'window_days',v_days,
      'people',jsonb_build_object(
        'linked_profiles',(select count(distinct profile_id)::int from linked_profiles),
        'teachers',(select n from teachers),
        'learners',(select n from learners),
        'parents',(select n from parents),
        'admins',(select count(distinct profile_id)::int from linked_profiles where role ilike '%admin%')
      ),
      'activity',jsonb_build_object(
        'active_schools',(select active_schools from activity),
        'active_users',(select active_users from activity),
        'events',(select events from activity),
        'previous_active_users',(select active_users from previous_activity),
        'active_user_change_pct',case when coalesce((select active_users from previous_activity),0)=0 then null else round(((select active_users from activity)-(select active_users from previous_activity))::numeric*100/(select active_users from previous_activity),1) end
      ),
      'revenue',jsonb_build_object(
        'currency','KES','attributed_paid_orders',(select count(*)::int from attributed),'attributed_paid_kes',(select coalesce(sum(amount_kes),0)::bigint from attributed),
        'institution_paid_claimable',false
      ),
      'data_quality',jsonb_build_object('pending_identity_candidates',(select n from identity_gap)),
      'generated_at',clock_timestamp()
    )
  );
end;
$$;
revoke all on function public.hq_school_network_county_detail(text,integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_county_detail(text,integer) to authenticated;

create or replace function public.hq_school_network_school_learning(p_school_id uuid,p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
begin
  perform public.hq_assert_owner();
  if not exists(select 1 from public.schools where id=p_school_id and deleted_at is null) then raise exception 'school_not_found'; end if;
  return (
    with teaching as (
      select count(*)::int occurrences,
             count(*) filter(where lifecycle='completed' or completed_at is not null)::int completed,
             count(distinct teacher_id)::int active_teachers
      from public.teaching_occurrences
      where school_id=p_school_id and occurrence_date>=current_date-(v_days-1)
    ), attendance as (
      select count(*)::int marks,count(distinct student_id)::int learners_seen,count(distinct teacher_id)::int teachers_marking
      from public.attendance where school_id=p_school_id and date>=current_date-(v_days-1)
    ), homework as (
      select count(*)::int created,count(distinct teacher_id)::int teachers
      from public.homework where school_id=p_school_id and created_at>=clock_timestamp()-make_interval(days=>v_days)
    ), submissions as (
      select count(*)::int submitted,count(distinct hs.student_id)::int learners
      from public.homework_submissions hs join public.homework h on h.id=hs.homework_id
      where h.school_id=p_school_id and hs.submitted_at>=clock_timestamp()-make_interval(days=>v_days)
    ), assessments as (
      select count(*)::int attempts,count(*) filter(where submitted_at is not null)::int submitted,count(distinct student_id)::int learners
      from public.assessment_attempts where school_id=p_school_id and created_at>=clock_timestamp()-make_interval(days=>v_days)
    ), products as (
      select
        exists(select 1 from teaching where occurrences>0) teacher_os,
        exists(select 1 from attendance where marks>0) attendance_used,
        exists(select 1 from homework where created>0) homework_used,
        exists(select 1 from assessments where attempts>0) assessments_used
    )
    select jsonb_build_object(
      'window_days',v_days,
      'teaching',jsonb_build_object('occurrences',(select occurrences from teaching),'completed',(select completed from teaching),'active_teachers',(select active_teachers from teaching)),
      'attendance',jsonb_build_object('marks',(select marks from attendance),'learners_seen',(select learners_seen from attendance),'teachers_marking',(select teachers_marking from attendance)),
      'homework',jsonb_build_object('created',(select created from homework),'teachers',(select teachers from homework),'submissions',(select submitted from submissions),'submitting_learners',(select learners from submissions)),
      'assessments',jsonb_build_object('attempts',(select attempts from assessments),'submitted',(select submitted from assessments),'learners',(select learners from assessments)),
      'adoption',jsonb_build_object('teacher_os',(select teacher_os from products),'attendance',(select attendance_used from products),'homework',(select homework_used from products),'assessments',(select assessments_used from products)),
      'semantics',jsonb_build_object('usage_only',true,'learning_outcome_claimed',false,'retention_claimed',false),
      'generated_at',clock_timestamp()
    )
  );
end;
$$;
revoke all on function public.hq_school_network_school_learning(uuid,integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_school_learning(uuid,integer) to authenticated;

-- Tighten the network funnel: an Active school must first be Connected.
create or replace function public.hq_school_network_overview(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_days integer:=greatest(1,least(coalesce(p_days,30),365));
begin
  perform public.hq_assert_owner();
  return (
    with counties(name,sort_order) as (values ('Baringo',1),('Bomet',2),('Bungoma',3),('Busia',4),('Elgeyo-Marakwet',5),('Embu',6),('Garissa',7),('Homa Bay',8),('Isiolo',9),('Kajiado',10),('Kakamega',11),('Kericho',12),('Kiambu',13),('Kilifi',14),('Kirinyaga',15),('Kisii',16),('Kisumu',17),('Kitui',18),('Kwale',19),('Laikipia',20),('Lamu',21),('Machakos',22),('Makueni',23),('Mandera',24),('Marsabit',25),('Meru',26),('Migori',27),('Mombasa',28),('Murang''a',29),('Nairobi',30),('Nakuru',31),('Nandi',32),('Narok',33),('Nyamira',34),('Nyandarua',35),('Nyeri',36),('Samburu',37),('Siaya',38),('Taita-Taveta',39),('Tana River',40),('Tharaka-Nithi',41),('Trans Nzoia',42),('Turkana',43),('Uasin Gishu',44),('Vihiga',45),('Wajir',46),('West Pokot',47)),
    directory as (select regexp_replace(upper(trim(coalesce(county,''))),'[^A-Z0-9]+','','g') county_key,count(*)::int known_schools from public.schools_directory group by 1),
    canonical as (select regexp_replace(upper(trim(coalesce(county,''))),'[^A-Z0-9]+','','g') county_key,count(*) filter(where deleted_at is null)::int canonical_schools from public.schools group by 1),
    connected as (select s.id school_id,regexp_replace(upper(trim(coalesce(s.county,''))),'[^A-Z0-9]+','','g') county_key from public.schools s where s.deleted_at is null and exists(select 1 from public.school_members sm where sm.school_id=s.id)),
    active_school as (select distinct pe.school_id from public.platform_events pe join connected c on c.school_id=pe.school_id where pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)),
    active_people as (select count(distinct pe.actor_id)::int n from public.platform_events pe join connected c on c.school_id=pe.school_id where pe.actor_id is not null and pe.occurred_at>=clock_timestamp()-make_interval(days=>v_days)),
    county_rows as (select c.name,c.sort_order,coalesce(d.known_schools,0) known_schools,coalesce(k.canonical_schools,0) canonical_schools,count(distinct cn.school_id)::int connected_schools,count(distinct cn.school_id) filter(where a.school_id is not null)::int active_schools from counties c left join directory d on d.county_key=regexp_replace(upper(c.name),'[^A-Z0-9]+','','g') left join canonical k on k.county_key=regexp_replace(upper(c.name),'[^A-Z0-9]+','','g') left join connected cn on cn.county_key=regexp_replace(upper(c.name),'[^A-Z0-9]+','','g') left join active_school a on a.school_id=cn.school_id group by c.name,c.sort_order,d.known_schools,k.canonical_schools),
    risk as (select count(*)::int n from (select s.id from public.schools s left join lateral(select count(distinct sc.student_id)::int n from public.student_classes sc where sc.school_id=s.id and sc.is_current) l on true left join lateral(select count(distinct tc.teacher_id)::int n from public.teacher_classes tc where tc.school_id=s.id)t on true where s.deleted_at is null and coalesce(l.n,0)>0 and coalesce(t.n,0)=0)x)
    select jsonb_build_object('country',jsonb_build_object('code','KE','name','Kenya','administrative_regions',47),'window_days',v_days,'network',jsonb_build_object('known_schools',(select count(*)::int from public.schools_directory),'canonical_schools',(select count(*)::int from public.schools where deleted_at is null),'connected_schools',(select count(*)::int from connected),'active_schools',(select count(*)::int from active_school),'linked_users',(select count(distinct sm.profile_id)::int from public.school_members sm join connected c on c.school_id=sm.school_id),'active_users',(select n from active_people),'attention_schools',(select n from risk)),'counties',(select jsonb_agg(jsonb_build_object('name',name,'known_schools',known_schools,'canonical_schools',canonical_schools,'connected_schools',connected_schools,'active_schools',active_schools) order by sort_order) from county_rows),'semantics',jsonb_build_object('known_schools','schools_directory records; not canonical institutions','canonical_schools','non-deleted public.schools rows','connected_schools','canonical schools with at least one school_members relationship','active_schools','connected schools with school-scoped platform_events in selected window','unknown_is_zero',false),'generated_at',clock_timestamp())
  );
end;
$$;
revoke all on function public.hq_school_network_overview(integer) from public, anon, authenticated;
grant execute on function public.hq_school_network_overview(integer) to authenticated;
