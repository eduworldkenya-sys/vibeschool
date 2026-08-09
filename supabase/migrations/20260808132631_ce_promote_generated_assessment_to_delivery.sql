begin;

create or replace function public.ce_promote_generated_assessment(
  p_generated_assessment_id uuid,
  p_class_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_generated record;
  v_blueprint record;
  v_tc record;
  v_source_resource_id uuid;
  v_definition_id uuid;
  v_existing_id uuid;
  v_item record;
  v_type text;
  v_answer text;
  v_auto_mode text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select ga.* into v_generated
  from public.generated_assessments ga
  where ga.id = p_generated_assessment_id
  for update;
  if not found then raise exception 'Generated assessment not found'; end if;

  select b.* into v_blueprint
  from public.content_assessment_blueprints b
  where b.id = v_generated.blueprint_id;
  if not found then raise exception 'Assessment blueprint not found'; end if;
  if v_blueprint.teacher_id is distinct from v_uid then raise exception 'Not authorized'; end if;
  if v_generated.status <> 'approved' or v_blueprint.status <> 'approved' then
    raise exception 'Assessment must be teacher-approved before promotion';
  end if;

  select tc.school_id, tc.subject_id, tc.class_id into v_tc
  from public.teacher_classes tc
  where tc.teacher_id = v_uid
    and tc.class_id = p_class_id
    and tc.school_id is not null
    and tc.subject_id is not null
  order by tc.created_at asc
  limit 1;
  if not found then raise exception 'Teacher is not assigned to this class and subject'; end if;

  select ad.id into v_existing_id
  from public.assessment_definitions ad
  where ad.teacher_id = v_uid
    and ad.generation_metadata->>'generated_assessment_id' = p_generated_assessment_id::text
    and ad.class_id = p_class_id
  order by ad.created_at desc
  limit 1;
  if v_existing_id is not null then
    return jsonb_build_object('ok',true,'assessment_id',v_existing_id,'operation','existing');
  end if;

  select cas.resource_id into v_source_resource_id
  from public.content_assessment_sources cas
  where cas.blueprint_id = v_blueprint.id
  order by cas.created_at asc
  limit 1;

  v_type := case v_blueprint.assessment_type
    when 'cat' then 'test'
    when 'quiz' then 'quiz'
    when 'exam' then 'exam'
    when 'homework' then 'homework'
    when 'exercise' then 'exercise'
    else 'practice'
  end;

  insert into public.assessment_definitions(
    school_id, teacher_id, class_id, subject_id, source_resource_id,
    assessment_type, title, status, version, total_marks,
    generation_source, generation_metadata, approved_by, approved_at,
    teacher_reviewed_at, generation_status
  ) values (
    v_tc.school_id, v_uid, p_class_id, v_tc.subject_id, v_source_resource_id,
    v_type, v_blueprint.title, 'approved', 1, v_generated.total_marks,
    'content_engine',
    jsonb_build_object(
      'generated_assessment_id', p_generated_assessment_id,
      'blueprint_id', v_blueprint.id,
      'provenance', 'content_engine_generated_assessment'
    ),
    v_uid, coalesce(v_generated.approved_at, now()), now(), 'generated'
  ) returning id into v_definition_id;

  for v_item in
    select * from public.generated_assessment_items
    where assessment_id = p_generated_assessment_id
    order by sequence
  loop
    v_answer := nullif(btrim(coalesce(v_item.answer_key->>'answer','')), '');
    v_auto_mode := case
      when v_item.question_type = 'multiple_choice' then 'option_match'
      when v_answer is not null then 'case_insensitive'
      else 'none'
    end;

    insert into public.assessment_items(
      assessment_id, source_resource_id, source_block_id,
      question_type, prompt, options, accepted_answers, correct_answer,
      marking_guide, marks, difficulty, bloom_level, auto_marking_mode,
      order_num, status, generated_by, teacher_approved_at
    ) values (
      v_definition_id, v_item.source_resource_id, v_item.source_block_id,
      v_item.question_type, v_item.prompt, coalesce(v_item.options,'[]'::jsonb),
      case when v_answer is null then '[]'::jsonb else jsonb_build_array(v_answer) end,
      v_item.answer_key,
      coalesce(v_item.answer_key,'{}'::jsonb),
      v_item.marks, v_item.difficulty, v_item.bloom_level, v_auto_mode,
      v_item.sequence, 'approved', 'content_engine', now()
    );
  end loop;

  return jsonb_build_object('ok',true,'assessment_id',v_definition_id,'operation','created');
end;
$$;

revoke all on function public.ce_promote_generated_assessment(uuid,uuid) from public, anon;
grant execute on function public.ce_promote_generated_assessment(uuid,uuid) to authenticated, service_role;

create or replace function public.ce_assign_assessment_to_class(
  p_assessment_id uuid,
  p_closes_at timestamptz default null,
  p_time_limit_minutes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_assessment record;
  v_assignment_id uuid;
  v_existing_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select ad.* into v_assessment
  from public.assessment_definitions ad
  where ad.id = p_assessment_id
  for update;
  if not found then raise exception 'Assessment not found'; end if;
  if v_assessment.teacher_id is distinct from v_uid then raise exception 'Not authorized'; end if;
  if v_assessment.status not in ('approved','assigned','open') then raise exception 'Assessment is not approved for assignment'; end if;
  if v_assessment.class_id is null then raise exception 'Assessment has no target class'; end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'Close time must be in the future'; end if;
  if p_time_limit_minutes is not null and p_time_limit_minutes <= 0 then raise exception 'Time limit must be positive'; end if;

  if not exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = v_uid
      and tc.school_id = v_assessment.school_id
      and tc.class_id = v_assessment.class_id
      and tc.subject_id = v_assessment.subject_id
  ) then raise exception 'Teacher assignment no longer permits this assessment'; end if;

  select aa.id into v_existing_id
  from public.assessment_assignments aa
  where aa.assessment_id = p_assessment_id
    and aa.class_id = v_assessment.class_id
    and aa.teacher_id = v_uid
    and aa.status in ('assigned','open')
  order by aa.created_at desc limit 1;
  if v_existing_id is not null then
    return jsonb_build_object('ok',true,'assignment_id',v_existing_id,'operation','existing');
  end if;

  insert into public.assessment_assignments(
    assessment_id, school_id, class_id, teacher_id,
    status, opens_at, closes_at, time_limit_minutes,
    max_attempts, randomize_items, randomize_options,
    show_score_policy, answer_review_policy,
    show_explanations, show_worked_solutions, assigned_at
  ) values (
    p_assessment_id, v_assessment.school_id, v_assessment.class_id, v_uid,
    'assigned', now(), p_closes_at, p_time_limit_minutes,
    1, false, false, 'after_review', 'after_release', true, true, now()
  ) returning id into v_assignment_id;

  update public.assessment_definitions
  set status = 'assigned', updated_at = now()
  where id = p_assessment_id and status = 'approved';

  return jsonb_build_object('ok',true,'assignment_id',v_assignment_id,'operation','created');
end;
$$;

revoke all on function public.ce_assign_assessment_to_class(uuid,timestamptz,integer) from public, anon;
grant execute on function public.ce_assign_assessment_to_class(uuid,timestamptz,integer) to authenticated, service_role;

commit;
