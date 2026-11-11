-- One-time, owner-delegated operator publication of original Grade 1 Jumping assets.
-- Run ONLY as the authenticated Supabase database operator (postgres), never as
-- an anonymous/student/teacher client. This does not widen certification RPC grants.
-- The KICD curriculum is a scope reference, not copied or claimed as publisher.
-- The user's explicit instruction authorized operator publication without a
-- separate owner login; the evidence records an AI-assisted review, not a human reviewer.
begin;
do $release$
declare
  v_count integer;
  v_bad integer;
  v_record record;
  v_source constant text := 'https://kicd.ac.ke/wp-content/uploads/2024/06/GRADE-1-CREATIVE-ACTIVITIES-DESIGN-May-2024-final.pdf';
  v_release constant text := 'vs-g01-ca-jumping-owner-delegated-2026-11-11';
begin
  if current_user <> 'postgres' or (select auth.uid()) is not null then
    raise exception 'GRADE1_RELEASE_DATABASE_OPERATOR_ONLY';
  end if;

  select count(*) into v_count
  from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
  join public.cbc_strands unit on unit.id=r.sub_strand_id
  where r.canonical_key like 'vs:g1:jumping:%'
    and unit.source_ref='VS-CUR-G01-CA-2026#1.1'
    and r.owner_type='platform' and r.source_type='platform_authored'
    and r.grade='Grade 1' and r.subject='Creative Activities'
    and r.status='inactive' and r.visibility='private'
    and v.lifecycle_status='candidate' and v.rights_status='pending'
    and v.payload->>'schema'='vibeschool.originals.lesson-content.v1'
    and length(v.payload->>'content_text') >= 300
    and v.content_sha256=encode(extensions.digest(convert_to(v.payload::text,'UTF8'),'sha256'),'hex');
  if v_count <> 33 then
    raise exception 'GRADE1_RELEASE_PRECHECK_EXPECTED_33_GOT_%',v_count;
  end if;

  select count(*) into v_count from public.learning_resources
  where canonical_key ~ '^vs:g1:jumping:learner:lesson:[0-9]{2}$';
  if v_count<>14 then raise exception 'GRADE1_RELEASE_INCOMPLETE_LEARNER_SEQUENCE'; end if;
  select count(*) into v_count from public.learning_resources
  where canonical_key ~ '^vs:g1:jumping:teacher:lesson:[0-9]{2}$';
  if v_count<>14 then raise exception 'GRADE1_RELEASE_INCOMPLETE_TEACHER_SEQUENCE'; end if;

  -- Correct the missing external-picture reference and put original song
  -- lyrics on the lesson which asks the learner to sing.
  with fixes as (
    select v.id,v.payload,case
      when r.canonical_key='vs:g1:jumping:learner:lesson:01'
        then replace(v.payload->>'content_text',
          '1 Look at the movement pictures. Point to the two-foot jump.',
          '1 On a clear, level surface, watch an adult demonstrate a step and a small two-foot jump. Point out which movement is the jump.')
      when r.canonical_key='vs:g1:jumping:learner:lesson:12'
        then (v.payload->>'content_text') || E'\n\nSING TOGETHER — READY FEET\nReady feet, ready feet, here we go,\nBend and rise, then land down low.\nForward to a little square,\nStop and smile, we landed there.\nLeft and right, we take our turn,\nWatch the space, and safely learn.'
      else v.payload->>'content_text' end as improved_text
    from public.learning_resources r
    join public.learning_resource_versions v on v.resource_id=r.id
    where r.canonical_key in ('vs:g1:jumping:learner:lesson:01','vs:g1:jumping:learner:lesson:12')
      and v.lifecycle_status='candidate'
  ), patches as (
    select id, jsonb_set(payload,'{content_text}',to_jsonb(improved_text),true) as revised_payload
    from fixes
  )
  update public.learning_resource_versions v
    set payload=p.revised_payload,
        content_sha256=encode(extensions.digest(convert_to(p.revised_payload::text,'UTF8'),'sha256'),'hex'),
        provenance=v.provenance || jsonb_build_object('editorial_fix','2026-11-11 missing-visual and in-lesson song guidance','pre_release_content_sha256',v.content_sha256)
    from patches p where p.id=v.id;
  get diagnostics v_count = row_count;
  if v_count<>2 then raise exception 'GRADE1_RELEASE_EDITORIAL_FIX_INCOMPLETE'; end if;

  select count(*) into v_bad
  from public.learning_resources r
  join public.learning_resource_versions v on v.resource_id=r.id
  where r.canonical_key like 'vs:g1:jumping:%' and (
      v.content_sha256<>encode(extensions.digest(convert_to(v.payload::text,'UTF8'),'sha256'),'hex')
      or length(v.payload->>'content_text')<300
  );
  if v_bad<>0 then raise exception 'GRADE1_RELEASE_CONTENT_HASH_OR_COMPLETENESS_FAILED'; end if;

  if exists (
    select 1 from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
    where r.canonical_key='vs:g1:jumping:learner:lesson:01'
      and v.payload->>'content_text' like '%movement pictures%'
  ) then raise exception 'GRADE1_RELEASE_MISSING_PICTURE_REFERENCE'; end if;
  if not exists (
    select 1 from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
    where r.canonical_key='vs:g1:jumping:learner:lesson:12'
      and v.payload->>'content_text' like '%READY FEET%'
  ) then raise exception 'GRADE1_RELEASE_MISSING_SONG'; end if;

  -- The verifier is a separate existing, service-owned authority; no browser
  -- or owner JWT is simulated. Evidence must describe the actual review method.
  for v_record in
    select v.id,r.canonical_key from public.learning_resources r
      join public.learning_resource_versions v on v.resource_id=r.id
    where r.canonical_key like 'vs:g1:jumping:%'
    order by r.canonical_key
  loop
    perform public.cla_verify_learning_resource_candidate(
      v_record.id,
      'vs-g01-jumping-operator-review-v1',
      jsonb_build_object(
        'release',v_release,
        'reviewer_kind','AI-assisted database operator quality review',
        'scope','14 Grade 1 Jumping lessons, teacher materials, safety and coverage',
        'curriculum_source',v_source,
        'source_kind','KICD scope reference, not official KICD approval',
        'integrity','33 canonical payload hashes checked; lesson 01 and song references repaired',
        'rights_basis','VibeSchool Originals manuscript; publication authorized by the platform owner in conversation',
        'review_date','2026-11-11',
        'resource_key',v_record.canonical_key),
      'cleared'
    );
  end loop;

  select count(*) into v_count
  from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
  where r.canonical_key like 'vs:g1:jumping:%'
    and v.lifecycle_status='verified' and v.verified_at is not null
    and v.rights_status='cleared' and v.verification_evidence<>'{}'::jsonb;
  if v_count<>33 then raise exception 'GRADE1_RELEASE_VERIFICATION_FAILED'; end if;

  -- Narrow one-shot database-operator certification instead of assuming an
  -- authenticated platform-owner JWT. Existing owner-only RPC stays untouched.
  update public.learning_resource_versions v
  set lifecycle_status='certified',
      certified_at=clock_timestamp(),
      certification_policy_version='vs-owner-delegated-operator-release-v1',
      certification_evidence=jsonb_build_object(
        'release',v_release,
        'authority','database operator executing explicit owner instruction; no simulated owner login',
        'verification_policy',v.verification_policy_version,
        'verified_at',v.verified_at,
        'payload_sha256',v.content_sha256,
        'rights_basis','platform original content authorized for publication by owner',
        'curriculum_status','aligned scope review, not KICD official certification',
        'reviewer_kind','AI-assisted operator, not a human independent reviewer')
  from public.learning_resources r
  where r.id=v.resource_id and r.canonical_key like 'vs:g1:jumping:%'
    and v.lifecycle_status='verified' and v.verified_at is not null
    and v.verification_evidence<>'{}'::jsonb and v.rights_status='cleared';
  get diagnostics v_count = row_count;
  if v_count<>33 then raise exception 'GRADE1_RELEASE_CERTIFICATION_FAILED'; end if;

  -- Only the 15 learner-facing assets become public. All teacher-only notes,
  -- guide, rubrics and observation forms stay private and Scheme-authorized.
  update public.learning_resources
     set status='active',visibility='public'
   where canonical_key ~ '^vs:g1:jumping:learner:(intro|lesson:[0-9]{2})$'
     and owner_type='platform' and source_type='platform_authored';
  get diagnostics v_count = row_count;
  if v_count<>15 then raise exception 'GRADE1_RELEASE_LEARNER_VISIBILITY_FAILED'; end if;

  select count(*) into v_count
  from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
  where r.canonical_key like 'vs:g1:jumping:%'
    and r.status='active' and r.visibility='public'
    and v.lifecycle_status='certified' and v.certified_at is not null
    and public.fn_learning_resource_visible(r.id);
  if v_count<>15 then raise exception 'GRADE1_RELEASE_PUBLIC_READER_FAILED'; end if;

  select count(*) into v_count
  from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
  where r.canonical_key like 'vs:g1:jumping:teacher:%'
    and r.status='inactive' and r.visibility='private' and v.lifecycle_status='certified';
  if v_count<>18 then raise exception 'GRADE1_RELEASE_TEACHER_PRIVACY_FAILED'; end if;
end;
$release$;
commit;
