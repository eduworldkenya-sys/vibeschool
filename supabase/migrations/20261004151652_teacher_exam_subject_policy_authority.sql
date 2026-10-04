-- Teacher subject scoring-policy authority.
-- Applied to production as migration 20261004151652.
CREATE OR REPLACE FUNCTION public.teacher_set_exam_subject_policy(p_exam_id uuid, p_school_id uuid, p_class_id uuid, p_subject_id uuid, p_max_marks numeric, p_pass_mark numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_context jsonb;
  v_exam public.exams%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_context:=public.teacher_get_operating_context(null);
  if nullif(v_context->>'school_id','')::uuid is distinct from p_school_id then raise exception 'active_school_changed'; end if;
  if not public.is_live_teacher_subject(p_school_id,p_class_id,p_subject_id) then raise exception 'teacher_subject_not_authorized'; end if;
  select * into v_exam from public.exams where id=p_exam_id and school_id=p_school_id;
  if not found then raise exception 'exam_not_available'; end if;
  if v_exam.is_locked then raise exception 'exam_locked'; end if;
  if p_max_marks is null or p_max_marks<=0 or p_max_marks>10000 then raise exception 'invalid_max_marks'; end if;
  if p_pass_mark is null or p_pass_mark<0 or p_pass_mark>p_max_marks then raise exception 'invalid_pass_mark'; end if;
  if exists(
    select 1 from public.exam_results er
    where er.exam_id=p_exam_id and er.subject_id=p_subject_id
      and (er.max_marks is distinct from p_max_marks)
  ) then raise exception 'exam_subject_policy_has_results'; end if;

  insert into public.exam_subject_config(exam_id,subject_id,pass_mark,max_marks)
  values(p_exam_id,p_subject_id,p_pass_mark,p_max_marks)
  on conflict(exam_id,subject_id) do update
    set pass_mark=excluded.pass_mark,max_marks=excluded.max_marks;

  return jsonb_build_object(
    'exam_id',p_exam_id,'school_id',p_school_id,'subject_id',p_subject_id,
    'pass_mark',p_pass_mark,'max_marks',p_max_marks,
    'pass_percentage',round((p_pass_mark/p_max_marks)*100,2),
    'configured',true,'is_locked',false
  );
end
$function$;

revoke all on function public.teacher_set_exam_subject_policy(uuid,uuid,uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.teacher_set_exam_subject_policy(uuid,uuid,uuid,uuid,numeric,numeric) to authenticated;

comment on function public.teacher_set_exam_subject_policy(uuid,uuid,uuid,uuid,numeric,numeric) is
  'Lets an authorized subject teacher define raw maximum and pass marks before results exist; result denominators cannot be silently rewritten after entry.';
