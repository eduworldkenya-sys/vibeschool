create table if not exists public.student_exam_readiness_state (
  student_id uuid primary key references auth.users(id) on delete cascade,
  exam_name text not null default 'KCSE',
  exam_date date,
  daily_revision_minutes integer not null default 90 check (daily_revision_minutes between 15 and 480),
  confidence_check integer check (confidence_check between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_exam_readiness_state enable row level security;

drop policy if exists student_exam_readiness_select_own on public.student_exam_readiness_state;
create policy student_exam_readiness_select_own on public.student_exam_readiness_state
for select to authenticated using (student_id = auth.uid());

drop policy if exists student_exam_readiness_update_own on public.student_exam_readiness_state;
create policy student_exam_readiness_update_own on public.student_exam_readiness_state
for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists student_exam_readiness_insert_own on public.student_exam_readiness_state;
create policy student_exam_readiness_insert_own on public.student_exam_readiness_state
for insert to authenticated with check (student_id = auth.uid());

create or replace function public.student_get_exam_readiness_brief()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_student uuid;
  v_class uuid;
  v_class_name text;
  v_target text;
  v_exam_name text := 'KCSE';
  v_exam_date date;
  v_daily_minutes integer := 90;
  v_confidence integer;
  v_days integer;
  v_avg numeric;
  v_attempts integer;
  v_subjects jsonb;
  v_priorities jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select s.id, s.class_id, c.name into v_student, v_class, v_class_name
  from public.students s left join public.classes c on c.id=s.class_id
  where s.profile_id=v_user and s.deleted_at is null limit 1;
  if v_student is null then raise exception 'Student profile not found'; end if;

  insert into public.student_exam_readiness_state(student_id)
  values (v_user)
  on conflict (student_id) do nothing;

  select r.exam_name, r.exam_date, r.daily_revision_minutes, r.confidence_check
  into v_exam_name, v_exam_date, v_daily_minutes, v_confidence
  from public.student_exam_readiness_state r where r.student_id=v_user;

  select h.kcse_target_grade into v_target from public.student_home_state h where h.student_id=v_user;

  if v_exam_date is not null then v_days := greatest(v_exam_date - current_date, 0); end if;

  select round(avg(a.percentage)::numeric,1), count(*)
  into v_avg, v_attempts
  from public.assessment_attempts a
  where a.student_id=v_student and a.status in ('submitted','auto_marked','teacher_reviewed') and a.percentage is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject_id', x.subject_id,
    'subject_name', x.subject_name,
    'attempts', x.attempts,
    'average_percentage', x.avg_pct,
    'signal', case when x.avg_pct < 50 then 'needs_attention' when x.avg_pct < 70 then 'developing' else 'strong' end
  ) order by x.avg_pct asc), '[]'::jsonb)
  into v_subjects
  from (
    select ass.subject_id, coalesce(su.name,'General') subject_name, count(*) attempts, round(avg(a.percentage)::numeric,1) avg_pct
    from public.assessment_attempts a
    join public.assessments ass on ass.id=a.assessment_id
    left join public.subjects su on su.id=ass.subject_id
    where a.student_id=v_student and a.status in ('submitted','auto_marked','teacher_reviewed') and a.percentage is not null
    group by ass.subject_id, su.name
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject', q.subject::text,
    'topic', q.topic,
    'available_questions', q.cnt,
    'action_url', '/student/vibelearn/practice?subject=' || replace(q.subject::text,' ','%20'),
    'reason', case when q.form::text='Form 4' then 'Form 4 exam practice available' else 'Exam practice available' end
  ) order by q.cnt desc), '[]'::jsonb)
  into v_priorities
  from (
    select subject, form, coalesce(topic,'Mixed practice') topic, count(*) cnt
    from public.exam_question_bank
    where status='published' and form::text='Form 4'
    group by subject, form, topic
    order by count(*) desc
    limit 5
  ) q;

  return jsonb_build_object(
    'student_id',v_student,
    'class_id',v_class,
    'class_name',v_class_name,
    'exam_name',v_exam_name,
    'exam_date',v_exam_date,
    'days_remaining',v_days,
    'target_grade',v_target,
    'daily_revision_minutes',v_daily_minutes,
    'confidence_check',v_confidence,
    'evidence',jsonb_build_object('attempt_count',coalesce(v_attempts,0),'average_percentage',v_avg),
    'subject_signals',v_subjects,
    'revision_priorities',v_priorities,
    'psychology',jsonb_build_object(
      'headline',case when v_days is null then 'Set your exam date to build a focused plan.' when v_days <= 14 then 'Protect calm, accuracy and sleep. Focus on mistakes, not panic.' when v_days <= 60 then 'There is still time to improve through focused daily practice.' else 'Build consistency now so pressure stays manageable later.' end,
      'comparison_rule','Compete with your previous performance, not public rankings.',
      'prediction_disclaimer','Readiness is based on available Vibeschool evidence and is not an official KCSE prediction.'
    )
  );
end;$$;

create or replace function public.student_update_exam_readiness(p_exam_date date, p_daily_revision_minutes integer, p_confidence_check integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.student_exam_readiness_state(student_id, exam_date, daily_revision_minutes, confidence_check, updated_at)
  values(auth.uid(), p_exam_date, greatest(15,least(480,p_daily_revision_minutes)), case when p_confidence_check between 1 and 5 then p_confidence_check else null end, now())
  on conflict(student_id) do update set exam_date=excluded.exam_date, daily_revision_minutes=excluded.daily_revision_minutes, confidence_check=excluded.confidence_check, updated_at=now();
end;$$;

revoke all on function public.student_get_exam_readiness_brief() from public, anon;
revoke all on function public.student_update_exam_readiness(date,integer,integer) from public, anon;
grant execute on function public.student_get_exam_readiness_brief() to authenticated;
grant execute on function public.student_update_exam_readiness(date,integer,integer) to authenticated;
