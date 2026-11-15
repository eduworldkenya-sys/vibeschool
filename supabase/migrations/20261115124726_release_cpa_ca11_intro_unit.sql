-- Content quality release for the first reviewed CPA Foundation CA11 unit only.
-- Curriculum identity: KASNEB CPA reviewed syllabus June 2024, CA11 sections 1.1–1.5.
-- Current paper designation: official April 2026 KASNEB qualification booklet.
-- Consumer: existing course->module->topic learner reader and protected quiz service.
-- This publish is intentionally narrow, independently verified by an executable
-- contract and gated by source/answer identity, never a blanket CPA syllabus release.
begin;

do $release$
declare
  v_course public.courses%rowtype;
  v_module public.modules%rowtype;
  v_topic_count integer;
  v_question_count integer;
  v_incorrect_answers integer;
  v_weak_topics integer;
  v_foreign_topics integer;
begin
  select * into v_course from public.courses
  where slug='kasneb-cpa'
    and qualification_code='CPA'
    and qualifying_body='KASNEB'
    and status='coming_soon'
    and syllabus_source_url like 'https://www.kasneb.or.ke/%';
  if not found then
    raise exception 'CA11 publish blocked: canonical source/versioned course missing or already live';
  end if;
  select * into v_module from public.modules
  where course_id=v_course.id and slug='ca11' and qualification_level='Foundation'
    and qualification_requirement='required';
  if not found then
    raise exception 'CA11 publish blocked: Foundation paper missing';
  end if;
  select count(*) into v_foreign_topics
  from public.topics t join public.modules m on m.id=t.module_id
  where m.course_id=v_course.id and (m.slug <> 'ca11' or
    t.slug not in ('why-accounts-matter','five-elements-of-financial-statements','the-equation-in-action'));
  if v_foreign_topics > 0 then
    raise exception 'CA11 publish blocked: unexpected CPA topics have been staged';
  end if;
  select count(*) into v_topic_count from public.topics t
  where t.module_id=v_module.id
    and t.content_status='in_review'
    and t.week_number is null
    and t.slug in ('why-accounts-matter','five-elements-of-financial-statements','the-equation-in-action');
  if v_topic_count <> 3 then
    raise exception 'CA11 publish blocked: expected three independently reviewed topics, got %',v_topic_count;
  end if;
  select count(*) into v_weak_topics from public.topics t
  where t.module_id=v_module.id and (
    jsonb_typeof(t.concept_tab) is distinct from 'array'
    or jsonb_array_length(coalesce(t.concept_tab, '[]'::jsonb)) < 6
    or jsonb_array_length(coalesce(t.kenya_context_tab, '[]'::jsonb)) < 1
    or jsonb_array_length(coalesce(t.common_errors_tab, '[]'::jsonb)) < 1
    or jsonb_array_length(coalesce(t.clinical_tip_tab, '[]'::jsonb)) < 1
  );
  if v_weak_topics <> 0 then
    raise exception 'CA11 publish blocked: lesson depth incomplete';
  end if;
  select count(*) into v_question_count from public.quiz_questions q
  join public.topics t on t.id=q.topic_id
  where t.module_id=v_module.id;
  if v_question_count <> 12 then
    raise exception 'CA11 publish blocked: expected 12 verified questions, got %',v_question_count;
  end if;
  select count(*) into v_incorrect_answers from public.quiz_questions q
  join public.topics t on t.id=q.topic_id
  where t.module_id=v_module.id and (
    jsonb_typeof(q.options) is distinct from 'array'
    or jsonb_array_length(q.options) <> 4
    or not exists (
      select 1 from jsonb_array_elements(q.options) o
      where o->>'id' = q.correct_option_id
    )
    or length(btrim(coalesce(q.explanation,''))) < 65
  );
  if v_incorrect_answers <> 0 then
    raise exception 'CA11 publish blocked: malformed answer keys or insufficient explanations';
  end if;
  if not exists (
    select 1 from pg_proc
    where pronamespace='public'::regnamespace and proname='get_my_cpa_paper_catalogue'
  ) or not exists (
    select 1 from pg_proc
    where pronamespace='public'::regnamespace and proname='submit_quiz_answer'
  ) then
    raise exception 'CA11 publish blocked: protected catalogue/practice missing';
  end if;
  update public.topics set content_status='published'
  where module_id=v_module.id
    and content_status='in_review'
    and slug in ('why-accounts-matter','five-elements-of-financial-statements','the-equation-in-action');
  if not found then raise exception 'CA11 publish blocked: no eligible topics'; end if;
  update public.courses set status='live' where id=v_course.id and status='coming_soon';
  if not found then raise exception 'CA11 publish blocked: course changed during publication'; end if;
end $release$;
commit;
