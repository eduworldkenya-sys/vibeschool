-- Released timestamp belongs to the canonical gradebook, not assessment_attempts.
CREATE OR REPLACE FUNCTION public.exq_get_my_result(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid:=auth.uid();
  learner_id uuid;
  at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype;
  ad public.assessment_definitions%rowtype;
  items jsonb;
  reveal_answers boolean;
  reveal_explanations boolean;
  reveal_solutions boolean;
  attempts_used integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at
  from public.assessment_attempts
  where id=p_attempt_id and student_id=learner_id;
  if not found then raise exception 'result_not_found'; end if;
  if at.status<>'released' or at.result_status<>'released' then raise exception 'result_not_released'; end if;

  select * into aa from public.assessment_assignments where id=at.assignment_id;
  select * into ad from public.assessment_definitions where id=at.assessment_id;

  reveal_answers:=case
    when aa.answer_review_policy='never' then false
    when aa.answer_review_policy='after_release' then true
    when aa.answer_review_policy='after_close' then aa.closes_at is not null and aa.closes_at<=now()
    else false
  end;
  reveal_explanations:=reveal_answers and aa.show_explanations;
  reveal_solutions:=reveal_answers and aa.show_worked_solutions;

  select count(*) into attempts_used
  from public.assessment_attempts prior
  where prior.assignment_id=at.assignment_id and prior.student_id=learner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ai.id,
    'order_num',ai.order_num,
    'question_type',ai.question_type,
    'prompt',ai.prompt,
    'response_text',ar.response_text,
    'response_value',ar.response_value,
    'final_score',ar.final_score,
    'max_score',ar.max_score,
    'teacher_feedback',ar.teacher_feedback,
    'answer_revealed',reveal_answers,
    'explanation',case when reveal_explanations then ai.explanation else null end,
    'worked_solution',case when reveal_solutions then ai.worked_solution else null end,
    'correct_answer',case when reveal_answers then ai.correct_answer else null end
  ) order by ai.order_num),'[]'::jsonb)
  into items
  from public.assessment_responses ar
  join public.assessment_items ai on ai.id=ar.assessment_item_id
  where ar.attempt_id=at.id and ar.status<>'void';

  return jsonb_build_object(
    'ok',true,
    'attempt_id',at.id,
    'assignment_id',aa.id,
    'title',ad.title,
    'assessment_type',ad.assessment_type,
    'score',at.score,
    'max_score',at.max_score,
    'percentage',at.percentage,
    'feedback',at.feedback,
    'submitted_at',at.submitted_at,
    'released_at',(select g.released_at from public.assessment_gradebook_entries g where g.attempt_id=at.id limit 1),
    'attempt_number',at.attempt_number,
    'attempts_used',attempts_used,
    'max_attempts',aa.max_attempts,
    'answer_review_policy',aa.answer_review_policy,
    'answers_revealed',reveal_answers,
    'can_retry',(
      attempts_used<aa.max_attempts
      and aa.status in ('assigned','open')
      and (aa.opens_at is null or aa.opens_at<=now())
      and (aa.closes_at is null or aa.closes_at>now())
    ),
    'items',items
  );
end;
$function$
;
