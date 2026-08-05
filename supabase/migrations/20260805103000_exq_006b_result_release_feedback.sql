begin;

alter table public.assessment_assignments
  add column if not exists answer_review_policy text not null default 'after_release',
  add column if not exists show_explanations boolean not null default true,
  add column if not exists show_worked_solutions boolean not null default true;

alter table public.assessment_assignments
  drop constraint if exists assessment_assignments_answer_review_policy_chk,
  add constraint assessment_assignments_answer_review_policy_chk
    check (answer_review_policy in ('never','after_release','after_close'));

create or replace function public.exq_set_result_visibility(
  p_assignment_id uuid,
  p_answer_review_policy text,
  p_show_explanations boolean default true,
  p_show_worked_solutions boolean default true
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); aa public.assessment_assignments%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_answer_review_policy not in ('never','after_release','after_close') then raise exception 'invalid_answer_review_policy'; end if;
  select * into aa from public.assessment_assignments where id=p_assignment_id for update;
  if not found then raise exception 'assignment_not_found'; end if;
  if aa.teacher_id is distinct from caller then raise exception 'assignment_not_owned'; end if;
  update public.assessment_assignments
  set answer_review_policy=p_answer_review_policy,
      show_explanations=coalesce(p_show_explanations,true),
      show_worked_solutions=coalesce(p_show_worked_solutions,true),
      updated_at=now()
  where id=aa.id;
  return jsonb_build_object('ok',true,'assignment_id',aa.id,'answer_review_policy',p_answer_review_policy,
    'show_explanations',coalesce(p_show_explanations,true),'show_worked_solutions',coalesce(p_show_worked_solutions,true));
end;
$$;

create or replace function public.exq_get_my_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid(); learner_id uuid; at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype; ad public.assessment_definitions%rowtype;
  items jsonb; reveal_answers boolean; reveal_explanations boolean; reveal_solutions boolean; attempts_used integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;
  select * into at from public.assessment_attempts where id=p_attempt_id and student_id=learner_id;
  if not found then raise exception 'result_not_found'; end if;
  if at.status<>'released' or at.result_status<>'released' then raise exception 'result_not_released'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  select * into ad from public.assessment_definitions where id=at.assessment_id;
  reveal_answers:=case when aa.answer_review_policy='never' then false when aa.answer_review_policy='after_release' then true when aa.answer_review_policy='after_close' then aa.closes_at is not null and aa.closes_at<=now() else false end;
  reveal_explanations:=reveal_answers and aa.show_explanations;
  reveal_solutions:=reveal_answers and aa.show_worked_solutions;
  select count(*) into attempts_used from public.assessment_attempts prior where prior.assignment_id=at.assignment_id and prior.student_id=learner_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ai.id,'order_num',ai.order_num,'question_type',ai.question_type,'prompt',ai.prompt,
    'response_text',ar.response_text,'response_value',ar.response_value,'final_score',ar.final_score,'max_score',ar.max_score,
    'teacher_feedback',ar.teacher_feedback,'answer_revealed',reveal_answers,
    'explanation',case when reveal_explanations then ai.explanation else null end,
    'worked_solution',case when reveal_solutions then ai.worked_solution else null end,
    'correct_answer',case when reveal_answers then ai.correct_answer else null end
  ) order by ai.order_num),'[]'::jsonb)
  into items
  from public.assessment_responses ar join public.assessment_items ai on ai.id=ar.assessment_item_id
  where ar.attempt_id=at.id and ar.status<>'void';
  return jsonb_build_object(
    'ok',true,'attempt_id',at.id,'assignment_id',aa.id,'title',ad.title,'assessment_type',ad.assessment_type,
    'score',at.score,'max_score',at.max_score,'percentage',at.percentage,'feedback',at.feedback,
    'submitted_at',at.submitted_at,'released_at',at.released_at,'attempt_number',at.attempt_number,
    'attempts_used',attempts_used,'max_attempts',aa.max_attempts,'answer_review_policy',aa.answer_review_policy,
    'answers_revealed',reveal_answers,'can_retry',(
      attempts_used<aa.max_attempts and aa.status in ('assigned','open')
      and (aa.opens_at is null or aa.opens_at<=now()) and (aa.closes_at is null or aa.closes_at>now())
    ),'items',items);
end;
$$;

create or replace function public.exq_list_my_results()
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); learner_id uuid; payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id',at.id,'assignment_id',aa.id,'assessment_id',ad.id,'title',ad.title,
    'assessment_type',ad.assessment_type,'score',at.score,'max_score',at.max_score,
    'percentage',at.percentage,'feedback',at.feedback,'submitted_at',at.submitted_at,
    'released_at',at.released_at,'attempt_number',at.attempt_number,'max_attempts',aa.max_attempts
  ) order by at.released_at desc nulls last,at.submitted_at desc),'[]'::jsonb)
  into payload
  from public.assessment_attempts at
  join public.assessment_assignments aa on aa.id=at.assignment_id
  join public.assessment_definitions ad on ad.id=at.assessment_id
  where at.student_id=learner_id and at.status='released' and at.result_status='released';
  return jsonb_build_object('ok',true,'results',payload);
end;
$$;

revoke all on function public.exq_set_result_visibility(uuid,text,boolean,boolean) from public,anon;
revoke all on function public.exq_get_my_result(uuid) from public,anon;
revoke all on function public.exq_list_my_results() from public,anon;
grant execute on function public.exq_set_result_visibility(uuid,text,boolean,boolean) to authenticated,service_role;
grant execute on function public.exq_get_my_result(uuid) to authenticated,service_role;
grant execute on function public.exq_list_my_results() to authenticated,service_role;

commit;
