-- Serve verified practice questions without exposing answer keys.
-- Scoring remains with student_record_vibelearn_practice_answer.
create or replace function public.student_list_vibelearn_practice_questions(
  p_subject text default null,
  p_topic text default null,
  p_form text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile uuid := auth.uid();
  v_student uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit,20),20));
  v_questions jsonb;
begin
  if v_profile is null then raise exception 'Authentication required'; end if;
  select s.id into v_student
    from public.students s
    where s.profile_id=v_profile and s.deleted_at is null
    order by s.created_at limit 1;
  if v_student is null then raise exception 'Learner profile not found'; end if;

  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_questions
  from (
    select b.id, b.subject::text as subject, b.form::text as form,
           b.topic, b.difficulty::text as difficulty, b.question, b.options, b.hint
    from public.exam_question_bank b
    where b.status='active'
      and b.provenance_status in ('teacher_verified','publisher_verified','official_verified')
      and (nullif(btrim(p_subject),'') is null or lower(b.subject::text)=lower(btrim(p_subject)))
      and (nullif(btrim(p_topic),'') is null or lower(b.topic)=lower(btrim(p_topic)))
      and (nullif(btrim(p_form),'') is null or lower(b.form::text)=lower(btrim(p_form)))
    order by b.id
    limit v_limit
  ) q;
  return v_questions;
end;
$$;

revoke execute on function public.student_list_vibelearn_practice_questions(text,text,text,integer) from public, anon;
grant execute on function public.student_list_vibelearn_practice_questions(text,text,text,integer) to authenticated;
