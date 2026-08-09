begin;

alter table public.homework_questions
  add column if not exists source_resource_id uuid null references public.learning_resources(id) on delete set null,
  add column if not exists source_block_id uuid null references public.content_blocks(id) on delete set null,
  add column if not exists source_outcome_id uuid null references public.curriculum_learning_outcomes(id) on delete set null;

create index if not exists idx_homework_questions_source_block on public.homework_questions(source_block_id) where source_block_id is not null;
create index if not exists idx_homework_questions_source_resource on public.homework_questions(source_resource_id) where source_resource_id is not null;

create or replace function public.ce_create_homework_from_payload(
  p_chapter_id uuid,
  p_class_id uuid,
  p_title text,
  p_instructions text,
  p_due_date date,
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
  v_tc record;
  v_subject_name text;
  v_homework_id uuid;
  v_question jsonb;
  v_sequence integer := 0;
  v_block_id uuid;
  v_block_resource_id uuid;
  v_chapter_resource_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then raise exception 'Questions are required'; end if;
  if jsonb_array_length(p_questions) > 50 then raise exception 'Too many questions'; end if;
  if p_due_date is not null and p_due_date < current_date then raise exception 'Due date cannot be in the past'; end if;

  v_ctx := public.ce_get_teacher_derivation_context(p_chapter_id);
  v_chapter_resource_id := nullif(v_ctx->>'chapter_resource_id','')::uuid;

  select tc.school_id, tc.subject_id, tc.class_id into v_tc
  from public.teacher_classes tc
  where tc.teacher_id = v_uid
    and tc.class_id = p_class_id
    and tc.school_id is not null
    and tc.subject_id is not null
  order by tc.created_at asc limit 1;
  if not found then raise exception 'Teacher is not assigned to this class and subject'; end if;

  select s.name into v_subject_name from public.subjects s where s.id = v_tc.subject_id;

  insert into public.homework(
    class_id, teacher_id, title, subject, instructions, type, due_date,
    school_id, source_publication_id, source_chapter_id, source_resource_id
  ) values (
    p_class_id, v_uid,
    coalesce(nullif(btrim(p_title),''), coalesce(v_ctx->>'chapter_title','Homework')),
    v_subject_name,
    nullif(btrim(coalesce(p_instructions,'')),''),
    'written', p_due_date, v_tc.school_id,
    nullif(v_ctx->>'publication_id','')::uuid,
    p_chapter_id,
    v_chapter_resource_id
  ) returning id into v_homework_id;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    if nullif(btrim(coalesce(v_question->>'prompt','')), '') is null then continue; end if;
    v_sequence := v_sequence + 1;

    begin
      v_block_id := nullif(v_question->>'sourceBlockId','')::uuid;
    exception when others then
      v_block_id := null;
    end;
    if v_block_id is not null and not exists (
      select 1 from public.content_blocks cb where cb.id = v_block_id and cb.chapter_id = p_chapter_id
    ) then v_block_id := null; end if;

    v_block_resource_id := null;
    if v_block_id is not null then
      select lr.id into v_block_resource_id from public.learning_resources lr
      where lr.content_block_id = v_block_id and lr.source_type = 'content_block'
      order by lr.created_at asc limit 1;
    end if;

    insert into public.homework_questions(
      homework_id, question, order_num, model_answer,
      source_resource_id, source_block_id
    ) values (
      v_homework_id,
      btrim(v_question->>'prompt'),
      v_sequence,
      nullif(btrim(coalesce(v_question->>'answer','')),''),
      coalesce(v_block_resource_id, v_chapter_resource_id),
      v_block_id
    );
  end loop;

  if v_sequence = 0 then raise exception 'No valid homework questions were supplied'; end if;

  return jsonb_build_object(
    'ok',true,'homework_id',v_homework_id,'question_count',v_sequence,
    'publication_id',v_ctx->>'publication_id','chapter_id',p_chapter_id,'class_id',p_class_id
  );
end;
$$;

revoke all on function public.ce_create_homework_from_payload(uuid,uuid,text,text,date,jsonb) from public, anon;
grant execute on function public.ce_create_homework_from_payload(uuid,uuid,text,text,date,jsonb) to authenticated, service_role;

commit;
