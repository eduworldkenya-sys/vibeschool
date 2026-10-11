-- CBC class exam register: scoped read projection, no duplicate mark store.
-- The class roster, learning areas and scores resolve from canonical authorities.
begin;
create or replace function public.teacher_get_class_exam_sheet(
  p_exam_id uuid, p_school_id uuid, p_class_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_context jsonb;
  v_locked boolean;
  v_class_teacher boolean;
  v_learners jsonb;
  v_subjects jsonb;
  v_results jsonb;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  v_context := public.teacher_get_operating_context(null);
  if nullif(v_context->>'school_id','')::uuid is distinct from p_school_id then
    raise exception 'active_school_changed';
  end if;
  if not public.teacher_can_view_class_exam(p_school_id,p_class_id) then
    raise exception 'exam_class_not_authorized';
  end if;
  if not exists(select 1 from public.classes c
    where c.id=p_class_id and c.school_id=p_school_id) then
    raise exception 'class_not_available';
  end if;
  select e.is_locked into v_locked
  from public.exams e
  where e.id=p_exam_id and e.school_id=p_school_id;
  if not found then raise exception 'exam_not_available'; end if;
  v_class_teacher:=public.teacher_is_current_class_teacher(p_school_id,p_class_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'name',r.name,'admission_number',r.admission_number
  ) order by r.name,r.id),'[]'::jsonb) into v_learners
  from (
    select distinct s.id,s.name,s.admission_number
    from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.school_id=p_school_id and sc.class_id=p_class_id and sc.is_current=true
  ) r;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'name',a.name,
    'can_enter',public.is_live_teacher_subject(p_school_id,p_class_id,a.id),
    'can_correct',v_class_teacher,
    'max_marks',a.max_marks
  ) order by a.name,a.id),'[]'::jsonb) into v_subjects
  from (
    select s.id,s.name,coalesce(esc.max_marks::numeric,100) max_marks
    from public.subjects s
    left join public.exam_subject_config esc
      on esc.subject_id=s.id and esc.exam_id=p_exam_id
    where s.school_id=p_school_id and (
      exists (
      select 1 from public.teacher_classes tc
      join public.school_members sm
        on sm.profile_id=tc.teacher_id and sm.school_id=tc.school_id
       and sm.role='teacher'
      where tc.school_id=p_school_id and tc.class_id=p_class_id and tc.subject_id=s.id
    )
    or exists (
      select 1 from public.exam_results er
      where er.exam_id=p_exam_id and er.school_id=p_school_id
        and er.class_id=p_class_id and er.subject_id=s.id
    )
    )
  ) a;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id',er.student_id,'subject_id',er.subject_id,
    'marks',er.marks,'max_marks',er.max_marks,'percentage',er.percentage,
    'result_state',er.result_state,'updated_at',er.updated_at,
    'recorder_is_me',(er.teacher_id=(select auth.uid()))
  ) order by er.student_id,er.subject_id),'[]'::jsonb) into v_results
  from public.exam_results er
  join public.student_classes sc
    on sc.student_id=er.student_id and sc.school_id=p_school_id
   and sc.class_id=p_class_id and sc.is_current=true
  join public.students s on s.id=er.student_id and s.deleted_at is null
  where er.exam_id=p_exam_id and er.school_id=p_school_id
    and er.class_id=p_class_id;

  return jsonb_build_object(
    'exam_id',p_exam_id,'school_id',p_school_id,'class_id',p_class_id,
    'is_locked',v_locked,'is_class_teacher',v_class_teacher,
    'learners',v_learners,'subjects',v_subjects,'results',v_results
  );
end;
$function$;
revoke all on function public.teacher_get_class_exam_sheet(uuid,uuid,uuid) from public,anon;
grant execute on function public.teacher_get_class_exam_sheet(uuid,uuid,uuid) to authenticated;
commit;
