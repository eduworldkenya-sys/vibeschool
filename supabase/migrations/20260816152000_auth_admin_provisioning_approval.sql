begin;

create or replace function public.create_school_with_admin(
  p_user_id uuid,
  p_full_name text,
  p_school_name text,
  p_subdomain text,
  p_county text default null,
  p_sub_county text default null,
  p_ward text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_knec_code text default null,
  p_nemis_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_existing uuid;
  v_existing_count integer;
  v_name_norm text;
  v_county_norm text;
  v_subcounty_norm text;
  v_uid uuid := auth.uid();
  v_recent integer;
begin
  if v_uid is null or v_uid <> p_user_id then raise exception 'unauthorized_identity'; end if;
  if length(trim(coalesce(p_full_name,''))) < 2 then raise exception 'invalid_full_name'; end if;
  if length(trim(coalesce(p_school_name,''))) < 3 then raise exception 'invalid_school_name'; end if;
  if length(trim(coalesce(p_subdomain,''))) < 3 then raise exception 'invalid_subdomain'; end if;

  v_name_norm := lower(regexp_replace(trim(p_school_name),'[^a-zA-Z0-9]+','','g'));
  v_county_norm := lower(trim(coalesce(p_county,'')));
  v_subcounty_norm := lower(trim(coalesce(p_sub_county,'')));

  select count(*) into v_recent
  from public.schools s
  where s.created_by = v_uid
    and s.created_at >= now() - interval '24 hours';

  if v_recent >= 1 and not coalesce(public.is_platform_owner(),false) then
    raise exception 'school_creation_rate_limited';
  end if;

  select count(*), min(s.id) into v_existing_count, v_existing
  from public.schools s
  where s.deleted_at is null
    and s.status in ('pending','active')
    and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g')) = v_name_norm
    and lower(trim(coalesce(s.county,''))) = v_county_norm
    and (v_subcounty_norm = '' or lower(trim(coalesce(s.sub_county,''))) = v_subcounty_norm);

  if v_existing_count > 0 then
    raise exception 'school_already_exists:%', v_existing;
  end if;

  if nullif(trim(coalesce(p_knec_code,'')),'') is not null
     and exists(select 1 from public.schools where deleted_at is null and knec_code = trim(p_knec_code)) then
    raise exception 'school_code_already_exists';
  end if;

  if nullif(trim(coalesce(p_nemis_code,'')),'') is not null
     and exists(select 1 from public.schools where deleted_at is null and nemis_code = trim(p_nemis_code)) then
    raise exception 'school_code_already_exists';
  end if;

  if p_lat is not null and p_lng is not null and exists(
    select 1
    from public.schools s
    where s.deleted_at is null
      and s.status in ('pending','active')
      and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g')) = v_name_norm
      and s.gps_lat is not null
      and s.gps_lng is not null
      and 6371*2*asin(sqrt(
        power(sin(radians((s.gps_lat-p_lat)/2)),2)
        + cos(radians(p_lat))*cos(radians(s.gps_lat))*power(sin(radians((s.gps_lng-p_lng)/2)),2)
      )) < 1.0
  ) then
    raise exception 'school_identity_review_required';
  end if;

  insert into public.schools(
    name, subdomain, timezone, status, country_code, requires_dual_approval,
    county, sub_county, ward, gps_lat, gps_lng, knec_code, nemis_code,
    name_normalized, school_type, directory_source, last_verified_at, created_by
  )
  values(
    trim(p_school_name), lower(trim(p_subdomain)), 'Africa/Nairobi', 'pending', 'KE', true,
    nullif(trim(p_county),''), nullif(trim(p_sub_county),''), nullif(trim(p_ward),''),
    p_lat, p_lng, nullif(trim(p_knec_code),''), nullif(trim(p_nemis_code),''),
    v_name_norm, 'UNCLASSIFIED', 'ADMIN_REQUEST', null, v_uid
  )
  returning id into v_school_id;

  -- Creating a school request must never grant admin authority. Keep any existing
  -- authoritative profile role unchanged and create a reviewable join request.
  update public.profiles
  set full_name = trim(p_full_name), updated_at = now()
  where id = p_user_id;

  insert into public.school_admin_join_requests(
    school_id, requester_id, requester_name, status
  ) values (
    v_school_id, p_user_id, trim(p_full_name), 'pending'
  )
  on conflict (school_id, requester_id) do update
  set requester_name = excluded.requester_name,
      status = case
        when public.school_admin_join_requests.status = 'rejected' then 'pending'
        else public.school_admin_join_requests.status
      end,
      reviewed_by = case
        when public.school_admin_join_requests.status = 'rejected' then null
        else public.school_admin_join_requests.reviewed_by
      end,
      reviewed_at = case
        when public.school_admin_join_requests.status = 'rejected' then null
        else public.school_admin_join_requests.reviewed_at
      end,
      review_note = case
        when public.school_admin_join_requests.status = 'rejected' then null
        else public.school_admin_join_requests.review_note
      end;

  return v_school_id;
end;
$$;

create or replace function public.approve_school_admin_join_request(
  p_request_id uuid,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_requester_id uuid;
begin
  select school_id, requester_id
    into v_school_id, v_requester_id
  from public.school_admin_join_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then raise exception 'request_not_pending'; end if;

  if not coalesce(public.is_platform_owner(), false)
     and not exists(
       select 1
       from public.school_members
       where school_id = v_school_id
         and profile_id = auth.uid()
         and role in ('admin','owner')
     ) then
    raise exception 'forbidden_school_admin';
  end if;

  update public.profiles
  set school_id = v_school_id,
      role = 'admin',
      updated_at = now()
  where id = v_requester_id;

  insert into public.school_members(school_id, profile_id, role, joined_at)
  values(v_school_id, v_requester_id, 'admin', now())
  on conflict(school_id, profile_id) do update set role = 'admin';

  update public.school_admin_join_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note
  where id = p_request_id;
end;
$$;

revoke all on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) from public;
revoke all on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) from anon;
grant execute on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) to authenticated;

revoke all on function public.approve_school_admin_join_request(uuid,text) from public;
revoke all on function public.approve_school_admin_join_request(uuid,text) from anon;
grant execute on function public.approve_school_admin_join_request(uuid,text) to authenticated;

commit;
