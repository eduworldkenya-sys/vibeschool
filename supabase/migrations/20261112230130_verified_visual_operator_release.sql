-- Delegated publication of verified visual_aid versions for the solo VibeSchool operator.
-- This is a separate, narrowly scoped service credential lane. It does not
-- modify or grant the general platform-owner content certification function.
-- Service_role execution is itself gated by a dedicated server-only release
-- credential on the operator API. Anonymous/authenticated roles cannot invoke.
begin;

create or replace function public.vs_release_verified_visual(
  p_version_id uuid,
  p_expected_sha256 text,
  p_release_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $visual_release$
declare
  v public.learning_resource_versions%rowtype;
  r public.learning_resources%rowtype;
  p jsonb;
  object_row record;
  v_policy constant text := 'vibeschool-scoped-visual-operator-release-v1';
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception using errcode='42501', message='VS_VISUAL_RELEASE_SERVICE_ROLE_REQUIRED';
  end if;
  if p_version_id is null
     or coalesce(p_expected_sha256,'') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='VS_VISUAL_RELEASE_SHA_AND_VERSION_REQUIRED';
  end if;
  if p_release_evidence is null
     or jsonb_typeof(p_release_evidence) is distinct from 'object'
     or p_release_evidence->>'operator_reason' is null
     or length(btrim(p_release_evidence->>'operator_reason')) < 12
     or p_release_evidence->>'quality_check' is null
     or length(btrim(p_release_evidence->>'quality_check')) < 12
     or p_release_evidence->>'rights_check' is null
     or length(btrim(p_release_evidence->>'rights_check')) < 12
     or p_release_evidence->>'accessibility_check' is null
     or length(btrim(p_release_evidence->>'accessibility_check')) < 12 then
    raise exception using errcode='22023', message='VS_VISUAL_RELEASE_EVIDENCE_REQUIRED';
  end if;

  select * into v from public.learning_resource_versions
    where id=p_version_id for update;
  if not found then
    raise exception using errcode='P0002', message='VS_VISUAL_VERSION_NOT_FOUND';
  end if;
  select * into r from public.learning_resources
    where id=v.resource_id for update;
  if not found or r.asset_kind is distinct from 'visual_aid'
     or r.owner_type is distinct from 'platform'
     or r.source_type is distinct from 'platform_authored' then
    raise exception using errcode='42501', message='VS_VISUAL_RELEASE_ASSET_SCOPE_REQUIRED';
  end if;

  if v.content_sha256 is distinct from p_expected_sha256 then
    raise exception using errcode='23514', message='VS_VISUAL_RELEASE_CONTENT_HASH_MISMATCH';
  end if;
  if v.lifecycle_status='certified' and r.status='active' and r.visibility='public' then
    return jsonb_build_object(
      'status','already_released', 'resource_id',r.id, 'version_id',v.id,
      'content_sha256',v.content_sha256
    );
  end if;
  if v.lifecycle_status is distinct from 'verified'
     or v.verified_at is null
     or length(btrim(coalesce(v.verification_policy_version,''))) < 3
     or v.verification_evidence='{}'::jsonb
     or v.rights_status is distinct from 'cleared'
     or length(btrim(coalesce(v.verification_evidence->>'rights_basis',''))) < 12
     or length(btrim(coalesce(v.verification_evidence->>'visual_accuracy',''))) < 12 then
    raise exception using errcode='23514', message='VS_VISUAL_RELEASE_REQUIRES_VERIFIED_RIGHTS_AND_QA';
  end if;
  if r.status is distinct from 'inactive'
     or r.visibility is distinct from 'private'
     or exists (
       select 1 from public.learning_resource_versions other
       where other.resource_id=r.id and other.id<>v.id
         and other.lifecycle_status='certified'
     ) then
    raise exception using errcode='23514', message='VS_VISUAL_RELEASE_NOT_PRIVATE_UNIQUE_CANDIDATE';
  end if;

  p := v.payload;
  if p->>'schema' is distinct from 'vibeschool.visual.v1'
     or r.sub_strand_id is null
     or p->>'source_strand_id' is distinct from r.sub_strand_id::text
     or length(btrim(coalesce(p->>'alt_text',''))) < 8
     or length(btrim(coalesce(p->>'caption',''))) < 3
     or jsonb_typeof(p->'labels') is distinct from 'array'
     or jsonb_array_length(p->'labels')=0
     or jsonb_typeof(p->'placements') is distinct from 'array'
     or jsonb_array_length(p->'placements')=0
     or p->'storage'->>'bucket' is distinct from 'vibe-publication-drafts'
     or coalesce(p->'storage'->>'path','') !~
       '^visual-library/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp|gif)$'
     or p->'storage'->>'mime' not in
       ('image/png','image/jpeg','image/webp','image/gif')
     or coalesce(p->'storage'->>'sha256','') !~ '^[0-9a-f]{64}$'
     or p->'storage'->>'sha256'
        is distinct from v.verification_evidence->>'actual_file_sha256' then
    raise exception using errcode='23514', message='VS_VISUAL_RELEASE_METADATA_OR_FILE_EVIDENCE_INVALID';
  end if;

  select id, metadata into object_row
  from storage.objects
  where bucket_id='vibe-publication-drafts'
    and name=p->'storage'->>'path'
    and archived_at is null
    and coalesce(is_delete_marker,false)=false
  limit 1;
  if not found
     or object_row.metadata->>'mimetype' is distinct from p->'storage'->>'mime'
     or object_row.metadata->>'size' is distinct from p->'storage'->>'bytes' then
    raise exception using errcode='23514', message='VS_VISUAL_RELEASE_PRIVATE_FILE_UNVERIFIED';
  end if;

  update public.learning_resource_versions
    set lifecycle_status='certified',
        certification_policy_version=v_policy,
        certification_evidence=jsonb_build_object(
          'lane','scoped_visual_operator',
          'policy',v_policy,
          'verification_policy_version',v.verification_policy_version,
          'verified_file_sha256',p->'storage'->>'sha256',
          'resource_version_sha256',v.content_sha256,
          'storage_object_id',object_row.id,
          'released_at',now(),
          'release_evidence',p_release_evidence
        ),
        certified_at=now()
    where id=v.id;

  update public.learning_resources
    set status='active',visibility='public'
    where id=r.id;

  return jsonb_build_object(
    'status','released', 'resource_id',r.id, 'version_id',v.id,
    'content_sha256',v.content_sha256,
    'reference_token','[visual:'||r.id::text||'@'||v.id::text||']'
  );
end;
$visual_release$;

revoke all on function public.vs_release_verified_visual(uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.vs_release_verified_visual(uuid,text,jsonb)
  to service_role;

comment on function public.vs_release_verified_visual(uuid,text,jsonb) is
  'Scoped service-only visual release; verifies exact certified candidate version, QA, rights, private storage and audit evidence. Does not alter general owner-only certification.';

commit;
