create or replace function public.register_learning_resource(
  p_source_type text,
  p_source_id uuid
) returns jsonb
language plpgsql
security definer
set search_path='public','auth'
as $$
declare
  v_uid uuid := auth.uid();
  v_resource public.learning_resources%rowtype;
  v_pub public.vibe_publications%rowtype;
  v_ch public.vibe_chapters%rowtype;
  v_content public.vibelearn_content%rowtype;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;

  if p_source_type='publication' then
    select * into v_pub from public.vibe_publications where id=p_source_id;
    if not found then return jsonb_build_object('ok',false,'error','publication_not_found'); end if;
    if v_pub.status <> 'published' and v_pub.author_id <> v_uid then
      return jsonb_build_object('ok',false,'error','forbidden');
    end if;
    insert into public.learning_resources(source_type,publication_id,title,description,subject,grade,status,created_by)
    values('publication',v_pub.id,coalesce(v_pub.title,'Untitled publication'),v_pub.description,v_pub.cbc_subject,v_pub.cbc_grade,case when v_pub.status='published' then 'active' else 'inactive' end,v_pub.author_id)
    on conflict (publication_id) where publication_id is not null do update
      set title=excluded.title,description=excluded.description,subject=excluded.subject,grade=excluded.grade,status=excluded.status,updated_at=now()
    returning * into v_resource;
  elsif p_source_type='chapter' then
    select c.* into v_ch from public.vibe_chapters c where c.id=p_source_id;
    if not found then return jsonb_build_object('ok',false,'error','chapter_not_found'); end if;
    select * into v_pub from public.vibe_publications where id=v_ch.publication_id;
    if v_pub.status <> 'published' and v_pub.author_id <> v_uid then
      return jsonb_build_object('ok',false,'error','forbidden');
    end if;
    insert into public.learning_resources(source_type,chapter_id,title,description,curriculum_id,sub_strand_id,subject,grade,strand,learning_outcomes,status,created_by)
    values('chapter',v_ch.id,coalesce(v_ch.title,'Untitled chapter'),null,v_ch.curriculum_id,v_ch.sub_strand_id,v_pub.cbc_subject,v_pub.cbc_grade,v_ch.cbc_strand,coalesce(v_ch.learning_outcomes,'{}'::text[]),case when v_ch.status='published' and v_pub.status='published' then 'active' else 'inactive' end,v_pub.author_id)
    on conflict (chapter_id) where chapter_id is not null do update
      set title=excluded.title,curriculum_id=excluded.curriculum_id,sub_strand_id=excluded.sub_strand_id,subject=excluded.subject,grade=excluded.grade,strand=excluded.strand,learning_outcomes=excluded.learning_outcomes,status=excluded.status,updated_at=now()
    returning * into v_resource;
  elsif p_source_type='vibelearn_content' then
    select * into v_content from public.vibelearn_content where id=p_source_id;
    if not found then return jsonb_build_object('ok',false,'error','content_not_found'); end if;
    if v_content.status <> 'live' and v_content.submitted_by <> v_uid then
      return jsonb_build_object('ok',false,'error','forbidden');
    end if;
    insert into public.learning_resources(source_type,content_id,title,description,subject_id,status,created_by)
    values('vibelearn_content',v_content.id,v_content.title,v_content.description,v_content.subject_id,case when v_content.status='live' then 'active' else 'inactive' end,v_content.submitted_by)
    on conflict (content_id) where content_id is not null do update
      set title=excluded.title,description=excluded.description,subject_id=excluded.subject_id,status=excluded.status,updated_at=now()
    returning * into v_resource;
  else
    return jsonb_build_object('ok',false,'error','invalid_source_type');
  end if;

  return jsonb_build_object('ok',true,'resource',to_jsonb(v_resource));
end;
$$;

create or replace function public.link_learning_resource(
  p_resource_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_usage_role text default 'source',
  p_sequence integer default 1,
  p_page_start integer default null,
  p_page_end integer default null,
  p_section_refs jsonb default '[]'::jsonb,
  p_exercise_refs jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth'
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.teaching_resource_links%rowtype;
  v_scheme uuid; v_lesson uuid; v_homework uuid; v_project uuid; v_exam uuid; v_assignment uuid;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  if not public.fn_learning_resource_visible(p_resource_id) then return jsonb_build_object('ok',false,'error','resource_not_visible'); end if;

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
  values(p_resource_id,p_target_type,v_scheme,v_lesson,v_homework,v_project,v_exam,v_assignment,p_usage_role,p_sequence,p_page_start,p_page_end,coalesce(p_section_refs,'[]'::jsonb),coalesce(p_exercise_refs,'[]'::jsonb),v_uid)
  returning * into v_link;

  return jsonb_build_object('ok',true,'link',to_jsonb(v_link));
exception when unique_violation then
  select * into v_link from public.teaching_resource_links t
  where t.resource_id=p_resource_id and t.target_type=p_target_type and t.usage_role=p_usage_role
    and ((p_target_type='scheme_lesson' and t.scheme_lesson_id=p_target_id)
      or (p_target_type='lesson_plan' and t.lesson_plan_id=p_target_id)
      or (p_target_type='homework' and t.homework_id=p_target_id)
      or (p_target_type='project' and t.project_id=p_target_id)
      or (p_target_type='exam' and t.exam_id=p_target_id)
      or (p_target_type='chapter_assignment' and t.chapter_assignment_id=p_target_id));
  return jsonb_build_object('ok',true,'link',to_jsonb(v_link),'existing',true);
end;
$$;

create or replace function public.list_teaching_resources(
  p_target_type text,
  p_target_id uuid
) returns jsonb
language plpgsql
security definer
set search_path='public','auth'
as $$
declare
  v_scheme uuid; v_lesson uuid; v_homework uuid; v_project uuid; v_exam uuid; v_assignment uuid;
  v_result jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  if p_target_type='scheme_lesson' then v_scheme:=p_target_id;
  elsif p_target_type='lesson_plan' then v_lesson:=p_target_id;
  elsif p_target_type='homework' then v_homework:=p_target_id;
  elsif p_target_type='project' then v_project:=p_target_id;
  elsif p_target_type='exam' then v_exam:=p_target_id;
  elsif p_target_type='chapter_assignment' then v_assignment:=p_target_id;
  else return jsonb_build_object('ok',false,'error','invalid_target_type'); end if;

  if not public.fn_content_os_target_authorized(p_target_type,v_scheme,v_lesson,v_homework,v_project,v_exam,v_assignment,false) then
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'link_id',t.id,'resource_id',lr.id,'source_type',lr.source_type,'title',lr.title,'description',lr.description,
    'publication_id',lr.publication_id,'chapter_id',lr.chapter_id,'content_id',lr.content_id,
    'usage_role',t.usage_role,'sequence',t.sequence,'page_start',t.page_start,'page_end',t.page_end,
    'section_refs',t.section_refs,'exercise_refs',t.exercise_refs,'created_at',t.created_at
  ) order by t.sequence,t.created_at),'[]'::jsonb)
  into v_result
  from public.teaching_resource_links t join public.learning_resources lr on lr.id=t.resource_id
  where t.target_type=p_target_type and (
    (p_target_type='scheme_lesson' and t.scheme_lesson_id=p_target_id)
    or (p_target_type='lesson_plan' and t.lesson_plan_id=p_target_id)
    or (p_target_type='homework' and t.homework_id=p_target_id)
    or (p_target_type='project' and t.project_id=p_target_id)
    or (p_target_type='exam' and t.exam_id=p_target_id)
    or (p_target_type='chapter_assignment' and t.chapter_assignment_id=p_target_id)
  );
  return jsonb_build_object('ok',true,'resources',v_result);
end;
$$;

create or replace function public.unlink_learning_resource(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','auth'
as $$
declare
  v_link public.teaching_resource_links%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  select * into v_link from public.teaching_resource_links where id=p_link_id;
  if not found then return jsonb_build_object('ok',false,'error','link_not_found'); end if;
  if not public.fn_content_os_target_authorized(v_link.target_type,v_link.scheme_lesson_id,v_link.lesson_plan_id,v_link.homework_id,v_link.project_id,v_link.exam_id,v_link.chapter_assignment_id,true) then
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;
  delete from public.teaching_resource_links where id=p_link_id;
  return jsonb_build_object('ok',true,'deleted_id',p_link_id);
end;
$$;

revoke execute on function public.register_learning_resource(text,uuid) from public, anon;
revoke execute on function public.link_learning_resource(uuid,text,uuid,text,integer,integer,integer,jsonb,jsonb) from public, anon;
revoke execute on function public.list_teaching_resources(text,uuid) from public, anon;
revoke execute on function public.unlink_learning_resource(uuid) from public, anon;
grant execute on function public.register_learning_resource(text,uuid) to authenticated, service_role;
grant execute on function public.link_learning_resource(uuid,text,uuid,text,integer,integer,integer,jsonb,jsonb) to authenticated, service_role;
grant execute on function public.list_teaching_resources(text,uuid) to authenticated, service_role;
grant execute on function public.unlink_learning_resource(uuid) to authenticated, service_role;

revoke execute on function public.list_scheme_lesson_resources(uuid) from public, anon;
revoke execute on function public.upsert_scheme_lesson_resource(uuid,uuid,uuid,text,integer,integer,integer,jsonb) from public, anon;
revoke execute on function public.remove_scheme_lesson_resource(uuid) from public, anon;
revoke execute on function public.recommend_textbook_chapters_for_scheme_lesson(uuid,integer) from public, anon;
revoke execute on function public.assign_scheme_resource_to_class(uuid,uuid,timestamptz) from public, anon;
grant execute on function public.list_scheme_lesson_resources(uuid) to authenticated, service_role;
grant execute on function public.upsert_scheme_lesson_resource(uuid,uuid,uuid,text,integer,integer,integer,jsonb) to authenticated, service_role;
grant execute on function public.remove_scheme_lesson_resource(uuid) to authenticated, service_role;
grant execute on function public.recommend_textbook_chapters_for_scheme_lesson(uuid,integer) to authenticated, service_role;
grant execute on function public.assign_scheme_resource_to_class(uuid,uuid,timestamptz) to authenticated, service_role;
