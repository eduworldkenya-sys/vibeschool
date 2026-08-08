create or replace function public.student_get_twin_school_context()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student public.students%rowtype;
  v_class_id uuid;
  v_school_id uuid;
  v_today_dow integer := extract(isodow from current_date)::integer;
  v_attendance jsonb;
  v_homework jsonb;
  v_timetable jsonb;
  v_pacing jsonb;
  v_lessons jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_student from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  select sc.class_id, sc.school_id into v_class_id, v_school_id
  from public.student_classes sc where sc.student_id=v_student.id and sc.is_current=true
  order by sc.joined_at desc limit 1;
  v_class_id := coalesce(v_class_id,v_student.class_id);

  select jsonb_build_object(
    'recent',coalesce(jsonb_agg(jsonb_build_object('date',x.date,'status',x.status,'is_late',x.is_late) order by x.date desc),'[]'::jsonb),
    'present_last_14_days',count(*) filter(where x.status::text='present' and x.date>=current_date-13),
    'absent_last_14_days',count(*) filter(where x.status::text='absent' and x.date>=current_date-13),
    'latest_date',max(x.date)
  ) into v_attendance
  from (select a.date,a.status,a.is_late from public.attendance a where a.student_id in (v_student.id,v_uid) order by a.date desc limit 14) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'homework_id',h.id,'title',h.title,'due_date',h.due_date,
    'submission_status',hs.status,'submitted_at',hs.submitted_at,'returned_at',hs.returned_at,
    'feedback_released_at',hs.feedback_released_at,'mark',case when hs.feedback_released_at is not null then hs.mark else null end
  ) order by h.due_date asc nulls last),'[]'::jsonb)
  into v_homework
  from public.homework h
  left join lateral (
    select s.status,s.submitted_at,s.returned_at,s.feedback_released_at,s.mark
    from public.homework_submissions s
    where s.homework_id=h.id and s.student_id in (v_student.id,v_uid)
    order by s.updated_at desc limit 1
  ) hs on true
  where h.class_id=v_class_id and (h.due_date is null or h.due_date>=current_date-14);

  select coalesce(jsonb_agg(jsonb_build_object(
    'slot_id',ts.id,'subject_id',ts.subject_id,'day_of_week',ts.day_of_week,
    'start_time',ts.start_time,'end_time',ts.end_time,'is_today',ts.day_of_week=v_today_dow
  ) order by ts.day_of_week,ts.start_time),'[]'::jsonb)
  into v_timetable
  from public.timetable_slots ts
  where ts.class_id=v_class_id and ts.effective_from<=current_date and (ts.effective_until is null or ts.effective_until>=current_date);

  select coalesce(jsonb_agg(jsonb_build_object(
    'scheme_id',sw.id,'subject_id',sw.subject_id,'week',sw.week,'date',sw.date,
    'topic',sw.topic,'status',sw.status
  ) order by sw.week desc,sw.sequence_number desc nulls last),'[]'::jsonb)
  into v_pacing
  from (select * from public.scheme_of_work where class_id=v_class_id order by week desc,sequence_number desc nulls last limit 18) sw;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lesson_plan_id',lp.id,'subject_id',lp.subject_id,'title',lp.title,'topic',lp.topic,
    'status',lp.status,'taught_date',lp.taught_date,'scheme_id',lp.scheme_id
  ) order by lp.taught_date desc nulls last,lp.created_at desc),'[]'::jsonb)
  into v_lessons
  from (select * from public.lesson_plans where class_id=v_class_id order by taught_date desc nulls last,created_at desc limit 12) lp;

  return jsonb_build_object(
    'student_id',v_student.id,'profile_id',v_uid,'class_id',v_class_id,'school_id',v_school_id,
    'attendance',coalesce(v_attendance,'{}'::jsonb),
    'assigned_homework',coalesce(v_homework,'[]'::jsonb),
    'timetable',coalesce(v_timetable,'[]'::jsonb),
    'scheme_pacing',coalesce(v_pacing,'[]'::jsonb),
    'recent_teacher_lessons',coalesce(v_lessons,'[]'::jsonb),
    'authority',jsonb_build_object(
      'teacher_assignments_are_obligations',true,
      'teacher_pacing_is_context_not_mastery',true,
      'attendance_is_context_not_mastery',true,
      'private_teacher_notes_exposed',false,
      'twin_may_override_teacher_assignment',false
    ),
    'generated_at',now()
  );
end;
$$;

revoke all on function public.student_get_twin_school_context() from public;
revoke all on function public.student_get_twin_school_context() from anon;
grant execute on function public.student_get_twin_school_context() to authenticated;

create or replace function public.student_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_brain jsonb;
  v_memory jsonb;
  v_school jsonb;
begin
  v_brain := public.student_get_twin_brain();
  v_memory := public.student_get_twin_memory();
  v_school := public.student_get_twin_school_context();
  return jsonb_build_object(
    'student_id',v_brain->'student_id','generated_at',v_brain->'generated_at','confidence',v_brain->'confidence',
    'curriculum',v_brain->'curriculum','mastery',v_brain->'mastery','interventions',v_brain->'interventions',
    'recommendations',v_brain->'recommendations','decision',v_brain->'decision','prediction',v_brain->'prediction',
    'evidence',v_brain->'evidence','learning',v_brain->'learning','adaptation',v_brain->'adaptation','memory',v_memory,
    'exam',v_brain->'exam','study_time',v_brain->'study_time','school_context',v_school,'guardrails',v_brain->'tutor'
  );
end;
$$;

revoke all on function public.student_get_twin_tutor_context() from public;
revoke all on function public.student_get_twin_tutor_context() from anon;
grant execute on function public.student_get_twin_tutor_context() to authenticated;
