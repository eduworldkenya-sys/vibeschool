-- VibeSchool Grade 4 Mathematics / Measurement 2.6 Time
-- Owner-delegated, database-operator one-shot release of 10 VibeSchool-original
-- learner manuscripts authored through ChatGPT-led production.
--
-- Authorization evidence: explicit owner request to publish Grade 4 Time
-- content, then "continue"; not a simulated owner login.
-- AI-assisted author/operator review is NOT an independent human review,
-- learner study, KICD approval or endorsement. This exception matches
-- VibeSchool's existing Grade 1 Jumping owner-delegated operator precedent.
-- Execute only from trusted database administrator tooling, never a public
-- browser, service-role secret in frontend, or client SDK.
begin;

do $release$
declare
  v_count integer;
  v_total_questions integer;
  v_bad integer;
  v_record record;
  v_release constant text := 'vs-g04-ma-time-operator-release-20261111-v1';
  v_source constant text := 'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf';
  v_substrand constant uuid := 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c';
begin
  if current_user <> 'postgres' or (select auth.uid()) is not null then
    raise exception 'GRADE4_TIME_DATABASE_OPERATOR_ONLY';
  end if;

  if not exists (
    select 1
    from public.grade4_mathematics_reader_bindings b
    join public.cbc_strands s on s.id=b.sub_strand_id
    where b.source_ref='VS-CUR-G04-MA-2026#2.6'
      and b.sub_strand_id=v_substrand and b.status='active'
      and s.grade='Grade 4' and s.name='Measurement' and s.sub_strand='Time'
  ) then raise exception 'GRADE4_TIME_CANONICAL_BINDING_MISSING'; end if;

  -- No partial batch, wrong-grade resource, duplicate version, or empty body.
  select count(*),coalesce(sum(jsonb_array_length(v.payload->'questions')),0)
  into v_count,v_total_questions
  from public.learning_resources r
  join public.learning_resource_versions v on v.resource_id=r.id
  where r.canonical_key ~ '^vs:g4:mathematics:time:learner:lesson:(0[1-9]|10)$'
    and r.owner_type='platform' and r.source_type='platform_authored'
    and r.grade='Grade 4' and r.subject='Mathematics'
    and r.sub_strand_id=v_substrand and r.status='active' and r.visibility='public'
    and r.asset_kind='learner_notes'
    and v.version=1 and v.lifecycle_status='candidate'
    and v.rights_status='cleared'
    and v.payload->>'schema'='vibeschool.originals.lesson-content.v1'
    and v.payload->>'source_edition'='learner'
    and v.payload->>'package_id'='VS-G04-MA-2.6-TIME-20261111'
    and length(v.payload->>'content_text')>=2000
    and jsonb_typeof(v.payload->'teacher_guidance')='object'
    and jsonb_typeof(v.payload->'questions')='array'
    and v.content_sha256=encode(extensions.digest(convert_to(v.payload::text,'UTF8'),'sha256'),'hex');

  if v_count<>10 or v_total_questions<>72 then
    raise exception 'GRADE4_TIME_RELEASE_PRECHECK_RESOURCES_%_QUESTIONS_%', v_count, v_total_questions;
  end if;

  select count(*) into v_bad from public.learning_resources r
  where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    and r.canonical_key !~ '^vs:g4:mathematics:time:learner:lesson:(0[1-9]|10)$';
  if v_bad<>0 then raise exception 'GRADE4_TIME_UNEXPECTED_RESOURCE_KEY'; end if;

  select count(*) into v_bad from public.learning_resources r
  join public.learning_resource_versions v on v.resource_id=r.id
  where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    and (v.lifecycle_status<>'candidate' or v.version<>1 or v.verified_at is not null
      or v.certified_at is not null);
  if v_bad<>0 then raise exception 'GRADE4_TIME_NONCANDIDATE_OR_DUPLICATE_VERSION'; end if;

  select count(*) into v_count from (
    select distinct (v.payload->>'lesson_order')::integer as lesson_order
    from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
    where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    and (v.payload->>'lesson_order')::integer between 1 and 10
  ) numbered;
  if v_count<>10 then raise exception 'GRADE4_TIME_LESSON_ORDER_INCOMPLETE'; end if;

  select count(*) into v_count from (
    select distinct outcome_id from public.learning_resources r
    join public.learning_resource_versions v on v.resource_id=r.id
    cross join lateral jsonb_array_elements_text(v.payload->'learning_outcome_ids') outcome_id
    where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
  ) ids;
  if v_count<>7 then raise exception 'GRADE4_TIME_OUTCOME_COVERAGE_NOT_SEVEN'; end if;

  if exists (
    select 1 from public.learning_resources r
    join public.learning_resource_versions v on v.resource_id=r.id
    cross join lateral jsonb_array_elements(v.payload->'questions') q
    where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
      and (coalesce(q->>'id','')='' or coalesce(q->>'prompt','')=''
           or coalesce(q->>'answer','')='' or coalesce(q->>'explanation','')='')
  ) then raise exception 'GRADE4_TIME_QUESTION_EVIDENCE_INCOMPLETE'; end if;

  -- Use the existing canonical verification transition. The actual reviewer
  -- type is recorded, with no false assertion of human independence.
  for v_record in
    select v.id, r.canonical_key,v.content_sha256 from public.learning_resources r
    join public.learning_resource_versions v on v.resource_id=r.id
    where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    order by r.canonical_key
  loop
    perform public.cla_verify_learning_resource_candidate(
      v_record.id,
      'vs-g04-time-operator-source-and-answer-audit-v1',
      jsonb_build_object(
        'release',v_release,
        'reviewer_kind','ChatGPT-assisted database operator, not independent human evaluator',
        'source',v_source,
        'source_section','2024 revised Grade 4 Mathematics, Measurement 2.6 Time, printed pp.32-33',
        'source_outcomes','a-g, including digital time and appreciation of time',
        'content_check','10 distinct lessons, 72 answered/explained items, all 7 mapped outcomes, complete bodies, canonical hashes',
        'method','operator checked source-to-outcome coverage, internal calculations and resource integrity',
        'independent_human_review',false,
        'owner_authority','explicit request to produce and publish, followed by continue',
        'resource_key',v_record.canonical_key,
        'payload_sha256',v_record.content_sha256
      ),
      'cleared'
    );
  end loop;

  select count(*) into v_count from public.learning_resources r
  join public.learning_resource_versions v on v.resource_id=r.id
  where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    and v.lifecycle_status='verified' and v.verified_at is not null
    and v.verification_policy_version='vs-g04-time-operator-source-and-answer-audit-v1'
    and v.verification_evidence<>'{}'::jsonb and v.rights_status='cleared';
  if v_count<>10 then raise exception 'GRADE4_TIME_VERIFICATION_TRANSITION_FAILED'; end if;

  -- Scoped owner-delegated database-operator release, per existing precedent.
  -- The platform-owner-only RPC is NOT redefined, weakened or exposed.
  update public.learning_resource_versions v
  set lifecycle_status='certified',
    certified_at=clock_timestamp(),
    certification_policy_version='vs-owner-delegated-operator-release-v1',
    certification_evidence=jsonb_build_object(
      'release',v_release,
      'authority','database operator implementing explicit owner publication instruction, without impersonating owner login',
      'source',v_source,
      'verification_policy',v.verification_policy_version,
      'verification_recorded_at',v.verified_at,
      'reviewer_kind','AI-assisted operator; NOT independent human reviewer',
      'independent_human_review',false,
      'rights_basis','original VibeSchool-authored lessons; KICD used for scope not copied',
      'kicd_endorsement',false,
      'payload_sha256',v.content_sha256
    )
  from public.learning_resources r
  where r.id=v.resource_id
    and r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%'
    and v.lifecycle_status='verified'
    and v.verified_at is not null
    and v.verification_evidence<>'{}'::jsonb and v.rights_status='cleared';
  get diagnostics v_count=row_count;
  if v_count<>10 then raise exception 'GRADE4_TIME_CERTIFICATION_INCOMPLETE'; end if;

  select count(*) into v_count
  from public.vs_public_grade4_math_time_learner_lessons();
  if v_count<>10 then raise exception 'GRADE4_TIME_PUBLIC_READER_DID_NOT_RETURN_TEN'; end if;

end;
$release$;

commit;
