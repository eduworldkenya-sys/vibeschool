create or replace function public.student_record_twin_calibration(
  p_prediction_type text,p_predicted_value numeric,p_actual_value numeric,p_confidence_score numeric,
  p_subject_id uuid default null,p_outcome_id uuid default null,p_source_type text default 'learner_self_check',p_source_id uuid default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_student_id uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  if p_prediction_type not in ('mastery','assessment_score','forgetting_risk','readiness') then raise exception 'unsupported_prediction_type'; end if;
  if p_confidence_score<0 or p_confidence_score>1 then raise exception 'invalid_confidence_score'; end if;
  if p_source_type <> 'learner_self_check' then raise exception 'unsupported_calibration_source'; end if;
  insert into public.student_twin_calibration_events(student_id,subject_id,outcome_id,prediction_type,predicted_value,actual_value,confidence_score,absolute_error,source_type,source_id,metadata,resolved_at)
  values(v_student_id,p_subject_id,p_outcome_id,p_prediction_type,p_predicted_value,p_actual_value,p_confidence_score,case when p_actual_value is null or p_predicted_value is null then null else abs(p_actual_value-p_predicted_value) end,'learner_self_check',p_source_id,coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('authoritative',false),case when p_actual_value is null then null else now() end)
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'authoritative',false);
end;
$function$;

create or replace function public.twin_record_verified_calibration(
  p_student_id uuid,p_prediction_type text,p_predicted_value numeric,p_actual_value numeric,p_confidence_score numeric,
  p_subject_id uuid default null,p_outcome_id uuid default null,p_source_type text default 'verified_evidence',p_source_id uuid default null,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if not exists(select 1 from public.students where id=p_student_id and deleted_at is null) then raise exception 'learner_identity_not_found'; end if;
  if p_prediction_type not in ('mastery','assessment_score','forgetting_risk','readiness') then raise exception 'unsupported_prediction_type'; end if;
  if p_confidence_score<0 or p_confidence_score>1 then raise exception 'invalid_confidence_score'; end if;
  insert into public.student_twin_calibration_events(student_id,subject_id,outcome_id,prediction_type,predicted_value,actual_value,confidence_score,absolute_error,source_type,source_id,metadata,resolved_at)
  values(p_student_id,p_subject_id,p_outcome_id,p_prediction_type,p_predicted_value,p_actual_value,p_confidence_score,case when p_actual_value is null or p_predicted_value is null then null else abs(p_actual_value-p_predicted_value) end,p_source_type,p_source_id,coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('authoritative',true),case when p_actual_value is null then null else now() end)
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.student_record_twin_calibration(text,numeric,numeric,numeric,uuid,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.student_record_twin_calibration(text,numeric,numeric,numeric,uuid,uuid,text,uuid,jsonb) to authenticated,service_role;
revoke all on function public.twin_record_verified_calibration(uuid,text,numeric,numeric,numeric,uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.twin_record_verified_calibration(uuid,text,numeric,numeric,numeric,uuid,uuid,text,uuid,jsonb) to service_role;
