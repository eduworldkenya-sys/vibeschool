-- P1: Quality and publication gate for canonical outcome packages.
-- Existing authorities only: learning_resources, immutable learning_resource_versions,
-- cla_audit_outcome_package, curriculum reconciliation and assessment_questions.
-- This migration does not certify, approve, publish or create reviewer identities.
begin;

create or replace function public.cla_outcome_package_quality_gate(
  p_resource_id uuid,
  p_payload jsonb,
  p_content_sha256 text,
  p_rights_status text,
  p_verification_evidence jsonb
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $quality$
declare
  root public.learning_resources%rowtype;
  manifest_audit jsonb;
  quality jsonb := p_verification_evidence->'package_quality_v1';
  checks jsonb := quality->'checks';
  blockers text[] := array[]::text[];
  check_name text;
  state text;
  method text;
  ref text;
  exp text;
  released_count integer := 0;
  practice_release boolean := false;
  maths boolean := false;
  pin jsonb;
  pin_row record;
  qid text;
  question record;
  role text;
  steps_ok boolean := false;
  worked jsonb;
  visual jsonb;
  delivery jsonb;
  delivery_name text;
begin
  select * into root from public.learning_resources where id = p_resource_id;
  if root.id is null or root.asset_kind is distinct from 'outcome_package' then
    return jsonb_build_object('state','BLOCKED','blockers',jsonb_build_array('PACKAGE_ROOT_INVALID'),
      'policy','outcome-package-quality-v1');
  end if;

  manifest_audit := public.cla_audit_outcome_package(p_resource_id,p_payload);
  if coalesce(manifest_audit->>'valid','false') <> 'true' then
    blockers := array_append(blockers,'PACKAGE_MANIFEST_OR_CURRICULUM_NOT_READY');
  end if;
  if p_rights_status not in ('cleared','not_applicable') or p_rights_status is null then
    blockers := array_append(blockers,'PACKAGE_RIGHTS_UNCLEARED');
  end if;
  if p_content_sha256 is null or p_content_sha256 is distinct from
    encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex') then
    blockers := array_append(blockers,'PACKAGE_PAYLOAD_HASH_MISMATCH');
  end if;

  maths := lower(coalesce(root.subject,'')) like '%math%';
  if nullif(btrim(coalesce(root.subject,'')),'') is null and root.subject_id is null then
    blockers := array_append(blockers,'SUBJECT_SCOPE_UNDECLARED');
  end if;
  if root.subject_id is not null then
    -- Never treat a missing Mathematics label as a reason to skip worked-step review.
    maths := maths or exists (
      select 1 from public.subjects s
      where s.id = root.subject_id and lower(coalesce(s.name,'')) like '%math%'
    );
  end if;

  if jsonb_typeof(quality) is distinct from 'object'
     or quality->>'policy' is distinct from 'outcome-package-quality-v1'
     or quality->>'content_sha256' is distinct from p_content_sha256
     or coalesce(quality->>'reviewer_kind','') not in ('ai_assisted_operator','automated_and_operator')
     or jsonb_typeof(quality->'independent_human_review') is distinct from 'boolean'
     or quality->>'independent_human_review' is distinct from 'false'
     or jsonb_typeof(checks) is distinct from 'object' then
    blockers := array_append(blockers,'QUALITY_EVIDENCE_MISSING_STALE_OR_MISATTRIBUTED');
  end if;

  -- These are scoped operator/test attestations, NOT inferred independent human
  -- approvals and NOT mathematical correctness inferred from a passing schema.
  foreach check_name in array array[
    'curriculum_match','mathematical_correctness','worked_steps','answer_keys',
    'teacher_usefulness','rights','accessibility','cross_surface_links'
  ] loop
    state := checks->check_name->>'status';
    method := btrim(coalesce(checks->check_name->>'method',''));
    ref := btrim(coalesce(checks->check_name->>'evidence_ref',''));
    if state = 'not_applicable' and check_name in ('mathematical_correctness','worked_steps')
       and not maths
       and length(btrim(coalesce(checks->check_name->>'reason',''))) >= 12 then
      continue;
    end if;
    if state is distinct from 'pass' or length(method) < 12 or length(ref) < 8 then
      blockers := array_append(blockers,'QUALITY_CHECK_UNPROVEN:'||check_name);
    end if;
  end loop;

  if jsonb_typeof(p_payload->'release') is distinct from 'object' then
    blockers := array_append(blockers,'PACKAGE_RELEASE_STATES_MISSING');
  else
    foreach exp in array array['core','activities','revision'] loop
      if p_payload #>> array['release',exp] in ('ready','released') then
        released_count := released_count + 1;
        if exp in ('activities','revision') then practice_release := true; end if;
        if manifest_audit #>> array['experiences',exp,'releasable'] is distinct from 'true' then
          blockers := array_append(blockers,'EXPERIENCE_NOT_RELEASABLE:'||exp);
        end if;
      end if;
    end loop;
  end if;
  if released_count = 0 then
    blockers := array_append(blockers,'NO_READY_OR_RELEASED_EXPERIENCE');
  end if;

  -- Check actual versioned visual rights and accessibility, not only reported QA.
  -- Other pinned assets must retain their immutable rights clearance.
  if jsonb_typeof(p_payload->'assets') = 'object' then
    foreach role in array array['core','activities','revision','teacher_guidance','visual_assets'] loop
      if jsonb_typeof(p_payload #> array['assets',role]) is distinct from 'array' then
        blockers := array_append(blockers,'ASSET_PIN_ARRAY_MISSING:'||role);
        continue;
      end if;
      for pin in select value from jsonb_array_elements(p_payload #> array['assets',role]) loop
        if coalesce(pin->>'resource_version_id','') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
          blockers := array_append(blockers,'ASSET_PIN_ID_INVALID:'||role);
          continue;
        end if;
        select v.id,v.rights_status,v.lifecycle_status,v.payload,r.asset_kind
          into pin_row
        from public.learning_resource_versions v
        join public.learning_resources r on r.id = v.resource_id
        where v.id = (pin->>'resource_version_id')::uuid
          and r.id::text = pin->>'resource_id';
        if pin_row.id is null then
          blockers := array_append(blockers,'PINNED_VERSION_NOT_FOUND:'||role);
          continue;
        end if;
        if pin_row.rights_status not in ('cleared','not_applicable')
           or pin_row.lifecycle_status <> 'certified' then
          blockers := array_append(blockers,'PINNED_VERSION_NOT_CERTIFIED_OR_RIGHTS_CLEARED:'||role);
        end if;
        if role = 'visual_assets' then
          visual := pin_row.payload;
          if visual->>'schema' is distinct from 'vibeschool.visual.v1'
             or length(btrim(coalesce(visual->>'alt_text',''))) < 8
             or length(btrim(coalesce(visual->>'caption',''))) < 3
             or jsonb_typeof(visual->'labels') is distinct from 'array'
             or jsonb_typeof(visual->'placements') is distinct from 'array'
             or visual #>> '{storage,bucket}' is distinct from 'vibe-publication-drafts'
             or coalesce(visual #>> '{storage,path}','') !~ '^visual-library/[0-9a-f-]{36}\\.(png|jpg|webp|gif)$'
             or (visual->>'visual_type' in ('diagram','chart','graph','map','number_line','fraction_model')
               and jsonb_typeof(visual->'labels') = 'array'
               and jsonb_array_length(visual->'labels') = 0) then
            blockers := array_append(blockers,'VISUAL_ACCESSIBILITY_OR_STORAGE_INVALID');
          end if;
        end if;
        if role = 'core' and maths then
          worked := pin_row.payload;
          if jsonb_typeof(worked #> '{worked,steps}') = 'array' then
            steps_ok := steps_ok or jsonb_array_length(worked #> '{worked,steps}') >= 2;
          end if;
          if jsonb_typeof(worked->'worked_steps') = 'array' then
            steps_ok := steps_ok or jsonb_array_length(worked->'worked_steps') >= 2;
          end if;
          if jsonb_typeof(worked->'worked_examples') = 'array' then
            steps_ok := steps_ok or exists (
              select 1 from jsonb_array_elements(worked->'worked_examples') e
              where jsonb_typeof(e->'steps') = 'array'
                and jsonb_array_length(e->'steps') >= 2
            );
          end if;
        end if;
      end loop;
    end loop;
  end if;

  if maths and released_count > 0 and not steps_ok then
    blockers := array_append(blockers,'MATH_WORKED_STEPS_NOT_STRUCTURED');
  end if;

  -- Question-bank identity remains assessment_questions as defined by P0
  -- manifest. Do not create assessments, approve questions or leak formal items.
  foreach role in array array['activities','revision'] loop
    if jsonb_typeof(p_payload #> array['question_ids',role]) = 'array' then
      for pin in select value from jsonb_array_elements(p_payload #> array['question_ids',role]) loop
        qid := pin #>> '{}';
        if qid !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
          blockers := array_append(blockers,'QUESTION_ID_INVALID:'||role);
          continue;
        end if;
        select q.id,q.correct_answer,q.accepted_answers,q.marking_guide,
               q.explanation,q.review_status,q.reviewed_by,q.reviewed_at,q.status,
               q.learning_outcome_id,q.school_id
          into question from public.assessment_questions q where q.id=qid::uuid;
        if question.id is null or question.learning_outcome_id is distinct from root.curriculum_outcome_id
           or question.school_id is not null or question.status <> 'confirmed'
           or question.review_status <> 'approved' then
          blockers := array_append(blockers,'QUESTION_LINEAGE_OR_APPROVAL_INVALID:'||role);
          continue;
        end if;
        if question.reviewed_by is null or question.reviewed_at is null then
          blockers := array_append(blockers,'QUESTION_REVIEW_NOT_RECORDED:'||role);
        end if;
        if nullif(btrim(coalesce(question.correct_answer,'')),'') is null
           and (jsonb_typeof(question.accepted_answers) <> 'array'
             or question.accepted_answers = '[]'::jsonb)
           and coalesce(question.marking_guide,'{}'::jsonb) = '{}'::jsonb then
          blockers := array_append(blockers,'QUESTION_ANSWER_KEY_MISSING:'||role);
        end if;
        if length(btrim(coalesce(question.explanation,''))) < 8
           and coalesce(question.marking_guide,'{}'::jsonb) = '{}'::jsonb then
          blockers := array_append(blockers,'QUESTION_EXPLANATION_MISSING:'||role);
        end if;
      end loop;
    end if;
  end loop;

  -- Delivery is separately proved: a canonical package must not claim
  -- reader / teacher / practice readiness merely because its manifest exists.
  -- Evidence references are externally reproduced test runs, not approvals.
  delivery := quality->'delivery_tests';
  foreach delivery_name in array array['learner_reader','teacher_tools','practice'] loop
    if delivery_name='practice' and not practice_release then continue; end if;
    if delivery #> array[delivery_name,'status'] is distinct from '"pass"'::jsonb
       or length(btrim(coalesce(delivery #>> array[delivery_name,'evidence_ref'],''))) < 8 then
      blockers := array_append(blockers,'DELIVERY_TEST_NOT_VERIFIED:'||delivery_name);
    end if;
  end loop;

  return jsonb_build_object(
    'state',case when cardinality(blockers)=0 then 'PASS' else 'BLOCKED' end,
    'policy','outcome-package-quality-v1',
    'resource_id',p_resource_id,'outcome_id',root.curriculum_outcome_id,
    'reviewer_kind',quality->>'reviewer_kind',
    'independent_human_review',false,
    'maths_required',maths,
    'ready_or_released_experiences',released_count,
    'manifest_audit',manifest_audit,
    'blockers',to_jsonb(blockers)
  );
end
$quality$;

-- The existing certification RPC performs an UPDATE. A trigger also covers
-- direct privileged SQL transitions and INSERT ... lifecycle_status='certified'.
-- Historical certified versions are intentionally untouched.
create or replace function public.cla_require_outcome_package_quality()
returns trigger
language plpgsql security invoker set search_path = ''
as $guard$
declare
  kind text;
  report jsonb;
begin
  if new.lifecycle_status <> 'certified' then return new; end if;
  if tg_op='UPDATE' and old.lifecycle_status = 'certified' then return new; end if;
  select asset_kind into kind from public.learning_resources where id=new.resource_id;
  if kind is distinct from 'outcome_package' then return new; end if;
  if tg_op='INSERT' or old.lifecycle_status is distinct from 'verified'
     or new.verified_at is null or new.verification_evidence = '{}'::jsonb then
    raise exception using errcode='23514',
      message='CLA_OUTCOME_PACKAGE_INDEPENDENT_VERIFICATION_REQUIRED';
  end if;
  if new.certification_evidence->>'independent_human_review' = 'true' then
    raise exception using errcode='23514',
      message='CLA_OUTCOME_PACKAGE_UNSUPPORTED_HUMAN_APPROVAL_CLAIM';
  end if;
  report := public.cla_outcome_package_quality_gate(
    new.resource_id,new.payload,new.content_sha256,
    new.rights_status,new.verification_evidence);
  if report->>'state' <> 'PASS' then
    raise exception using errcode='23514',
      message='CLA_OUTCOME_PACKAGE_QUALITY_BLOCKED',detail=report::text;
  end if;
  return new;
end
$guard$;

drop trigger if exists cla_require_outcome_package_quality
  on public.learning_resource_versions;
create trigger cla_require_outcome_package_quality
before insert or update of lifecycle_status
on public.learning_resource_versions
for each row execute function public.cla_require_outcome_package_quality();

revoke all on function public.cla_outcome_package_quality_gate(uuid,jsonb,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.cla_outcome_package_quality_gate(uuid,jsonb,text,text,jsonb)
  to service_role;
revoke all on function public.cla_require_outcome_package_quality()
  from public,anon,authenticated,service_role;

comment on function public.cla_outcome_package_quality_gate(uuid,jsonb,text,text,jsonb) is
  'Read-only P1 evidence report; validates underlying canonical assets, answers, accessibility, declared QA and delivery test evidence before certification. Does not certify or approve.';
comment on function public.cla_require_outcome_package_quality() is
  'Fail-closed quality boundary on new outcome-package certification, including privileged direct SQL. Does not modify historical certified records.';

commit;