-- Close the remaining self-service admin elevation path.
-- A new-school registration is a request until a platform owner approves it.

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

  -- Never permit an already-classified account to bootstrap another authority lane.
  if exists(select 1 from public.profiles where id=v_uid and role is not null) then
    raise exception 'account_already_classified';
  end if;

  v_name_norm := lower(regexp_replace(trim(p_school_name),'[^a-zA-Z0-9]+','','g'));
  v_county_norm := lower(trim(coalesce(p_county,'')));
  v_subcounty_norm := lower(trim(coalesce(p_sub_county,'')));

  select count(*) into v_recent from public.schools s
  where s.created_by=v_uid and s.created_at>=now()-interval '24 hours';
  if v_recent>=1 and not coalesce(public.is_platform_owner(),false) then
    raise exception 'school_creation_rate_limited';
  end if;

  select count(*),min(s.id) into v_existing_count,v_existing
  from public.schools s
  where s.deleted_at is null
    and s.status in ('pending','active')
    and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=v_name_norm
    and lower(trim(coalesce(s.county,'')))=v_county_norm
    and (v_subcounty_norm='' or lower(trim(coalesce(s.sub_county,'')))=v_subcounty_norm);
  if v_existing_count>0 then raise exception 'school_already_exists:%',v_existing; end if;

  if nullif(trim(coalesce(p_knec_code,'')),'') is not null
     and exists(select 1 from public.schools where deleted_at is null and knec_code=trim(p_knec_code)) then
    raise exception 'school_code_already_exists';
  end if;
  if nullif(trim(coalesce(p_nemis_code,'')),'') is not null
     and exists(select 1 from public.schools where deleted_at is null and nemis_code=trim(p_nemis_code)) then
    raise exception 'school_code_already_exists';
  end if;

  insert into public.schools(
    name,subdomain,timezone,status,country_code,requires_dual_approval,
    county,sub_county,ward,gps_lat,gps_lng,knec_code,nemis_code,
    name_normalized,school_type,directory_source,last_verified_at,created_by
  ) values(
    trim(p_school_name),lower(trim(p_subdomain)),'Africa/Nairobi','pending','KE',true,
    nullif(trim(p_county),''),nullif(trim(p_sub_county),''),nullif(trim(p_ward),''),
    p_lat,p_lng,nullif(trim(p_knec_code),''),nullif(trim(p_nemis_code),''),
    v_name_norm,'UNCLASSIFIED','ADMIN_REQUEST',null,v_uid
  ) returning id into v_school_id;

  -- Keep the account unclassified. Approval, not registration, grants admin.
  update public.profiles
  set full_name=trim(p_full_name), updated_at=now()
  where id=v_uid and role is null;

  insert into public.school_admin_join_requests(school_id,requester_id,requester_name,status)
  values(v_school_id,v_uid,trim(p_full_name),'pending')
  on conflict(school_id,requester_id) do nothing;

  return v_school_id;
end;
$$;

revoke all on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) from public, anon;
grant execute on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) to authenticated;

create or replace function public.approve_pending_school_registration(
  p_school_id uuid,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_requester_id uuid;
begin
  if not coalesce(public.is_platform_owner(),false) then
    raise exception 'platform_owner_required' using errcode='42501';
  end if;

  select r.id,r.requester_id
    into v_request_id,v_requester_id
  from public.school_admin_join_requests r
  join public.schools s on s.id=r.school_id
  where r.school_id=p_school_id
    and r.status='pending'
    and s.status='pending'
    and s.created_by=r.requester_id
  for update of r,s;

  if not found then raise exception 'pending_school_registration_not_found'; end if;

  update public.schools
  set status='active', updated_at=now()
  where id=p_school_id and status='pending';

  update public.profiles
  set school_id=p_school_id, role='admin', updated_at=now()
  where id=v_requester_id and role is null;

  if not found then raise exception 'requester_role_conflict'; end if;

  insert into public.school_members(school_id,profile_id,role,joined_at)
  values(p_school_id,v_requester_id,'admin',now())
  on conflict(school_id,profile_id) do update set role='admin';

  update public.school_admin_join_requests
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_review_note
  where id=v_request_id;
end;
$$;

revoke all on function public.approve_pending_school_registration(uuid,text) from public, anon, authenticated;
grant execute on function public.approve_pending_school_registration(uuid,text) to service_role;

comment on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) is
  'Creates a pending school registration request only. It never grants admin role or membership.';
comment on function public.approve_pending_school_registration(uuid,text) is
  'Platform-owner gated transition that activates a pending school and grants its requester canonical admin authority.';
