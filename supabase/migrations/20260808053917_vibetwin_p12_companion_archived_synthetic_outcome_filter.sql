create or replace function public.student_get_learning_companion_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_brain jsonb;
  v_memory jsonb;
  v_learning jsonb;
  v_revision jsonb;
  v_revision_context jsonb;
  v_session jsonb;
  v_safe_claims jsonb := '[]'::jsonb;
  v_safe_exposures jsonb := '[]'::jsonb;
  v_safe_changes jsonb := '[]'::jsonb;
  v_today jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  v_brain := public.student_get_twin_brain();
  v_memory := public.student_get_twin_memory();
  v_learning := public.student_get_twin_learning();
  v_revision := public.student_get_revision_workspace(null,null);
  v_revision_context := public.student_get_adaptive_revision_context();

  select to_jsonb(s) into v_session
  from public.student_adaptive_learning_sessions s
  where s.profile_id=v_uid and s.status in ('planned','active')
  order by s.updated_at desc limit 1;

  select coalesce(jsonb_agg(c order by coalesce((c->>'importance')::numeric,0) desc, c->>'last_confirmed_at' desc),'[]'::jsonb)
    into v_safe_claims
  from jsonb_array_elements(coalesce(v_memory->'claims','[]'::jsonb)) c
  left join public.curriculum_learning_outcomes o on o.id=nullif(c->>'outcome_id','')::uuid
  where coalesce(c #>> '{source,synthetic}','false') <> 'true'
    and coalesce(c #>> '{provenance,synthetic}','false') <> 'true'
    and coalesce(c->>'claim_key','') not ilike 'synthetic_twin_seed_v1:%'
    and coalesce(c->>'claim','') not ilike '%SYNTHETIC TWIN TEST%'
    and (o.id is null or (o.status in ('active','verified') and coalesce(o.outcome_text,'') not ilike '%SYNTHETIC TWIN TEST%'));

  select coalesce(jsonb_agg(e order by e->>'exposed_at' desc),'[]'::jsonb)
    into v_safe_exposures
  from jsonb_array_elements(coalesce(v_learning->'recent_exposures','[]'::jsonb)) e
  left join public.curriculum_learning_outcomes o on o.id=nullif(e->>'outcome_id','')::uuid
  where coalesce(e->>'intervention_key','') not ilike 'synthetic_twin_seed_v1:%'
    and (o.id is null or (o.status in ('active','verified') and coalesce(o.outcome_text,'') not ilike '%SYNTHETIC TWIN TEST%'));

  select coalesce(v_revision->'today_plan','[]'::jsonb) into v_today;

  select coalesce(jsonb_agg(x order by x->>'at' desc),'[]'::jsonb)
    into v_safe_changes
  from (
    select jsonb_build_object('type','learning_exposure','at',e->>'exposed_at','summary',replace(coalesce(e->>'intervention_type','learning'),'_',' '),'authoritative_mastery',false) x
    from jsonb_array_elements(v_safe_exposures) e
    where nullif(e->>'exposed_at','') is not null
    union all
    select jsonb_build_object('type','memory_refresh','at',c->>'last_confirmed_at','summary',c->>'claim','authoritative_mastery',false)
    from jsonb_array_elements(v_safe_claims) c
    where nullif(c->>'last_confirmed_at','') is not null
  ) q
  limit 12;

  return jsonb_build_object(
    'student_id',v_student_id,
    'profile_id',v_uid,
    'generated_at',now(),
    'what_matters_now',v_brain->'decision'->'now',
    'next',coalesce(v_brain->'decision'->'next','[]'::jsonb),
    'teacher_context',v_brain->'teacher_context',
    'resume_session',v_session,
    'today_revision',v_today,
    'what_twin_remembers',v_safe_claims,
    'recent_changes',v_safe_changes,
    'recent_learning_exposures',v_safe_exposures,
    'confidence',v_brain->'confidence',
    'verified_evidence_count',v_brain->'evidence'->'competency_evidence_count',
    'verified_calibration_count',v_brain->'evidence'->'verified_calibration_count',
    'exam_context_valid',coalesce((v_revision_context->>'exam_context_valid')::boolean,false),
    'exam_context',case when coalesce((v_revision_context->>'exam_context_valid')::boolean,false) then jsonb_build_object('mode',v_revision_context->'mode','exam_name',v_revision_context->'exam_name','exam_date',v_revision_context->'exam_date','days_remaining',v_revision_context->'days_remaining') else null end,
    'guardrails',jsonb_build_object(
      'synthetic_memory_filtered',true,
      'archived_synthetic_outcomes_filtered',true,
      'invalid_exam_metadata_filtered',true,
      'low_authority_changes_do_not_write_mastery',true,
      'teacher_assignments_remain_authoritative',true
    )
  );
end;
$$;

revoke all on function public.student_get_learning_companion_snapshot() from public;
revoke all on function public.student_get_learning_companion_snapshot() from anon;
grant execute on function public.student_get_learning_companion_snapshot() to authenticated;
