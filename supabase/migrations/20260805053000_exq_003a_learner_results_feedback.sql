begin;

create or replace function public.exq_list_my_results()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  learner_id uuid;
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id = caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id',at.id,'assignment_id',aa.id,'assessment_id',ad.id,
    'title',ad.title,'assessment_type',ad.assessment_type,
    'score',at.score,'max_score',at.max_score,'percentage',at.percentage,
    'feedback',at.feedback,'submitted_at',at.submitted_at,
    'released_at',at.teacher_reviewed_at,'attempt_number',at.attempt_number
  ) order by coalesce(at.teacher_reviewed_at,at.submitted_at) desc),'[]'::jsonb)
  into payload
  from public.assessment_attempts at
  join public.assessment_assignments aa on aa.id=at.assignment_id
  join public.assessment_definitions ad on ad.id=at.assessment_id
  where at.student_id=learner_id and at.status='released' and at.result_status='released';

  return jsonb_build_object('ok',true,'results',payload);
end;
$$;

create or replace function public.exq_get_my_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  learner_id uuid;
  at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype;
  ad public.assessment_definitions%rowtype;
  items jsonb;
  reveal_answers boolean;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into at from public.assessment_attempts where id=p_attempt_id and student_id=learner_id;
  if not found then raise exception 'result_not_found'; end if;
  if at.status <> 'released' or at.result_status <> 'released' then raise exception 'result_not_released'; end if;

  select * into aa from public.assessment_assignments where id=at.assignment_id;
  select * into ad from public.assessment_definitions where id=at.assessment_id;
  reveal_answers := aa.show_score_policy in ('immediate','after_close','after_review');

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ai.id,'order_num',ai.order_num,'question_type',ai.question_type,
    'prompt',ai.prompt,'response_text',ar.response_text,'response_value',ar.response_value,
    'final_score',ar.final_score,'max_score',ar.max_score,
    'teacher_feedback',ar.teacher_feedback,
    'explanation',case when reveal_answers then ai.explanation else null end,
    'worked_solution',case when reveal_answers then ai.worked_solution else null end,
    'correct_answer',case when reveal_answers then ai.correct_answer else null end
  ) order by ai.order_num),'[]'::jsonb)
  into items
  from public.assessment_responses ar
  join public.assessment_items ai on ai.id=ar.assessment_item_id
  where ar.attempt_id=at.id;

  return jsonb_build_object(
    'ok',true,'attempt_id',at.id,'title',ad.title,'assessment_type',ad.assessment_type,
    'score',at.score,'max_score',at.max_score,'percentage',at.percentage,
    'feedback',at.feedback,'submitted_at',at.submitted_at,'released_at',at.teacher_reviewed_at,
    'attempt_number',at.attempt_number,
    'can_retry',(select count(*) < aa.max_attempts from public.assessment_attempts prior
      where prior.assignment_id=at.assignment_id and prior.student_id=learner_id),
    'items',items
  );
end;
$$;

revoke all on function public.exq_list_my_results() from public,anon;
revoke all on function public.exq_get_my_result(uuid) from public,anon;
grant execute on function public.exq_list_my_results() to authenticated,service_role;
grant execute on function public.exq_get_my_result(uuid) to authenticated,service_role;

commit;
