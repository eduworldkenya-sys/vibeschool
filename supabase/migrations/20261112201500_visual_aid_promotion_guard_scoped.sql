-- Restrict curriculum manuscript alias/package gate to actual manuscript assets.
-- The previous trigger applied to ALL platform-authored assets, blocking the
-- existing canonical Visual Learning Library's candidate->verified transition
-- with VS_CURRICULUM_PACKAGE_ID_REQUIRED for correctly scoped visual_aid roots.
-- This fixes only that scope collision; owner-only certification, root visibility,
-- private storage, resource version immutability and curriculum package guards
-- for non-visual resources remain unchanged.
begin;

create or replace function public.vs_guard_curriculum_version_promotion()
returns trigger language plpgsql security invoker set search_path = ''
as $guard$
declare
  r public.learning_resources%rowtype;
  v_package_id text;
  state jsonb;
  expected_aliases jsonb;
  submitted_aliases jsonb;
begin
  if new.lifecycle_status not in ('verified','certified') then return new; end if;
  if tg_op='UPDATE' and old.lifecycle_status is not distinct from new.lifecycle_status then
    return new;
  end if;

  select * into r from public.learning_resources where id=new.resource_id;
  if not found then
    raise exception using errcode='23503',message='VS_CURRICULUM_RESOURCE_NOT_FOUND';
  end if;
  if r.owner_type is distinct from 'platform'
    or r.source_type is distinct from 'platform_authored' then return new; end if;

  -- Visual aids are independent canonical resources tied to an existing
  -- sub-strand, not to a manuscript/package alias list. They still require
  -- real visual schema, source, storage and accessibility metadata before
  -- the existing separate verified -> owner-certified lifecycle can proceed.
  -- Restrict this exception to exactly visual_aid; do not relax curriculum
  -- resource reconciliation or any other learning-resource asset kind.
  if r.asset_kind = 'visual_aid' then
    if r.sub_strand_id is null
       or new.payload->>'schema' is distinct from 'vibeschool.visual.v1'
       or new.payload->>'source_strand_id' is distinct from r.sub_strand_id::text
       or new.payload->'storage'->>'bucket' is distinct from 'vibe-publication-drafts'
       or coalesce(new.payload->'storage'->>'path','') !~
          '^visual-library/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp|gif)
  if v_package_id is null then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_PACKAGE_ID_REQUIRED';
  end if;

  state := public.vs_curriculum_package_gate(v_package_id);
  if state->>'state' <> 'PASS' then
    raise exception using errcode='23514',
      message='BLOCKED_CURRICULUM_RECONCILIATION',detail=state::text;
  end if;

  if not exists (
    select 1 from public.vs_curriculum_package_scopes p
    where p.package_id=v_package_id and p.sub_strand_id=r.sub_strand_id
      and left(r.canonical_key,length(p.resource_key_prefix))=p.resource_key_prefix
  ) then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_RESOURCE_PACKAGE_MISMATCH';
  end if;

  select coalesce(jsonb_agg(alias order by alias),'[]'::jsonb)
    into expected_aliases
  from (
    select distinct ra.manuscript_alias as alias
    from public.vs_curriculum_resource_aliases ra
    where ra.package_id=v_package_id and ra.resource_id=r.id
  ) linked;

  if jsonb_typeof(new.payload->'curriculum_outcome_aliases') is distinct from 'array' then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_VERSION_ALIASES_REQUIRED';
  end if;
  select coalesce(jsonb_agg(alias order by alias),'[]'::jsonb)
    into submitted_aliases
  from (
    select distinct value as alias
    from jsonb_array_elements_text(new.payload->'curriculum_outcome_aliases')
  ) submitted;

  if expected_aliases is distinct from submitted_aliases
    or jsonb_array_length(new.payload->'curriculum_outcome_aliases')
       <> jsonb_array_length(submitted_aliases) then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_VERSION_ALIASES_MISMATCH',
      detail=jsonb_build_object('expected',expected_aliases,'submitted',submitted_aliases)::text;
  end if;
  return new;
end
$guard$;
       or coalesce(new.payload->'storage'->>'mime','') not in
          ('image/png','image/jpeg','image/webp','image/gif')
       or length(btrim(coalesce(new.payload->>'alt_text',''))) < 8
       or length(btrim(coalesce(new.payload->>'caption',''))) < 3
       or jsonb_typeof(new.payload->'labels') is distinct from 'array'
       or jsonb_typeof(new.payload->'placements') is distinct from 'array'
    then
      raise exception using errcode='23514',message='VS_VISUAL_PROMOTION_METADATA_INVALID';
    end if;
    return new;
  end if;

  v_package_id := nullif(btrim(coalesce(new.provenance->>'package_id','')),'');
  if v_package_id is null then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_PACKAGE_ID_REQUIRED';
  end if;

  state := public.vs_curriculum_package_gate(v_package_id);
  if state->>'state' <> 'PASS' then
    raise exception using errcode='23514',
      message='BLOCKED_CURRICULUM_RECONCILIATION',detail=state::text;
  end if;

  if not exists (
    select 1 from public.vs_curriculum_package_scopes p
    where p.package_id=v_package_id and p.sub_strand_id=r.sub_strand_id
      and left(r.canonical_key,length(p.resource_key_prefix))=p.resource_key_prefix
  ) then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_RESOURCE_PACKAGE_MISMATCH';
  end if;

  select coalesce(jsonb_agg(alias order by alias),'[]'::jsonb)
    into expected_aliases
  from (
    select distinct ra.manuscript_alias as alias
    from public.vs_curriculum_resource_aliases ra
    where ra.package_id=v_package_id and ra.resource_id=r.id
  ) linked;

  if jsonb_typeof(new.payload->'curriculum_outcome_aliases') is distinct from 'array' then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_VERSION_ALIASES_REQUIRED';
  end if;
  select coalesce(jsonb_agg(alias order by alias),'[]'::jsonb)
    into submitted_aliases
  from (
    select distinct value as alias
    from jsonb_array_elements_text(new.payload->'curriculum_outcome_aliases')
  ) submitted;

  if expected_aliases is distinct from submitted_aliases
    or jsonb_array_length(new.payload->'curriculum_outcome_aliases')
       <> jsonb_array_length(submitted_aliases) then
    raise exception using errcode='23514',
      message='VS_CURRICULUM_VERSION_ALIASES_MISMATCH',
      detail=jsonb_build_object('expected',expected_aliases,'submitted',submitted_aliases)::text;
  end if;
  return new;
end
$guard$;

comment on function public.vs_guard_curriculum_version_promotion() is
  'Fail-closed curriculum package gate for platform manuscripts; scoped independently validated visual_aid resources use existing visual authority and owner-only certification.';

commit;
