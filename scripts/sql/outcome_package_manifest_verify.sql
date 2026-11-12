-- Run after the outcome package migration in a disposable database.
-- This test intentionally rolls back every fixture. No learner data is published.
begin;

do $verify$
declare
  o public.curriculum_learning_outcomes%rowtype;
  fixture_user_id uuid;
  fixture_subject_id uuid;
  fixture_curriculum_id uuid;
  fixture_import_id uuid;
  primary_package_id text;
  primary_alias text;
  question_curriculum_id uuid;
  core_id uuid;
  core_version uuid;
  pkg_id uuid;
  pkg_version uuid;
  q_id uuid;
  other_outcome_id uuid;
  gated_outcome_id uuid;
  gated_package_id text;
  gated_alias text;
  gated_core_id uuid;
  gated_core_version uuid;
  gated_pkg_id uuid;
  gated_manifest jsonb;
  manifest jsonb;
  audit jsonb;
  broken jsonb;
begin
  select * into o from public.curriculum_learning_outcomes
   where status='verified' and verified_at is not null
     and source_import_id is not null and nullif(btrim(source_locator),'') is not null
     and curriculum_id is not null limit 1;
  if o.id is null then
    -- Blank database rebuilds may have no imported-verified outcome. P0 Grade 4
    -- Time still seeds a fully reconciled active outcome through the source gate.
    select ao.outcome_id,ao.package_id,ao.manuscript_alias
      into other_outcome_id,primary_package_id,primary_alias
    from public.vs_curriculum_alias_outcomes ao
    join public.curriculum_learning_outcomes go on go.id=ao.outcome_id
    where go.status='active' and nullif(btrim(go.source_locator),'') is not null
      and (public.vs_curriculum_package_gate(ao.package_id)->>'state')='PASS'
    limit 1;
    select * into o from public.curriculum_learning_outcomes where id=other_outcome_id;
  end if;
  if o.id is null then
    -- A *clean* local database has no verified outcome. Create a transaction-
    -- scoped, fully linked fixture rather than depending on production seed.
    -- All inserts, including the auth user, are rolled back below.
    insert into auth.users(id,aud,role,email,raw_user_meta_data)
    values (gen_random_uuid(),'authenticated','authenticated',
      'p0-outcome-test-'||replace(gen_random_uuid()::text,'-','')||'@example.test',
      '{"full_name":"P0 rollback fixture"}'::jsonb)
    returning id into fixture_user_id;
    insert into public.subjects(name)
    values ('P0 outcome fixture '||gen_random_uuid()::text)
    returning id into fixture_subject_id;
    insert into public.curriculum(
      curriculum,grade,subject,term,week,strand,sub_strand,topic,global_subject_id
    ) values ('P0 Fixture','Grade 4','Mathematics',1,1,'Measurement','Time',
              'P0 test only',fixture_subject_id)
    returning id into fixture_curriculum_id;
    insert into public.curriculum_imports(
      created_by,source_type,authority_name,curriculum_name,grade,subject,
      status,verified_by,verified_at
    ) values (fixture_user_id,'official','P0 TEST ONLY','Fixture',
              'Grade 4','Mathematics','verified',fixture_user_id,now())
    returning id into fixture_import_id;
    insert into public.curriculum_learning_outcomes(
      curriculum_id,outcome_text,source_type,status,verified_by,verified_at,
      source_import_id,source_locator
    ) values (fixture_curriculum_id,'P0 rollback outcome','official','verified',
              fixture_user_id,now(),fixture_import_id,'TEST #1.0')
    returning * into o;
  end if;
  question_curriculum_id := coalesce(o.curriculum_id,(select c.id from public.curriculum c limit 1));
  if question_curriculum_id is null then
    raise exception 'P0 TEST FIXTURE REQUIRED: an existing curriculum for the question bank';
  end if;

  insert into public.learning_resources(
    source_type,title,owner_type,visibility,canonical_key,
    asset_kind,purpose,curriculum_outcome_id
  ) values (
    'platform_generated','P0 test core','platform','public','p0-test-core-'||gen_random_uuid(),
    'learner_notes','teach',o.id
  ) returning id into core_id;
  insert into public.learning_resource_versions(
    resource_id,version,lifecycle_status,payload,content_sha256,
    rights_status,certification_policy_version,certification_evidence,certified_at
  ) values (
    core_id,1,'certified','{"text":"Core fixture"}'::jsonb,repeat('a',64),
    'cleared','p0-test','{"fixture":true}'::jsonb,now()
  ) returning id into core_version;

  insert into public.learning_resources(
    source_type,title,owner_type,visibility,canonical_key,
    asset_kind,purpose,curriculum_outcome_id
  ) values (
    'platform_generated','P0 test package','platform','public','p0-test-package-'||gen_random_uuid(),
    'outcome_package','teach',o.id
  ) returning id into pkg_id;

  manifest := jsonb_build_object(
    'schema','vibeschool.outcome-package.v1',
    'outcome_id',o.id,
    'curriculum_package_id',primary_package_id,
    'curriculum_outcome_aliases',case when primary_alias is null then '[]'::jsonb else jsonb_build_array(primary_alias) end,
    'requirements',jsonb_build_object('teacher_guidance',false,'visual_assets',false),
    'assets',jsonb_build_object(
      'core',jsonb_build_array(jsonb_build_object('resource_id',core_id,'resource_version_id',core_version)),
      'activities','[]'::jsonb,'revision','[]'::jsonb,
      'teacher_guidance','[]'::jsonb,'visual_assets','[]'::jsonb),
    'question_ids',jsonb_build_object('activities','[]'::jsonb,'revision','[]'::jsonb),
    'release',jsonb_build_object('core','released','activities','draft','revision','draft')
  );
  audit := public.cla_audit_outcome_package(pkg_id,manifest);
  if audit->>'valid' <> 'true'
     or audit #>> '{experiences,core,completeness}' <> 'complete'
     or audit #>> '{experiences,core,release}' <> 'released'
     or audit #>> '{experiences,activities,completeness}' <> 'incomplete'
     or audit #>> '{experiences,revision,release}' <> 'draft' then
    raise exception 'P0 partial-release regression: %',audit;
  end if;

  insert into public.learning_resource_versions(
    resource_id,version,lifecycle_status,payload,content_sha256
  ) values (pkg_id,1,'candidate',manifest,repeat('b',64))
  returning id into pkg_version;

  -- The alias ledger is present, nonempty values are typed, and duplicates fail.
  broken := jsonb_set(manifest,'{curriculum_outcome_aliases}',jsonb_build_array('duplicate','duplicate'));
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Duplicate curriculum aliases accepted';
  end if;
  broken := manifest - 'curriculum_outcome_aliases';
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Missing curriculum alias ledger accepted';
  end if;

  -- No false "ready": revision with zero items must fail.
  broken := jsonb_set(manifest,'{release,revision}','"ready"'::jsonb);
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Empty revision incorrectly marked ready';
  end if;
  -- Invalid version pins cannot be mistaken for content.
  broken := jsonb_set(manifest,'{assets,core,0,resource_version_id}',to_jsonb(gen_random_uuid()::text));
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Missing asset reference accepted';
  end if;
  -- The same version may not appear twice in a section.
  broken := jsonb_set(manifest,'{assets,activities}',
     jsonb_build_array(manifest #> '{assets,core,0}',manifest #> '{assets,core,0}'));
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Duplicate/incorrect asset kind accepted';
  end if;
  -- Required visuals and teacher guidance are not assumed to exist.
  broken := jsonb_set(manifest,'{requirements,visual_assets}','true'::jsonb);
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Missing required visual accepted';
  end if;
  -- A proposed release with an unapproved existing question must fail.
  insert into public.assessment_questions(
    curriculum_id,question_text,question_type,status,review_status,
    learning_outcome_id
  ) values (
    question_curriculum_id,'P0 test question','written','draft','approved',o.id
  ) returning id into q_id;
  broken := jsonb_set(manifest,'{question_ids,activities}',jsonb_build_array(q_id::text));
  broken := jsonb_set(broken,'{release,activities}','"ready"'::jsonb);
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Draft question promoted to ready content';
  end if;
  -- Exact outcome link required even for an approved, confirmed item.
  update public.assessment_questions set status='confirmed' where id=q_id;
  broken := jsonb_set(manifest,'{question_ids,activities}',jsonb_build_array(q_id::text));
  broken := jsonb_set(broken,'{release,activities}','"ready"'::jsonb);
  audit := public.cla_audit_outcome_package(pkg_id,broken);
  if audit->>'valid' <> 'true'
     or audit #>> '{experiences,activities,completeness}' <> 'complete'
     or audit #>> '{experiences,revision,completeness}' <> 'incomplete' then
    raise exception 'Independent activity readiness regression: %',audit;
  end if;
  broken := jsonb_set(broken,'{question_ids,activities}',jsonb_build_array(gen_random_uuid()::text));
  if public.cla_audit_outcome_package(pkg_id,broken)->>'valid' <> 'false' then
    raise exception 'Unmapped question ID accepted';
  end if;

  -- Explicitly wrong outcome identity must fail even when the version exists.
  select id into other_outcome_id from public.curriculum_learning_outcomes
   where id <> o.id limit 1;
  if other_outcome_id is not null then
    update public.learning_resources set curriculum_outcome_id=other_outcome_id
     where id=core_id;
    if public.cla_audit_outcome_package(pkg_id,manifest)->>'valid' <> 'false' then
      raise exception 'Cross-outcome pinned resource was accepted';
    end if;
    update public.learning_resources set curriculum_outcome_id=o.id where id=core_id;
  end if;

  -- An existing manifest cannot change the identity of its canonical root.
  begin
    update public.learning_resources set asset_kind='content_block' where id=pkg_id;
    raise exception 'PACKAGE ROOT IDENTITY GUARD DID NOT FIRE';
  exception when check_violation then
    if sqlerrm <> 'CLA_PACKAGE_ROOT_IDENTITY_IMMUTABLE' then raise; end if;
  end;

  -- A fully reconciled legacy-active outcome must pass the established P0
  -- source/alias gate even without the newer imported verified_at/source_import.
  select ao.outcome_id,ao.package_id,ao.manuscript_alias
  into gated_outcome_id,gated_package_id,gated_alias
  from public.vs_curriculum_alias_outcomes ao
  join public.curriculum_learning_outcomes go on go.id=ao.outcome_id
  where go.status='active'
    and nullif(btrim(go.source_locator),'') is not null
    and (public.vs_curriculum_package_gate(ao.package_id)->>'state')='PASS'
  limit 1;
  if gated_outcome_id is not null then
    insert into public.learning_resources (
      source_type,title,owner_type,visibility,canonical_key,asset_kind,purpose,curriculum_outcome_id
    ) values ('platform_generated','P0 gated core','platform','public',
              'p0-test-gated-core-'||gen_random_uuid(),'learner_notes','teach',gated_outcome_id)
      returning id into gated_core_id;
    insert into public.learning_resource_versions (
      resource_id,version,lifecycle_status,payload,content_sha256,
      rights_status,certification_policy_version,certification_evidence,certified_at
    ) values (gated_core_id,1,'certified','{"text":"Gated fixture"}'::jsonb,
              repeat('c',64),'cleared','p0-test','{"fixture":true}'::jsonb,now())
      returning id into gated_core_version;
    insert into public.learning_resources (
      source_type,title,owner_type,visibility,canonical_key,asset_kind,purpose,curriculum_outcome_id
    ) values ('platform_generated','P0 gated package','platform','public',
              'p0-test-gated-package-'||gen_random_uuid(),'outcome_package','reference',gated_outcome_id)
      returning id into gated_pkg_id;
    gated_manifest := jsonb_set(manifest,'{outcome_id}',to_jsonb(gated_outcome_id::text));
    gated_manifest := jsonb_set(gated_manifest,'{curriculum_package_id}',to_jsonb(gated_package_id));
    gated_manifest := jsonb_set(gated_manifest,'{curriculum_outcome_aliases}',jsonb_build_array(gated_alias));
    gated_manifest := jsonb_set(gated_manifest,'{assets,core,0,resource_id}',to_jsonb(gated_core_id::text));
    gated_manifest := jsonb_set(gated_manifest,'{assets,core,0,resource_version_id}',to_jsonb(gated_core_version::text));
    audit := public.cla_audit_outcome_package(gated_pkg_id,gated_manifest);
    if audit->>'valid' <> 'true'
       or audit->>'curriculum_reconciled' <> 'true'
       or audit #>> '{experiences,core,releasable}' <> 'true' then
      raise exception 'Active P0-gated outcome wrongly blocked: %',audit;
    end if;
    broken := jsonb_set(gated_manifest,'{curriculum_package_id}',to_jsonb('INVALID-PACKAGE'::text));
    if public.cla_audit_outcome_package(gated_pkg_id,broken)->>'valid' <> 'false' then
      raise exception 'Invalid P0 reconciliation package ID accepted';
    end if;
    broken := jsonb_set(gated_manifest,'{curriculum_outcome_aliases}',jsonb_build_array('INVALID-ALIAS'));
    if public.cla_audit_outcome_package(gated_pkg_id,broken)->>'valid' <> 'false' then
      raise exception 'Unreconciled P0 alias accepted';
    end if;
  end if;

  -- Version trigger must reject a false release, not merely report it.
  begin
    update public.learning_resource_versions
       set payload=jsonb_set(manifest,'{release,revision}','"ready"'::jsonb)
       where id=pkg_version;
    raise exception 'TRIGGER DID NOT REJECT false readiness';
  exception when check_violation then
    if sqlerrm <> 'CLA_OUTCOME_PACKAGE_INVALID' then raise; end if;
  end;

  if has_function_privilege('anon','public.cla_audit_outcome_package(uuid,jsonb)','execute')
     or has_function_privilege('authenticated','public.cla_audit_outcome_package(uuid,jsonb)','execute') then
    raise exception 'Browser roles must not invoke raw manifest audit';
  end if;
  raise notice 'P0 outcome package manifest verification PASS';
end;
$verify$;

rollback;
