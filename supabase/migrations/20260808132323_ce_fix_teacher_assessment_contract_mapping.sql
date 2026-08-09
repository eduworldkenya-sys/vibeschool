begin;

create or replace function public.ce_create_generated_assessment_from_payload(
  p_chapter_id uuid,
  p_assessment_type text,
  p_title text,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ctx jsonb;
  v_blueprint_id uuid;
  v_assessment_id uuid;
  v_resource_id uuid;
  v_school_id uuid;
  v_subject_id uuid;
  v_stored_type text;
  v_total_marks integer := 0;
  v_question jsonb;
  v_sequence integer := 0;
  v_marks integer;
  v_block_id uuid;
  v_block_resource_id uuid;
  v_options jsonb;
  v_answer_key jsonb;
  v_difficulty text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_assessment_type not in ('quiz','test','exam') then raise exception 'Unsupported assessment type'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then raise exception 'Questions are required'; end if;
  if jsonb_array_length(p_questions) > 50 then raise exception 'Too many questions'; end if;

  v_stored_type := case when p_assessment_type = 'test' then 'cat' else p_assessment_type end;
  v_ctx := public.ce_get_teacher_derivation_context(p_chapter_id);
  v_resource_id := nullif(v_ctx->>'chapter_resource_id','')::uuid;
  v_school_id := nullif(v_ctx->>'school_id','')::uuid;
  v_subject_id := nullif(v_ctx->>'subject_id','')::uuid;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_marks := greatest(1, least(20, coalesce((v_question->>'marks')::integer, 1)));
    v_total_marks := v_total_marks + v_marks;
  end loop;

  insert into public.content_assessment_blueprints(
    school_id, teacher_id, subject_id, title, assessment_type,
    total_marks, status, difficulty_distribution, bloom_distribution
  ) values (
    v_school_id, v_uid, v_subject_id,
    coalesce(nullif(btrim(p_title), ''), coalesce(v_ctx->>'chapter_title','Assessment')),
    v_stored_type, v_total_marks, 'draft', '{}'::jsonb, '{}'::jsonb
  ) returning id into v_blueprint_id;

  insert into public.content_assessment_sources(blueprint_id, resource_id, weight)
  values (v_blueprint_id, v_resource_id, 1);

  insert into public.generated_assessments(blueprint_id, version, status, total_marks, generated_by)
  values (v_blueprint_id, 1, 'draft', v_total_marks, v_uid)
  returning id into v_assessment_id;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_sequence := v_sequence + 1;
    v_marks := greatest(1, least(20, coalesce((v_question->>'marks')::integer, 1)));
    v_options := case when jsonb_typeof(v_question->'options') = 'array' then v_question->'options' else null end;
    v_answer_key := case
      when v_question ? 'correctIndex' then jsonb_build_object('correctIndex', (v_question->>'correctIndex')::integer, 'answer', coalesce(v_question->>'answer',''))
      else jsonb_build_object('answer', coalesce(v_question->>'answer',''))
    end;

    v_difficulty := case lower(coalesce(v_question->>'difficulty',''))
      when 'easy' then 'foundation'
      when 'medium' then 'developing'
      when 'hard' then 'advanced'
      when 'foundation' then 'foundation'
      when 'developing' then 'developing'
      when 'proficient' then 'proficient'
      when 'advanced' then 'advanced'
      else 'developing'
    end;

    begin
      v_block_id := nullif(v_question->>'sourceBlockId','')::uuid;
    exception when others then
      v_block_id := null;
    end;

    if v_block_id is not null and not exists (
      select 1 from public.content_blocks cb
      where cb.id = v_block_id and cb.chapter_id = p_chapter_id
    ) then
      v_block_id := null;
    end if;

    v_block_resource_id := null;
    if v_block_id is not null then
      select lr.id into v_block_resource_id
      from public.learning_resources lr
      where lr.content_block_id = v_block_id and lr.source_type = 'content_block'
      order by lr.created_at asc limit 1;
    end if;

    insert into public.generated_assessment_items(
      assessment_id, sequence, question_type, prompt, options, answer_key,
      marks, difficulty, bloom_level, source_resource_id, source_block_id
    ) values (
      v_assessment_id,
      v_sequence,
      case when v_options is not null and jsonb_array_length(v_options) >= 2 then 'multiple_choice' else 'short_answer' end,
      nullif(btrim(v_question->>'prompt'), ''),
      v_options,
      v_answer_key,
      v_marks,
      v_difficulty,
      case lower(coalesce(v_question->>'bloomLevel',''))
        when 'remember' then 'remember'
        when 'understand' then 'understand'
        when 'apply' then 'apply'
        when 'analyze' then 'analyze'
        when 'evaluate' then 'evaluate'
        when 'create' then 'create'
        else 'understand'
      end,
      coalesce(v_block_resource_id, v_resource_id),
      v_block_id
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'blueprint_id', v_blueprint_id,
    'assessment_id', v_assessment_id,
    'total_marks', v_total_marks,
    'question_count', v_sequence,
    'assessment_type', p_assessment_type,
    'stored_assessment_type', v_stored_type,
    'publication_id', v_ctx->>'publication_id',
    'chapter_id', p_chapter_id
  );
end;
$$;

revoke all on function public.ce_create_generated_assessment_from_payload(uuid,text,text,jsonb) from public, anon;
grant execute on function public.ce_create_generated_assessment_from_payload(uuid,text,text,jsonb) to authenticated, service_role;

commit;
