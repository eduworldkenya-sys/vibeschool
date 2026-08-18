-- R3.4 Canonical Learning Assets promotion authority.
-- A candidate cannot become reusable truth merely because a service process can
-- write the version table. Verification, certification, rejection and retirement
-- are explicit authorities with separate execution lanes.

begin;

alter table public.learning_resource_versions
  add column if not exists verification_policy_version text,
  add column if not exists verification_evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(verification_evidence) = 'object');

-- Ordinary service executors may deposit candidates through the governed claim
-- completion RPC, but may not directly mutate version lifecycle/evidence.
revoke update on table public.learning_resource_versions from service_role;

create or replace function public.cla_guard_resource_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode='42501', message='CLA_VERSION_DELETE_FORBIDDEN',
      detail='Canonical learning resource versions are retired or rejected, never deleted.';
  end if;

  if old.lifecycle_status = 'certified' then
    if new.lifecycle_status = 'retired'
       and new.retired_at is not null
       and new.id = old.id
       and new.resource_id = old.resource_id
       and new.version = old.version
       and new.previous_version_id is not distinct from old.previous_version_id
       and new.payload_format = old.payload_format
       and new.payload = old.payload
       and new.content_sha256 = old.content_sha256
       and new.provenance = old.provenance
       and new.rights_status = old.rights_status
       and new.verification_policy_version is not distinct from old.verification_policy_version
       and new.verification_evidence = old.verification_evidence
       and new.certification_policy_version is not distinct from old.certification_policy_version
       and new.certification_evidence = old.certification_evidence
       and new.created_by is not distinct from old.created_by
       and new.created_at = old.created_at
       and new.verified_at is not distinct from old.verified_at
       and new.certified_at is not distinct from old.certified_at
    then
      return new;
    end if;

    raise exception using errcode='42501', message='CLA_CERTIFIED_VERSION_IMMUTABLE',
      detail='Certified payload/evidence is immutable. Create a new version or retire this version.';
  end if;

  if old.lifecycle_status = 'retired' then
    raise exception using errcode='42501', message='CLA_RETIRED_VERSION_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.cla_guard_resource_version_mutation()
  from public, anon, authenticated, service_role;

create or replace function public.cla_verify_learning_resource_candidate(
  p_version_id uuid,
  p_verification_policy_version text,
  p_verification_evidence jsonb,
  p_rights_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.learning_resource_versions%rowtype;
begin
  if p_verification_policy_version is null
     or btrim(p_verification_policy_version) = '' then
    raise exception using errcode='22023', message='CLA_VERIFICATION_POLICY_REQUIRED';
  end if;

  if p_verification_evidence is null
     or jsonb_typeof(p_verification_evidence) <> 'object'
     or p_verification_evidence = '{}'::jsonb then
    raise exception using errcode='22023', message='CLA_VERIFICATION_EVIDENCE_REQUIRED';
  end if;

  if p_rights_status <> all(array['cleared','not_applicable']::text[]) then
    raise exception using errcode='22023', message='CLA_RIGHTS_CLEARANCE_REQUIRED';
  end if;

  select * into v_version
  from public.learning_resource_versions
  where id = p_version_id
  for update;

  if v_version.id is null then
    raise exception using errcode='P0002', message='CLA_VERSION_NOT_FOUND';
  end if;

  if v_version.lifecycle_status <> 'candidate' then
    raise exception using errcode='23514', message='CLA_ONLY_CANDIDATE_CAN_BE_VERIFIED';
  end if;

  update public.learning_resource_versions
  set lifecycle_status = 'verified',
      rights_status = p_rights_status,
      verification_policy_version = p_verification_policy_version,
      verification_evidence = p_verification_evidence,
      verified_at = now()
  where id = p_version_id
  returning * into v_version;

  return jsonb_build_object(
    'status','verified',
    'resource_id',v_version.resource_id,
    'resource_version_id',v_version.id,
    'version',v_version.version,
    'content_sha256',v_version.content_sha256,
    'verified_at',v_version.verified_at
  );
end;
$$;

revoke all on function public.cla_verify_learning_resource_candidate(uuid,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.cla_verify_learning_resource_candidate(uuid,text,jsonb,text)
  to service_role;

create or replace function public.cla_reject_learning_resource_candidate(
  p_version_id uuid,
  p_rejection_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.learning_resource_versions%rowtype;
begin
  if p_rejection_evidence is null
     or jsonb_typeof(p_rejection_evidence) <> 'object'
     or p_rejection_evidence = '{}'::jsonb then
    raise exception using errcode='22023', message='CLA_REJECTION_EVIDENCE_REQUIRED';
  end if;

  select * into v_version
  from public.learning_resource_versions
  where id = p_version_id
  for update;

  if v_version.id is null then
    raise exception using errcode='P0002', message='CLA_VERSION_NOT_FOUND';
  end if;

  if v_version.lifecycle_status <> all(array['candidate','verified']::text[]) then
    raise exception using errcode='23514', message='CLA_VERSION_NOT_REJECTABLE';
  end if;

  update public.learning_resource_versions
  set lifecycle_status = 'rejected',
      certification_evidence = p_rejection_evidence
  where id = p_version_id
  returning * into v_version;

  return jsonb_build_object(
    'status','rejected',
    'resource_id',v_version.resource_id,
    'resource_version_id',v_version.id,
    'version',v_version.version
  );
end;
$$;

revoke all on function public.cla_reject_learning_resource_candidate(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.cla_reject_learning_resource_candidate(uuid,jsonb)
  to service_role;

create or replace function public.cla_certify_learning_resource_version(
  p_version_id uuid,
  p_certification_policy_version text,
  p_certification_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.learning_resource_versions%rowtype;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception using errcode='42501', message='CLA_PLATFORM_OWNER_REQUIRED';
  end if;

  if p_certification_policy_version is null
     or btrim(p_certification_policy_version) = '' then
    raise exception using errcode='22023', message='CLA_CERTIFICATION_POLICY_REQUIRED';
  end if;

  if p_certification_evidence is null
     or jsonb_typeof(p_certification_evidence) <> 'object'
     or p_certification_evidence = '{}'::jsonb then
    raise exception using errcode='22023', message='CLA_CERTIFICATION_EVIDENCE_REQUIRED';
  end if;

  select * into v_version
  from public.learning_resource_versions
  where id = p_version_id
  for update;

  if v_version.id is null then
    raise exception using errcode='P0002', message='CLA_VERSION_NOT_FOUND';
  end if;

  if v_version.lifecycle_status <> 'verified'
     or v_version.verified_at is null
     or v_version.verification_policy_version is null
     or v_version.verification_evidence = '{}'::jsonb then
    raise exception using errcode='23514', message='CLA_INDEPENDENT_VERIFICATION_REQUIRED';
  end if;

  if v_version.rights_status <> all(array['cleared','not_applicable']::text[]) then
    raise exception using errcode='23514', message='CLA_RIGHTS_CLEARANCE_REQUIRED';
  end if;

  if exists (
    select 1
    from public.learning_resource_versions other
    where other.resource_id = v_version.resource_id
      and other.lifecycle_status = 'certified'
      and other.id <> v_version.id
  ) then
    raise exception using errcode='23505', message='CLA_CERTIFIED_VERSION_ALREADY_EXISTS';
  end if;

  update public.learning_resource_versions
  set lifecycle_status = 'certified',
      certification_policy_version = p_certification_policy_version,
      certification_evidence = p_certification_evidence,
      certified_at = now()
  where id = p_version_id
  returning * into v_version;

  return jsonb_build_object(
    'status','certified',
    'resource_id',v_version.resource_id,
    'resource_version_id',v_version.id,
    'version',v_version.version,
    'content_sha256',v_version.content_sha256,
    'certified_at',v_version.certified_at
  );
end;
$$;

revoke all on function public.cla_certify_learning_resource_version(uuid,text,jsonb)
  from public, anon, service_role;
grant execute on function public.cla_certify_learning_resource_version(uuid,text,jsonb)
  to authenticated;

create or replace function public.cla_retire_learning_resource_version(
  p_version_id uuid,
  p_retirement_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.learning_resource_versions%rowtype;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception using errcode='42501', message='CLA_PLATFORM_OWNER_REQUIRED';
  end if;

  if p_retirement_evidence is null
     or jsonb_typeof(p_retirement_evidence) <> 'object'
     or p_retirement_evidence = '{}'::jsonb then
    raise exception using errcode='22023', message='CLA_RETIREMENT_EVIDENCE_REQUIRED';
  end if;

  select * into v_version
  from public.learning_resource_versions
  where id = p_version_id
  for update;

  if v_version.id is null then
    raise exception using errcode='P0002', message='CLA_VERSION_NOT_FOUND';
  end if;

  if v_version.lifecycle_status <> 'certified' then
    raise exception using errcode='23514', message='CLA_ONLY_CERTIFIED_VERSION_CAN_BE_RETIRED';
  end if;

  update public.learning_resource_versions
  set lifecycle_status = 'retired',
      retired_at = now()
  where id = p_version_id
  returning * into v_version;

  return jsonb_build_object(
    'status','retired',
    'resource_id',v_version.resource_id,
    'resource_version_id',v_version.id,
    'version',v_version.version,
    'retired_at',v_version.retired_at,
    'retirement_evidence',p_retirement_evidence
  );
end;
$$;

revoke all on function public.cla_retire_learning_resource_version(uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.cla_retire_learning_resource_version(uuid,jsonb)
  to authenticated;

comment on function public.cla_verify_learning_resource_candidate(uuid,text,jsonb,text) is
  'Service-only independent verification gate. Moves candidate to verified only with explicit evidence and rights clearance.';
comment on function public.cla_certify_learning_resource_version(uuid,text,jsonb) is
  'Platform-owner certification boundary. Verified evidence and rights clearance are mandatory before a version can become reusable truth.';
comment on function public.cla_reject_learning_resource_candidate(uuid,jsonb) is
  'Service-only rejection path preserving candidate history and evidence.';
comment on function public.cla_retire_learning_resource_version(uuid,jsonb) is
  'Platform-owner retirement boundary. Certified content is retired, never deleted or rewritten.';

commit;
