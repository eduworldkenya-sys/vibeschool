begin;

-- A chapter is not globally meaningful without its publication identity in
-- downstream teaching-resource consumers. Backfill existing chapter resources
-- and make future register_learning_resource('chapter', ...) calls preserve
-- both ids.
update public.learning_resources lr
set publication_id = c.publication_id,
    updated_at = now()
from public.vibe_chapters c
where lr.source_type='chapter'
  and lr.chapter_id=c.id
  and lr.publication_id is distinct from c.publication_id;

create or replace function public.register_learning_resource(
  p_source_type text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
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
    insert into public.learning_resources(source_type,publication_id,chapter_id,title,description,curriculum_id,sub_strand_id,subject,grade,strand,learning_outcomes,status,created_by)
    values('chapter',v_ch.publication_id,v_ch.id,coalesce(v_ch.title,'Untitled chapter'),null,v_ch.curriculum_id,v_ch.sub_strand_id,v_pub.cbc_subject,v_pub.cbc_grade,v_ch.cbc_strand,coalesce(v_ch.learning_outcomes,'{}'::text[]),case when v_ch.status='published' and v_pub.status='published' then 'active' else 'inactive' end,v_pub.author_id)
    on conflict (chapter_id) where chapter_id is not null do update
      set publication_id=excluded.publication_id,title=excluded.title,curriculum_id=excluded.curriculum_id,sub_strand_id=excluded.sub_strand_id,subject=excluded.subject,grade=excluded.grade,strand=excluded.strand,learning_outcomes=excluded.learning_outcomes,status=excluded.status,updated_at=now()
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
$function$;

commit;
