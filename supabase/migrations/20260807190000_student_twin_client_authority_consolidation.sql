-- Student Twin consolidation:
-- 1. one authenticated brain RPC refreshes the canonical snapshot;
-- 2. VibeLearn projects that snapshot instead of recomputing the brain independently.

create or replace function public.student_get_twin_brain_cached()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_state jsonb;
  v_student_id uuid;
  v_evidence jsonb;
begin
  v_state := public.student_get_twin_brain();
  v_student_id := nullif(v_state->>'student_id', '')::uuid;
  v_evidence := coalesce(v_state->'evidence', '{}'::jsonb);

  if v_student_id is not null then
    insert into public.student_twin_state_snapshots(
      student_id,
      state,
      confidence_score,
      evidence_count,
      generated_at,
      updated_at
    )
    values (
      v_student_id,
      v_state,
      coalesce((v_state->>'confidence')::numeric, 0),
      coalesce((v_evidence->>'competency_evidence_count')::integer, 0),
      now(),
      now()
    )
    on conflict (student_id) do update
      set state = excluded.state,
          confidence_score = excluded.confidence_score,
          evidence_count = excluded.evidence_count,
          generated_at = excluded.generated_at,
          updated_at = excluded.updated_at;
  end if;

  return v_state;
end;
$function$;

revoke all on function public.student_get_twin_brain_cached() from public, anon;
grant execute on function public.student_get_twin_brain_cached() to authenticated;

create or replace function public.student_get_vibelearn_workstation()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_student_id uuid;
  v_class_id uuid;
  v_class_name text;
  v_subjects jsonb;
  v_continue jsonb;
  v_practice jsonb;
  v_assigned jsonb;
  v_twin jsonb := '{}'::jsonb;
  v_twin_summary jsonb := '{}'::jsonb;
  v_now jsonb;
  v_learning jsonb := '{}'::jsonb;
  v_adaptation jsonb := '{}'::jsonb;
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

  select coalesce(state, '{}'::jsonb)
  into v_twin
  from public.student_twin_state_snapshots
  where student_id = v_student_id;

  v_twin := coalesce(v_twin, '{}'::jsonb);
  v_now := v_twin #> '{decision,now}';
  v_learning := coalesce(v_twin->'learning', '{}'::jsonb);
  v_adaptation := coalesce(v_twin->'adaptation', '{}'::jsonb);

  v_twin_summary := jsonb_build_object(
    'available', v_twin <> '{}'::jsonb,
    'confidence', coalesce((v_twin->>'confidence')::numeric, 0),
    'now', coalesce(v_now, 'null'::jsonb),
    'next', coalesce(v_twin #> '{decision,next}', '[]'::jsonb),
    'mastery', jsonb_build_object(
      'outcome_count', coalesce(jsonb_array_length(coalesce(v_twin #> '{mastery,outcomes}', '[]'::jsonb)), 0),
      'average_effective_mastery', v_twin #> '{prediction,average_effective_mastery}',
      'average_forgetting_risk', coalesce(v_twin #> '{prediction,average_forgetting_risk}', '0'::jsonb)
    ),
    'evidence', jsonb_build_object(
      'competency_evidence_count', coalesce(v_twin #> '{evidence,competency_evidence_count}', '0'::jsonb),
      'learning_event_count', coalesce(v_twin #> '{evidence,learning_event_count}', '0'::jsonb),
      'task_receipt_count', coalesce(v_twin #> '{evidence,task_receipt_count}', '0'::jsonb),
      'verified_calibration_count', coalesce(v_twin #> '{evidence,verified_calibration_count}', '0'::jsonb)
    ),
    'learning', jsonb_build_object(
      'policy', v_learning->'policy',
      'unresolved_exposures', coalesce(v_learning->'unresolved_exposures', '0'::jsonb),
      'learned_interventions', coalesce(v_learning->'learned_interventions', '[]'::jsonb)
    ),
    'adaptation', jsonb_build_object(
      'policy_version', coalesce(v_adaptation->'policy_version', '0'::jsonb),
      'strategy', v_adaptation #> '{decision,strategy}',
      'difficulty', v_adaptation #> '{decision,difficulty}',
      'reason', v_adaptation #> '{decision,reason}'
    ),
    'guardrails', jsonb_build_object(
      'uses_verified_evidence', true,
      'must_abstain_when_evidence_is_insufficient', true,
      'teacher_authority_first', true,
      'twin_does_not_create_marks_or_verified_completion', true
    )
  );

  return jsonb_build_object(
    'student_id', v_student_id,
    'class_id', v_class_id,
    'class_name', v_class_name,
    'subjects', v_subjects,
    'continue_learning', v_continue,
    'practice_by_subject', v_practice,
    'assigned_assessments', v_assigned,
    'twin', v_twin_summary,
    'tutor_policy', jsonb_build_object(
      'default_mode', 'off',
      'allowed_actions', jsonb_build_array('hint','explain_simply','show_example','explain_mistake','translate','read_aloud'),
      'blocked_in_timed_assessment', true,
      'answer_reveal_requires_escalation', true,
      'ai_share_target_percent', 10
    )
  );
end;
$function$;

revoke all on function public.student_get_vibelearn_workstation() from public, anon;
grant execute on function public.student_get_vibelearn_workstation() to authenticated;
