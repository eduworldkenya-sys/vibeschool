-- CPA Foundation self-study: read a private paper catalogue without publishing
-- a blank learner course. Reuse existing quiz RPCs, never expose answer keys.
-- No new learning authority, no broad SELECT on unpublished courses/modules.
begin;

create or replace function public.get_my_cpa_paper_catalogue()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $catalogue$
declare
  v_user uuid := (select auth.uid());
  v_course public.courses%rowtype;
  v_papers jsonb;
begin
  if v_user is null or not exists (
    select 1 from public.learner_education_paths p
    where p.user_id = v_user
      and p.education_stage = 'post_secondary'
      and p.programme_family = 'professional_studies'
      and p.qualification_code = 'CPA'
      and p.examining_body = 'KASNEB'
  ) then
    raise exception 'CPA learner access denied' using errcode = '42501';
  end if;

  select * into v_course from public.courses
  where slug = 'kasneb-cpa' and qualification_code = 'CPA'
    and qualifying_body = 'KASNEB';
  if not found then
    raise exception 'CPA catalogue unavailable' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', m.slug,
    'title', m.title,
    'qualification_level', m.qualification_level,
    'qualification_requirement', m.qualification_requirement,
    'sequence_number', m.sequence_number,
    'has_published_lessons', (
      v_course.status = 'live' and exists (
        select 1 from public.topics t where t.module_id=m.id
        and t.content_status='published'
      )
    )
  ) order by m.sequence_number), '[]'::jsonb)
  into v_papers
  from public.modules m
  where m.course_id = v_course.id;

  return jsonb_build_object(
    'status', v_course.status,
    'papers', v_papers
  );
end;
$catalogue$;

revoke all on function public.get_my_cpa_paper_catalogue() from public, anon;
grant execute on function public.get_my_cpa_paper_catalogue() to authenticated;

-- Quizzes already use this protected service, but the previous read service
-- supplied the explanation before the learner answered. Keep its stable
-- result signature while withholding explanations and all answer keys.
create or replace function public.get_public_quiz_questions(p_topic_id uuid)
returns table(id uuid, question_text text, options jsonb, explanation text)
language plpgsql
security definer
set search_path = public, pg_temp
as $quizread$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  select q.id, q.question_text, q.options, null::text
  from public.quiz_questions q
  join public.topics t on t.id = q.topic_id
  join public.modules m on m.id = t.module_id
  join public.courses c on c.id = m.course_id
  where q.topic_id = p_topic_id
    and t.content_status = 'published'
    and c.status = 'live'
  order by q.created_at, q.id;
end;
$quizread$;

-- Only a genuine listed answer may be submitted. A forged value cannot
-- be used to extract the full explanation or turn the quiz into a data oracle.
create or replace function public.submit_quiz_answer(
  p_question_id uuid,
  p_option_id text
)
returns table(is_correct boolean, explanation text)
language plpgsql
security definer
set search_path = public, pg_temp
as $quizmark$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  select q.correct_option_id = p_option_id, q.explanation
  from public.quiz_questions q
  join public.topics t on t.id = q.topic_id
  join public.modules m on m.id = t.module_id
  join public.courses c on c.id = m.course_id
  where q.id = p_question_id
    and t.content_status = 'published'
    and c.status = 'live'
    and exists (
      select 1 from jsonb_array_elements(q.options) opt
      where opt->>'id' = p_option_id
    );
end;
$quizmark$;

revoke all on function public.get_public_quiz_questions(uuid) from public, anon;
grant execute on function public.get_public_quiz_questions(uuid) to authenticated;
revoke all on function public.submit_quiz_answer(uuid,text) from public, anon;
grant execute on function public.submit_quiz_answer(uuid,text) to authenticated;

-- Negative-path preflight: no public or anonymous access to private catalogue.
do $assert$
begin
  if has_function_privilege('anon', 'public.get_my_cpa_paper_catalogue()', 'EXECUTE')
    or has_function_privilege('anon','public.get_public_quiz_questions(uuid)','EXECUTE')
    or has_function_privilege('anon','public.submit_quiz_answer(uuid,text)','EXECUTE')
  then raise exception 'Anonymous execution must be denied'; end if;
  if not has_function_privilege('authenticated','public.get_my_cpa_paper_catalogue()','EXECUTE')
  then raise exception 'College learner catalogue function not granted'; end if;
end $assert$;
commit;
