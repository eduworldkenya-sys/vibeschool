begin;

create or replace function public.exq_list_marking_queue()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id', at.id,
    'assignment_id', aa.id,
    'assessment_id', ad.id,
    'assessment_title', ad.title,
    'assessment_type', ad.assessment_type,
    'class_name', c.name,
    'class_stream', c.stream,
    'student_id', s.id,
    'student_name', s.name,
    'admission_number', s.admission_number,
    'attempt_status', at.status,
    'result_status', at.result_status,
    'score', at.score,
    'max_score', at.max_score,
    'percentage', at.percentage,
    'submitted_at', at.submitted_at,
    'manual_items', (
      select count(*) from public.assessment_responses ar
      where ar.attempt_id=at.id and ar.status='teacher_review'
    )
  ) order by at.submitted_at desc),'[]'::jsonb)
  into payload
  from public.assessment_attempts at
  join public.assessment_assignments aa on aa.id=at.assignment_id
  join public.assessment_definitions ad on ad.id=at.assessment_id
  join public.students s on s.id=at.student_id
  join public.classes c on c.id=at.class_id
  where aa.teacher_id=caller
    and at.status in ('teacher_review','marked','released');

  return jsonb_build_object('ok',true,'attempts',payload);
end;
$$;

create or replace function public.exq_get_marking_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype;
  ad public.assessment_definitions%rowtype;
  learner public.students%rowtype;
  responses jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into at from public.assessment_attempts where id=p_attempt_id;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'attempt_not_owned'; end if;
  select * into ad from public.assessment_definitions where id=at.assessment_id;
  select * into learner from public.students where id=at.student_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'response_id', ar.id,
    'assessment_item_id', ai.id,
    'order_num', ai.order_num,
    'question_type', ai.question_type,
    'prompt', ai.prompt,
    'response_text', ar.response_text,
    'response_value', ar.response_value,
    'auto_score', ar.auto_score,
    'teacher_score', ar.teacher_score,
    'final_score', ar.final_score,
    'max_score', ar.max_score,
    'teacher_feedback', ar.teacher_feedback,
    'status', ar.status,
    'marking_guide', ai.marking_guide,
    'correct_answer', ai.correct_answer
  ) order by ai.order_num),'[]'::jsonb)
  into responses
  from public.assessment_responses ar
  join public.assessment_items ai on ai.id=ar.assessment_item_id
  where ar.attempt_id=at.id;

  return jsonb_build_object(
    'ok',true,
    'attempt_id',at.id,
    'assessment_title',ad.title,
    'student_name',learner.name,
    'attempt_status',at.status,
    'result_status',at.result_status,
    'score',at.score,
    'max_score',at.max_score,
    'percentage',at.percentage,
    'feedback',at.feedback,
    'responses',responses
  );
end;
$$;

create or replace function public.exq_mark_response(
  p_response_id uuid,
  p_teacher_score numeric,
  p_teacher_feedback text default null,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  ar public.assessment_responses%rowtype;
  at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ar from public.assessment_responses where id=p_response_id for update;
  if not found then raise exception 'response_not_found'; end if;
  select * into at from public.assessment_attempts where id=ar.attempt_id;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'response_not_owned'; end if;
  if p_teacher_score < 0 or p_teacher_score > ar.max_score then raise exception 'invalid_score'; end if;

  update public.assessment_responses
  set teacher_score=p_teacher_score,
      final_score=p_teacher_score,
      teacher_feedback=nullif(btrim(coalesce(p_teacher_feedback,'')),''),
      teacher_override_reason=nullif(btrim(coalesce(p_override_reason,'')),''),
      status='marked',marked_by=caller,marked_at=now(),updated_at=now()
  where id=p_response_id;

  return jsonb_build_object('ok',true,'response_id',p_response_id,'score',p_teacher_score);
end;
$$;

create or replace function public.exq_finalize_attempt(
  p_attempt_id uuid,
  p_feedback text default null,
  p_release boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  at public.assessment_attempts%rowtype;
  aa public.assessment_assignments%rowtype;
  unresolved integer;
  total_score numeric;
  total_max numeric;
  pct numeric;
  next_status text;
  next_result text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into at from public.assessment_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'attempt_not_owned'; end if;

  select count(*) into unresolved
  from public.assessment_responses
  where attempt_id=at.id and final_score is null and status <> 'void';
  if unresolved > 0 then raise exception 'responses_unmarked'; end if;

  select coalesce(sum(final_score),0),coalesce(sum(max_score),0)
  into total_score,total_max
  from public.assessment_responses
  where attempt_id=at.id and status <> 'void';

  pct := case when total_max>0 then round((total_score/total_max)*100,3) else 0 end;
  next_status := case when p_release then 'released' else 'marked' end;
  next_result := case when p_release then 'released' else 'marked' end;

  update public.assessment_attempts
  set status=next_status,result_status=next_result,score=total_score,max_score=total_max,
      percentage=pct,feedback=nullif(btrim(coalesce(p_feedback,'')),''),
      reviewed_by=caller,teacher_reviewed_at=now(),updated_at=now()
  where id=at.id;

  return jsonb_build_object('ok',true,'attempt_id',at.id,'status',next_status,
    'result_status',next_result,'score',total_score,'max_score',total_max,'percentage',pct);
end;
$$;

revoke all on function public.exq_list_marking_queue() from public,anon;
revoke all on function public.exq_get_marking_attempt(uuid) from public,anon;
revoke all on function public.exq_mark_response(uuid,numeric,text,text) from public,anon;
revoke all on function public.exq_finalize_attempt(uuid,text,boolean) from public,anon;
grant execute on function public.exq_list_marking_queue() to authenticated,service_role;
grant execute on function public.exq_get_marking_attempt(uuid) to authenticated,service_role;
grant execute on function public.exq_mark_response(uuid,numeric,text,text) to authenticated,service_role;
grant execute on function public.exq_finalize_attempt(uuid,text,boolean) to authenticated,service_role;

commit;
