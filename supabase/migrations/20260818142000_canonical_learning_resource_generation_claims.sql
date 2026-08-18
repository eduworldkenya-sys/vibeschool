-- R3.2/R3.3 single-flight content-gap claims.
-- Only the service-role generation boundary may claim a canonical miss.
-- access: service-only public.learning_resource_generation_claims
-- authorization-test: public.learning_resource_generation_claims scripts/sql/canonical_learning_resource_versions_verify.sql

begin;

create table if not exists public.learning_resource_generation_claims (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references public.learning_resources(id) on delete restrict,
  status text not null default 'claimed'
    check (status = any (array['claimed','completed','failed']::text[])),
  requested_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_resource_generation_claims_expiry_check
    check (expires_at > claimed_at),
  constraint learning_resource_generation_claims_completed_check
    check (status <> 'completed' or completed_at is not null),
  constraint learning_resource_generation_claims_failed_check
    check (status <> 'failed' or failed_at is not null)
);

create unique index if not exists learning_resource_generation_claims_one_active_uidx
  on public.learning_resource_generation_claims(resource_id)
  where status = 'claimed';

create index if not exists learning_resource_generation_claims_status_expiry_idx
  on public.learning_resource_generation_claims(status, expires_at);

alter table public.learning_resource_generation_claims enable row level security;
revoke all on table public.learning_resource_generation_claims from anon, authenticated;
revoke delete on table public.learning_resource_generation_claims from service_role;
grant select, insert, update on table public.learning_resource_generation_claims to service_role;

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
  if p_asset_kind is null or p_purpose is null or p_language_code is null then
    raise exception using errcode='22023', message='CLA_ASSET_IDENTITY_REQUIRED';
  end if;

  -- Unique canonical_key is the convergence point. Platform roots deliberately
  -- have created_by=null so an ordinary teacher never gains creator-manage
  -- authority over a reusable global family.
  insert into public.learning_resources (
    source_type,
    title,
    subject_id,
    curriculum_id,
    sub_strand_id,
    grade,
    status,
    visibility,
    owner_type,
    canonical_key,
    asset_kind,
    purpose,
    identity_key_version,
    language_code,
    created_by
  ) values (
    'platform_generated',
    p_title,
    p_subject_id,
    p_curriculum_id,
    p_sub_strand_id,
    p_grade,
    'active',
    'public',
    'platform',
    p_family_key,
    p_asset_kind,
    p_purpose,
    1,
    p_language_code,
    null
  )
  on conflict (canonical_key) do nothing;

  select * into v_resource
  from public.learning_resources
  where canonical_key = p_family_key
  for update;

  if v_resource.id is null then
    raise exception using errcode='P0001', message='CLA_RESOURCE_ROOT_RESOLUTION_FAILED';
  end if;

  -- A family key collision with different authoritative dimensions is a hard
  -- integrity failure, never a reason to reuse or overwrite the existing root.
  if v_resource.curriculum_id is distinct from p_curriculum_id
     or v_resource.subject_id is distinct from p_subject_id
     or lower(btrim(coalesce(v_resource.grade,''))) <> lower(btrim(p_grade))
     or v_resource.sub_strand_id is distinct from p_sub_strand_id
     or v_resource.asset_kind is distinct from p_asset_kind
     or v_resource.purpose is distinct from p_purpose
     or lower(btrim(coalesce(v_resource.language_code,''))) <> lower(btrim(p_language_code)) then
    raise exception using
      errcode='23514',
      message='CLA_FAMILY_KEY_METADATA_COLLISION';
  end if;

  select * into v_version
  from public.learning_resource_versions
  where resource_id = v_resource.id
    and lifecycle_status = 'certified'
  limit 1;

  if v_version.id is not null then
    return jsonb_build_object(
      'status', 'hit',
      'resource_id', v_resource.id,
      'resource_version_id', v_version.id,
      'version', v_version.version,
      'family_key', v_resource.canonical_key,
      'payload_format', v_version.payload_format,
      'payload', v_version.payload,
      'content_sha256', v_version.content_sha256,
      'certification_policy_version', v_version.certification_policy_version,
      'certified_at', v_version.certified_at
    );
  end if;

  -- Expired ownership cannot block the family forever.
  update public.learning_resource_generation_claims
  set status = 'failed',
      failed_at = now(),
      failure_reason = 'claim_expired',
      updated_at = now()
  where resource_id = v_resource.id
    and status = 'claimed'
    and expires_at <= now();

  select * into v_claim
  from public.learning_resource_generation_claims
  where resource_id = v_resource.id
    and status = 'claimed'
    and expires_at > now()
  limit 1;

  if v_claim.id is not null then
    return jsonb_build_object(
      'status', 'pending',
      'resource_id', v_resource.id,
      'claim_id', v_claim.id,
      'expires_at', v_claim.expires_at
    );
  end if;

  insert into public.learning_resource_generation_claims (
    resource_id,
    status,
    requested_by
  ) values (
    v_resource.id,
    'claimed',
    p_requested_by
  )
  returning * into v_claim;

  return jsonb_build_object(
    'status', 'claimed',
    'resource_id', v_resource.id,
    'claim_id', v_claim.id,
    'expires_at', v_claim.expires_at
  );
end;
$$;

revoke all on function public.cla_claim_learning_resource_gap(
  text,text,uuid,uuid,text,uuid,text,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.cla_claim_learning_resource_gap(
  text,text,uuid,uuid,text,uuid,text,text,text,uuid
) to service_role;

create or replace function public.cla_fail_learning_resource_claim(
  p_claim_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.learning_resource_generation_claims
  set status='failed',
      failed_at=now(),
      failure_reason=left(coalesce(p_reason,'generation_failed'),500),
      updated_at=now()
  where id=p_claim_id
    and status='claimed';
end;
$$;

revoke all on function public.cla_fail_learning_resource_claim(uuid,text)
  from public, anon, authenticated;
grant execute on function public.cla_fail_learning_resource_claim(uuid,text)
  to service_role;

comment on table public.learning_resource_generation_claims is
  'Single-flight ownership for a canonical content gap. External generation/search spend is permitted only to the active claim owner.';
comment on function public.cla_claim_learning_resource_gap(text,text,uuid,uuid,text,uuid,text,text,text,uuid) is
  'Atomically resolves certified hit, active pending claim, or creates one claim for an authoritative canonical family.';

commit;
