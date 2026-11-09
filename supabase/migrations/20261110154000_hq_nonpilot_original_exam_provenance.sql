-- Non-pilot authoring metadata for owner-approved original VibeSchool exams.
-- Reuses the owner-only canonical HQ publisher and its provisional curriculum safeguards.
-- Formal/class-controlled assessments remain governed by a different release path.
-- VibeSchool original exam publisher: owner preview -> explicitly approved publication.
-- Reuses canonical source, outcome, assessment and public-practice assignment authorities.
-- Only authenticated platform owners may preview or publish. Never asserts KICD verification.
create or replace function public.hq_publish_original_practice(
  p_paper jsonb, p_publish boolean default false, p_approved boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $fn$
declare
  v_caller uuid:=auth.uid();
  v_title text; v_id text; v_grade text; v_subject_name text;
  v_subject uuid; v_minutes integer; v_attempts integer; v_count integer;
  v_items jsonb; v_q jsonb; v_opts jsonb; v_opt jsonb;
  v_prompt text; v_key text; v_answer text; v_topic text; v_diff text; v_explanation text;
  v_num integer; v_marks numeric; v_total numeric:=0;
  v_seen_keys text[]:=array[]::text[];
  v_seen_prompts text[]:=array[]::text[];
  v_seen_numbers integer[]:=array[]::integer[];
  v_options_seen text[]; v_labels_seen text[];
  v_issues jsonb:='[]'::jsonb; v_existing uuid; v_hash text;
  v_pub uuid; v_chapter uuid; v_assessment uuid; v_block uuid; v_outcome uuid; v_item uuid;
  v_assignment jsonb; v_validation jsonb; v_matched numeric;
begin
  if v_caller is null or not coalesce(public.is_platform_owner(),false)
  then raise exception 'platform_owner_required' using errcode='42501'; end if;
  if p_paper is null or jsonb_typeof(p_paper)<>'object'
  then return jsonb_build_object('ok',false,'valid',false,'issues',jsonb_build_array('paper_must_be_object')); end if;

  v_id:=btrim(coalesce(p_paper->>'id',''));
  v_title:=btrim(coalesce(p_paper->>'title',''));
  v_grade:=btrim(coalesce(p_paper->>'grade',''));
  v_subject_name:=btrim(coalesce(p_paper->>'subject',''));
  v_hash:=md5(p_paper::text);
  if v_id !~ '^[a-z0-9][a-z0-9_-]{2,79}$' then v_issues:=v_issues||'"invalid_paper_id"'::jsonb; end if;
  if length(v_title)<8 or length(v_title)>160 then v_issues:=v_issues||'"invalid_title"'::jsonb; end if;
  if length(v_grade)<3 or length(v_grade)>35 then v_issues:=v_issues||'"invalid_grade"'::jsonb; end if;
  if length(v_subject_name)<2 or length(v_subject_name)>100 then v_issues:=v_issues||'"invalid_subject"'::jsonb; end if;
  if coalesce(p_paper->>'assessment_type','practice')<>'practice' then
    v_issues:=v_issues||'"only_original_practice_supported"'::jsonb;
  end if;
  if coalesce(p_paper->>'visibility','public_practice') not in ('public_practice','pilot_only') then
    v_issues:=v_issues||'"invalid_visibility"'::jsonb;
  end if;
  if jsonb_typeof(p_paper->'items')<>'array' then
    v_issues:=v_issues||'"items_must_be_array"'::jsonb;
    return jsonb_build_object('ok',false,'valid',false,'issues',v_issues);
  end if;
  v_items:=p_paper->'items';
  v_count:=jsonb_array_length(v_items);
  if v_count<1 or v_count>50 then
    v_issues:=v_issues||'"question_count_out_of_range"'::jsonb;
    return jsonb_build_object('ok',false,'valid',false,'issues',v_issues);
  end if;
  if coalesce(p_paper->>'duration_minutes','') !~ '^[0-9]{1,3}$' then
    v_issues:=v_issues||'"invalid_duration"'::jsonb;
    v_minutes:=20;
  else v_minutes:=(p_paper->>'duration_minutes')::integer; end if;
  if v_minutes<5 or v_minutes>180 then v_issues:=v_issues||'"duration_out_of_range"'::jsonb; end if;
  if coalesce(p_paper->>'max_attempts','3') !~ '^[1-5]$' then
    v_issues:=v_issues||'"invalid_attempt_limit"'::jsonb;
    v_attempts:=3;
  else v_attempts:=coalesce((p_paper->>'max_attempts')::integer,3); end if;
  if length(btrim(coalesce(p_paper->>'instructions','')))<10 then
    v_issues:=v_issues||'"instructions_required"'::jsonb;
  end if;

  select s.id into v_subject from public.subjects s
  join public.grade_subject_authority g on replace(lower(btrim(g.subject_name)),'&','and')=replace(lower(btrim(s.name)),'&','and')
  where s.school_id is null and lower(btrim(s.name))=lower(v_subject_name)
    and lower(btrim(g.grade))=lower(v_grade)
    and (g.effective_to is null or g.effective_to>=current_date)
  order by s.id limit 1;
  if v_subject is null then v_issues:=v_issues||'"grade_subject_not_in_authority"'::jsonb; end if;

  perform pg_advisory_xact_lock(hashtextextended('vs-exam-publish:'||lower(v_title),0));
  select id into v_existing from public.assessment_definitions
    where lower(btrim(title))=lower(v_title) order by created_at desc limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok',true,'valid',false,'already_exists',true,
      'assessment_id',v_existing,'issues',jsonb_build_array('title_already_exists'));
  end if;

  for v_q in select value from jsonb_array_elements(v_items) loop
    v_num:=null; v_marks:=null;
    v_key:=btrim(coalesce(v_q->>'bank_key',''));
    v_prompt:=btrim(coalesce(v_q->>'prompt',''));
    v_answer:=btrim(coalesce(v_q->>'correctAnswer',''));
    v_topic:=btrim(coalesce(v_q->>'topic',''));
    v_diff:=lower(btrim(coalesce(v_q->>'difficulty','')));
    v_explanation:=btrim(coalesce(v_q->>'explanation',''));
    if coalesce(v_q->>'number','') ~ '^[0-9]{1,2}$' then
      v_num:=(v_q->>'number')::integer;
    end if;
    if v_num is null or v_num<1 or v_num>v_count or v_num=any(v_seen_numbers) then
      v_issues:=v_issues||jsonb_build_array('invalid_or_duplicate_number:'||coalesce(v_q->>'number','null'));
    else v_seen_numbers:=array_append(v_seen_numbers,v_num); end if;
    if v_key !~ '^[A-Za-z0-9_-]{3,60}$' or lower(v_key)=any(v_seen_keys) then
      v_issues:=v_issues||jsonb_build_array('invalid_or_duplicate_bank_key:'||v_key);
    else v_seen_keys:=array_append(v_seen_keys,lower(v_key)); end if;
    if length(v_prompt)<8 or lower(v_prompt)=any(v_seen_prompts) then
      v_issues:=v_issues||jsonb_build_array('invalid_or_duplicate_prompt:'||v_key);
    else v_seen_prompts:=array_append(v_seen_prompts,lower(v_prompt)); end if;
    if length(v_topic)<2 or length(v_topic)>120 then v_issues:=v_issues||jsonb_build_array('invalid_topic:'||v_key); end if;
    if v_diff not in ('easy','medium','challenging') then v_issues:=v_issues||jsonb_build_array('invalid_difficulty:'||v_key); end if;
    if length(v_explanation)<12 then v_issues:=v_issues||jsonb_build_array('explanation_required:'||v_key); end if;
    if coalesce(v_q->>'marks','') ~ '^[0-9]{1,2}$' then v_marks:=(v_q->>'marks')::numeric; end if;
    if v_marks is null or v_marks<1 or v_marks>10 then
      v_issues:=v_issues||jsonb_build_array('invalid_marks:'||v_key);
    else v_total:=v_total+v_marks; end if;
    v_opts:=v_q->'options';
    if jsonb_typeof(v_opts)<>'array' then
      v_issues:=v_issues||jsonb_build_array('invalid_options:'||v_key);
    elsif jsonb_array_length(v_opts)<>4 then
      v_issues:=v_issues||jsonb_build_array('four_options_required:'||v_key);
    else
      v_options_seen:=array[]::text[]; v_labels_seen:=array[]::text[];
      for v_opt in select value from jsonb_array_elements(v_opts) loop
        if coalesce(v_opt->>'value','') not in ('A','B','C','D')
           or v_opt->>'value'=any(v_options_seen) then
          v_issues:=v_issues||jsonb_build_array('invalid_option_values:'||v_key);
        end if;
        v_options_seen:=array_append(v_options_seen,coalesce(v_opt->>'value',''));
        if length(btrim(coalesce(v_opt->>'label','')))=0 or
           lower(btrim(coalesce(v_opt->>'label','')))=any(v_labels_seen) then
          v_issues:=v_issues||jsonb_build_array('invalid_or_duplicate_option_label:'||v_key);
        end if;
        v_labels_seen:=array_append(v_labels_seen,lower(btrim(coalesce(v_opt->>'label',''))));
      end loop;
      if not (v_options_seen @> array['A','B','C','D']::text[]) then
        v_issues:=v_issues||jsonb_build_array('missing_options:'||v_key);
      end if;
      if v_answer<>all(v_options_seen) then
        v_issues:=v_issues||jsonb_build_array('answer_not_in_options:'||v_key);
      end if;
    end if;
    if exists(select 1 from public.assessment_items ai
      join public.assessment_definitions ad on ad.id=ai.assessment_id
      where ai.status='approved' and ad.published_at is not null
        and lower(btrim(ai.prompt))=lower(v_prompt)) then
      v_issues:=v_issues||jsonb_build_array('published_question_duplicate:'||v_key);
    end if;
    if exists(select 1 from public.assessment_items ai
      where ai.source_exercise_ref->>'bank_key'=v_key) then
      v_issues:=v_issues||jsonb_build_array('bank_key_already_used:'||v_key);
    end if;
  end loop;
  if array_length(v_seen_numbers,1) is distinct from v_count then v_issues:=v_issues||'"question_number_sequence_incomplete"'::jsonb; end if;
  if coalesce(p_paper->>'total_marks','') !~ '^[0-9]{1,3}$' then
    v_issues:=v_issues||'"invalid_total_marks"'::jsonb;
  elsif (p_paper->>'total_marks')::numeric is distinct from v_total then
    v_issues:=v_issues||'"total_marks_mismatch"'::jsonb;
  end if;
  if jsonb_array_length(v_issues)>0 then
    return jsonb_build_object('ok',false,'valid',false,'issues',v_issues,
      'question_count',v_count,'computed_marks',v_total);
  end if;
  if not p_publish then
    return jsonb_build_object('ok',true,'valid',true,'ready_to_publish',true,
      'question_count',v_count,'total_marks',v_total,'grade',v_grade,
      'subject',v_subject_name,'title',v_title,
      'curriculum_verification','provisional','content_hash',v_hash);
  end if;
  if not p_approved then raise exception 'explicit_owner_approval_required' using errcode='42501'; end if;

  insert into public.vibe_publications(
    author_id,format,title,description,status,cbc_subject,cbc_grade,cbc_aligned,chapter_count
  ) values(v_caller,'ebook',v_title||' — original question sources',
    'Owner-approved original VibeSchool practice source; KICD outcome mapping provisional',
    'draft',v_subject_name,v_grade,false,1) returning id into v_pub;
  insert into public.vibe_chapters(publication_id,title,number,status,alignment_status)
    values(v_pub,'Original question sources',1,'draft','creator_claimed')
    returning id into v_chapter;

  insert into public.assessment_definitions(
    school_id,teacher_id,class_id,subject_id,assessment_type,title,description,
    instructions,status,total_marks,estimated_minutes,generation_source,
    generation_metadata,approved_by,approved_at,published_at,teacher_reviewed_at
  ) values(
    null,v_caller,null,v_subject,'practice',v_title,
    'Owner-approved VibeSchool original practice; curriculum outcome mapping provisional',
    p_paper->>'instructions','approved',v_total,v_minutes,'owner_authored_original',
    jsonb_build_object('audience','public_practice','grade',v_grade,'paper_id',v_id,
      'curriculum_verification','provisional','source_origin','VibeSchool Original',
      'owner_approved',true,'content_hash',v_hash,'publisher','hq_publish_original_practice'),
    v_caller,now(),now(),now()
  ) returning id into v_assessment;

  for v_q in select value from jsonb_array_elements(v_items) order by (value->>'number')::int loop
    v_key:=v_q->>'bank_key';
    insert into public.curriculum_learning_outcomes(
      outcome_text,outcome_code,source_type,source_ref,status,created_by
    ) values (
      'Original assessment competency (NOT KICD verified): '||(v_q->>'topic')||
      ' ['||v_id||'/'||v_key||']',v_key,
      'creator_claimed','chapter:'||v_chapter::text,'draft',v_caller
    ) returning id into v_outcome;
    insert into public.content_blocks(
      publication_id,chapter_id,block_type,sequence,payload,title,status,is_assessable
    ) values (
      v_pub,v_chapter,'question',(v_q->>'number')::integer,
      jsonb_build_object('prompt',v_q->>'prompt','options',v_q->'options',
        'topic',v_q->>'topic','bank_key',v_key),
      v_title||' — '||v_key,'draft',true
    ) returning id into v_block;
    insert into public.chapter_learning_outcome_links(
      publication_id,chapter_id,outcome_id,alignment_strength,sequence,evidence_note,created_by
    ) values(v_pub,v_chapter,v_outcome,'supports',(v_q->>'number')::integer,
      'Original assessment competency, provisional and not KICD verified',v_caller);
    insert into public.content_block_outcome_links(
      publication_id,chapter_id,content_block_id,outcome_id,relationship,created_by
    ) values(v_pub,v_chapter,v_block,v_outcome,'supports',v_caller);
    insert into public.assessment_items(
      assessment_id,source_block_id,question_type,prompt,options,correct_answer,
      explanation,worked_solution,marks,difficulty,auto_marking_mode,order_num,
      status,generated_by,teacher_approved_at,source_exercise_ref
    ) values(
      v_assessment,v_block,'multiple_choice',v_q->>'prompt',v_q->'options',
      to_jsonb(v_q->>'correctAnswer'),v_q->>'explanation',v_q->>'explanation',
      (v_q->>'marks')::numeric,v_q->>'difficulty','option_match',(v_q->>'number')::integer,
      'approved','owner_authored_original',now(),
      jsonb_build_object('paper_id',v_id,'bank_key',v_key,'topic',v_q->>'topic',
        'curriculum_mapping','provisional')
    ) returning id into v_item;
    insert into public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
      values(v_item,v_outcome,1) on conflict(assessment_item_id,outcome_id) do nothing;
  end loop;
  v_validation:=public.exq_validate_assessment(v_assessment);
  if coalesce((v_validation->>'valid')::boolean,false)=false then
    raise exception 'canonical_assessment_validation_failed: %',v_validation; end if;
  v_assignment:=public.exq_publish_public_practice(v_assessment,v_grade,v_attempts);
  if coalesce((v_assignment->>'ok')::boolean,false)=false or v_assignment->>'assignment_id' is null then
    raise exception 'public_assignment_creation_failed'; end if;
  return jsonb_build_object('ok',true,'valid',true,'published',true,'assessment_id',v_assessment,
    'assignment_id',v_assignment->>'assignment_id','question_count',v_count,
    'total_marks',v_total,'title',v_title,'grade',v_grade,
    'curriculum_verification','provisional','content_hash',v_hash);
end;
$fn$;
revoke all on function public.hq_publish_original_practice(jsonb,boolean,boolean)
  from public,anon;
grant execute on function public.hq_publish_original_practice(jsonb,boolean,boolean)
  to authenticated;
