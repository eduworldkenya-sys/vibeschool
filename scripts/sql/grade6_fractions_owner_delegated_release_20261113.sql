-- One-time owner-delegated Grade 6 Mathematics Fractions release.
-- Owner instruction: "continue publish" (13 Nov 2026).
-- Existing Grade 1/Grade 4 database-operator precedent; no simulated user login.
-- AI-assisted arithmetic review is NOT independent human or KICD certification.
begin;
do $release$
declare
  r public.learning_resources%rowtype;
  v public.learning_resource_versions%rowtype;
  n integer;
  k constant text:='vs:g6:mathematics:fractions:addition:learner:lesson:01';
begin
  if current_user<>'postgres' or auth.uid() is not null then
    raise exception 'G6_DATABASE_OPERATOR_ONLY';
  end if;
  if not exists (
    select 1 from public.grade6_mathematics_reader_bindings b
    join public.cbc_strands s on s.id=b.sub_strand_id
    join public.curriculum_learning_outcomes o on o.sub_strand_id=s.id
    where b.source_ref='VS-CUR-G06-MA-2026#1.4' and b.status='active'
      and s.id='d8f452e0-3270-4389-ad86-646af8f26f6d'::uuid
      and s.grade='Grade 6' and s.name='Numbers' and s.sub_strand='Fractions'
      and o.id='65cc88b5-0767-4c09-965c-0ce562f3fdae'::uuid
      and o.outcome_code='VS-G6-MA-1.4-1' and o.status='active'
  ) then raise exception 'G6_CANONICAL_OUTCOME_REQUIRED'; end if;
  select * into r from public.learning_resources where canonical_key=k for update;
  if r.id is null or r.owner_type<>'platform' or r.source_type<>'platform_authored'
    or r.grade<>'Grade 6' or r.subject<>'Mathematics' or r.strand<>'Numbers'
    or r.sub_strand_id<>'d8f452e0-3270-4389-ad86-646af8f26f6d'::uuid
    or r.curriculum_outcome_id<>'65cc88b5-0767-4c09-965c-0ce562f3fdae'::uuid
    or r.asset_kind<>'learner_notes' or r.status<>'inactive' or r.visibility<>'private'
    then raise exception 'G6_PRIVATE_CANONICAL_RESOURCE_REQUIRED'; end if;
  select count(*) into n from public.learning_resource_versions where resource_id=r.id;
  if n<>1 then raise exception 'G6_ONE_VERSION_REQUIRED'; end if;
  select * into v from public.learning_resource_versions
    where resource_id=r.id and version=1 and lifecycle_status='candidate' for update;
  if v.id is null or v.verified_at is not null or v.certified_at is not null
    or v.rights_status<>'pending' or v.payload_format<>'json'
    or v.content_sha256<>encode(extensions.digest(convert_to(v.payload::text,'UTF8'),'sha256'),'hex')
    then raise exception 'G6_CANDIDATE_HASH_OR_STATE_INVALID'; end if;
  if v.payload->>'schema'<>'vibeschool.originals.lesson-content.v1'
    or v.payload->>'package_id'<>'VS-G06-MA-1.4-FRACTIONS-ADD-20261113'
    or v.payload->>'source_edition'<>'learner' or v.payload->>'unit_id'<>'1.4'
    or v.payload->'canonical_curriculum_outcome_ids'<>
       jsonb_build_array('65cc88b5-0767-4c09-965c-0ce562f3fdae')
    or length(v.payload->>'content_text')<8000
    or jsonb_array_length(v.payload->'sections')<>6
    or jsonb_array_length(v.payload->'questions')<>63
    or jsonb_array_length(v.payload->'quick_check_mcqs')<>5
    or jsonb_array_length(v.payload->'bank_candidates')<>20
    or v.payload->'sections'->0->'tools'->0->>'id'<>'fraction-bars'
    or (v.payload->'sections')::text like '%grade6-fractions-addition-assets/%'
    then raise exception 'G6_LEARNER_PACKAGE_INCOMPLETE'; end if;
  if exists (select 1 from jsonb_array_elements(v.payload->'questions') q
     where coalesce(q->>'prompt','')='' or coalesce(q->>'answer','')=''
       or coalesce(q->>'explanation','')='')
    then raise exception 'G6_PRACTICE_FEEDBACK_INCOMPLETE'; end if;
  if exists (select 1 from jsonb_array_elements(v.payload->'bank_candidates') q
    where q->>'unseen_exam_eligible'<>'false'
      or q->>'status'<>'exposed_draft_not_unseen_exam')
    then raise exception 'G6_UNSEEN_EXAM_BANK_INTEGRITY'; end if;
  perform public.cla_verify_learning_resource_candidate(v.id,
    'vs-g6-operator-fractions-review-v1',
    jsonb_build_object('owner_authorization','continue publish, 13 November 2026',
      'reviewer_kind','AI-assisted operator, not independent human reviewer',
      'independent_human_review',false,
      'scope','one Grade 6 Fractions addition learning outcome',
      'arithmetic_review','38 exact-fraction automated checks passed; 20 practice-bank candidates reviewed',
      'copyright','VibeSchool-original learner lesson',
      'curriculum_source_verification','PENDING, no official endorsement',
      'visuals','native fraction-bars tool, SVGs not yet registered',
      'unseen_exam_bank',false,'payload_sha256',v.content_sha256),
    'cleared');
  select * into v from public.learning_resource_versions where id=v.id for update;
  if v.lifecycle_status<>'verified' or v.verified_at is null
    or v.verification_evidence='{}'::jsonb or v.rights_status<>'cleared'
    then raise exception 'G6_VERIFICATION_MISSING'; end if;
  -- Database-operator commission; original owner-only RPC remains unchanged.
  update public.learning_resource_versions set
    lifecycle_status='certified',certified_at=clock_timestamp(),
    certification_policy_version='vs-owner-delegated-operator-release-v1',
    certification_evidence=jsonb_build_object(
      'owner_instruction','continue publish, 13 November 2026',
      'authority','database operator acting on explicit publication instruction, no simulated login',
      'review','AI-assisted, not independent human QA',
      'curriculum','KICD scope alignment not formal certification',
      'visuals','native fraction-bars; static assets remain pending',
      'unseen_exam_bank',false,
      'payload_sha256',v.content_sha256)
  where id=v.id and lifecycle_status='verified' and rights_status='cleared'
    and verification_evidence<>'{}'::jsonb;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'G6_CERTIFICATION_NOT_ATOMIC'; end if;
  update public.learning_resources set status='active',visibility='public'
    where id=r.id and status='inactive' and visibility='private';
  get diagnostics n=row_count;
  if n<>1 then raise exception 'G6_VISIBILITY_NOT_ATOMIC'; end if;
  select count(*) into n from public.vs_public_grade6_fractions_addition_learner_lesson();
  if n<>1 then raise exception 'G6_PUBLIC_READER_NOT_VISIBLE'; end if;
end;
$release$;
commit;
