-- VibeSchool: submitted practice guided self-review. Requires migration 20261115040500.
-- Formal exam release and canonical gradebook remain unchanged.
begin;

create or replace function public.exq_get_my_self_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_assignment public.assessment_assignments%rowtype;
  v_items jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select at.* into v_attempt
  from public.assessment_attempts at
  join public.students s on s.id=at.student_id
  where at.id=p_attempt_id and s.profile_id=auth.uid();
  if not found then raise exception 'attempt_not_owned_or_found'; end if;

  select * into v_assignment from public.assessment_assignments where id=v_attempt.assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if not (
    (v_attempt.status='released' and v_attempt.result_status='released')
    or (v_attempt.status='teacher_review'
      and v_attempt.result_status='partially_marked'
      and v_attempt.submitted_at is not null
      and v_assignment.show_score_policy='immediate'
      and exists (
        select 1 from public.assessment_definitions d
        where d.id=v_attempt.assessment_id and d.assessment_type='practice'
      ))
  ) then raise exception 'result_not_released'; end if;

  if not (
      v_assignment.answer_review_policy='after_release'
      or (v_assignment.answer_review_policy='after_close'
          and v_assignment.closes_at is not null and v_assignment.closes_at<=now())
  ) then raise exception 'answer_review_not_available'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id', ai.id,
    'criteria', ai.marking_guide->'criteria',
    'max_score', ar.max_score,
    'self_review_score', ar.self_review_score,
    'selected_ids', ar.self_review_selected_ids,
    'unsure', ar.self_review_unsure,
    'reviewed_at', ar.self_reviewed_at
  ) order by ai.order_num), '[]'::jsonb)
  into v_items
  from public.assessment_responses ar
  join public.assessment_items ai on ai.id=ar.assessment_item_id
  where ar.attempt_id=v_attempt.id
    and ar.status<>'void'
    and ai.auto_marking_mode='none'
    and ai.question_type in ('short_answer','structured','essay','drawing','practical')
    and case when jsonb_typeof(ai.marking_guide->'criteria')='array'
      then jsonb_array_length(ai.marking_guide->'criteria') between 1 and 20
      else false end;

  return jsonb_build_object('ok', true, 'attempt_id',v_attempt.id,'items',v_items);
end;
$fn$;


create or replace function public.exq_set_my_self_review(
  p_attempt_id uuid,
  p_assessment_item_id uuid,
  p_selected_ids text[] default array[]::text[],
  p_unsure boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_assignment public.assessment_assignments%rowtype;
  v_item public.assessment_items%rowtype;
  v_response public.assessment_responses%rowtype;
  v_criteria jsonb;
  v_criterion jsonb;
  v_id text;
  v_label text;
  v_points numeric;
  v_max_criteria numeric:=0;
  v_awarded numeric:=0;
  v_ids text[]:=array[]::text[];
  v_count int:=0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select at.* into v_attempt
  from public.assessment_attempts at
  join public.students s on s.id=at.student_id
  where at.id=p_attempt_id and s.profile_id=auth.uid();
  if not found then raise exception 'attempt_not_owned_or_found'; end if;

  select * into v_assignment from public.assessment_assignments where id=v_attempt.assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if not (
    (v_attempt.status='released' and v_attempt.result_status='released')
    or (v_attempt.status='teacher_review'
      and v_attempt.result_status='partially_marked'
      and v_attempt.submitted_at is not null
      and v_assignment.show_score_policy='immediate'
      and exists (
        select 1 from public.assessment_definitions d
        where d.id=v_attempt.assessment_id and d.assessment_type='practice'
      ))
  ) then raise exception 'result_not_released'; end if;

  if not (
      v_assignment.answer_review_policy='after_release'
      or (v_assignment.answer_review_policy='after_close'
          and v_assignment.closes_at is not null and v_assignment.closes_at<=now())
  ) then raise exception 'answer_review_not_available'; end if;

  select * into v_item from public.assessment_items
  where id=p_assessment_item_id and assessment_id=v_attempt.assessment_id;
  if not found or v_item.auto_marking_mode<>'none'
     or v_item.question_type not in ('short_answer','structured','essay','drawing','practical')
  then raise exception 'not_a_self_reviewable_item'; end if;

  select * into v_response from public.assessment_responses
  where attempt_id=v_attempt.id and assessment_item_id=v_item.id
  for update;
  if not found or v_response.status='void' then raise exception 'response_not_found'; end if;

  if p_unsure is null or p_selected_ids is null or cardinality(p_selected_ids)>20
     or (p_unsure and cardinality(p_selected_ids)>0)
  then raise exception 'invalid_self_review_selection'; end if;
  if not p_unsure and cardinality(p_selected_ids)>0 and
     nullif(btrim(coalesce(v_response.response_text,'')),'') is null
  then raise exception 'cannot_award_unanswered_response'; end if;

  v_criteria:=v_item.marking_guide->'criteria';
  if jsonb_typeof(v_criteria) is distinct from 'array' then
    raise exception 'verified_point_form_scheme_required';
  end if;
  if jsonb_array_length(v_criteria) not between 1 and 20 then
    raise exception 'verified_point_form_scheme_required';
  end if;

  for v_criterion in select value from jsonb_array_elements(v_criteria) as x(value) loop
    v_count:=v_count+1;
    if jsonb_typeof(v_criterion)<>'object'
       or jsonb_typeof(v_criterion->'id')<>'string'
       or jsonb_typeof(v_criterion->'label')<>'string'
       or jsonb_typeof(v_criterion->'marks')<>'number'
    then raise exception 'invalid_point_form_scheme'; end if;

    v_id:=btrim(v_criterion->>'id');
    v_label:=btrim(v_criterion->>'label');
    v_points:=(v_criterion->>'marks')::numeric;
    if v_id='' or length(v_id)>80 or v_label='' or length(v_label)>500
       or v_points<=0 or v_id=any(v_ids) then
      raise exception 'invalid_point_form_scheme';
    end if;
    v_ids:=array_append(v_ids,v_id);
    v_max_criteria:=v_max_criteria+v_points;
    if v_id=any(p_selected_ids) then v_awarded:=v_awarded+v_points; end if;
  end loop;

  if v_count=0 or v_max_criteria>v_item.marks
    or (select count(distinct x.id) from unnest(p_selected_ids) as x(id))<>cardinality(p_selected_ids)
    or exists(select 1 from unnest(p_selected_ids) as x(id) where x.id is null or not (x.id=any(v_ids)))
  then raise exception 'invalid_self_review_selection_or_scheme'; end if;

  update public.assessment_responses
  set self_review_score=case when p_unsure then null else v_awarded end,
      self_review_selected_ids=case when p_unsure then array[]::text[] else p_selected_ids end,
      self_review_unsure=p_unsure,
      self_reviewed_at=now()
  where id=v_response.id;

  return jsonb_build_object(
    'ok',true, 'assessment_item_id',v_item.id,
    'self_review_score',case when p_unsure then null else v_awarded end,
    'selected_ids',case when p_unsure then '[]'::jsonb else to_jsonb(p_selected_ids) end,
    'unsure',p_unsure, 'max_score',v_response.max_score,
    'score_authority','learner_self_assessed_not_verified'
  );
end;
$fn$;



-- Immediate practice review is a separate self-assessment report, not a
-- formal exam result, a grading authority, or a second assessment engine.
create or replace function public.exq_get_my_practice_self_review(p_attempt_id uuid)
returns jsonb language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_assignment public.assessment_assignments%rowtype;
  v_definition public.assessment_definitions%rowtype;
  v_items jsonb;
  v_guide jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select at.* into v_attempt
  from public.assessment_attempts at
  join public.students s on s.id=at.student_id
  where at.id=p_attempt_id and s.profile_id=auth.uid();
  if not found then raise exception 'attempt_not_owned_or_found'; end if;

  select * into v_assignment from public.assessment_assignments where id=v_attempt.assignment_id;
  select * into v_definition from public.assessment_definitions where id=v_attempt.assessment_id;
  if v_definition.assessment_type<>'practice'
    or v_assignment.show_score_policy<>'immediate'
    or v_attempt.submitted_at is null
    or not (
      (v_attempt.status='teacher_review' and v_attempt.result_status='partially_marked')
      or (v_attempt.status='released' and v_attempt.result_status='released')
    )
  then raise exception 'practice_review_not_available'; end if;
  if not (
      v_assignment.answer_review_policy='after_release'
      or (v_assignment.answer_review_policy='after_close'
          and v_assignment.closes_at is not null and v_assignment.closes_at<=now())
  ) then raise exception 'answer_review_not_available'; end if;

  v_guide:=public.exq_get_my_self_review(p_attempt_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ai.id,
    'order_num',ai.order_num,
    'prompt',ai.prompt,
    'question_type',ai.question_type,
    'response_text',ar.response_text,
    'response_value',ar.response_value,
    'auto_score',ar.auto_score,
    'max_score',ar.max_score,
    'correct_answer',ai.correct_answer,
    'explanation',case when v_assignment.show_explanations then ai.explanation else null end,
    'worked_solution',case when v_assignment.show_worked_solutions then ai.worked_solution else null end
  ) order by ai.order_num), '[]'::jsonb)
  into v_items
  from public.assessment_responses ar
  join public.assessment_items ai on ai.id=ar.assessment_item_id
  where ar.attempt_id=v_attempt.id and ar.status<>'void';

  return jsonb_build_object(
    'ok',true,'attempt_id',v_attempt.id,'title',v_definition.title,
    'assessment_type','practice','score_authority','mixed_auto_and_self_assessed',
    'verified_score',(select coalesce(sum(ar.auto_score),0) from public.assessment_responses ar
      where ar.attempt_id=v_attempt.id and ar.status='auto_marked'),
    'verified_max',(select coalesce(sum(ar.max_score),0) from public.assessment_responses ar
      where ar.attempt_id=v_attempt.id and ar.status='auto_marked'),
    'written_max',(select coalesce(sum(ar.max_score),0) from public.assessment_responses ar
      where ar.attempt_id=v_attempt.id and ar.status='teacher_review'),
    'items',v_items,'reviews',v_guide->'items'
  );
end;
$fn$;
revoke all on function public.exq_get_my_practice_self_review(uuid) from public, anon;
grant execute on function public.exq_get_my_practice_self_review(uuid) to authenticated;
comment on function public.exq_get_my_practice_self_review(uuid) is
  'Learner-owned submitted immediate practice only. Never exposes a formal paper or alters gradebook.';

commit;
