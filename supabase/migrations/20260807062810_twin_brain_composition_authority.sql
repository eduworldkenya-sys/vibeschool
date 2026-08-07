create or replace function public.student_get_twin_brain()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_state jsonb;
  v_mastery jsonb;
  v_prediction jsonb;
  v_priority jsonb;
  v_tutor jsonb;
  v_student_id uuid;
begin
  v_state := public.student_get_twin_state();
  v_mastery := public.student_get_twin_mastery();
  v_prediction := public.student_get_twin_prediction();
  v_priority := public.student_get_twin_priority();
  v_student_id := nullif(v_state->>'student_id','')::uuid;

  v_tutor := jsonb_build_object(
    'mode','bounded',
    'can_explain',true,
    'can_question',true,
    'can_hint',true,
    'can_generate_practice',true,
    'cannot_change_marks',true,
    'cannot_mark_verified_completion',true,
    'cannot_override_teacher_interventions',true,
    'cannot_claim_official_exam_prediction',true,
    'mastery',v_mastery,
    'prediction',v_prediction,
    'decision',v_priority,
    'interventions',coalesce(v_state->'interventions','[]'::jsonb),
    'curriculum',coalesce(v_state->'curriculum','{}'::jsonb)
  );

  v_state := v_state || jsonb_build_object(
    'mastery',v_mastery,
    'prediction',v_prediction,
    'decision',v_priority,
    'tutor',v_tutor
  );

  if v_student_id is not null then
    update public.student_twin_state_snapshots
       set state = v_state,
           confidence_score = coalesce((v_state->>'confidence')::numeric,confidence_score),
           generated_at = now(),
           updated_at = now()
     where student_id = v_student_id;
  end if;

  return v_state;
end;
$function$;

create or replace function public.student_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_brain jsonb;
begin
  v_brain := public.student_get_twin_brain();
  return jsonb_build_object(
    'student_id',v_brain->'student_id',
    'generated_at',v_brain->'generated_at',
    'confidence',v_brain->'confidence',
    'curriculum',v_brain->'curriculum',
    'mastery',v_brain->'mastery',
    'interventions',v_brain->'interventions',
    'recommendations',v_brain->'recommendations',
    'decision',v_brain->'decision',
    'prediction',v_brain->'prediction',
    'evidence',v_brain->'evidence',
    'guardrails',v_brain->'tutor'
  );
end;
$function$;

revoke all on function public.student_get_twin_brain() from public,anon;
grant execute on function public.student_get_twin_brain() to authenticated,service_role;
revoke all on function public.student_get_twin_tutor_context() from public,anon;
grant execute on function public.student_get_twin_tutor_context() to authenticated,service_role;
