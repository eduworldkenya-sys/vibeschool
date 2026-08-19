-- VibeSchool Task 5: Student core journey pilot-context hardening.
--
-- Repairs production-proven defects without creating a parallel learner model:
-- 1. Kenya learner-day semantics must use Africa/Nairobi, not the database UTC day.
-- 2. VibeLearn Continue Learning must not surface completed or wrong-grade history.
-- 3. VibeLearn assigned assessments must use the canonical assignment lifecycle
--    (assigned/open), not the nonexistent `published` assignment state.
-- 4. KCSE practice must not be offered to non-Form learners.

-- Student day-based functions execute with the Kenya product timezone. This makes
-- current_date and timestamptz::date deterministic for the learner's local day.
do $$
declare
  r record;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'student_%'
      and pg_get_functiondef(p.oid) ilike '%current_date%'
  loop
    execute format('alter function %s set timezone to %L', r.oid::regprocedure, 'Africa/Nairobi');
  end loop;
end
$$;

-- Keep the existing workstation composition as an internal implementation so the
-- mature Twin/evidence payload is preserved. Ordinary clients cannot bypass the
-- scoped wrapper added below.
alter function public.student_get_vibelearn_workstation()
  rename to student_get_vibelearn_workstation_base_20260819;

revoke all on function public.student_get_vibelearn_workstation_base_20260819()
  from public, anon, authenticated;
grant execute on function public.student_get_vibelearn_workstation_base_20260819()
  to service_role;

create or replace function public.student_get_vibelearn_workstation()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set timezone = 'Africa/Nairobi'
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id uuid;
  v_class_id uuid;
  v_class_name text;
  v_class_key text;
  v_payload jsonb;
  v_continue jsonb := '[]'::jsonb;
  v_practice jsonb := '[]'::jsonb;
  v_assigned jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.id, coalesce(sc.class_id, s.class_id), c.name
  into v_student_id, v_class_id, v_class_name
  from public.students s
  left join public.student_classes sc
    on sc.student_id = s.id
   and sc.is_current = true
  left join public.classes c
    on c.id = coalesce(sc.class_id, s.class_id)
  where s.profile_id = v_user_id
    and s.deleted_at is null
  order by sc.joined_at desc nulls last
  limit 1;

  if v_student_id is null then
    raise exception 'Student profile not found';
  end if;

  v_payload := public.student_get_vibelearn_workstation_base_20260819();
  v_class_key := regexp_replace(lower(coalesce(v_class_name, '')), '[^a-z0-9]+', '', 'g');

  -- Reading history remains durable and account-scoped, but "Continue Learning"
  -- is an action recommendation. Only unfinished assets compatible with the
  -- learner's active class/grade may be promoted here.
  select coalesce(jsonb_agg(x.item order by x.last_read_at desc), '[]'::jsonb)
  into v_continue
  from (
    select item,
           nullif(item->>'last_read_at', '')::timestamptz as last_read_at
    from jsonb_array_elements(coalesce(v_payload->'continue_learning', '[]'::jsonb)) item
    join public.vibe_publications p
      on p.id = (item->>'publication_id')::uuid
    where coalesce(nullif(item->>'progress_percent', '')::numeric, 0) < 100
      and (
        p.cbc_grade is null
        or btrim(p.cbc_grade) = ''
        or regexp_replace(lower(p.cbc_grade), '[^a-z0-9]+', '', 'g') = v_class_key
      )
  ) x;

  -- KCSE question-bank practice is Form-specific. Primary/CBC grade learners must
  -- not receive secondary Form practice merely because questions exist globally.
  if v_class_key in ('form1', 'form2', 'form3', 'form4') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'subject', q.subject,
      'question_count', q.question_count,
      'action_url', '/student/vibelearn/practice?subject=' || lower(replace(q.subject, ' ', '-'))
    ) order by q.question_count desc), '[]'::jsonb)
    into v_practice
    from (
      select eq.subject::text as subject, count(*)::int as question_count
      from public.exam_question_bank eq
      where eq.status = 'published'
        and regexp_replace(lower(eq.form::text), '[^a-z0-9]+', '', 'g') = v_class_key
      group by eq.subject
      order by count(*) desc
      limit 8
    ) q;
  end if;

  -- Canonical assignment lifecycle is draft -> assigned/open -> closed. The old
  -- workstation filtered on `published`, a state forbidden by the table contract.
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', aa.id,
    'title', ad.title,
    'assessment_type', ad.assessment_type,
    'subject_id', ad.subject_id,
    'subject_name', subj.name,
    'closes_at', aa.closes_at,
    'action_url', '/student/assessment/' || aa.id::text
  ) order by aa.closes_at asc nulls last), '[]'::jsonb)
  into v_assigned
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id = aa.assessment_id
  left join public.subjects subj on subj.id = ad.subject_id
  where aa.class_id = v_class_id
    and aa.status in ('assigned', 'open')
    and (aa.opens_at is null or aa.opens_at <= now())
    and (aa.closes_at is null or aa.closes_at >= now())
    and (
      aa.target_group_id is null
      or exists (
        select 1
        from public.class_group_members cgm
        where cgm.group_id = aa.target_group_id
          and cgm.student_id = v_student_id
      )
    );

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_payload, '{continue_learning}', v_continue, true),
      '{practice_by_subject}', v_practice, true
    ),
    '{assigned_assessments}', v_assigned, true
  );
end;
$$;

revoke all on function public.student_get_vibelearn_workstation()
  from public, anon;
grant execute on function public.student_get_vibelearn_workstation()
  to authenticated, service_role;

comment on function public.student_get_vibelearn_workstation() is
  'Task 5 canonical learner VibeLearn workstation: active-class scoped resume, Form-scoped KCSE practice, and canonical assessment assignment lifecycle.';
