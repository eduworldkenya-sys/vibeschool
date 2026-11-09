-- Grade 9 Mathematics, Indices: first five-question, untimed Topic Practice.
-- Reuses the two independently stored, owner-approved pilot questions by
-- source_item_id and source_block_id; original exam pilots stay untouched.
-- Adds three original VibeSchool-authored questions with provisional mapping.
-- Product-owner authorization: Grade 9 Topic Practice request, 2026-11-09.
do $publish$
declare
 v_title text := 'Grade 9 Mathematics — Indices · Topic Practice 01';
 v_assessment uuid;
 v_assignment uuid;
 v_owner uuid;
 v_subject uuid;
 v_existing integer;
 v_added integer;
 v_count integer;
 v_origins integer;
 v_publication uuid;
 v_chapter uuid;
 v_block3 uuid;
 v_block4 uuid;
 v_block5 uuid;
begin
 select count(*) into v_existing from public.assessment_definitions
 where title=v_title and generation_metadata->>'topic_practice'='true';
 if v_existing>0 then raise exception 'topic_practice_already_exists:%',v_title; end if;

 select teacher_id, subject_id into v_owner,v_subject
 from public.assessment_definitions
 where title='Grade 9 Mathematics — Pilot 01'
   and generation_source='owner_authored_pilot'
   and status='approved' and published_at is not null
 order by created_at desc limit 1;
 -- Fresh database reconstruction cannot contain the account-backed pilot
 -- author or its published source questions yet. Do not fabricate either.
 if v_owner is null or v_subject is null then
   raise notice 'Skipping dependent Grade 9 indices seed until original owner-authored pilot exists';
   return;
 end if;

 select count(*) into v_origins
 from public.assessment_items ai
 join public.assessment_definitions ad on ad.id=ai.assessment_id
 where ad.title in ('Grade 9 Mathematics — Pilot 01','Grade 9 Mathematics — Pilot 02')
 and ai.status='approved'
 and ai.source_exercise_ref->>'topic'='Indices'
 and ai.auto_marking_mode='option_match' and ai.question_type='multiple_choice'
 and ai.source_block_id is not null
 and jsonb_array_length(ai.options)=4
 and nullif(ai.explanation,'') is not null;
 if v_origins<>2 then raise exception 'expected_two_original_indices_items_found:%',v_origins; end if;

 insert into public.assessment_definitions(
  school_id, teacher_id, class_id, subject_id, assessment_type,
  title, description, instructions, status, total_marks, estimated_minutes,
  generation_source, generation_metadata,
  approved_by, approved_at, published_at, teacher_reviewed_at
 ) values (
  null,v_owner,null,v_subject,'practice',
  v_title,'Five original indices questions. Reuses VibeSchool Pilot 01 and Pilot 02 item sources, plus three new original questions. Curriculum outcome alignment remains provisional.',
  'Tap an answer to check it. Skip if needed. Continue at your own pace.',
  'approved',5,null,'owner_authored_pilot',
  jsonb_build_object(
    'audience','public_practice','grade','Grade 9','subject','Mathematics',
    'topic','Indices','topic_practice',true,
    'pilot','grade9-indices-topic-01',
    'curriculum_verification','provisional',
    'source_origin','VibeSchool Original',
    'approved_by_product_owner',true,
    'source_reuse','Grade 9 Mathematics Pilot 01 and Pilot 02 (two canonical items)',
    'new_original_item_count',3
  ),
  v_owner,now(),now(),now()
 ) returning id into v_assessment;

 -- Preserve the canonical bank-item identity of the two existing questions.
 insert into public.assessment_items(
  assessment_id,source_item_id,source_block_id,source_exercise_ref,
  question_type,prompt,options,correct_answer,explanation,worked_solution,
  marks,difficulty,auto_marking_mode,order_num,status,generated_by,teacher_approved_at
 )
 select v_assessment,ai.id,ai.source_block_id,
        coalesce(ai.source_exercise_ref,'{}'::jsonb) ||
          jsonb_build_object('reused_from_item_id',ai.id,'topic_practice','grade9-indices-topic-01'),
        ai.question_type,ai.prompt,ai.options,ai.correct_answer,ai.explanation,
        ai.worked_solution,ai.marks,ai.difficulty,ai.auto_marking_mode,
        row_number() over (order by ad.title,ai.order_num)::integer,
        'approved','owner_authored_pilot',now()
 from public.assessment_items ai
 join public.assessment_definitions ad on ad.id=ai.assessment_id
 where ad.title in ('Grade 9 Mathematics — Pilot 01','Grade 9 Mathematics — Pilot 02')
 and ai.status='approved'
 and ai.source_exercise_ref->>'topic'='Indices'
 and ai.auto_marking_mode='option_match' and ai.question_type='multiple_choice'
 order by ad.title,ai.order_num;

 -- Preserve original source provenance independently from both exam pilots.
 insert into public.vibe_publications(
   author_id,format,title,description,status,cbc_subject,cbc_grade,cbc_aligned,chapter_count
 ) values (
   v_owner,'ebook','Grade 9 Mathematics Indices — Topic Practice 01 sources',
   'Three newly authored VibeSchool indices questions; provisional curriculum mapping, not certified KICD aligned.',
   'draft','Mathematics','Grade 9',false,1
 ) returning id into v_publication;

 insert into public.vibe_chapters(publication_id,title,number,status,alignment_status)
 values(v_publication,'Indices — original practice items',1,'draft','creator_claimed')
 returning id into v_chapter;

 insert into public.content_blocks(publication_id,chapter_id,block_type,sequence,payload,title,status,is_assessable)
 values(v_publication,v_chapter,'question',1,
   jsonb_build_object('prompt','Evaluate 3² × 3³.','topic','Indices','bank_key','G9TP-IND-003'),
   'Indices G9TP-IND-003','draft',true)
 returning id into v_block3;
 insert into public.content_blocks(publication_id,chapter_id,block_type,sequence,payload,title,status,is_assessable)
 values(v_publication,v_chapter,'question',2,
   jsonb_build_object('prompt','Simplify 5⁴ ÷ 5².','topic','Indices','bank_key','G9TP-IND-004'),
   'Indices G9TP-IND-004','draft',true)
 returning id into v_block4;
 insert into public.content_blocks(publication_id,chapter_id,block_type,sequence,payload,title,status,is_assessable)
 values(v_publication,v_chapter,'question',3,
   jsonb_build_object('prompt','Evaluate (2³)².','topic','Indices','bank_key','G9TP-IND-005'),
   'Indices G9TP-IND-005','draft',true)
 returning id into v_block5;

 -- New original questions: multiply, divide and apply the power-of-a-power rule.
 insert into public.assessment_items(
  assessment_id,source_block_id,source_exercise_ref,question_type,prompt,options,correct_answer,
  explanation,worked_solution,marks,difficulty,auto_marking_mode,order_num,
  status,generated_by,teacher_approved_at
 ) values
 (
  v_assessment,v_block3,jsonb_build_object('topic','Indices','bank_key','G9TP-IND-003','source_origin','VibeSchool original','curriculum_mapping','provisional'),
  'multiple_choice','Evaluate 3² × 3³.',
  '[{"value":"A","label":"27"},{"value":"B","label":"81"},{"value":"C","label":"243"},{"value":"D","label":"729"}]'::jsonb,
  '"C"'::jsonb,
  'When multiplying powers with the same base, add their indices: 3² × 3³ = 3⁵ = 243.',
  '2 + 3 = 5, then 3 × 3 × 3 × 3 × 3 = 243.',1,'easy','option_match',3,
  'approved','owner_authored_pilot',now()
 ),
 (
  v_assessment,v_block4,jsonb_build_object('topic','Indices','bank_key','G9TP-IND-004','source_origin','VibeSchool original','curriculum_mapping','provisional'),
  'multiple_choice','Simplify 5⁴ ÷ 5².',
  '[{"value":"A","label":"5"},{"value":"B","label":"25"},{"value":"C","label":"125"},{"value":"D","label":"625"}]'::jsonb,
  '"B"'::jsonb,
  'When dividing powers with the same non-zero base, subtract their indices: 5⁴ ÷ 5² = 5² = 25.',
  '4 − 2 = 2, so 5² = 25.',1,'easy','option_match',4,
  'approved','owner_authored_pilot',now()
 ),
 (
  v_assessment,v_block5,jsonb_build_object('topic','Indices','bank_key','G9TP-IND-005','source_origin','VibeSchool original','curriculum_mapping','provisional'),
  'multiple_choice','Evaluate (2³)².',
  '[{"value":"A","label":"32"},{"value":"B","label":"64"},{"value":"C","label":"16"},{"value":"D","label":"256"}]'::jsonb,
  '"B"'::jsonb,
  'For a power raised to another power, multiply the indices: (2³)² = 2⁶ = 64.',
  '3 × 2 = 6 and 2⁶ = 64.',1,'medium','option_match',5,
  'approved','owner_authored_pilot',now()
 );

 -- Final integrity gate: full delivery remains unpublished if any invariant fails.
 select count(*) into v_count from public.assessment_items
 where assessment_id=v_assessment and status='approved'
 and question_type='multiple_choice' and auto_marking_mode='option_match'
 and marks=1 and jsonb_array_length(options)=4
 and correct_answer#>>'{}' in ('A','B','C','D')
 and nullif(explanation,'') is not null;
 if v_count<>5 then raise exception 'five_question_integrity_failed:%',v_count; end if;
 select count(*) into v_added from public.assessment_items
 where assessment_id=v_assessment and source_item_id is not null;
 if v_added<>2 then raise exception 'source_reuse_integrity_failed:%',v_added; end if;
 if (select count(distinct order_num) from public.assessment_items where assessment_id=v_assessment)<>5
 then raise exception 'question_order_not_unique'; end if;

 insert into public.assessment_assignments(
  assessment_id,school_id,class_id,teacher_id,audience,audience_grade,
  status,time_limit_minutes,max_attempts,randomize_items,randomize_options,
  show_score_policy,answer_review_policy,show_explanations,show_worked_solutions,assigned_at
 ) values (
  v_assessment,null,null,v_owner,'public_practice','Grade 9',
  'open',null,3,false,false,
  'immediate','after_release',true,true,now()
 ) returning id into v_assignment;
 raise notice 'Published topic practice assessment %, assignment %, items 5',v_assessment,v_assignment;
end
$publish$;
