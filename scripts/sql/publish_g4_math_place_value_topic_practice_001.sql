-- Production release operator script, intentionally NOT an auto-applied migration.
-- Precondition: KICD authority source and exact curriculum outcome were verified
-- through canonical curriculum-authority snapshots/promotions. No synthetic/claimed IDs.
-- This uses existing unified EXQ definitions/items/outcomes/assignments.
-- Source: content/topic-practice/grade4-mathematics-place-value-001.json.
-- Run only once source verification is complete and learner E2E verification arranged.
BEGIN;
DO $release$
DECLARE
  v_key constant text := 'g4-mathematics-place-value-topic-practice-001';
  v_outcome uuid;
  v_subject uuid;
  v_owner uuid;
  v_assessment uuid;
  v_assignment uuid;
  v_count integer;
BEGIN
  -- This guard MUST run before any write.
  SELECT o.id INTO v_outcome
  FROM public.curriculum_learning_outcomes o
  JOIN public.curriculum_authority_promotions p ON p.outcome_id=o.id
  JOIN public.curriculum_authority_snapshots snap ON snap.id=p.snapshot_id
  JOIN public.curriculum_authority_sources src ON src.id=snap.source_id
  WHERE o.id='c600f693-6242-45b3-b6f2-0211447e579c'::uuid
    AND o.status='active'
    AND o.source_type='official'
    AND o.verified_at IS NOT NULL
    AND nullif(btrim(o.source_locator),'') IS NOT NULL
    AND src.grade='Grade 4' AND lower(btrim(src.subject_label))='mathematics'
    AND src.approved_at IS NOT NULL AND src.source_status='approved'
    AND snap.promoted_at IS NOT NULL
    AND p.action IN ('created','updated','linked','promoted')
  LIMIT 1;
  IF v_outcome IS NULL THEN
    RAISE EXCEPTION 'release_blocked: exact Grade 4 place-value outcome is not officially verified and promoted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.assessment_definitions
    WHERE generation_metadata->>'release_key'=v_key
  ) THEN
    RAISE EXCEPTION 'release_blocked: existing release key %',v_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.assessment_definitions
    WHERE title='Grade 4 Mathematics — Place Value & Total Value' AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'release_blocked: title already published';
  END IF;
  SELECT s.id INTO v_subject
  FROM public.subjects s
  JOIN public.grade_subject_authority g
    ON lower(btrim(g.subject_name))=lower(btrim(s.name))
  WHERE lower(btrim(g.grade))='grade 4'
    AND lower(btrim(g.subject_name))='mathematics'
    AND (g.effective_to IS NULL OR g.effective_to>=current_date)
  ORDER BY s.school_id NULLS FIRST,s.id LIMIT 1;
  IF v_subject IS NULL THEN RAISE EXCEPTION 'release_blocked: grade_subject_authority unresolved'; END IF;
  -- Existing platform-owned Grade 4 Mathematics paper preserves an account-backed author.
  SELECT d.teacher_id INTO v_owner
  FROM public.assessment_definitions d
  WHERE d.title='Grade 4 Mathematics — VibeSchool Exam 01'
    AND d.assessment_type='practice'
    AND d.status='approved'
    AND d.published_at IS NOT NULL
    AND d.teacher_id IS NOT NULL
  ORDER BY d.created_at DESC LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'release_blocked: original owner author unresolved'; END IF;
  INSERT INTO public.assessment_definitions(
    school_id,teacher_id,class_id,subject_id,assessment_type,
    title,description,instructions,status,total_marks,estimated_minutes,
    generation_source,generation_metadata,approved_by,approved_at,published_at,teacher_reviewed_at
  ) VALUES (
    null,v_owner,null,v_subject,'practice',
    'Grade 4 Mathematics — Place Value & Total Value','Five VibeSchool original questions linked to verified Grade 4 Whole Numbers curriculum authority.',
    'Choose an answer, read your feedback, or skip; continue at your own pace.',
    'approved',5,null,'owner_authored_original',
    jsonb_build_object(
      'release_key',v_key,'audience','public_practice','grade','Grade 4',
      'subject','Mathematics','topic','Place Value & Total Value','topic_practice',true,
      'source_origin','VibeSchool Original','curriculum_verification','verified',
      'curriculum_outcome_id',v_outcome,'canonical_engine','EXQ'
    ),v_owner,now(),now(),now()
  ) RETURNING id INTO v_assessment;

  WITH source_questions(order_num,bank_key,prompt,options,correct_answer,explanation,difficulty) AS (
    VALUES
    (1, 'PV001-Q1', 'In 4,582, which place does the digit 5 occupy?', '[{"value":"A","label":"Ones"},{"value":"B","label":"Tens"},{"value":"C","label":"Hundreds"},{"value":"D","label":"Thousands"}]'::jsonb, to_jsonb('C'::text), 'Count from the right: 2 ones, 8 tens, 5 hundreds, 4 thousands.', 'easy'),
    (2, 'PV001-Q2', 'What is the total value of the digit 7 in 7,304?', '[{"value":"A","label":"7"},{"value":"B","label":"70"},{"value":"C","label":"700"},{"value":"D","label":"7,000"}]'::jsonb, to_jsonb('D'::text), 'The 7 occupies the thousands place, so 7 × 1,000 = 7,000.', 'easy'),
    (3, 'PV001-Q3', 'Which number has the digit 6 in the tens place?', '[{"value":"A","label":"6,241"},{"value":"B","label":"3,462"},{"value":"C","label":"2,614"},{"value":"D","label":"4,126"}]'::jsonb, to_jsonb('B'::text), '3,462 has 2 ones and 6 tens. The tens digit is second from the right.', 'medium'),
    (4, 'PV001-Q4', 'A school has 12,450 exercise books. What is the total value of the digit 2?', '[{"value":"A","label":"2"},{"value":"B","label":"20"},{"value":"C","label":"200"},{"value":"D","label":"2,000"}]'::jsonb, to_jsonb('D'::text), 'The 2 is in the thousands place, so its total value is 2,000.', 'medium'),
    (5, 'PV001-Q5', 'A learner says that the total value of the digit 3 in 13,625 is 300. What is the correct total value?', '[{"value":"A","label":"3"},{"value":"B","label":"30"},{"value":"C","label":"300"},{"value":"D","label":"3,000"}]'::jsonb, to_jsonb('D'::text), 'The 3 is in the thousands place. Its total value is 3,000, not 300.', 'medium')
  ), inserted AS (
    INSERT INTO public.assessment_items(
      assessment_id,source_exercise_ref,question_type,prompt,options,correct_answer,
      explanation,marks,difficulty,auto_marking_mode,order_num,status,
      generated_by,teacher_approved_at
    )
    SELECT v_assessment,
      jsonb_build_object('bank_key',bank_key,'release_key',v_key,'topic','Place Value & Total Value',
        'source_origin','VibeSchool Original','outcome_id',v_outcome),
      'multiple_choice',prompt,options,correct_answer,explanation,1,difficulty,
      'option_match',order_num,'approved','owner_authored_original',now()
    FROM source_questions ORDER BY order_num
    RETURNING id
  )
  INSERT INTO public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
  SELECT id,v_outcome,1 FROM inserted;

  SELECT count(*) INTO v_count FROM public.assessment_items i
  JOIN public.assessment_item_outcomes l ON l.assessment_item_id=i.id
  WHERE i.assessment_id=v_assessment AND l.outcome_id=v_outcome
    AND i.status='approved' AND i.question_type='multiple_choice'
    AND i.auto_marking_mode='option_match' AND i.marks=1
    AND jsonb_array_length(i.options)=4
    AND i.correct_answer#>>'{}' IN ('A','B','C','D')
    AND nullif(btrim(i.explanation),'') IS NOT NULL;
  IF v_count<>5 THEN RAISE EXCEPTION 'release_blocked: expected five verified linked items, found %',v_count; END IF;

  INSERT INTO public.assessment_assignments(
    assessment_id,school_id,class_id,teacher_id,audience,audience_grade,status,
    time_limit_minutes,max_attempts,randomize_items,randomize_options,
    show_score_policy,answer_review_policy,show_explanations,show_worked_solutions,assigned_at
  ) VALUES (
    v_assessment,null,null,v_owner,'public_practice','Grade 4','open',
    null,3,false,false,'immediate','after_release',true,true,now()
  ) RETURNING id INTO v_assignment;
  RAISE NOTICE 'Canonical Grade 4 Topic Practice published: assessment %, assignment %, outcome %',v_assessment,v_assignment,v_outcome;
END
$release$;
COMMIT;
