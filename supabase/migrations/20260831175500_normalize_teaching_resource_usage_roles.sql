create or replace function public.link_learning_resource(
  p_resource_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_usage_role text default 'source'::text,
  p_sequence integer default 1,
  p_page_start integer default null::integer,
  p_page_end integer default null::integer,
  p_section_refs jsonb default '[]'::jsonb,
  p_exercise_refs jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_link public.teaching_resource_links%rowtype;
  v_scheme uuid; v_lesson uuid; v_homework uuid; v_project uuid; v_exam uuid; v_assignment uuid;
  v_usage_role text;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  if not public.fn_learning_resource_visible(p_resource_id) then return jsonb_build_object('ok',false,'error','resource_not_visible'); end if;

  v_usage_role := lower(trim(coalesce(nullif(p_usage_role, ''), 'source')));
  v_usage_role := case v_usage_role
    when 'primary' then 'source'
    when 'secondary' then 'reference'
    when 'teacher' then 'teacher_notes'
    else v_usage_role
  end;

  if v_usage_role <> all (array[
    'source','reference','before_class','in_class','after_class','learner_reading',
    'teacher_notes','homework_source','question_source','project_brief',
    'assessment_source','revision_source'
  ]) then
    return jsonb_build_object('ok',false,'error','invalid_usage_role','usage_role',v_usage_role);
  end if;

  if p_target_type='scheme_lesson' then v_scheme:=p_target_id;
  elsif p_target_type='lesson_plan' then v_lesson:=p_target_id;
  elsif p_target_type='homework' then v_homework:=p_target_id;
  elsif p_target_type='project' then v_project:=p_target_id;
  elsif p_target_type='exam' then v_exam:=p_target_id;
  elsif p_target_type='chapter_assignment' then v_assignment:=p_target_id;
  else return jsonb_build_object('ok',false,'error','invalid_target_type');
  end if;

  if not public.fn_content_os_target_authorized(p_target_type,v_scheme,v_lesson,v_homework,v_project,v_exam,v_assignment,true) then
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;

  insert into public.teaching_resource_links(resource_id,target_type,scheme_lesson_id,lesson_plan_id,homework_id,project_id,exam_id,chapter_assignment_id,usage_role,sequence,page_start,page_end,section_refs,exercise_refs,created_by)
  values(p_resource_id,p_target_type,v_scheme,v_lesson,v_homework,v_project,v_exam,v_assignment,v_usage_role,p_sequence,p_page_start,p_page_end,coalesce(p_section_refs,'[]'::jsonb),coalesce(p_exercise_refs,'[]'::jsonb),v_uid)
  returning * into v_link;

  return jsonb_build_object('ok',true,'link',to_jsonb(v_link));
exception when unique_violation then
  select * into v_link from public.teaching_resource_links t
  where t.resource_id=p_resource_id and t.target_type=p_target_type and t.usage_role=v_usage_role
    and ((p_target_type='scheme_lesson' and t.scheme_lesson_id=p_target_id)
      or (p_target_type='lesson_plan' and t.lesson_plan_id=p_target_id)
      or (p_target_type='homework' and t.homework_id=p_target_id)
      or (p_target_type='project' and t.project_id=p_target_id)
      or (p_target_type='exam' and t.exam_id=p_target_id)
      or (p_target_type='chapter_assignment' and t.chapter_assignment_id=p_target_id));
  return jsonb_build_object('ok',true,'link',to_jsonb(v_link),'existing',true);
end;
$function$;

revoke all on function public.link_learning_resource(uuid,text,uuid,text,integer,integer,integer,jsonb,jsonb) from public;
grant execute on function public.link_learning_resource(uuid,text,uuid,text,integer,integer,integer,jsonb,jsonb) to authenticated;
