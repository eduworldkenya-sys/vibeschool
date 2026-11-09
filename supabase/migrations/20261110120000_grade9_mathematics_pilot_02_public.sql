-- Grade 9 Mathematics Pilot 02 original public-practice assessment, draft outcome mapping.
do $seed$
declare
  v_paper jsonb := $paper${"id":"grade9-mathematics-pilot-02","title":"Grade 9 Mathematics — Pilot 02","grade":"Grade 9","subject":"Mathematics","curriculum":"Kenya CBC Grade 9 — provisional topic mapping; KICD outcome verification pending","status":"owner_requested_pilot_publication","origin":"VibeSchool Original — Internally Authored","assessment_type":"practice","duration_minutes":20,"total_marks":10,"visibility":"public_practice","instructions":"Choose one answer for each question. You may skip questions. Each question carries one mark.","items":[{"number":1,"bank_key":"G9M2-001","topic":"Fractions","difficulty":"easy","prompt":"Calculate 3/4 − 2/5.","options":[{"value":"A","label":"7/20"},{"value":"B","label":"1/20"},{"value":"C","label":"11/20"},{"value":"D","label":"1/2"}],"correctAnswer":"A","explanation":"Use a common denominator of 20: 15/20 − 8/20 = 7/20.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":2,"bank_key":"G9M2-002","topic":"Percentages","difficulty":"easy","prompt":"A school bag costs KSh 1,500. During a sale, its price is reduced by 20%. What is the new price?","options":[{"value":"A","label":"KSh 300"},{"value":"B","label":"KSh 1,180"},{"value":"C","label":"KSh 1,200"},{"value":"D","label":"KSh 1,300"}],"correctAnswer":"C","explanation":"20% of 1,500 = 300. New price = 1,500 − 300 = KSh 1,200.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":3,"bank_key":"G9M2-003","topic":"Squares and Square Roots","difficulty":"medium","prompt":"Evaluate 15² − 11².","options":[{"value":"A","label":"4"},{"value":"B","label":"104"},{"value":"C","label":"136"},{"value":"D","label":"256"}],"correctAnswer":"B","explanation":"15² − 11² = 225 − 121 = 104.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":4,"bank_key":"G9M2-004","topic":"Indices","difficulty":"easy","prompt":"Evaluate 5⁰ + 2³.","options":[{"value":"A","label":"8"},{"value":"B","label":"10"},{"value":"C","label":"13"},{"value":"D","label":"9"}],"correctAnswer":"D","explanation":"Every non-zero number to the power 0 equals 1. Therefore 1 + 8 = 9.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":5,"bank_key":"G9M2-005","topic":"Linear Equations","difficulty":"medium","prompt":"Solve 5(2x − 3) = 35.","options":[{"value":"A","label":"4"},{"value":"B","label":"5"},{"value":"C","label":"7"},{"value":"D","label":"10"}],"correctAnswer":"B","explanation":"Divide both sides by 5: 2x − 3 = 7. Then 2x = 10, so x = 5.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":6,"bank_key":"G9M2-006","topic":"Simultaneous Equations","difficulty":"challenging","prompt":"Find x and y if 2x + y = 11 and x − y = 1.","options":[{"value":"A","label":"x = 3, y = 5"},{"value":"B","label":"x = 5, y = 1"},{"value":"C","label":"x = 4, y = 3"},{"value":"D","label":"x = 6, y = −1"}],"correctAnswer":"C","explanation":"Add the equations: 3x = 12, so x = 4. Then y = 11 − 8 = 3.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":7,"bank_key":"G9M2-007","topic":"Gradient","difficulty":"medium","prompt":"Find the gradient of the line joining (1, 5) and (4, 11).","options":[{"value":"A","label":"2"},{"value":"B","label":"3"},{"value":"C","label":"1/2"},{"value":"D","label":"6"}],"correctAnswer":"A","explanation":"Gradient = (11 − 5) ÷ (4 − 1) = 6/3 = 2.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":8,"bank_key":"G9M2-008","topic":"Polygons","difficulty":"medium","prompt":"Each interior angle of a regular hexagon measures how many degrees?","options":[{"value":"A","label":"60°"},{"value":"B","label":"90°"},{"value":"C","label":"108°"},{"value":"D","label":"120°"}],"correctAnswer":"D","explanation":"Each interior angle is ((6 − 2) × 180°) ÷ 6 = 120°.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":9,"bank_key":"G9M2-009","topic":"Area","difficulty":"medium","prompt":"A triangle has a base of 16 cm and a perpendicular height of 9 cm. Find its area.","options":[{"value":"A","label":"144 cm²"},{"value":"B","label":"72 cm²"},{"value":"C","label":"25 cm²"},{"value":"D","label":"81 cm²"}],"correctAnswer":"B","explanation":"Area = 1/2 × base × height = 1/2 × 16 × 9 = 72 cm².","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null},{"number":10,"bank_key":"G9M2-010","topic":"Probability","difficulty":"challenging","prompt":"Two fair six-sided dice are rolled. What is the probability that the sum of the numbers is 7?","options":[{"value":"A","label":"1/12"},{"value":"B","label":"1/3"},{"value":"C","label":"1/6"},{"value":"D","label":"1/4"}],"correctAnswer":"C","explanation":"Six of the 36 equally likely ordered outcomes add to 7, so the probability is 6/36 = 1/6.","marks":1,"review_status":"original_pilot_pending_independent_educational_review","verified_kicd_outcome_id":null}]}$paper$::jsonb;
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
    v_owner,'ebook','Grade 9 Mathematics Pilot 02 — question provenance',
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
    jsonb_build_object('audience','public_practice','grade','Grade 9','pilot','grade9-mathematics-pilot-02',
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
      'Original pilot competency check (NOT KICD verified): '||(v_q->>'topic')||' ['||(v_q->>'bank_key')||']',
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

    insert into public.chapter_learning_outcome_links(
      publication_id,chapter_id,outcome_id,alignment_strength,sequence,evidence_note,created_by
    ) values (
      v_publication,v_chapter,v_outcome,'supports',(v_q->>'number')::integer,
      'VibeSchool original pilot competency — provisional, not KICD verified',v_owner
    );

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
      jsonb_build_object('pilot','grade9-mathematics-pilot-02','bank_key',v_q->>'bank_key',
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
