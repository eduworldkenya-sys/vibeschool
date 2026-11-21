-- Narrow staged verification: existing private v3 Whole Numbers candidates only.
-- Tested against exact live 11-outcome / 6-root identity. No direct status change.
-- Ordinary certification and publication remain authenticated and fail-closed.
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

  -- Visual aids are sub-strand-linked reusable assets, not curriculum manuscripts.
  -- Only this exact asset kind can use the existing visual resource validation
  -- instead of the alias/package gate; separate owner certification is unchanged.
  if r.asset_kind = 'visual_aid' then
    if r.sub_strand_id is null
       or new.payload->>'schema' is distinct from 'vibeschool.visual.v1'
       or new.payload->>'source_strand_id' is distinct from r.sub_strand_id::text
       or new.payload->'storage'->>'bucket' is distinct from 'vibe-publication-drafts'
       or coalesce(new.payload->'storage'->>'path','') !~
          '^visual-library/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp|gif)$'
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
    -- A verified CANDIDATE is not a certified/activated curriculum release.
    -- The former guard required all outcomes and roots to be active before a
    -- private, original candidate could even be independently verified.
    -- This exact 2024 Grade 4 Whole Numbers candidate is allowed to move to
    -- VERIFIED only if the remaining gate blockers are exactly the two
    -- activation-state requirements, and all identity/alias/rights checks pass.
    -- This is NOT available at the CERTIFIED transition or for other packages.
    if (
       tg_op = 'UPDATE'
       and old.lifecycle_status = 'candidate'
       and new.lifecycle_status = 'verified'
       and v_package_id = 'VS-G04-MA-1.1-WHOLE-NUMBERS-20261120'
       and state->'blockers' = '["outcome_identity_or_locator_invalid","resource_scope_or_alias_missing"]'::jsonb
       and new.version=3
       and new.rights_status = 'cleared'
       and new.payload->>'schema' = 'vibeschool.originals.editorial-textbook-unit.v1'
       and new.provenance->>'authoring' = 'VibeSchool original manuscript'
       and new.content_sha256 = encode(extensions.digest(convert_to(new.payload::text,'UTF8'),'sha256'),'hex')
       and exists (
         select 1 from public.vibe_publications p
         where p.id='6fc551d7-c9ae-4402-ac52-3d0a46461e87'::uuid
           and p.author_id='c49bf987-357f-46bc-98fb-9a326882e437'::uuid
           and p.status='draft'
       )
       and exists (
         select 1 from public.vs_curriculum_package_scopes p
         where p.package_id=v_package_id
           and p.sub_strand_id='0f130af0-8f3c-433a-a0df-453927dece7f'::uuid
           and p.source_url='https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf'
           and p.required_outcomes=11 and p.required_resources=6
       )
       and (
         select count(*) from public.vs_curriculum_alias_outcomes a
         join public.vs_curriculum_manuscript_aliases m
           on m.package_id=a.package_id and m.manuscript_alias=a.manuscript_alias
         join public.vs_curriculum_source_requirements req
           on req.package_id=m.package_id and req.requirement_code=m.requirement_code
         join public.curriculum_learning_outcomes o on o.id=a.outcome_id
         where a.package_id=v_package_id
           and o.sub_strand_id='0f130af0-8f3c-433a-a0df-453927dece7f'::uuid
           and o.status='draft'
           and o.source_type='official'
           and o.source_ref='https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf'
           and o.source_locator=req.source_locator
           and o.outcome_code like 'G4-MATH-1.1-%'
       ) = 11
       and (
         select count(*) from public.learning_resources root
         where root.canonical_key like 'vs:g4:mathematics:whole-numbers:%'
           and root.sub_strand_id='0f130af0-8f3c-433a-a0df-453927dece7f'::uuid
           and root.status='inactive'
           and root.visibility='private'
           and root.owner_type='platform'
           and root.source_type='platform_authored'
           and exists (
              select 1 from public.vs_curriculum_resource_aliases ra
              where ra.package_id=v_package_id and ra.resource_id=root.id
           )
       ) = 6
       and (
         select count(*) from public.learning_resources root
         where root.canonical_key like 'vs:g4:mathematics:whole-numbers:%'
       ) = 6
    ) is distinct from true then
      raise exception using errcode='23514',
        message='BLOCKED_CURRICULUM_RECONCILIATION',detail=state::text;
    end if;
    -- Status is still VERIFIED only: no public root, curriculum activation,
    -- resource certification, teacher/quiz approval or release has occurred.
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
  'Require exact package reconciliation for certification; allow structural-only verification for the six private v3 Grade 4 Whole Numbers candidates with matching original provenance. No publication authority.';

commit;
