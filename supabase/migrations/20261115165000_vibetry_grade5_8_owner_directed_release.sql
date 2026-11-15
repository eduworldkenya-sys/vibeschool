-- scope: one-time owner-directed VibeTry Mathematics originals, Grades 5–8.
-- no unpublished prompt/answer keys in public source; original inputs live ONLY in private.original_exam_drafts.
-- release authority: owner explicitly requested release on 2026-11-15; do not invent HQ login,
-- human review, KICD outcome verification, or KNEC endorsement.
-- reuse canonical EXQ definitions/items/assignments/attempts, grade authority, and series registry.
-- strict fail-closed staging hash, independent arithmetic evidence, no duplicate claims.
-- no schema/RLS/auth/grant changes. Clean installs without private staging skip safely.
begin;
do $vibetry_release$
declare
  v_draft private.original_exam_drafts%rowtype;
  v_paper jsonb;
  v_item jsonb;
  v_custodian uuid;
  v_subject uuid;
  v_assessment uuid;
  v_assignment uuid;
  v_pub uuid;
  v_chapter uuid;
  v_block uuid;
  v_assessment_item uuid;
  v_outcome uuid;
  v_count int;
  v_order int;
  v_paperno int;
  v_published int;
  v_issued int:=0;
  v_total int;
  v_grade text;
  v_title text;
  v_key text;
  v_prompt text;
  v_answer text;
  v_family text;
  v_topic text;
  v_num int;
  v_denom int;
  v_x int;
  v_y int;
  v_coeff int;
  v_constant int;
  v_alt1 text;
  v_alt2 text;
  v_alt3 text;
  v_options jsonb;
  v_choices text[];
  v_correct_index int;
  v_distractor_idx int;
  v_choice_key text;
  v_label text;
  v_qtype text;
  v_mode text;
  v_guide jsonb;
  v_sum numeric;
  v_seen_keys text[];
  v_seen_prompts text[];
  j int;
begin
  select count(*),count(*) filter(where published_at is not null)
    into v_total,v_published
  from private.original_exam_drafts
  where paper_id ~ '^vibetry-g[5-8]-math-v[1-7]-2026$';

  if v_total=0 then
    raise notice 'Private VibeTry source absent on clean installation: data-only release skipped';
    return;
  end if;
  if v_total<>28 then raise exception 'VibeTry batch completeness gate: expected 28, found %',v_total; end if;
  if v_published=28 then
    if (select count(*) from public.exam_original_assignment_series where series_key='try' and edition_year=2026 and paper_number between 1 and 28)<>28
    then raise exception 'VibeTry partial series registration on retry'; end if;
    raise notice 'VibeTry 28 originals already recorded; idempotent skip';
    return;
  end if;
  if v_published<>0 then raise exception 'VibeTry partially released source; reconcile before retry'; end if;

  if (select count(*) from (
    select q.value->>'bank_key' bank_key
    from private.original_exam_drafts d
    cross join lateral jsonb_array_elements(d.paper->'items') q
    where d.paper_id ~ '^vibetry-g[5-8]-math-v[1-7]-2026$'
  ) k)<>336
  or (select count(distinct q.value->>'bank_key')
      from private.original_exam_drafts d cross join lateral jsonb_array_elements(d.paper->'items') q
      where d.paper_id ~ '^vibetry-g[5-8]-math-v[1-7]-2026$')<>336
  or (select count(distinct lower(btrim(q.value->>'prompt')))
      from private.original_exam_drafts d cross join lateral jsonb_array_elements(d.paper->'items') q
      where d.paper_id ~ '^vibetry-g[5-8]-math-v[1-7]-2026$')<>336
  then raise exception 'VibeTry content completeness or duplication gate'; end if;

  select po.profile_id into v_custodian
  from public.platform_owners po
  where public.hq_profile_is_active(po.profile_id)
    and exists (select 1 from auth.users u where u.id=po.profile_id)
  order by po.profile_id limit 1;
  if v_custodian is null then raise exception 'VibeTry requires an existing active account custodian'; end if;

  for v_draft in
    select * from private.original_exam_drafts d
    where d.paper_id ~ '^vibetry-g[5-8]-math-v[1-7]-2026$'
      and d.published_at is null
    order by (d.paper->>'paper_number')::int for update
  loop
    v_paper:=v_draft.paper;
    v_grade:=v_paper->>'grade';
    v_title:=v_paper->>'title';
    v_paperno:=(v_paper->>'paper_number')::int;
    v_count:=jsonb_array_length(v_paper->'items');
    v_seen_keys:=array[]::text[];
    v_seen_prompts:=array[]::text[];
    v_sum:=0;
    if v_draft.content_state<>'needs_editorial_review'
      or v_draft.paper_id<>v_paper->>'id'
      or v_draft.grade<>v_grade
      or v_draft.subject<>'Mathematics'
      or v_grade not in ('Grade 5','Grade 6','Grade 7','Grade 8')
      or v_paper->>'subject'<>'Mathematics'
      or v_paper->>'product_series'<>'try'
      or v_paper->>'edition_year'<>'2026'
      or v_paperno not between 1 and 28
      or v_count<>12
      or v_paper->>'total_marks'<>'12'
      or v_paper->>'assessment_type'<>'practice'
      or v_paper->>'visibility'<>'public_practice'
      or v_paper->>'curriculum_verification'<>'provisional'
      or length(v_title)<10
      or v_draft.review_evidence->>'source_sha256'<>'a7270fab7f11b82fae27ee7bf90f2bbe4d8cf78d20864d1076679db87dc22a90'
      or v_draft.review_evidence->>'independent_arithmetic_recomputation'<>'336_336_passed_for_batch'
      or v_draft.review_evidence->>'official_source_reference_review'<>'regular_grade_design_located'
      or v_draft.review_evidence->>'public_repository_exposure'<>'false'
      or v_draft.review_evidence->>'reviewed_content_md5'<>md5(v_paper::text)
    then raise exception 'VibeTry private preflight/provenance failure: %',v_draft.paper_id; end if;

    if exists(select 1 from public.assessment_definitions a where lower(btrim(a.title))=lower(btrim(v_title)))
      or exists(select 1 from public.exam_original_assignment_series e
        where e.series_key='try' and e.edition_year=2026 and e.paper_number=v_paperno)
    then raise exception 'VibeTry duplicate assessment/series paper: %',v_title; end if;

    select s.id into v_subject from public.subjects s
      where s.school_id is null and lower(btrim(s.name))='mathematics'
        and exists(select 1 from public.grade_subject_authority g
          where g.grade=v_grade
            and lower(btrim(g.subject_name))='mathematics'
            and (g.effective_to is null or g.effective_to>=current_date))
      order by s.id limit 1;
    if v_subject is null then raise exception 'VibeTry grade-subject authority missing: %',v_grade; end if;

    for v_item in select value from jsonb_array_elements(v_paper->'items') order by (value->>'number')::int
    loop
      v_order:=(v_item->>'number')::int;
      v_key:=v_item->>'bank_key';
      v_prompt:=btrim(v_item->>'prompt');
      v_answer:=btrim(v_item->>'correctAnswer');
      v_topic:=btrim(v_item->>'topic');
      v_qtype:=v_item->>'question_type';
      if v_order<1 or v_order>12 or array_length(v_seen_keys,1) is not distinct from 12
        or v_key !~ '^[A-Za-z0-9_-]{3,60}$'
        or lower(v_key)=any(v_seen_keys)
        or lower(v_prompt)=any(v_seen_prompts)
        or length(v_prompt)<10
        or length(v_answer)<1
        or length(v_topic)<2
        or v_item->>'bloom_level' not in ('remember','understand','apply','analyze','evaluate','create')
        or v_item->>'difficulty' not in ('easy','medium','challenging')
        or v_item->>'marks'<>'1'
        or length(coalesce(v_item->>'explanation',''))<12
        or v_qtype not in ('numeric','short_answer')
        or (v_qtype='numeric' and v_answer !~ '^[-]?[0-9]+([.][0-9]+)?$')
        or coalesce(v_item->>'source_url','') not like 'https://kicd.ac.ke/%'
      then raise exception 'VibeTry invalid source item % / %',v_draft.paper_id,v_order; end if;
      v_seen_keys:=array_append(v_seen_keys,lower(v_key));
      v_seen_prompts:=array_append(v_seen_prompts,lower(v_prompt));
      v_sum:=v_sum+1;
      if exists(select 1 from public.assessment_items ai where ai.source_exercise_ref->>'bank_key'=v_key)
        or exists(select 1 from public.assessment_items ai
          join public.assessment_definitions ad on ad.id=ai.assessment_id
          where ad.published_at is not null and ai.status='approved'
            and lower(btrim(ai.prompt))=lower(v_prompt))
      then raise exception 'VibeTry already-used item or prompt %',v_key; end if;
    end loop;
    if array_length(v_seen_keys,1)<>12 or v_sum<>12 then
      raise exception 'VibeTry wrong total or incomplete numbering: %',v_draft.paper_id; end if;

    -- Creator-claimed outcomes must be anchored in a real, unpublished source chapter.
    -- No answer keys are written to learner-readable content blocks.
    insert into public.vibe_publications(
      author_id,format,title,description,status,cbc_subject,cbc_grade,cbc_aligned,chapter_count
    ) values (
      v_custodian,'ebook',v_title||' — original question sources',
      'Draft source for owner-directed VibeTry paper; provisional curriculum mapping; no human review',
      'draft','Mathematics',v_grade,false,1
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
      'VibeSchool VibeTry original short mathematics trial. Automated arithmetic checks; provisional curriculum mapping; no human editorial endorsement.',
      v_paper->>'instructions','approved',12,20,'owner_authored_original',
      jsonb_build_object('audience','public_practice','grade',v_grade,
        'paper_id',v_draft.paper_id,'curriculum_verification','provisional',
        'source_origin','VibeSchool Original','owner_approved',false,
        'release_authority','explicit_owner_instruction_2026_11_15',
        'release_method','owner_directed_automated_vibetry_batch',
        'human_educational_review','not_performed','independent_arithmetic','336_336_verified',
        'source_sha256',v_draft.review_evidence->>'source_sha256',
        'content_hash',md5(v_paper::text)),
      null,now(),now(),null
    ) returning id into v_assessment;

    for v_item in select value from jsonb_array_elements(v_paper->'items') order by (value->>'number')::int
    loop
      v_order:=(v_item->>'number')::int;
      v_key:=v_item->>'bank_key';
      v_answer:=btrim(v_item->>'correctAnswer');
      v_family:=v_item->>'generation_family';
      v_topic:=v_item->>'topic';
      v_options:=null;
      v_choices:=null;
      v_guide:='{}'::jsonb;
      if v_item->>'question_type'='numeric' then
        v_qtype:='numeric';
        v_mode:='numeric_tolerance';
        v_choice_key:=v_answer;
        v_guide:=jsonb_build_object('tolerance',0);
      else
        v_qtype:='multiple_choice';
        v_mode:='option_match';
        v_num:=null;
        v_denom:=null;
        v_x:=null;
        v_y:=null;
        if v_answer ~ '^[0-9]+/[1-9][0-9]*$' then
          v_num:=split_part(v_answer,'/',1)::int;
          v_denom:=split_part(v_answer,'/',2)::int;
          v_alt1:=(v_num+1)::text||'/'||v_denom::text;
          v_alt2:=v_num::text||'/'||(v_denom+1)::text;
          v_alt3:=(v_num+2)::text||'/'||v_denom::text;
        elsif v_answer ~ '^n < [0-9]+$' then
          v_num:=split_part(v_answer,' ',3)::int;
          v_alt1:='n > '||v_num::text;
          v_alt2:='n < '||(v_num-1)::text;
          v_alt3:='n < '||(v_num+1)::text;
        elsif v_answer ~ '^[0-9]+x [+] [0-9]+$' then
          v_coeff:=split_part(v_answer,'x',1)::int;
          v_constant:=split_part(v_answer,' + ',2)::int;
          v_alt1:=(v_coeff+1)::text||'x + '||v_constant::text;
          v_alt2:=v_coeff::text||'x + '||(v_constant+1)::text;
          v_alt3:=(v_coeff+1)::text||'x + '||(v_constant+1)::text;
        elsif v_answer ~ '^[(]-?[0-9]+, -?[0-9]+[)]$' then
          v_x:=trim(both '(' from split_part(v_answer,',',1))::int;
          v_y:=trim(both ')' from btrim(split_part(v_answer,',',2)))::int;
          v_alt1:='('||(-v_x)::text||', '||v_y::text||')';
          v_alt2:='('||v_x::text||', '||(-v_y)::text||')';
          v_alt3:='('||v_y::text||', '||v_x::text||')';
        else
          raise exception 'Uncertified VibeTry written-response variant: %',v_key;
        end if;
        if v_answer in (v_alt1,v_alt2,v_alt3)
          or v_alt1=v_alt2 or v_alt1=v_alt3 or v_alt2=v_alt3
        then raise exception 'Ambiguous MCQ distractors in %',v_key; end if;
        v_options:='[]'::jsonb;
        v_correct_index:=((v_order+v_paperno)%4)+1;
        v_choice_key:=chr(64+v_correct_index);
        v_distractor_idx:=1;
        for j in 1..4 loop
          if j=v_correct_index then v_label:=v_answer;
          else
            v_label:=case v_distractor_idx
              when 1 then v_alt1 when 2 then v_alt2 else v_alt3 end;
            v_distractor_idx:=v_distractor_idx+1;
          end if;
          v_options:=v_options||jsonb_build_array(jsonb_build_object('value',chr(64+j),'label',v_label));
        end loop;
      end if;

      insert into public.content_blocks(
        publication_id,chapter_id,block_type,sequence,payload,title,status,is_assessable
      ) values (
        v_pub,v_chapter,'question',v_order,
        jsonb_build_object('prompt',v_item->>'prompt',
          'topic',v_topic,'bank_key',v_key),
        v_title||' — '||v_key,'draft',true
      ) returning id into v_block;

      insert into public.curriculum_learning_outcomes(
        outcome_text,outcome_code,source_type,source_ref,status,created_by
      ) values (
        'VibeTry original provisional practice competency: '||v_topic||
        '. KICD specific learning outcome not independently verified. ['||v_key||']',
        v_key,'creator_claimed','chapter:'||v_chapter::text,'draft',null
      ) returning id into v_outcome;

      insert into public.chapter_learning_outcome_links(
        publication_id,chapter_id,outcome_id,alignment_strength,sequence,evidence_note,created_by
      ) values (
        v_pub,v_chapter,v_outcome,'supports',v_order,
        'VibeTry original assessment competency: provisional, KICD outcome not verified',null
      );
      insert into public.content_block_outcome_links(
        publication_id,chapter_id,content_block_id,outcome_id,relationship,created_by
      ) values (v_pub,v_chapter,v_block,v_outcome,'supports',null);

      insert into public.assessment_items(
        assessment_id,source_block_id,question_type,prompt,options,accepted_answers,correct_answer,
        marking_guide,explanation,worked_solution,marks,difficulty,bloom_level,
        auto_marking_mode,order_num,status,generated_by,teacher_approved_at,source_exercise_ref
      ) values (
        v_assessment,v_block,v_qtype,
        v_item->>'prompt',v_options,
        case when v_qtype='numeric' then v_item->'accepted_answers' else null end,
        to_jsonb(v_choice_key),v_guide,
        v_item->>'explanation',v_item->>'explanation',
        1,v_item->>'difficulty',v_item->>'bloom_level',
        v_mode,v_order,'approved','owner_authored_original',null,
        jsonb_build_object('paper_id',v_draft.paper_id,'bank_key',v_key,
          'original_question_id',v_item->>'original_question_id',
          'topic',v_topic,'strand',v_item->>'strand',
          'curriculum_mapping','provisional','source_url',v_item->>'source_url',
          'review_state','owner_directed_automated','original_answer_type',v_item->>'answer_type')
      ) returning id into v_assessment_item;

      insert into public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
      values (v_assessment_item,v_outcome,1);
    end loop;

    if (select count(*) from public.assessment_items
        where assessment_id=v_assessment and status='approved')<>12
      or (select count(*) from public.assessment_item_outcomes aio
        join public.assessment_items ai on ai.id=aio.assessment_item_id
        where ai.assessment_id=v_assessment)<>12
    then raise exception 'VibeTry final item/outcome integrity failure %',v_draft.paper_id; end if;

    insert into public.assessment_assignments(
      assessment_id,school_id,class_id,teacher_id,audience,audience_grade,
      status,time_limit_minutes,max_attempts,randomize_items,randomize_options,
      show_score_policy,answer_review_policy,show_explanations,show_worked_solutions,assigned_at
    ) values (
      v_assessment,null,null,v_custodian,'public_practice',v_grade,
      'open',20,3,false,false,'immediate','after_release',true,true,now()
    ) returning id into v_assignment;

    insert into public.exam_original_assignment_series(
      assignment_id,series_key,edition_year,paper_number,certified_by,certified_at,review_mode
    ) values (v_assignment,'try',2026,v_paperno,v_custodian,now(),'owner_directed_automated');

    update private.original_exam_drafts d
    set published_at=now(),
      publication_receipt=jsonb_build_object('ok',true,'published',true,
        'assessment_id',v_assessment,'assignment_id',v_assignment,
        'paper_number',v_paperno,'grade',v_grade,'title',v_title,
        'question_count',12,'curriculum_verification','provisional',
        'human_educational_review','not_performed',
        'release_method','owner_directed_automated_vibetry_batch'),
      review_evidence=d.review_evidence||jsonb_build_object(
        'human_educational_review','not_performed','independent_review','not_performed',
        'authenticated_owner_signoff','not_claimed',
        'release_authority','owner_explicitly_requested_2026_11_15',
        'release_method','owner_directed_automated_vibetry_batch'),
      updated_at=now()
    where d.paper_id=v_draft.paper_id;
    v_issued:=v_issued+1;
  end loop;
  if v_issued<>28 then raise exception 'VibeTry release incomplete %/28',v_issued; end if;
end;
$vibetry_release$;
commit;
