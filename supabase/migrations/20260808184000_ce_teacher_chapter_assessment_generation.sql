begin;

create or replace function public.ce_get_teacher_derivation_context(p_chapter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_chapter record;
  v_publication record;
  v_resource_id uuid;
  v_school_id uuid;
  v_subject_id uuid;
  v_blocks jsonb;
  v_source_text text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role::text in ('teacher','admin')
  ) then
    raise exception 'Teacher role required';
  end if;

  select * into v_chapter
  from public.vibe_chapters
  where id = p_chapter_id;
  if not found then raise exception 'Chapter not found'; end if;

  select * into v_publication
  from public.vibe_publications
  where id = v_chapter.publication_id;
  if not found then raise exception 'Publication not found'; end if;

  if v_publication.author_id is distinct from v_uid
     and not (v_publication.status = 'published' and v_chapter.status = 'published') then
    raise exception 'Source chapter is not available for derivation';
  end if;

  select lr.id into v_resource_id
  from public.learning_resources lr
  where lr.chapter_id = p_chapter_id and lr.source_type = 'chapter'
  order by lr.created_at asc
  limit 1;
  if v_resource_id is null then raise exception 'Chapter learning resource is missing'; end if;

  select sm.school_id into v_school_id
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role::text in ('teacher','admin')
  order by sm.created_at asc
  limit 1;

  if v_publication.cbc_subject is not null then
    select s.id into v_subject_id
    from public.subjects s
    where lower(s.name) = lower(v_publication.cbc_subject)
    order by s.id
    limit 1;
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', cb.id,
      'block_type', cb.block_type,
      'text', coalesce(cb.plain_text, ''),
      'is_assessable', cb.is_assessable,
      'resource_id', blr.id
    ) order by cb.sequence), '[]'::jsonb),
    coalesce(string_agg(nullif(btrim(cb.plain_text), ''), E'\n\n' order by cb.sequence), '')
  into v_blocks, v_source_text
  from public.content_blocks cb
  left join public.learning_resources blr
    on blr.content_block_id = cb.id and blr.source_type = 'content_block'
  where cb.chapter_id = p_chapter_id
    and (v_publication.author_id = v_uid or (cb.status = 'published' and cb.is_teacher_only = false));

  if nullif(btrim(v_source_text), '') is null then
    raise exception 'Chapter has no derivable source text';
  end if;

  return jsonb_build_object(
    'teacher_id', v_uid,
    'school_id', v_school_id,
    'subject_id', v_subject_id,
    'publication_id', v_publication.id,
    'publication_title', v_publication.title,
    'publication_format', v_publication.format,
    'grade', v_publication.cbc_grade,
    'subject', v_publication.cbc_subject,
    'chapter_id', v_chapter.id,
    'chapter_title', v_chapter.title,
    'chapter_number', v_chapter.number,
    'chapter_resource_id', v_resource_id,
    'learning_outcomes', coalesce(to_jsonb(v_chapter.learning_outcomes), '[]'::jsonb),
    'blocks', v_blocks,
    'source_text', left(v_source_text, 40000)
  );
end;
$$;

revoke all on function public.ce_get_teacher_derivation_context(uuid) from public, anon;
grant execute on function public.ce_get_teacher_derivation_context(uuid) to authenticated, service_role;

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
  v_total_marks integer := 0;
  v_question jsonb;
  v_sequence integer := 0;
  v_marks integer;
  v_block_id uuid;
  v_block_resource_id uuid;
  v_options jsonb;
  v_answer_key jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_assessment_type not in ('quiz','test','exam') then raise exception 'Unsupported assessment type'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then raise exception 'Questions are required'; end if;
  if jsonb_array_length(p_questions) > 50 then raise exception 'Too many questions'; end if;

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
    p_assessment_type, v_total_marks, 'draft', '{}'::jsonb, '{}'::jsonb
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
      case when v_options is not null and jsonb_array_length(v_options) >= 2 then 'mcq' else 'short_answer' end,
      nullif(btrim(v_question->>'prompt'), ''),
      v_options,
      v_answer_key,
      v_marks,
      nullif(btrim(v_question->>'difficulty'), ''),
      nullif(btrim(v_question->>'bloomLevel'), ''),
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
    'publication_id', v_ctx->>'publication_id',
    'chapter_id', p_chapter_id
  );
end;
$$;

revoke all on function public.ce_create_generated_assessment_from_payload(uuid,text,text,jsonb) from public, anon;
grant execute on function public.ce_create_generated_assessment_from_payload(uuid,text,text,jsonb) to authenticated, service_role;

commit;
