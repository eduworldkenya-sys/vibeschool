-- Twin adaptive tutor memory authority parity.
-- Makes structured evidence-backed learner memory explicit in the bounded tutor context.
-- Production applied as twin_adaptive_tutor_memory_authority.

create or replace function public.student_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_brain jsonb;
  v_memory jsonb;
begin
  v_brain := public.student_get_twin_brain();
  v_memory := public.student_get_twin_memory();
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
    'learning',v_brain->'learning',
    'adaptation',v_brain->'adaptation',
    'memory',v_memory,
    'exam',v_brain->'exam',
    'study_time',v_brain->'study_time',
    'guardrails',v_brain->'tutor'
  );
end;
$function$;

revoke all on function public.student_get_twin_tutor_context() from public, anon;
grant execute on function public.student_get_twin_tutor_context() to authenticated;
