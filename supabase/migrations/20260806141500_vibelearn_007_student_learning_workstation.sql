create or replace function public.student_get_vibelearn_workstation()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_student_id uuid;
  v_class_id uuid;
  v_class_name text;
  v_subjects jsonb;
  v_continue jsonb;
  v_practice jsonb;
  v_assigned jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select s.id, coalesce(sc.class_id, s.class_id), c.name
  into v_student_id, v_class_id, v_class_name
  from public.students s
  left join public.student_classes sc on sc.student_id = s.id and sc.is_current = true
  left join public.classes c on c.id = coalesce(sc.class_id, s.class_id)
  where s.profile_id = v_user_id and s.deleted_at is null
  order by sc.joined_at desc nulls last
  limit 1;

  if v_student_id is null then raise exception 'Student profile not found'; end if;

  select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.name), '[]'::jsonb)
  into v_subjects
  from (
    select distinct subj.id, subj.name,
      (select count(*)::int from public.vibelearn_content vc where vc.status = 'published' and vc.subject_id = subj.id) as resource_count
    from public.subjects subj
    where exists (select 1 from public.teacher_classes tc where tc.class_id = v_class_id and tc.subject_id = subj.id)
       or exists (select 1 from public.vibelearn_content vc where vc.status = 'published' and vc.subject_id = subj.id)
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'publication_id', rp.publication_id,
    'chapter_id', rp.chapter_id,
    'title', p.title,
    'chapter_title', ch.title,
    'progress_percent', rp.progress_percent,
    'last_read_at', rp.last_read_at,
    'action_url', '/read/textbook/' || rp.publication_id::text
  ) order by rp.last_read_at desc), '[]'::jsonb)
  into v_continue
  from public.vibe_reading_progress rp
  join public.vibe_publications p on p.id = rp.publication_id and p.status = 'published'
  left join public.vibe_chapters ch on ch.id = rp.chapter_id
  where rp.viewer_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject', q.subject,
    'question_count', q.question_count,
    'action_url', '/student/vibelearn/practice?subject=' || lower(replace(q.subject,' ','-'))
  ) order by q.question_count desc), '[]'::jsonb)
  into v_practice
  from (
    select subject::text as subject, count(*)::int as question_count
    from public.exam_question_bank
    where status = 'published'
    group by subject
    order by count(*) desc
    limit 8
  ) q;

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
    and aa.status = 'published'
    and (aa.opens_at is null or aa.opens_at <= now())
    and (aa.closes_at is null or aa.closes_at >= now());

  return jsonb_build_object(
    'student_id', v_student_id,
    'class_id', v_class_id,
    'class_name', v_class_name,
    'subjects', v_subjects,
    'continue_learning', v_continue,
    'practice_by_subject', v_practice,
    'assigned_assessments', v_assigned,
    'tutor_policy', jsonb_build_object(
      'default_mode', 'off',
      'allowed_actions', jsonb_build_array('hint','explain_simply','show_example','explain_mistake','translate','read_aloud'),
      'blocked_in_timed_assessment', true,
      'answer_reveal_requires_escalation', true,
      'ai_share_target_percent', 10
    )
  );
end;
$$;

revoke all on function public.student_get_vibelearn_workstation() from public, anon;
grant execute on function public.student_get_vibelearn_workstation() to authenticated;
