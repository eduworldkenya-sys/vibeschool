-- P0 school identity authority hardening.
--
-- Discovery is not identity. An ordinary teacher selecting a directory record must
-- never infer a canonical identity from fuzzy/name/location similarity and must never
-- write reviewer-owned reconciliation fields. Only an already trusted, owner-reviewed
-- candidate may be used for teacher onboarding.
--
-- This also repairs the owner-approved NEW path: schools.subdomain is NOT NULL/UNIQUE,
-- so a newly approved canonical identity must receive a deterministic collision-safe
-- pending subdomain instead of depending on an absent default/trigger.
--
-- SECURITY DECLARATION: both functions remain authenticated entrypoints with fixed
-- search_path and internal authorization rules. hq_review_school_identity_candidate
-- remains platform-owner only. connect_teacher_to_directory_school can only consume
-- an existing trusted reconciliation; it cannot create/update reconciliation evidence.
-- Access: authenticated-execute public.connect_teacher_to_directory_school; authenticated-execute/owner-authorized public.hq_review_school_identity_candidate.
-- Authorization-test: authenticated non-owner directory connect without pre-reviewed matched/new canonical candidate -> school_identity_review_required; authenticated non-owner cannot set reviewed_by/reviewed_at or create canonical school; platform owner NEW review creates pending dual-approval school with non-null unique subdomain.

create or replace function public.connect_teacher_to_directory_school(
  p_directory_id uuid,
  p_level text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then
    raise exception 'Invalid education level';
  end if;

  if not exists (
    select 1
    from public.schools_directory d
    where d.id=p_directory_id
      and lower(coalesce(d.status,'active')) <> 'closed'
  ) then
    raise exception 'Directory school not found';
  end if;

  -- The connection path is a consumer of trusted reconciliation, never a matcher.
  -- `matched` and `new` are only valid here when they already point at one canonical
  -- pending/active school. Ordinary onboarding cannot manufacture either state.
  select c.canonical_school_id
    into v_school
  from public.school_identity_candidates c
  join public.schools s
    on s.id=c.canonical_school_id
   and s.deleted_at is null
   and s.status in ('pending','active')
  where c.directory_school_id=p_directory_id
    and c.status in ('matched','new')
    and c.canonical_school_id is not null
    and c.reviewed_by is not null
    and c.reviewed_at is not null
  order by c.reviewed_at desc,c.updated_at desc
  limit 1;

  if v_school is null then
    -- Do not mutate the review queue from an end-user connection attempt. Discovery
    -- requests / ingestion create evidence; owner review owns identity disposition.
    raise exception 'school_identity_review_required';
  end if;

  insert into public.school_members(school_id,profile_id,role)
  values(v_school,v_uid,'teacher')
  on conflict(school_id,profile_id) do nothing;

  update public.profiles
  set school_id=v_school
  where id=v_uid;

  insert into public.teacher_profiles(profile_id,school_id)
  values(v_uid,v_school)
  on conflict(profile_id) do update set school_id=excluded.school_id;

  if p_level is not null then
    insert into public.school_levels(school_id,level)
    values(v_school,p_level)
    on conflict do nothing;
  end if;

  return v_school;
end;
$$;

revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public,anon;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;

create or replace function public.hq_review_school_identity_candidate(
  p_candidate_id uuid,
  p_action text,
  p_canonical_school_id uuid default null,
  p_alias text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  c record;
  d record;
  v_school uuid;
  v_uid uuid := auth.uid();
  v_alias text := nullif(trim(p_alias),'');
  v_subdomain text;
  v_slug text;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  if p_action not in ('matched','new','rejected') then
    raise exception 'invalid_action';
  end if;

  select * into c
  from public.school_identity_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'candidate_not_found';
  end if;

  if p_action='matched' then
    if p_canonical_school_id is null or not exists (
      select 1 from public.schools
      where id=p_canonical_school_id
        and deleted_at is null
        and status in ('pending','active')
    ) then
      raise exception 'canonical_school_required';
    end if;
    v_school := p_canonical_school_id;

  elsif p_action='new' then
    if c.directory_school_id is null then
      raise exception 'directory_school_required';
    end if;

    select * into d
    from public.schools_directory
    where id=c.directory_school_id
    for update;

    if not found then
      raise exception 'directory_school_not_found';
    end if;

    -- Fail closed if another active canonical identity already claims the strong
    -- directory KNEC code. Name similarity alone never selects that identity here.
    if d.knec_code is not null and exists (
      select 1 from public.schools s
      where s.deleted_at is null
        and s.status in ('pending','active')
        and s.knec_code=d.knec_code
    ) then
      raise exception 'canonical_identifier_collision';
    end if;

    v_slug := trim(both '-' from lower(regexp_replace(trim(d.name),'[^a-zA-Z0-9]+','-','g')));
    if v_slug is null or v_slug='' then
      v_slug := 'school';
    end if;
    v_slug := left(v_slug,40);
    -- Directory UUID is immutable. Using its full hex identity makes the generated
    -- subdomain deterministic and collision-safe without a random retry loop.
    v_subdomain := v_slug || '-' || replace(d.id::text,'-','');

    if exists(select 1 from public.schools s where s.subdomain=v_subdomain) then
      raise exception 'canonical_subdomain_collision';
    end if;

    insert into public.schools(
      name,subdomain,timezone,country_code,status,created_by,requires_dual_approval,
      county,sub_county,gps_lat,gps_lng,school_type,knec_code,
      directory_source,directory_source_ref,last_verified_at
    ) values (
      d.name,v_subdomain,'Africa/Nairobi','KE','pending',v_uid,true,
      d.county,d.sub_county,d.latitude,d.longitude,d.type,d.knec_code,
      'SCHOOL_DIRECTORY',d.id::text,now()
    )
    returning id into v_school;
  end if;

  update public.school_identity_candidates
  set canonical_school_id=case when p_action='rejected' then null else v_school end,
      status=p_action,
      confidence=case when p_action='matched' then 1 when p_action='new' then .99 else confidence end,
      match_reason=coalesce(
        nullif(trim(p_note),''),
        case
          when p_action='matched' then 'Platform owner verified canonical match'
          when p_action='new' then 'Platform owner approved new canonical school'
          else 'Platform owner rejected identity match'
        end
      ),
      reviewed_by=v_uid,
      reviewed_at=now(),
      updated_at=now()
  where id=p_candidate_id;

  if p_action in ('matched','new') then
    if v_alias is not null then
      insert into public.school_aliases(
        school_id,alias,alias_normalized,source,verified,source_type,confidence,verified_at
      ) values (
        v_school,v_alias,lower(regexp_replace(v_alias,'[^a-zA-Z0-9]+','','g')),
        'SCHOOL_IDENTITY_REVIEW',true,'operator',1,now()
      )
      on conflict do nothing;
    end if;
    return v_school;
  end if;

  return null;
end;
$$;

revoke all on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) to authenticated;
