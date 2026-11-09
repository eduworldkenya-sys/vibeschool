-- Read-only topic catalog over the existing verified practice bank.
-- Questions, answer keys, scoring and attempt receipts stay in their existing services.
create or replace function public.student_list_topic_practice_topics(p_form text)
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  v_student uuid;
  v_topics jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_student := public.current_student_id();
  if v_student is null then raise exception 'learner_identity_not_found'; end if;
  if nullif(btrim(p_form),'') is null then raise exception 'grade_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('subject',subject,'topic',topic,'count',question_count) order by subject,topic),'[]'::jsonb)
  into v_topics
  from (
    select b.subject::text as subject, b.topic::text as topic, count(distinct b.id) as question_count
    from public.exam_question_bank b
    where b.status='active'
      and b.provenance_status in ('teacher_verified','publisher_verified','official_verified')
      and lower(b.form::text)=lower(btrim(p_form))
      and nullif(btrim(b.topic),'') is not null
    group by b.subject::text,b.topic::text
    having count(distinct b.id)>=5
  ) ready;
  return v_topics;
end;
$$;
revoke all on function public.student_list_topic_practice_topics(text) from public,anon;
grant execute on function public.student_list_topic_practice_topics(text) to authenticated;
