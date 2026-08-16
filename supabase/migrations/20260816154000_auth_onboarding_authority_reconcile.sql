begin;

-- Final authority layer after the current auth-gateway migrations.
-- Provider/user metadata is identity/display data only; it never grants app authority.
alter table public.profiles alter column role drop default;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.profiles (id, full_name, role, account_status)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), null, 'active'::account_status)
    on conflict (id) do nothing;
  exception when others then
    begin
      insert into public.signup_provisioning_failures(user_id, email, attempted_role, error_message)
      values (new.id, new.email, null, sqlerrm);
    exception when others then null;
    end;
  end;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, service_role;

create or replace function public.claim_my_initial_role(p_role text)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current_role text;
  v_status text;
  v_anonymized boolean;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_role is null or p_role not in ('teacher','parent','global_user') then
    raise exception 'role_not_self_service' using errcode='22023';
  end if;

  select p.role, p.account_status::text, p.is_anonymized
    into v_current_role, v_status, v_anonymized
  from public.profiles p where p.id=v_uid for update;
  if not found then raise exception 'profile_missing' using errcode='P0002'; end if;
  if v_status is distinct from 'active' or coalesce(v_anonymized,false) then
    raise exception 'account_not_active' using errcode='42501';
  end if;

  if v_current_role is not null then return v_current_role; end if;

  update public.profiles set role=p_role, updated_at=now()
  where id=v_uid and role is null;
  select role into v_current_role from public.profiles where id=v_uid;
  return v_current_role;
end;
$$;
revoke all on function public.claim_my_initial_role(text) from public, anon;
grant execute on function public.claim_my_initial_role(text) to authenticated;

-- Direct client profile updates may change display fields, not authority fields.
-- Governed SECURITY DEFINER transitions execute as their function owner.
create or replace function public.guard_profile_authority_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user='authenticated' and (
       new.role is distinct from old.role
    or new.account_status is distinct from old.account_status
    or new.is_anonymized is distinct from old.is_anonymized
    or new.school_id is distinct from old.school_id
  ) then
    raise exception 'profile_authority_fields_are_read_only' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_authority_fields() from public, anon, authenticated;
drop trigger if exists guard_profile_authority_fields on public.profiles;
create trigger guard_profile_authority_fields
before update on public.profiles
for each row execute function public.guard_profile_authority_fields();

-- Harden the CURRENT two-argument school connection functions used by onboarding.
create or replace function public.connect_teacher_to_school(p_school_id uuid, p_level text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select public.get_my_role() into v_role;
  if v_role is distinct from 'teacher' then raise exception 'teacher_role_required' using errcode='42501'; end if;
  if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then raise exception 'invalid_education_level'; end if;
  if not exists(select 1 from public.schools where id=p_school_id and deleted_at is null and status in ('pending','active')) then
    raise exception 'school_not_available';
  end if;

  insert into public.school_members(school_id,profile_id,role)
  values(p_school_id,v_uid,'teacher')
  on conflict(school_id,profile_id) do update set role='teacher';
  update public.profiles set school_id=p_school_id where id=v_uid;
  insert into public.teacher_profiles(profile_id,school_id)
  values(v_uid,p_school_id)
  on conflict(profile_id) do update set school_id=excluded.school_id;
  if p_level is not null then
    insert into public.school_levels(school_id,level) values(p_school_id,p_level) on conflict do nothing;
  end if;
  return p_school_id;
end;
$$;
revoke all on function public.connect_teacher_to_school(uuid,text) from public, anon;
grant execute on function public.connect_teacher_to_school(uuid,text) to authenticated;

-- Auth hardening must not become a second School Engine identity authority.
-- Preserve the current governed directory reconciliation path and add only the
-- canonical teacher-role precondition required by this auth mission.
create or replace function public.connect_teacher_to_directory_school(p_directory_id uuid,p_level text default null)
returns uuid
language plpgsql
security definer
set search_path=public,extensions,auth,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  d record;
  v_school uuid;
  v_match_count integer:=0;
  v_reason text;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select public.get_my_role() into v_role;
  if v_role is distinct from 'teacher' then raise exception 'teacher_role_required' using errcode='42501'; end if;
  if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then raise exception 'invalid_education_level'; end if;

  select * into d from public.schools_directory
  where id=p_directory_id and lower(coalesce(status,'active'))<>'closed';
  if not found then raise exception 'directory_school_not_found'; end if;

  select c.canonical_school_id into v_school
  from public.school_identity_candidates c
  where c.directory_school_id=p_directory_id
    and c.status in ('matched','new')
    and c.canonical_school_id is not null
  order by case when c.status='matched' then 0 else 1 end,c.updated_at desc
  limit 1;

  if v_school is null then
    select count(*),min(s.id) into v_match_count,v_school
    from public.schools s
    where s.deleted_at is null and s.status in ('pending','active')
      and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g'))
      and lower(coalesce(s.county,''))=lower(coalesce(d.county,''))
      and lower(coalesce(s.sub_county,''))=lower(coalesce(d.sub_county,''));
    if v_match_count=1 then
      v_reason:='Unique normalized name + county + sub-county match';
    else
      v_school:=null;
    end if;
  end if;

  if v_school is null then
    insert into public.school_identity_candidates(directory_school_id,status,confidence,match_reason)
    values(p_directory_id,'pending',0,'No unambiguous canonical school match')
    on conflict (directory_school_id) where status in ('pending','matched','new')
    do update set updated_at=now(),match_reason=excluded.match_reason;
    raise exception 'school_identity_review_required';
  end if;

  insert into public.school_identity_candidates(
    directory_school_id,canonical_school_id,status,confidence,match_reason,reviewed_by,reviewed_at
  ) values(
    p_directory_id,v_school,'matched',1,coalesce(v_reason,'Existing trusted reconciliation'),v_uid,now()
  )
  on conflict (directory_school_id) where status in ('pending','matched','new')
  do update set canonical_school_id=excluded.canonical_school_id,status='matched',confidence=excluded.confidence,
    match_reason=excluded.match_reason,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,updated_at=now();

  insert into public.school_members(school_id,profile_id,role)
  values(v_school,v_uid,'teacher')
  on conflict(school_id,profile_id) do nothing;
  update public.profiles set school_id=v_school where id=v_uid;
  insert into public.teacher_profiles(profile_id,school_id)
  values(v_uid,v_school)
  on conflict(profile_id) do update set school_id=excluded.school_id;
  if p_level is not null then
    insert into public.school_levels(school_id,level) values(v_school,p_level) on conflict do nothing;
  end if;
  return v_school;
end;
$$;
revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public, anon;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;

-- Approval is explicit authority transition and cannot overwrite another role lane.
create or replace function public.approve_school_admin_join_request(p_request_id uuid,p_review_note text default null)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_school_id uuid;
  v_requester_id uuid;
  v_requester_role text;
begin
  select school_id,requester_id into v_school_id,v_requester_id
  from public.school_admin_join_requests
  where id=p_request_id and status='pending'
  for update;
  if not found then raise exception 'request_not_pending'; end if;

  if not coalesce(public.is_platform_owner(),false)
     and not exists(
       select 1 from public.school_members
       where school_id=v_school_id and profile_id=auth.uid() and role in ('admin','owner')
     ) then
    raise exception 'forbidden_school_admin' using errcode='42501';
  end if;

  select role into v_requester_role from public.profiles where id=v_requester_id for update;
  if v_requester_role is not null and v_requester_role<>'admin' then
    raise exception 'requester_role_conflict' using errcode='42501';
  end if;

  update public.profiles set school_id=v_school_id,role='admin',updated_at=now()
  where id=v_requester_id;
  insert into public.school_members(school_id,profile_id,role,joined_at)
  values(v_school_id,v_requester_id,'admin',now())
  on conflict(school_id,profile_id) do update set role='admin';
  update public.school_admin_join_requests
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_review_note
  where id=p_request_id;
end;
$$;
revoke all on function public.approve_school_admin_join_request(uuid,text) from public, anon;
grant execute on function public.approve_school_admin_join_request(uuid,text) to authenticated;

comment on function public.claim_my_initial_role(text) is 'One-time allowlisted self-service role claim. Existing canonical role always wins.';
comment on function public.guard_profile_authority_fields() is 'Blocks direct authenticated mutation of canonical authority fields; governed SECURITY DEFINER transitions remain available.';
comment on function public.connect_teacher_to_school(uuid,text) is 'Connects only an already-canonical teacher account to a canonical school.';
comment on function public.connect_teacher_to_directory_school(uuid,text) is 'Preserves the School Engine reconciliation path and requires canonical teacher authority before connection.';

commit;
