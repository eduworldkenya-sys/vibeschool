-- Grade 4 original VibeSchool Exam 01: one-time, service-operated release.
-- Owner instruction: publish without separate editorial reviewer (2026-11-10).
-- This is NOT a KICD certification or an educational review attestation.
-- No question texts or marking keys are stored in this public repository.
-- The existing owner-facing RPC permissions and review rules remain unchanged.
-- Only original, nonexposed, structurally checked private drafts are eligible.
do $grade4_release$
declare
  v_draft private.original_exam_drafts%rowtype;
  v_custodian uuid;
  v_subject uuid;
  v_paper jsonb;
  v_item jsonb;
  v_option jsonb;
  v_options text[];
  v_prompt text;
  v_key text;
  v_title text;
  v_count integer;
  v_marks numeric;
  v_sum numeric;
  v_pub uuid;
  v_chapter uuid;
  v_assessment uuid;
  v_block uuid;
  v_outcome uuid;
  v_assessment_item uuid;
  v_assignment uuid;
  v_order int;
  v_issued integer := 0;
  v_all integer;
begin
  select count(*) into v_all from private.original_exam_drafts
  where grade='Grade 4' and content_state='needs_editorial_review'
    and published_at is null
    and coalesce(review_evidence->>'public_repository_exposure','false')='false'
    and review_evidence->>'automated_review'='passed_structural_validation';
  -- A clean CI/database install has no private drafts or owner account yet.
  -- This one-time data migration must be safe to replay on such installations.
  if v_all=0 then
    raise notice 'No staged Grade 4 original exams; skipping service release';
    return;
  end if;
  if v_all<>7 then raise exception 'Expected exactly seven unpublished Grade 4 originals; got %',v_all; end if;

  -- The active platform owner is assigned as the required record custodian,
  -- but is NOT recorded as having logged in, reviewed or approved the paper.
  select po.profile_id into v_custodian
  from public.platform_owners po
  where public.hq_profile_is_active(po.profile_id)
    and exists(select 1 from auth.users u where u.id=po.profile_id)
  order by po.profile_id limit 1;
  if v_custodian is null then raise exception 'No valid account custodian exists'; end if;

  for v_draft in
    select * from private.original_exam_drafts d
    where d.grade='Grade 4' and d.content_state='needs_editorial_review'
      and d.published_at is null
      and coalesce(d.review_evidence->>'public_repository_exposure','false')='false'
      and d.review_evidence->>'automated_review'='passed_structural_validation'
    order by d.subject for update
  loop
    v_paper:=v_draft.paper;
    v_title:=btrim(v_paper->>'title');
    v_count:=jsonb_array_length(v_paper->'items');
    v_sum:=0;

    if v_draft.paper_id<>v_paper->>'id'
       or v_draft.grade<>'Grade 4' or v_count<>12
       or v_paper->>'assessment_type'<>'practice'
       or v_paper->>'visibility'<>'public_practice'
       or length(v_title)<8
       or coalesce(v_paper->>'curriculum_verification','provisional') not in ('provisional','unverified')
    then raise exception 'Invalid Grade 4 release contract: %',v_draft.paper_id; end if;
    if exists(select 1 from public.assessment_definitions a where lower(btrim(a.title))=lower(v_title)) then
      raise exception 'Assessment already exists: %',v_title;
    end if;
    if exists(select 1 from public.assessment_items ai join public.assessment_definitions ad on ad.id=ai.assessment_id
      cross join lateral jsonb_array_elements(v_paper->'items') q
      where ad.published_at is not null and lower(btrim(ai.prompt))=lower(btrim(q.value->>'prompt'))) then
      raise exception 'Previously published prompt found for %',v_draft.paper_id;
    end if;

    select s.id into v_subject from public.subjects s
      where s.school_id is null and lower(btrim(s.name))=lower(btrim(v_draft.subject))
        and exists (
          select 1 from public.grade_subject_authority g
          where lower(btrim(g.grade))='grade 4'
            and replace(lower(btrim(g.subject_name)),'&','and')=replace(lower(btrim(s.name)),'&','and')
            and (g.effective_to is null or g.effective_to>=current_date))
      order by s.id limit 1;
    if v_subject is null then raise exception 'Missing Grade 4 authority: %',v_draft.subject; end if;

    -- Fully check original answer data before any record is persisted.
    for v_item in select value from jsonb_array_elements(v_paper->'items') loop
      v_order:=(v_item->>'number')::integer;
      v_key:=btrim(coalesce(v_item->>'bank_key',''));
      v_prompt:=btrim(coalesce(v_item->>'prompt',''));
      v_options:=array[]::text[];
      if v_order<1 or v_order>v_count or v_key !~ '^[A-Za-z0-9_-]{3,60}$'
         or length(v_prompt)<8 or length(coalesce(v_item->>'explanation',''))<12
         or coalesce(v_item->>'difficulty','') not in ('easy','medium','challenging')
         or jsonb_typeof(v_item->'options')<>'array'
         or jsonb_array_length(v_item->'options')<>4
         or (v_item->>'marks')::numeric<>1
      then raise exception 'Question validation failed for %, item %',v_draft.paper_id,v_order; end if;
      for v_option in select value from jsonb_array_elements(v_item->'options') loop
        if (v_option->>'value') not in ('A','B','C','D') or (v_option->>'value')=any(v_options)
          or nullif(btrim(v_option->>'label'),'') is null
        then raise exception 'Invalid choice for %, item %',v_draft.paper_id,v_order; end if;
        v_options:=array_append(v_options,v_option->>'value');
      end loop;
      if not(v_options @> array['A','B','C','D']::text[])
         or not((v_item->>'correctAnswer')=any(v_options))
      then raise exception 'Invalid marking key for %, item %',v_draft.paper_id,v_order; end if;
      v_sum:=v_sum+(v_item->>'marks')::numeric;
    end loop;
    if v_sum<>(v_paper->>'total_marks')::numeric or v_sum<>12 then
      raise exception 'Total marks validation failed: %',v_draft.paper_id; end if;

    insert into public.vibe_publications(
      author_id,format,title,description,status,cbc_subject,cbc_grade,cbc_aligned,chapter_count
    ) values (
      v_custodian,'ebook',v_title||' — original question sources',
      'System-issued original VibeSchool assessment; automated checks only; not KICD outcome-verified',
      'draft',v_draft.subject,'Grade 4',false,1
    ) returning id into v_pub;

    insert into public.vibe_chapters(publication_id,title,number,status,alignment_status)
      values(v_pub,'Original question sources',1,'draft','creator_claimed')
      returning id into v_chapter;

    insert into public.assessment_definitions(
      school_id,teacher_id,class_id,subject_id,assessment_type,title,description,
      instructions,status,total_marks,estimated_minutes,generation_source,
      generation_metadata,approved_by,approved_at,published_at,teacher_reviewed_at
    ) values (
      null,v_custodian,null,v_subject,'practice',v_title,
      'Original VibeSchool Exam 01; automatically validated; educational review pending; KICD mapping provisional',
      v_paper->>'instructions','approved',v_sum,(v_paper->>'duration_minutes')::integer,
      'owner_authored_original',
      jsonb_build_object(
        'audience','public_practice','grade','Grade 4','paper_id',v_draft.paper_id,
        'curriculum_verification','provisional','source_origin','VibeSchool Original',
        'owner_approved',false,'release_authority','explicit_owner_instruction_2026_11_10',
        'release_method','service_operated_one_time_migration',
        'human_educational_review','not_performed',
        'automated_review','passed_structural_validation',
        'content_hash',md5(v_paper::text),
        'publisher','grade4_original_owner_requested_admin_release'),
      null,null,now(),null
    ) returning id into v_assessment;

    for v_item in select value from jsonb_array_elements(v_paper->'items') order by (value->>'number')::int
    loop
      v_key:=v_item->>'bank_key';
      v_order:=(v_item->>'number')::int;

      insert into public.curriculum_learning_outcomes(
        outcome_text,outcome_code,source_type,source_ref,status,created_by
      ) values (
        'Original practice competency; KICD outcome NOT verified: '||(v_item->>'topic')||
        ' ['||v_draft.paper_id||'/'||v_key||']',v_key,
        'creator_claimed','chapter:'||v_chapter::text,'draft',null
      ) returning id into v_outcome;

      insert into public.content_blocks(
        publication_id,chapter_id,block_type,sequence,payload,title,status,is_assessable
      ) values (
        v_pub,v_chapter,'question',v_order,
        jsonb_build_object('prompt',v_item->>'prompt','options',v_item->'options',
          'topic',v_item->>'topic','bank_key',v_key),
        v_title||' — '||v_key,'draft',true
      ) returning id into v_block;

      insert into public.chapter_learning_outcome_links(
        publication_id,chapter_id,outcome_id,alignment_strength,sequence,evidence_note,created_by
      ) values (
        v_pub,v_chapter,v_outcome,'supports',v_order,
        'Original assessment competency; provisional not KICD verified',null
      );

      insert into public.content_block_outcome_links(
        publication_id,chapter_id,content_block_id,outcome_id,relationship,created_by
      ) values (v_pub,v_chapter,v_block,v_outcome,'supports',null);

      insert into public.assessment_items(
        assessment_id,source_block_id,question_type,prompt,options,correct_answer,
        explanation,worked_solution,marks,difficulty,auto_marking_mode,order_num,
        status,generated_by,teacher_approved_at,source_exercise_ref
      ) values (
        v_assessment,v_block,'multiple_choice',v_item->>'prompt',v_item->'options',
        to_jsonb(v_item->>'correctAnswer'),v_item->>'explanation',v_item->>'explanation',
        (v_item->>'marks')::numeric,v_item->>'difficulty','option_match',v_order,
        'approved','owner_authored_original',null,
        jsonb_build_object('paper_id',v_draft.paper_id,'bank_key',v_key,
          'topic',v_item->>'topic','curriculum_mapping','provisional',
          'review_state','automated_only')
      ) returning id into v_assessment_item;

      insert into public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
        values(v_assessment_item,v_outcome,1)
        on conflict (assessment_item_id,outcome_id) do nothing;
    end loop;

    if (select count(*) from public.assessment_items where assessment_id=v_assessment and status='approved')<>v_count
      or (select count(distinct ai.id) from public.assessment_items ai
          join public.assessment_item_outcomes aio on aio.assessment_item_id=ai.id
          where ai.assessment_id=v_assessment)<>v_count
    then raise exception 'Canonical assessment items/outcomes incomplete: %',v_draft.paper_id; end if;

    insert into public.assessment_assignments(
      assessment_id,school_id,class_id,teacher_id,audience,audience_grade,
      status,time_limit_minutes,max_attempts,show_score_policy,
      answer_review_policy,show_explanations,show_worked_solutions,assigned_at
    ) values (
      v_assessment,null,null,v_custodian,'public_practice','Grade 4',
      'open',(v_paper->>'duration_minutes')::integer,(v_paper->>'max_attempts')::integer,
      'immediate','after_release',true,true,now()
    ) returning id into v_assignment;

    update private.original_exam_drafts
      set published_at=now(),publication_receipt=jsonb_build_object(
        'ok',true,'published',true,'assessment_id',v_assessment,
        'assignment_id',v_assignment,'title',v_title,
        'grade','Grade 4','question_count',v_count,'curriculum_verification','provisional',
        'release_method','one_time_admin_release_without_human_review'),
        review_evidence=review_evidence||jsonb_build_object(
          'release_authority','user_explicitly_requested_publication_without_reviewer',
          'release_date','2026-11-10','human_educational_review','not_performed',
          'owner_authenticated_signoff','not_claimed',
          'release_method','service_operated_one_time_migration'),
        updated_at=now()
      where paper_id=v_draft.paper_id and content_state='needs_editorial_review';

    v_issued:=v_issued+1;
  end loop;
  if v_issued<>7 then raise exception 'Expected 7 releases, got %',v_issued; end if;
end;
$grade4_release$;