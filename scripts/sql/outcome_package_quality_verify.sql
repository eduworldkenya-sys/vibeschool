-- P1 canonical package quality smoke. Disposable database / transaction rollback only.
-- Production certification is NOT performed by this test.
begin;
do $test$
declare
  o public.curriculum_learning_outcomes%rowtype;
  source_package_id text;
  manuscript_alias text;
  core_id uuid;
  core_version uuid;
  pkg_id uuid;
  pkg_version uuid;
  visual_id uuid;
  visual_version uuid;
  manifest jsonb;
  bad_manifest jsonb;
  evidence jsonb;
  bad_evidence jsonb;
  digest text;
  report jsonb;
  blocked boolean;
  v_name text;
begin
  select o0.* into o
  from public.curriculum_learning_outcomes o0
  join public.vs_curriculum_alias_outcomes ao on ao.outcome_id=o0.id
  where o0.status='active'
    and nullif(btrim(o0.source_locator),'') is not null
    and public.vs_curriculum_package_gate(ao.package_id)->>'state'='PASS'
  limit 1;
  if o.id is null then
    raise exception 'P1 fixture requires an exactly reconciled curriculum outcome';
  end if;
  select ao.package_id,ao.manuscript_alias into source_package_id,manuscript_alias
  from public.vs_curriculum_alias_outcomes ao
  where ao.outcome_id=o.id
    and public.vs_curriculum_package_gate(ao.package_id)->>'state'='PASS'
  limit 1;

  insert into public.learning_resources(
    source_type,title,status,owner_type,visibility,canonical_key,
    grade,subject,asset_kind,purpose,curriculum_outcome_id
  ) values (
    'platform_generated','P1 mathematics core','active','platform','public',
    'p1-quality-core-'||gen_random_uuid(),'Grade 4','Mathematics',
    'learner_notes','teach',o.id
  ) returning id into core_id;

  insert into public.learning_resource_versions(
    resource_id,version,lifecycle_status,payload,content_sha256,
    rights_status,certification_policy_version,certification_evidence,certified_at
  ) values (
    core_id,1,'certified',
    '{"worked":{"prompt":"Convert 2 hours to minutes","steps":["One hour is 60 minutes","2 times 60 is 120 minutes"]}}'::jsonb,
    repeat('a',64),'cleared','fixture-v1','{"test":true}'::jsonb,now()
  ) returning id into core_version;

  insert into public.learning_resources(
    source_type,title,status,owner_type,visibility,canonical_key,
    grade,subject,asset_kind,purpose,curriculum_outcome_id
  ) values (
    'platform_generated','P1 outcome package','active','platform','public',
    'p1-quality-package-'||gen_random_uuid(),'Grade 4','Mathematics',
    'outcome_package','reference',o.id
  ) returning id into pkg_id;

  manifest := jsonb_build_object(
    'schema','vibeschool.outcome-package.v1','outcome_id',o.id,
    'curriculum_package_id',source_package_id,
    'curriculum_outcome_aliases',jsonb_build_array(manuscript_alias),
    'requirements',jsonb_build_object('teacher_guidance',false,'visual_assets',false),
    'assets',jsonb_build_object(
      'core',jsonb_build_array(jsonb_build_object(
        'resource_id',core_id,'resource_version_id',core_version)),
      'activities','[]'::jsonb,'revision','[]'::jsonb,
      'teacher_guidance','[]'::jsonb,'visual_assets','[]'::jsonb),
    'question_ids',jsonb_build_object('activities','[]'::jsonb,'revision','[]'::jsonb),
    'release',jsonb_build_object('core','ready','activities','draft','revision','draft')
  );
  digest := encode(extensions.digest(convert_to(manifest::text,'UTF8'),'sha256'),'hex');
  evidence := jsonb_build_object('package_quality_v1',jsonb_build_object(
    'policy','outcome-package-quality-v1',
    'content_sha256',digest,
    'source_package_id',source_package_id,
    'reviewer_kind','ai_assisted_operator',
    'independent_human_review',false,
    'checks',jsonb_build_object(
      'curriculum_match',jsonb_build_object('status','pass','method','Source-to-identity checked','evidence_ref','test/curriculum'),
      'mathematical_correctness',jsonb_build_object('status','pass','method','Independent arithmetic audit','evidence_ref','test/maths'),
      'worked_steps',jsonb_build_object('status','pass','method','Steps and reasons verified','evidence_ref','test/steps'),
      'answer_keys',jsonb_build_object('status','pass','method','Answer guide checked','evidence_ref','test/answers'),
      'teacher_usefulness',jsonb_build_object('status','pass','method','Teacher prompts inspected','evidence_ref','test/teacher'),
      'rights',jsonb_build_object('status','pass','method','Original asset claims reviewed','evidence_ref','test/rights'),
      'accessibility',jsonb_build_object('status','pass','method','Text accessibility reviewed','evidence_ref','test/a11y'),
      'cross_surface_links',jsonb_build_object('status','pass','method','Reader and teacher test executed','evidence_ref','test/links')
    ),
    'delivery_tests',jsonb_build_object(
      'learner_reader',jsonb_build_object('status','pass','evidence_ref','test/learner-reader'),
      'teacher_tools',jsonb_build_object('status','pass','evidence_ref','test/teacher-tools')
    )
  ));
  report := public.cla_outcome_package_quality_gate(
    pkg_id,manifest,digest,'cleared',evidence);
  if report->>'state' <> 'PASS' then
    raise exception 'Valid fixture quality audit did not pass: %', report;
  end if;


  bad_evidence := jsonb_set(evidence,
    '{package_quality_v1,source_package_id}','"missing-source-package"'::jsonb);
  report := public.cla_outcome_package_quality_gate(
    pkg_id,manifest,digest,'cleared',bad_evidence);
  if report->>'state' <> 'BLOCKED'
     or report::text not like '%SOURCE_TO_DATABASE_RECONCILIATION_BLOCKED%' then
    raise exception 'Unreconciled source package accepted: %',report;
  end if;
  bad_manifest := jsonb_set(manifest,'{curriculum_package_id}',to_jsonb('wrong-curriculum-source'));
  report := public.cla_outcome_package_quality_gate(
    pkg_id,bad_manifest,encode(extensions.digest(convert_to(bad_manifest::text,'UTF8'),'sha256'),'hex'),'cleared',evidence);
  if report->>'state' <> 'BLOCKED'
     or report::text not like '%SOURCE_PACKAGE_MANIFEST_MISMATCH%' then
    raise exception 'Manifest source mismatch accepted: %',report;
  end if;
  bad_manifest := jsonb_set(manifest,'{curriculum_outcome_aliases}',jsonb_build_array('wrong-manuscript-alias'));
  report := public.cla_outcome_package_quality_gate(
    pkg_id,bad_manifest,encode(extensions.digest(convert_to(bad_manifest::text,'UTF8'),'sha256'),'hex'),'cleared',evidence);
  if report->>'state' <> 'BLOCKED'
     or report::text not like '%CURRICULUM_MANUSCRIPT_ALIASES_NOT_RECONCILED%' then
    raise exception 'Wrong manuscript alias accepted: %',report;
  end if;

  bad_evidence := '{}'::jsonb;
  report := public.cla_outcome_package_quality_gate(
    pkg_id,manifest,digest,'cleared',bad_evidence);
  if report->>'state' <> 'BLOCKED' or report::text not like '%QUALITY_EVIDENCE%' then
    raise exception 'Missing evidence was accepted: %',report;
  end if;

  report := public.cla_outcome_package_quality_gate(
    pkg_id,manifest,repeat('b',64),'cleared',evidence);
  if report->>'state' <> 'BLOCKED' or report::text not like '%HASH_MISMATCH%' then
    raise exception 'Stale checksum was accepted: %',report;
  end if;

  bad_evidence := jsonb_set(evidence,
    '{package_quality_v1,delivery_tests,teacher_tools,status}','"fail"'::jsonb);
  report := public.cla_outcome_package_quality_gate(
    pkg_id,manifest,digest,'cleared',bad_evidence);
  if report->>'state' <> 'BLOCKED' or report::text not like '%DELIVERY_TEST_NOT_VERIFIED%' then
    raise exception 'Unproven teacher delivery was accepted: %',report;
  end if;

  -- Real visual version, but caption is blank. Its existence is insufficient.
  insert into public.learning_resources(
    source_type,title,status,owner_type,visibility,canonical_key,
    grade,subject,asset_kind,purpose,curriculum_outcome_id
  ) values (
    'platform_generated','P1 inaccessible diagram','active','platform','public',
    'p1-quality-visual-'||gen_random_uuid(),'Grade 4','Mathematics',
    'visual_aid','reference',o.id
  ) returning id into visual_id;
  insert into public.learning_resource_versions(
    resource_id,version,lifecycle_status,payload,content_sha256,
    rights_status,certification_policy_version,certification_evidence,certified_at
  ) values (
    visual_id,1,'certified',
    '{"schema":"vibeschool.visual.v1","visual_type":"diagram","alt_text":"Clock with hands","caption":"","labels":["Hour"],"placements":["worked_example"],"storage":{"bucket":"vibe-publication-drafts","path":"visual-library/11111111-1111-4111-8111-111111111111.png"}}'::jsonb,
    repeat('c',64),'cleared','fixture-v1','{"test":true}'::jsonb,now()
  ) returning id into visual_version;
  bad_manifest := jsonb_set(manifest,'{assets,visual_assets}',
    jsonb_build_array(jsonb_build_object('resource_id',visual_id,'resource_version_id',visual_version)));
  report := public.cla_outcome_package_quality_gate(
    pkg_id,bad_manifest,
    encode(extensions.digest(convert_to(bad_manifest::text,'UTF8'),'sha256'),'hex'),
    'cleared',evidence);
  if report->>'state' <> 'BLOCKED'
     or report::text not like '%VISUAL_ACCESSIBILITY%' then
    raise exception 'Blank diagram caption accepted: %',report;
  end if;

  insert into public.learning_resource_versions(
    resource_id,version,lifecycle_status,payload,content_sha256,
    rights_status,verification_policy_version,verification_evidence,verified_at
  ) values (
    pkg_id,1,'candidate',manifest,digest,'cleared',
    'p1-test-v1',evidence,now()
  ) returning id into pkg_version;

  blocked := false;
  begin
    update public.learning_resource_versions
       set lifecycle_status='certified',
           certified_at=now(),
           certification_policy_version='test-v1',
           certification_evidence='{"test":true}'::jsonb
    where id=pkg_version;
  exception when check_violation then
    blocked := sqlerrm='CLA_OUTCOME_PACKAGE_INDEPENDENT_VERIFICATION_REQUIRED';
  end;
  if not blocked then raise exception 'Candidate skipped verified transition'; end if;

  update public.learning_resource_versions
    set lifecycle_status='verified',verification_evidence=evidence,verified_at=now()
    where id=pkg_version;

  blocked := false;
  begin
    update public.learning_resource_versions
       set lifecycle_status='certified',
           certified_at=now(),
           certification_policy_version='test-v1',
           certification_evidence='{"independent_human_review":true}'::jsonb
    where id=pkg_version;
  exception when check_violation then
    blocked := sqlerrm='CLA_OUTCOME_PACKAGE_UNSUPPORTED_HUMAN_APPROVAL_CLAIM';
  end;
  if not blocked then raise exception 'Fabricated human approval accepted'; end if;

  update public.learning_resource_versions
     set lifecycle_status='certified',
         certified_at=now(),
         certification_policy_version='test-v1',
         certification_evidence='{"test_only":true,"independent_human_review":false}'::jsonb
    where id=pkg_version;

  if (select lifecycle_status from public.learning_resource_versions
      where id=pkg_version) <> 'certified' then
    raise exception 'Valid package did not reach existing canonical certified state';
  end if;

  if has_function_privilege('anon',
    'public.cla_outcome_package_quality_gate(uuid,jsonb,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated',
    'public.cla_outcome_package_quality_gate(uuid,jsonb,text,text,jsonb)','EXECUTE') then
    raise exception 'Quality report must remain service-only';
  end if;
  raise notice 'P1 outcome package quality gate PASS (fixture rolled back)';
end
$test$;
rollback;
