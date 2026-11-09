-- Canonical platform-authored assessments need no school assignment.
-- Existing classroom assessments retain their school IDs.
alter table public.assessment_definitions alter column school_id drop not null;
-- Restrict null-school assessments to platform-owned original practice.
alter table public.assessment_definitions
  add constraint assessment_definitions_school_or_platform_practice_chk
  check (school_id is not null or (
    assessment_type='practice'
    and class_id is null
    and generation_source='owner_authored_pilot'
    and generation_metadata->>'audience'='public_practice'
  ));


-- Original owner-approved Pilot 01 questions. This content has NOT been
-- independently certified as KICD-verified. Its competency links stay DRAFT.
do $seed$
declare
  v_paper jsonb := $paper${"id":"grade9-mathematics-pilot-01","title":"Grade 9 Mathematics — Pilot 01","grade":"Grade 9","subject":"Mathematics","curriculum":"Kenya CBC Grade 9, provisional topic mapping; exact KICD learning-outcome verification pending","status":"approved_by_product_owner_pending_canonical_publication","origin":"VibeSchool Original — Internally Authored","assessment_type":"practice","duration_minutes":20,"total_marks":10,"visibility":"pilot_only","instructions":"Choose one answer for each item. Questions may be skipped. Each item carries one mark.","items":[{"number":1,"bank_key":"G9M-001","topic":"Integers","difficulty":"easy","prompt":"Evaluate −8 + 3 × (−4).","options":[{"value":"A","label":"−20"},{"value":"B","label":"−60"},{"value":"C","label":"20"},{"value":"D","label":"4"}],"correctAnswer":"A","explanation":"Multiply first: 3 × (−4) = −12. Then −8 − 12 = −20.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":2,"bank_key":"G9M-002","topic":"Cubes and Cube Roots","difficulty":"easy","prompt":"Find the cube root of 729.","options":[{"value":"A","label":"7"},{"value":"B","label":"8"},{"value":"C","label":"9"},{"value":"D","label":"11"}],"correctAnswer":"C","explanation":"9 × 9 × 9 = 729, so the cube root is 9.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":3,"bank_key":"G9M-003","topic":"Indices","difficulty":"medium","prompt":"Simplify 2³ × 2⁴.","options":[{"value":"A","label":"16"},{"value":"B","label":"32"},{"value":"C","label":"64"},{"value":"D","label":"128"}],"correctAnswer":"D","explanation":"2³ × 2⁴ = 2⁷ = 128.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":4,"bank_key":"G9M-004","topic":"Rates of Work","difficulty":"medium","prompt":"Six workers complete a job in 12 days. Assuming each works at the same constant rate, how many days will nine workers take?","options":[{"value":"A","label":"6 days"},{"value":"B","label":"8 days"},{"value":"C","label":"9 days"},{"value":"D","label":"18 days"}],"correctAnswer":"B","explanation":"6 × 12 = 72 worker-days. 72 ÷ 9 = 8 days.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":5,"bank_key":"G9M-005","topic":"Matrices","difficulty":"medium","prompt":"Matrix A = [[2, 1], [3, 4]] and B = [[1, 5], [6, 2]]. Find the element in row 2, column 1 of A + B.","options":[{"value":"A","label":"4"},{"value":"B","label":"6"},{"value":"C","label":"8"},{"value":"D","label":"9"}],"correctAnswer":"D","explanation":"The row 2, column 1 element is 3 + 6 = 9.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":6,"bank_key":"G9M-006","topic":"Equation of a Straight Line","difficulty":"medium","prompt":"A straight line passes through (0, 3) and (2, 7). What is its equation?","options":[{"value":"A","label":"y = 2x + 3"},{"value":"B","label":"y = 3x + 2"},{"value":"C","label":"y = 2x − 3"},{"value":"D","label":"y = 4x + 3"}],"correctAnswer":"A","explanation":"The gradient is (7 − 3)/(2 − 0) = 2 and intercept is 3. Hence y = 2x + 3.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":7,"bank_key":"G9M-007","topic":"Linear Inequalities","difficulty":"medium","prompt":"Solve 3x − 5 < 10.","options":[{"value":"A","label":"x > 5"},{"value":"B","label":"x < 5"},{"value":"C","label":"x < 15"},{"value":"D","label":"x > 15"}],"correctAnswer":"B","explanation":"3x − 5 < 10 implies 3x < 15, thus x < 5.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":8,"bank_key":"G9M-008","topic":"Volume of Solids","difficulty":"challenging","prompt":"A cylindrical container has an internal radius of 7 cm and an internal height of 10 cm. Find its capacity in cubic centimetres. Use π = 22/7.","options":[{"value":"A","label":"440 cm³"},{"value":"B","label":"770 cm³"},{"value":"C","label":"1,540 cm³"},{"value":"D","label":"3,080 cm³"}],"correctAnswer":"C","explanation":"πr²h = 22/7 × 49 × 10 = 1,540 cm³.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":9,"bank_key":"G9M-009","topic":"Scale Drawing","difficulty":"challenging","prompt":"Two towns are 3 cm apart on a map drawn to a scale of 1:50,000. What is the actual distance?","options":[{"value":"A","label":"0.15 km"},{"value":"B","label":"1.5 km"},{"value":"C","label":"15 km"},{"value":"D","label":"150 km"}],"correctAnswer":"B","explanation":"3 × 50,000 cm = 150,000 cm = 1.5 km.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null},{"number":10,"bank_key":"G9M-010","topic":"Probability","difficulty":"easy","prompt":"A bag contains 3 red, 2 blue and 5 green balls. A ball is selected at random. What is the probability it is blue?","options":[{"value":"A","label":"1/10"},{"value":"B","label":"1/5"},{"value":"C","label":"2/5"},{"value":"D","label":"1/2"}],"correctAnswer":"B","explanation":"2 of 10 balls are blue: 2/10 = 1/5.","marks":1,"review_status":"owner_approved_pilot","verified_kicd_outcome_id":null}]}$paper$::jsonb;
  v_q jsonb;
  v_owner uuid;
  v_subject uuid;
  v_publication uuid;
  v_chapter uuid;
  v_assessment uuid;
  v_block uuid;
  v_outcome uuid;
  v_item uuid;
  v_assignment uuid;
  v_existing uuid;
begin
  select p.id into v_owner from public.profiles p
  join public.platform_owners po on po.profile_id=p.id
  where p.role='teacher' order by p.id limit 1;
  if v_owner is null then raise exception 'missing_platform_owner_author'; end if;
  select id into v_subject from public.subjects
  where school_id is null and lower(btrim(name))='mathematics'
  order by id limit 1;
  if v_subject is null then raise exception 'missing_global_mathematics_subject'; end if;
  if not exists (select 1 from public.grade_subject_authority
    where grade='Grade 9' and subject_name='Mathematics'
    and (effective_to is null or effective_to>=current_date))
  then raise exception 'grade9_mathematics_not_canonical'; end if;
  select id into v_existing from public.assessment_definitions
    where title=v_paper->>'title' order by created_at desc limit 1;
  if v_existing is not null then
    raise exception 'grade9_maths_pilot_already_exists_check_before_reimport:%',v_existing;
  end if;

  insert into public.vibe_publications(
    author_id,format,title,description,status,cbc_subject,cbc_grade,cbc_aligned,chapter_count
  ) values (
    v_owner,'ebook','Grade 9 Mathematics Pilot 01 — question provenance',
    'Private original VibeSchool question source for pilot assessment, not certified KICD-aligned',
    'draft','Mathematics','Grade 9',false,1
  ) returning id into v_publication;
  insert into public.vibe_chapters(publication_id,title,number,status,alignment_status)
  values(v_publication,'Pilot source questions',1,'draft','creator_claimed')
  returning id into v_chapter;

  insert into public.assessment_definitions(
    school_id,teacher_id,class_id,subject_id,assessment_type,title,description,
    instructions,status,total_marks,estimated_minutes,
    generation_source,generation_metadata,
    approved_by,approved_at,published_at,teacher_reviewed_at
  ) values (
    null,v_owner,null,v_subject,'practice',v_paper->>'title',
    'Original owner-approved Grade 9 Mathematics pilot; curriculum outcome mapping is provisional',
    v_paper->>'instructions','approved',
    (v_paper->>'total_marks')::numeric,(v_paper->>'duration_minutes')::integer,
    'owner_authored_pilot',
    jsonb_build_object('audience','public_practice','grade','Grade 9','pilot','grade9-mathematics-pilot-01',
      'curriculum_verification','provisional','source_origin','VibeSchool Original',
      'approved_by_product_owner',true),
    v_owner,now(),now(),now()
  ) returning id into v_assessment;

  for v_q in select value from jsonb_array_elements(v_paper->'items') loop
    if not exists(select 1 from jsonb_array_elements(v_q->'options') opt
      where opt->>'value'=v_q->>'correctAnswer')
    then raise exception 'invalid_answer_key:%',v_q->>'bank_key'; end if;

    insert into public.curriculum_learning_outcomes(
      outcome_text,outcome_code,source_type,source_ref,status,created_by
    ) values (
      'Original pilot competency check (NOT KICD verified): '||(v_q->>'topic'),
      v_q->>'bank_key','creator_claimed','chapter:'||v_chapter::text,
      'draft',v_owner
    ) returning id into v_outcome;

    insert into public.content_blocks(
      publication_id,chapter_id,block_type,sequence,payload,title,status,is_assessable
    ) values (
      v_publication,v_chapter,'question',(v_q->>'number')::integer,
      jsonb_build_object('prompt',v_q->>'prompt','options',v_q->'options',
        'topic',v_q->>'topic','pilot_bank_key',v_q->>'bank_key'),
      'Grade 9 Mathematics '||(v_q->>'bank_key'),'draft',true
    ) returning id into v_block;

    insert into public.content_block_outcome_links(
      publication_id,chapter_id,content_block_id,outcome_id,relationship,created_by
    ) values(v_publication,v_chapter,v_block,v_outcome,'supports',v_owner);

    insert into public.assessment_items(
      assessment_id,source_block_id,question_type,prompt,options,correct_answer,
      explanation,worked_solution,marks,difficulty,auto_marking_mode,order_num,
      status,generated_by,teacher_approved_at,source_exercise_ref
    ) values (
      v_assessment,v_block,'multiple_choice',v_q->>'prompt',v_q->'options',
      to_jsonb(v_q->>'correctAnswer'),v_q->>'explanation',v_q->>'explanation',
      (v_q->>'marks')::numeric,v_q->>'difficulty','option_match',
      (v_q->>'number')::integer,'approved','owner_authored_pilot',now(),
      jsonb_build_object('pilot','grade9-mathematics-pilot-01','bank_key',v_q->>'bank_key',
        'topic',v_q->>'topic','curriculum_mapping','provisional')
    ) returning id into v_item;

    insert into public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
    values(v_item,v_outcome,1) on conflict(assessment_item_id,outcome_id) do nothing;
  end loop;

  if (select count(*) from public.assessment_items where assessment_id=v_assessment and status='approved')<>10
  then raise exception 'pilot_item_count_invalid'; end if;
  if (select count(*) from public.assessment_item_outcomes aio
      join public.assessment_items ai on ai.id=aio.assessment_item_id
      where ai.assessment_id=v_assessment)<>10
  then raise exception 'pilot_outcome_link_count_invalid'; end if;

  insert into public.assessment_assignments(
    assessment_id,school_id,class_id,teacher_id,audience,audience_grade,
    status,time_limit_minutes,max_attempts,show_score_policy,
    answer_review_policy,show_explanations,show_worked_solutions,assigned_at
  ) values (
    v_assessment,null,null,v_owner,'public_practice','Grade 9',
    'open',20,3,'immediate','after_release',true,true,now()
  ) returning id into v_assignment;
  raise notice 'Published Grade 9 Mathematics pilot assessment %, assignment %',v_assessment,v_assignment;
end
$seed$;
