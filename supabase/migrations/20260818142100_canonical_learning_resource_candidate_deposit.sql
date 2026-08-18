-- R3.3 candidate deposit + pending reuse state.
-- Hashes canonical payloads in PostgreSQL and prevents another generation while
-- a candidate/verified version is already under Content Factory review.

begin;

create or replace function public.cla_claim_learning_resource_gap(
  p_family_key text,
  p_title text,
  p_curriculum_id uuid,
  p_subject_id uuid,
  p_grade text,
  p_sub_strand_id uuid,
  p_asset_kind text,
  p_purpose text,
  p_language_code text,
  p_requested_by uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resource public.learning_resources%rowtype;
  v_version public.learning_resource_versions%rowtype;
  v_claim public.learning_resource_generation_claims%rowtype;
begin
  if p_family_key is null or btrim(p_family_key) = '' then
    raise exception using errcode='22023', message='CLA_FAMILY_KEY_REQUIRED';
  end if;
  if p_curriculum_id is null or p_subject_id is null then
    raise exception using errcode='22023', message='CLA_AUTHORITATIVE_CURRICULUM_IDENTITY_REQUIRED';
  end if;
  if p_grade is null or btrim(p_grade) = '' then
    raise exception using errcode='22023', message='CLA_GRADE_REQUIRED';
  end if;

  insert into public.learning_resources (
    source_type,title,subject_id,curriculum_id,sub_strand_id,grade,status,
    visibility,owner_type,canonical_key,asset_kind,purpose,
    identity_key_version,language_code,created_by
  ) values (
    'platform_generated',p_title,p_subject_id,p_curriculum_id,p_sub_strand_id,
    p_grade,'active','public','platform',p_family_key,p_asset_kind,p_purpose,
    1,p_language_code,null
  ) on conflict (canonical_key) do nothing;

  select * into v_resource
  from public.learning_resources
  where canonical_key=p_family_key
  for update;

  if v_resource.id is null then
    raise exception using errcode='P0001', message='CLA_RESOURCE_ROOT_RESOLUTION_FAILED';
  end if;

  if v_resource.curriculum_id is distinct from p_curriculum_id
     or v_resource.subject_id is distinct from p_subject_id
     or lower(btrim(coalesce(v_resource.grade,''))) <> lower(btrim(p_grade))
     or v_resource.sub_strand_id is distinct from p_sub_strand_id
     or v_resource.asset_kind is distinct from p_asset_kind
     or v_resource.purpose is distinct from p_purpose
     or lower(btrim(coalesce(v_resource.language_code,''))) <> lower(btrim(p_language_code)) then
    raise exception using errcode='23514', message='CLA_FAMILY_KEY_METADATA_COLLISION';
  end if;

  select * into v_version
  from public.learning_resource_versions
  where resource_id=v_resource.id and lifecycle_status='certified'
  limit 1;

  if v_version.id is not null then
    return jsonb_build_object(
      'status','hit',
      'resource_id',v_resource.id,
      'resource_version_id',v_version.id,
      'version',v_version.version,
      'family_key',v_resource.canonical_key,
      'payload_format',v_version.payload_format,
      'payload',v_version.payload,
      'content_sha256',v_version.content_sha256,
      'certification_policy_version',v_version.certification_policy_version,
      'certified_at',v_version.certified_at
    );
  end if;

  -- An unverified candidate is not reusable, but it is evidence that the gap
  -- is already being produced/reviewed. Do not spend again.
  select * into v_version
  from public.learning_resource_versions
  where resource_id=v_resource.id
    and lifecycle_status=any(array['candidate','verified']::text[])
  order by version desc
  limit 1;

  if v_version.id is not null then
    return jsonb_build_object(
      'status','pending',
      'resource_id',v_resource.id,
      'resource_version_id',v_version.id,
      'version',v_version.version,
      'review_status',v_version.lifecycle_status
    );
  end if;

  update public.learning_resource_generation_claims
  set status='failed', failed_at=now(), failure_reason='claim_expired', updated_at=now()
  where resource_id=v_resource.id and status='claimed' and expires_at<=now();

  select * into v_claim
  from public.learning_resource_generation_claims
  where resource_id=v_resource.id and status='claimed' and expires_at>now()
  limit 1;

  if v_claim.id is not null then
    return jsonb_build_object(
      'status','pending',
      'resource_id',v_resource.id,
      'claim_id',v_claim.id,
      'expires_at',v_claim.expires_at,
      'review_status','generating'
    );
  end if;

  insert into public.learning_resource_generation_claims(resource_id,status,requested_by)
  values (v_resource.id,'claimed',p_requested_by)
  returning * into v_claim;

  return jsonb_build_object(
    'status','claimed',
    'resource_id',v_resource.id,
    'claim_id',v_claim.id,
    'expires_at',v_claim.expires_at
  );
end;
$$;

revoke all on function public.cla_claim_learning_resource_gap(
  text,text,uuid,uuid,text,uuid,text,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.cla_claim_learning_resource_gap(
  text,text,uuid,uuid,text,uuid,text,text,text,uuid
) to service_role;

create or replace function public.cla_complete_learning_resource_claim(
  p_claim_id uuid,
  p_payload_format text,
  p_payload jsonb,
  p_provenance jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.learning_resource_generation_claims%rowtype;
  v_previous public.learning_resource_versions%rowtype;
  v_created public.learning_resource_versions%rowtype;
  v_next_version integer;
  v_hash text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode='22023', message='CLA_CANDIDATE_PAYLOAD_OBJECT_REQUIRED';
  end if;
  if p_payload_format is null or btrim(p_payload_format) = '' then
    raise exception using errcode='22023', message='CLA_PAYLOAD_FORMAT_REQUIRED';
  end if;
  if p_provenance is null or jsonb_typeof(p_provenance) <> 'object' then
    raise exception using errcode='22023', message='CLA_PROVENANCE_OBJECT_REQUIRED';
  end if;

  select * into v_claim
  from public.learning_resource_generation_claims
  where id=p_claim_id
  for update;

  if v_claim.id is null then
    raise exception using errcode='P0002', message='CLA_CLAIM_NOT_FOUND';
  end if;
  if v_claim.status <> 'claimed' then
    raise exception using errcode='23514', message='CLA_CLAIM_NOT_ACTIVE';
  end if;
  if v_claim.expires_at <= now() then
    update public.learning_resource_generation_claims
    set status='failed',failed_at=now(),failure_reason='claim_expired_before_deposit',updated_at=now()
    where id=v_claim.id;
    raise exception using errcode='23514', message='CLA_CLAIM_EXPIRED';
  end if;

  if exists (
    select 1 from public.learning_resource_versions
    where resource_id=v_claim.resource_id
      and lifecycle_status=any(array['candidate','verified']::text[])
  ) then
    raise exception using errcode='23505', message='CLA_CANDIDATE_ALREADY_EXISTS';
  end if;

  select * into v_previous
  from public.learning_resource_versions
  where resource_id=v_claim.resource_id
  order by version desc
  limit 1;

  v_next_version := coalesce(v_previous.version,0)+1;
  v_hash := encode(
    extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),
    'hex'
  );

  insert into public.learning_resource_versions(
    resource_id,version,previous_version_id,lifecycle_status,payload_format,
    payload,content_sha256,provenance,rights_status,created_by
  ) values (
    v_claim.resource_id,
    v_next_version,
    v_previous.id,
    'candidate',
    p_payload_format,
    p_payload,
    v_hash,
    p_provenance,
    'pending',
    v_claim.requested_by
  ) returning * into v_created;

  update public.learning_resource_generation_claims
  set status='completed',completed_at=now(),updated_at=now()
  where id=v_claim.id;

  return jsonb_build_object(
    'status','candidate',
    'resource_id',v_created.resource_id,
    'resource_version_id',v_created.id,
    'version',v_created.version,
    'content_sha256',v_created.content_sha256
  );
end;
$$;

revoke all on function public.cla_complete_learning_resource_claim(uuid,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.cla_complete_learning_resource_claim(uuid,text,jsonb,jsonb)
  to service_role;

comment on function public.cla_complete_learning_resource_claim(uuid,text,jsonb,jsonb) is
  'Deposits exactly one context-free candidate version for an active generation claim. The database computes the payload fingerprint; certification remains a separate governed step.';

commit;
