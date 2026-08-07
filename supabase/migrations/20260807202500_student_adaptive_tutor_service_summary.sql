create or replace function public.student_get_adaptive_tutor_service_summary()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_uid uuid:=auth.uid(); v_student_id uuid; v_brain jsonb; v_path jsonb; v_memory jsonb; v_prediction jsonb; v_evidence jsonb; v_home jsonb; v_exam jsonb; v_revision jsonb; v_weak uuid; v_intervention jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  v_brain:=public.student_get_twin_brain();
  v_path:=public.student_get_adaptive_learning_path();
  v_memory:=public.student_get_twin_memory();
  v_prediction:=public.student_get_twin_prediction();
  v_evidence:=public.student_get_twin_evidence();
  v_home:=public.student_get_home_os_brief();
  begin v_exam:=public.student_get_exam_readiness_brief(); exception when others then v_exam:='{}'::jsonb; end;
  select nullif(value->>'outcome_id','')::uuid into v_weak from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value order by coalesce((value->>'effective_mastery')::numeric,0) asc limit 1;
  if v_weak is not null then v_intervention:=public.student_get_adaptive_intervention(v_weak); else v_intervention:='{}'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'plan_date',plan_date,'subject',subject,'topic',topic,'activity_type',activity_type,'target_minutes',target_minutes,'priority',priority,'reason',reason,'action_url',action_url,'status',status,'source',source) order by plan_date,priority),'[]'::jsonb)
    into v_revision from public.student_revision_plan_items where student_id=v_student_id and status='planned' and plan_date>=current_date and plan_date<=current_date+7;
  return jsonb_build_object(
    'student_id',v_student_id,
    'brain',v_brain,
    'learning_path',v_path,
    'memory',v_memory,
    'prediction',v_prediction,
    'evidence',v_evidence,
    'home',v_home,
    'exam',v_exam,
    'revision_plan',v_revision,
    'selected_intervention',v_intervention,
    'capabilities',jsonb_build_object(
      'diagnosis',true,'curriculum_navigation',true,'dynamic_difficulty',true,'socratic_tutoring',true,'hint_progression',true,'misconception_remediation',true,'mastery_learning',true,'spaced_revision',true,'practice_generation',true,'feedback',true,'pacing',true,'memory',true,'goals',true,'teacher_authority',true,'assessment_integrity',true,'safety_gate',true,'calibration',true,'intervention_learning',true
    )
  );
end;$function$;
revoke execute on function public.student_get_adaptive_tutor_service_summary() from public,anon;
grant execute on function public.student_get_adaptive_tutor_service_summary() to authenticated;
