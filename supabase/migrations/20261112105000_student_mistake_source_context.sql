-- Learner-only source-grade provenance for displaying historical mistakes.
-- This is presentation metadata: never change the original attempt or mistake.
create or replace function public.student_get_my_mistake_source_grades()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
declare
  v_student uuid;
  v_results jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'mistake_id', m.id,
    'source_grade', q.form::text,
    'source_verified', coalesce(
      q.provenance_status in ('teacher_verified','publisher_verified','official_verified'),false)
  )),'[]'::jsonb)
  into v_results
  from public.student_mistake_notebook m
  left join public.exam_question_bank q on q.id=m.exam_question_id
  where m.student_id=v_student
    and m.exam_question_id is not null;

  return v_results;
end;
$function$;
revoke all on function public.student_get_my_mistake_source_grades()
  from public, anon;
grant execute on function public.student_get_my_mistake_source_grades()
  to authenticated;
