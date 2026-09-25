begin;

create or replace function public.connect_teacher_to_directory_school(
  p_directory_id uuid,
  p_level text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
  v_role text;
  v_status text;
  v_anonymized boolean;
  d public.schools_directory%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select p.role::text,p.account_status::text,coalesce(p.is_anonymized,false)
    into v_role,v_status,v_anonymized
  from public.profiles p where p.id=v_uid;

  if not found then raise exception 'profile_missing' using errcode='42501'; end if;
  if v_role is distinct from 'teacher' or v_status is distinct from 'active' or v_anonymized then
    raise exception 'teacher_authority_required' using errcode='42501';
  end if;
  if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then
    raise exception 'invalid_education_level' using errcode='22023';
  end if;

  select * into d from public.schools_directory
  where id=p_directory_id and lower(coalesce(status,'active')) <> 'closed';
  if not found then raise exception 'directory_school_not_found' using errcode='22023'; end if;

  select c.canonical_school_id into v_school
  from public.school_identity_candidates c
  join public.schools s on s.id=c.canonical_school_id and s.deleted_at is null and s.status in ('pending','active')
  where c.directory_school_id=p_directory_id
    and c.status in ('matched','new')
    and c.canonical_school_id is not null
    and c.reviewed_by is not null
    and c.reviewed_at is not null
  order by c.reviewed_at desc,c.updated_at desc limit 1;

  if v_school is null and d.knec_code is not null then
    select s.id into v_school from public.schools s
    where s.deleted_at is null and s.knec_code=d.knec_code
    order by case when s.status='active' then 0 else 1 end,s.created_at limit 1;
  end if;

  if v_school is null then
    select s.id into v_school from public.schools s
    where s.deleted_at is null
      and lower(trim(s.name))=lower(trim(d.name))
      and coalesce(lower(trim(s.county)),'')=coalesce(lower(trim(d.county)),'')
      and coalesce(lower(trim(s.sub_county)),'')=coalesce(lower(trim(d.sub_county)),'')
    order by case when s.status='active' then 0 else 1 end,s.created_at limit 1;
  end if;

  if v_school is null then
    select s.id into v_school from public.schools s
    where s.deleted_at is null
      and s.directory_source='schools_directory'
      and s.directory_source_ref=p_directory_id::text
    limit 1;
  end if;

  if v_school is null then
    insert into public.schools(
      name,timezone,country_code,status,created_by,requires_dual_approval,
      county,sub_county,gps_lat,gps_lng,knec_code,school_type,
      directory_source,directory_source_ref,last_verified_at
    ) values(
      d.name,'Africa/Nairobi','KE','pending',v_uid,true,
      d.county,d.sub_county,d.latitude,d.longitude,d.knec_code,d.type,
      'schools_directory',d.id::text,case when d.is_verified then now() else null end
    ) returning id into v_school;
  end if;

  insert into public.school_identity_candidates(
    directory_school_id,canonical_school_id,status,confidence,match_reason
  ) values(
    p_directory_id,v_school,'pending',
    case when d.is_verified then .95 else .70 end,
    'Teacher-selected directory identity; isolated canonical school created pending operator reconciliation'
  )
  on conflict (directory_school_id) where status in ('pending','matched','new')
  do update set canonical_school_id=excluded.canonical_school_id,
                match_reason=excluded.match_reason,
                updated_at=now();

  insert into public.school_members(school_id,profile_id,role)
  values(v_school,v_uid,'teacher')
  on conflict(school_id,profile_id) do nothing;

  update public.profiles set school_id=v_school where id=v_uid;
  if not found then raise exception 'profile_update_failed'; end if;

  insert into public.teacher_profiles(profile_id,school_id)
  values(v_uid,v_school)
  on conflict(profile_id) do update set school_id=excluded.school_id;

  if p_level is not null then
    insert into public.school_levels(school_id,level) values(v_school,p_level) on conflict do nothing;
  end if;

  if not exists(select 1 from public.school_members where school_id=v_school and profile_id=v_uid and role='teacher') then
    raise exception 'school_connection_verification_failed';
  end if;

  return v_school;
end;
$$;

revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public,anon,service_role;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;

comment on function public.connect_teacher_to_directory_school(uuid,text) is
'Teacher onboarding: connects an active teacher to an existing reconciled school when possible; otherwise creates an isolated pending canonical school from the selected directory record and queues identity reconciliation without granting access to any existing school identity.';

notify pgrst,'reload schema';
commit;
