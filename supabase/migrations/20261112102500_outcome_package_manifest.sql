-- P0: one outcome package is an ordinary canonical learning-resource root with an
-- immutable versioned JSON manifest. No second content/question/asset inventory.
-- Non-activating: no packages are created, certified, or released by this migration.
begin;

alter table public.learning_resources
  add column if not exists curriculum_outcome_id uuid
  references public.curriculum_learning_outcomes(id) on delete restrict;

alter table public.learning_resources
  drop constraint if exists learning_resources_asset_kind_check;
alter table public.learning_resources
  add constraint learning_resources_asset_kind_check check (
    asset_kind is null or asset_kind = any (array[
      'lesson_plan','teacher_notes','learner_notes','homework','quiz','exercise',
      'revision','worksheet','assessment','worked_example','project','practical',
      'remedial','enrichment','marking_scheme','rubric','content_block',
      'visual_aid','outcome_package'
    ]::text[])
  );

alter table public.learning_resources
  add constraint learning_resources_outcome_package_scope_check
  check (asset_kind <> 'outcome_package' or (
    curriculum_outcome_id is not null and owner_type = 'platform'
    and source_type in ('platform_authored','platform_generated')
    and school_id is null
  ));

-- A versioned manifest must not silently lose its validated root identity.
create or replace function public.cla_guard_outcome_package_root_identity()
returns trigger language plpgsql security invoker set search_path = '' as $
begin
  if old.asset_kind = 'outcome_package'
     and (new.asset_kind is distinct from old.asset_kind
       or new.curriculum_outcome_id is distinct from old.curriculum_outcome_id
       or new.canonical_key is distinct from old.canonical_key)
     and exists (select 1 from public.learning_resource_versions v
                 where v.resource_id = old.id) then
    raise exception using errcode='23514', message='CLA_PACKAGE_ROOT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$;
revoke all on function public.cla_guard_outcome_package_root_identity()
  from public,anon,authenticated,service_role;
drop trigger if exists cla_guard_outcome_package_root_identity on public.learning_resources;
create trigger cla_guard_outcome_package_root_identity
  before update of asset_kind,curriculum_outcome_id,canonical_key
  on public.learning_resources for each row
  execute function public.cla_guard_outcome_package_root_identity();

create index if not exists learning_resources_outcome_package_lookup_idx
  on public.learning_resources(curriculum_outcome_id)
  where asset_kind = 'outcome_package';

-- Returned completeness is computed from the actual pinned versions/questions.
-- Release intent is stored separately for core, activities and revision in the
-- *immutable* package version. Changing release intent requires a new version.
create or replace function public.cla_audit_outcome_package(
  p_resource_id uuid, p_manifest jsonb
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_root public.learning_resources%rowtype;
  v_outcome public.curriculum_learning_outcomes%rowtype;
  v_issues text[] := array[]::text[];
  v_refs jsonb;
  v_questions jsonb;
  v_release jsonb;
  v_asset jsonb;
  v_q jsonb;
  v_role text;
  v_exp text;
  v_seen text[];
  v_id text;
  v_version_id text;
  v_found record;
  v_qfound record;
  v_counts jsonb := '{"core":0,"activities":0,"revision":0,"teacher_guidance":0,"visual_assets":0}'::jsonb;
  v_cert jsonb := '{"core":true,"activities":true,"revision":true,"teacher_guidance":true,"visual_assets":true}'::jsonb;
  v_experiences jsonb := '{}'::jsonb;
  v_complete boolean;
  v_source_ready boolean;
  v_state text;
  v_requires_guidance boolean;
  v_requires_visuals boolean;
  v_uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  select * into v_root from public.learning_resources where id = p_resource_id;
  if v_root.id is null or v_root.asset_kind is distinct from 'outcome_package'
     or v_root.curriculum_outcome_id is null then
    return jsonb_build_object('valid',false,'issues',jsonb_build_array('PACKAGE_ROOT_NOT_BOUND'));
  end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' or
     p_manifest->>'schema' is distinct from 'vibeschool.outcome-package.v1' or
     p_manifest->>'outcome_id' is distinct from v_root.curriculum_outcome_id::text then
    return jsonb_build_object('valid',false,'issues',jsonb_build_array('PACKAGE_SCHEMA_OR_OUTCOME_MISMATCH'));
  end if;

  v_refs := p_manifest->'assets';
  v_questions := p_manifest->'question_ids';
  v_release := p_manifest->'release';
  if jsonb_typeof(v_refs) is distinct from 'object'
     or jsonb_typeof(v_questions) is distinct from 'object'
     or jsonb_typeof(v_release) is distinct from 'object'
     or jsonb_typeof(p_manifest->'requirements') is distinct from 'object' then
    return jsonb_build_object('valid',false,'issues',jsonb_build_array('PACKAGE_SECTIONS_REQUIRED'));
  end if;

  if jsonb_typeof(p_manifest #> '{requirements,teacher_guidance}') is distinct from 'boolean'
     or jsonb_typeof(p_manifest #> '{requirements,visual_assets}') is distinct from 'boolean' then
    v_issues := array_append(v_issues,'REQUIREMENT_FLAGS_MUST_BE_BOOLEAN');
  end if;
  v_requires_guidance := coalesce((p_manifest #>> '{requirements,teacher_guidance}')::boolean,false);
  v_requires_visuals := coalesce((p_manifest #>> '{requirements,visual_assets}')::boolean,false);

  select * into v_outcome from public.curriculum_learning_outcomes
    where id = v_root.curriculum_outcome_id;
  v_source_ready := coalesce(
    v_outcome.status = 'verified' and v_outcome.verified_at is not null
    and v_outcome.source_import_id is not null
    and nullif(btrim(v_outcome.source_locator),'') is not null, false);

  foreach v_role in array array['core','activities','revision','teacher_guidance','visual_assets'] loop
    if jsonb_typeof(v_refs->v_role) is distinct from 'array' then
      return jsonb_build_object('valid',false,'issues',jsonb_build_array('ASSET_ARRAY_REQUIRED:' || v_role));
    end if;
    v_seen := array[]::text[];
    for v_asset in select value from jsonb_array_elements(v_refs->v_role) loop
      v_id := v_asset->>'resource_id';
      v_version_id := v_asset->>'resource_version_id';
      if jsonb_typeof(v_asset) is distinct from 'object'
         or coalesce(v_id,'') !~ v_uuid_pattern
         or coalesce(v_version_id,'') !~ v_uuid_pattern then
        v_issues := array_append(v_issues,'INVALID_ASSET_PIN:' || v_role);
        v_cert := jsonb_set(v_cert,array[v_role],'false'::jsonb);
        continue;
      end if;
      if v_version_id = any(v_seen) then
        v_issues := array_append(v_issues,'DUPLICATE_ASSET_PIN:' || v_role);
      end if;
      v_seen := array_append(v_seen,v_version_id);
      select r.id as root_id,r.asset_kind,r.status as root_status,r.visibility,
             r.owner_type,r.curriculum_outcome_id,r.content_block_id,
             v.lifecycle_status, v.resource_id as pinned_root
        into v_found
      from public.learning_resources r
      join public.learning_resource_versions v on v.resource_id = r.id
      where v.id = v_version_id::uuid and r.id = v_id::uuid;
      if v_found.root_id is null then
        v_issues := array_append(v_issues,'ASSET_VERSION_MISSING_OR_MISMATCHED:' || v_role);
        v_cert := jsonb_set(v_cert,array[v_role],'false'::jsonb);
        continue;
      end if;
      if not coalesce((
        (v_role = 'core' and v_found.asset_kind in ('learner_notes','content_block','worked_example'))
        or (v_role = 'activities' and v_found.asset_kind in ('exercise','worksheet','quiz','project','practical','homework'))
        or (v_role = 'revision' and v_found.asset_kind in ('revision','worksheet','quiz','assessment','exercise'))
        or (v_role = 'teacher_guidance' and v_found.asset_kind in ('teacher_notes','lesson_plan','rubric','marking_scheme'))
        or (v_role = 'visual_assets' and v_found.asset_kind = 'visual_aid')
      ),false) then
        v_issues := array_append(v_issues,'ASSET_KIND_MISMATCH:' || v_role);
      end if;
      if not coalesce((
        v_found.curriculum_outcome_id = v_root.curriculum_outcome_id
        or (v_found.curriculum_outcome_id is null
          and v_found.content_block_id is not null and exists (
            select 1 from public.content_block_outcome_links l
            where l.content_block_id = v_found.content_block_id
              and l.outcome_id = v_root.curriculum_outcome_id
          ))
      ),false) then
        v_issues := array_append(v_issues,'ASSET_OUTCOME_UNPROVEN:' || v_role);
      end if;
      if v_found.lifecycle_status <> 'certified'
         or v_found.root_status <> 'active'
         or v_found.owner_type <> 'platform'
         or v_found.visibility <> 'public' then
        v_cert := jsonb_set(v_cert,array[v_role],'false'::jsonb);
      end if;
      v_counts := jsonb_set(v_counts,array[v_role],
        to_jsonb((v_counts->>v_role)::integer + 1));
    end loop;
  end loop;

  if (v_counts->>'core')::integer > 1 then
    v_issues := array_append(v_issues,'CORE_MUST_HAVE_AT_MOST_ONE_UNIT');
  end if;
  foreach v_role in array array['activities','revision'] loop
    if jsonb_typeof(v_questions->v_role) is distinct from 'array' then
      return jsonb_build_object('valid',false,'issues',jsonb_build_array('QUESTION_ARRAY_REQUIRED:' || v_role));
    end if;
    v_seen := array[]::text[];
    for v_q in select value from jsonb_array_elements(v_questions->v_role) loop
      v_id := trim(both '"' from v_q::text);
      if jsonb_typeof(v_q) is distinct from 'string' or v_id !~ v_uuid_pattern then
        v_issues := array_append(v_issues,'INVALID_QUESTION_ID:' || v_role);
        v_cert := jsonb_set(v_cert,array[v_role],'false'::jsonb);
        continue;
      end if;
      if v_id = any(v_seen) then
        v_issues := array_append(v_issues,'DUPLICATE_QUESTION_ID:' || v_role);
      end if;
      v_seen := array_append(v_seen,v_id);
      select q.id,q.learning_outcome_id,q.status,q.review_status,q.school_id
      into v_qfound
      from public.assessment_questions q where q.id = v_id::uuid;
      if v_qfound.id is null
         or v_qfound.learning_outcome_id is distinct from v_root.curriculum_outcome_id
         or v_qfound.school_id is not null then
        v_issues := array_append(v_issues,'QUESTION_OUTCOME_OR_SCOPE_MISMATCH:' || v_role);
        v_cert := jsonb_set(v_cert,array[v_role],'false'::jsonb);
        continue;
      end if;
      if v_qfound.status <> 'confirmed' or v_qfound.review_status <> 'approved' then
        v_cert := jsonb_set(v_cert,array[v_role],'false'::jsonb);
      end if;
      v_counts := jsonb_set(v_counts,array[v_role],
        to_jsonb((v_counts->>v_role)::integer + 1));
    end loop;
  end loop;

  foreach v_exp in array array['core','activities','revision'] loop
    v_state := v_release->>v_exp;
    if v_state is null or v_state not in ('draft','ready','released') then
      v_issues := array_append(v_issues,'INVALID_RELEASE_STATUS:' || v_exp);
    end if;
    v_complete := (v_counts->>v_exp)::integer > 0
       and (v_cert->>v_exp)::boolean
       and (not v_requires_guidance or (
         (v_counts->>'teacher_guidance')::integer > 0 and (v_cert->>'teacher_guidance')::boolean))
       and (not v_requires_visuals or (
         (v_counts->>'visual_assets')::integer > 0 and (v_cert->>'visual_assets')::boolean));
    v_experiences := jsonb_set(v_experiences,array[v_exp],
      jsonb_build_object('completeness',case when v_complete then 'complete' else 'incomplete' end,
                         'release',v_state,'releasable',v_complete and v_source_ready));
    if v_state in ('ready','released') and not v_complete then
      v_issues := array_append(v_issues,'EXPERIENCE_NOT_COMPLETE:' || v_exp);
    end if;
    if v_state in ('ready','released') and not v_source_ready then
      v_issues := array_append(v_issues,'CURRICULUM_NOT_RECONCILED:' || v_exp);
    end if;
  end loop;

  return jsonb_build_object(
    'valid',cardinality(v_issues) = 0,
    'issues',to_jsonb(v_issues),
    'outcome_id',v_root.curriculum_outcome_id,
    'curriculum_reconciled',v_source_ready,
    'requirements',p_manifest->'requirements',
    'asset_counts',v_counts,
    'experiences',v_experiences
  );
end;
$$;

-- Validation occurs at the storage boundary even when a service-role client
-- bypasses RLS. Incomplete draft manifests are allowed; false readiness is not.
create or replace function public.cla_guard_outcome_package_manifest()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_kind text;
  v_audit jsonb;
begin
  if tg_op = 'UPDATE' and old.lifecycle_status = 'certified'
      and new.lifecycle_status = 'retired' then
    return new; -- Existing immutable-version guard controls this transition.
  end if;
  select asset_kind into v_kind
    from public.learning_resources where id = new.resource_id;
  if v_kind is distinct from 'outcome_package' then return new; end if;
  v_audit := public.cla_audit_outcome_package(new.resource_id,new.payload);
  if not coalesce((v_audit->>'valid')::boolean,false) then
    raise exception using errcode='23514', message='CLA_OUTCOME_PACKAGE_INVALID',
      detail=v_audit::text;
  end if;
  return new;
end;
$$;

drop trigger if exists cla_guard_outcome_package_manifest
  on public.learning_resource_versions;
create trigger cla_guard_outcome_package_manifest
  before insert or update of resource_id,payload,lifecycle_status
  on public.learning_resource_versions
  for each row execute function public.cla_guard_outcome_package_manifest();

revoke all on function public.cla_audit_outcome_package(uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.cla_audit_outcome_package(uuid,jsonb) to service_role;
revoke all on function public.cla_guard_outcome_package_manifest()
  from public,anon,authenticated,service_role;

comment on column public.learning_resources.curriculum_outcome_id is
  'Stable reconciled curriculum outcome bound to this canonical resource. Required for outcome_package; optional on earlier assets.';
comment on function public.cla_audit_outcome_package(uuid,jsonb) is
  'P0 outcome manifest audit. Computes separate Core/Activities/Revision completeness and validates release intent against exact certified assets, approved questions and reconciled curriculum.';
comment on function public.cla_guard_outcome_package_manifest() is
  'Fail-closed manifest validation on every candidate/version transition. No new library or question-bank tables.';

commit;
