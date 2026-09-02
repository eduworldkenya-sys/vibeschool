begin;

create or replace function public.exq_promote_assessment_item_to_question_bank(
  p_assessment_item_id uuid,
  p_learning_outcome_id uuid default null,
  p_competency_tag text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  item public.assessment_items%rowtype;
  definition public.assessment_definitions%rowtype;
  existing_id uuid;
  question_id uuid;
  normalized_fingerprint text;
  resolved_outcome_id uuid := p_learning_outcome_id;
  linked_outcome_count integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into item from public.assessment_items where id = p_assessment_item_id;
  if not found then raise exception 'assessment_item_not_found'; end if;
  select * into definition from public.assessment_definitions where id = item.assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;
  if definition.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if item.status = 'retired' then raise exception 'assessment_item_retired'; end if;

  if resolved_outcome_id is null then
    select count(*), min(aio.outcome_id)
    into linked_outcome_count, resolved_outcome_id
    from public.assessment_item_outcomes aio
    where aio.assessment_item_id = item.id;

    if linked_outcome_count <> 1 then
      resolved_outcome_id := null;
    end if;
  end if;

  if definition.generation_source <> 'teacher_authored' and resolved_outcome_id is null then
    raise exception 'grounded_question_bank_outcome_required';
  end if;

  normalized_fingerprint := encode(digest(lower(regexp_replace(btrim(item.prompt), '\s+', ' ', 'g')), 'sha256'), 'hex');
  select id into existing_id
  from public.assessment_questions
  where author_id = caller
    and fingerprint = normalized_fingerprint
    and review_status <> 'retired'
  order by version desc
  limit 1;

  if existing_id is not null then
    if definition.generation_source <> 'teacher_authored'
       and not exists (
         select 1 from public.assessment_questions q
         where q.id = existing_id
           and q.subject_id is not distinct from definition.subject_id
           and q.learning_outcome_id = resolved_outcome_id
       )
    then raise exception 'existing_question_bank_lineage_mismatch'; end if;
    return jsonb_build_object('ok', true, 'created', false, 'question_id', existing_id);
  end if;

  insert into public.assessment_questions(
    school_id, subject_id, curriculum_id, learning_outcome_id, source_assessment_item_id,
    question_text, question_type, options, correct_answer, difficulty, competency_tag,
    source_type, status, author_id, marks, bloom_level, accepted_answers, marking_guide,
    explanation, fingerprint, review_status, version
  ) values (
    definition.school_id, definition.subject_id, null, resolved_outcome_id, item.id,
    item.prompt, item.question_type, item.options,
    case when item.correct_answer is null then null else item.correct_answer#>>'{}' end,
    item.difficulty, nullif(btrim(coalesce(p_competency_tag, '')), ''),
    'assessment_item', 'draft', caller, item.marks, item.bloom_level, item.accepted_answers,
    item.marking_guide, item.explanation, normalized_fingerprint, 'draft', 1
  ) returning id into question_id;

  return jsonb_build_object('ok', true, 'created', true, 'question_id', question_id);
end;
$$;

create or replace function public.exq_add_question_bank_item_to_assessment(
  p_question_id uuid,
  p_assessment_id uuid,
  p_order_num integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  q public.assessment_questions%rowtype;
  ad public.assessment_definitions%rowtype;
  item_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_order_num <= 0 then raise exception 'invalid_order_num'; end if;

  select * into q from public.assessment_questions where id = p_question_id;
  if not found then raise exception 'question_not_found'; end if;
  if q.review_status <> 'approved' and q.author_id is distinct from caller then raise exception 'question_not_available'; end if;

  select * into ad from public.assessment_definitions where id = p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status not in ('draft', 'review') then raise exception 'assessment_locked'; end if;

  if ad.generation_source <> 'teacher_authored' then
    if q.learning_outcome_id is null then raise exception 'question_bank_outcome_required'; end if;
    if q.subject_id is distinct from ad.subject_id then raise exception 'question_bank_subject_mismatch'; end if;
  end if;

  insert into public.assessment_items(
    assessment_id, source_item_id, question_type, prompt, options, accepted_answers,
    correct_answer, marking_guide, explanation, marks, difficulty, bloom_level,
    auto_marking_mode, order_num, status, generated_by
  ) values (
    ad.id, q.id, q.question_type, q.question_text, coalesce(q.options, '[]'::jsonb), q.accepted_answers,
    case when q.correct_answer is null then null else to_jsonb(q.correct_answer) end,
    q.marking_guide, q.explanation, q.marks, q.difficulty, q.bloom_level,
    case when q.correct_answer is null then 'none' else 'case_insensitive' end,
    p_order_num, 'draft', 'question_bank'
  ) returning id into item_id;

  if q.learning_outcome_id is not null then
    insert into public.assessment_item_outcomes(assessment_item_id, outcome_id, weight)
    values(item_id, q.learning_outcome_id, 1)
    on conflict (assessment_item_id, outcome_id) do nothing;
  end if;

  update public.assessment_questions
  set usage_count = usage_count + 1, last_used_at = now(), updated_at = now()
  where id = q.id;

  return jsonb_build_object('ok', true, 'assessment_item_id', item_id, 'question_id', q.id);
end;
$$;

revoke all on function public.exq_promote_assessment_item_to_question_bank(uuid, uuid, text) from public, anon;
revoke all on function public.exq_add_question_bank_item_to_assessment(uuid, uuid, integer) from public, anon;
grant execute on function public.exq_promote_assessment_item_to_question_bank(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.exq_add_question_bank_item_to_assessment(uuid, uuid, integer) to authenticated, service_role;

commit;
