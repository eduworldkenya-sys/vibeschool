begin;

-- Privileged SECURITY DEFINER functions must consume canonical role resolution.
-- This specifically prevents an orphaned profiles.role='admin' row from being
-- treated as admin authority when the required school membership is absent.

create or replace function public.ce_get_teacher_derivation_context(p_chapter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_chapter record;
  v_publication record;
  v_resource_id uuid;
  v_school_id uuid;
  v_subject_id uuid;
  v_blocks jsonb;
  v_source_text text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select public.get_my_role() into v_role;
  if v_role not in ('teacher','admin') then raise exception 'Teacher role required'; end if;

  select * into v_chapter from public.vibe_chapters where id = p_chapter_id;
  if not found then raise exception 'Chapter not found'; end if;
  select * into v_publication from public.vibe_publications where id = v_chapter.publication_id;
  if not found then raise exception 'Publication not found'; end if;

  if v_publication.author_id is distinct from v_uid
     and not (v_publication.status = 'published' and v_chapter.status = 'published') then
    raise exception 'Source chapter is not available for derivation';
  end if;

  select lr.id into v_resource_id
  from public.learning_resources lr
  where lr.chapter_id = p_chapter_id and lr.source_type = 'chapter'
  order by lr.created_at asc limit 1;
  if v_resource_id is null then raise exception 'Chapter learning resource is missing'; end if;

  select sm.school_id into v_school_id
  from public.school_members sm
  where sm.profile_id = v_uid and sm.role::text in ('teacher','admin')
  order by sm.created_at asc limit 1;

  if v_publication.cbc_subject is not null then
    select s.id into v_subject_id from public.subjects s
    where lower(s.name) = lower(v_publication.cbc_subject)
    order by s.id limit 1;
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id',cb.id,'block_type',cb.block_type,'text',coalesce(cb.plain_text,''),
      'is_assessable',cb.is_assessable,'resource_id',blr.id
    ) order by cb.sequence),'[]'::jsonb),
    coalesce(string_agg(nullif(btrim(cb.plain_text),''),E'\n\n' order by cb.sequence),'')
  into v_blocks,v_source_text
  from public.content_blocks cb
  left join public.learning_resources blr on blr.content_block_id=cb.id and blr.source_type='content_block'
  where cb.chapter_id=p_chapter_id
    and (v_publication.author_id=v_uid or (cb.status='published' and cb.is_teacher_only=false));

  if nullif(btrim(v_source_text),'') is null then raise exception 'Chapter has no derivable source text'; end if;

  return jsonb_build_object(
    'teacher_id',v_uid,'school_id',v_school_id,'subject_id',v_subject_id,
    'publication_id',v_publication.id,'publication_title',v_publication.title,
    'publication_format',v_publication.format,'grade',v_publication.cbc_grade,
    'subject',v_publication.cbc_subject,'chapter_id',v_chapter.id,
    'chapter_title',v_chapter.title,'chapter_number',v_chapter.number,
    'chapter_resource_id',v_resource_id,
    'learning_outcomes',coalesce(to_jsonb(v_chapter.learning_outcomes),'[]'::jsonb),
    'blocks',v_blocks,'source_text',left(v_source_text,40000)
  );
end;
$$;
revoke all on function public.ce_get_teacher_derivation_context(uuid) from public, anon;
grant execute on function public.ce_get_teacher_derivation_context(uuid) to authenticated, service_role;

create or replace function public.get_vibelearn_content_reader(content_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  row_data public.vibelearn_content%rowtype;
  viewer_id uuid := auth.uid();
  viewer_role text;
  viewer_is_author boolean := false;
  can_see_teacher_content boolean := false;
  safe_body text;
  had_teacher_content boolean := false;
begin
  perform public.hq_require_policy_enabled('vibelearn','vibelearn.enabled');
  perform public.hq_require_policy_enabled('vibelearn','publication.release_enabled');
  select * into row_data from public.vibelearn_content where id=content_id_input;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  viewer_is_author := viewer_id is not null and viewer_id=row_data.submitted_by;
  if row_data.status<>'live' and not viewer_is_author then
    return jsonb_build_object('ok',false,'reason','not_found');
  end if;

  if viewer_id is not null then select public.get_my_role() into viewer_role; end if;
  can_see_teacher_content := viewer_is_author or viewer_role in ('teacher','admin');
  had_teacher_content := row_data.body is not null and row_data.body ~ '\[TEACHER_ONLY\]';

  if can_see_teacher_content or row_data.body is null then
    safe_body := row_data.body;
  else
    safe_body := regexp_replace(row_data.body,'\[TEACHER_ONLY\].*?\[/TEACHER_ONLY\]','','gs');
    safe_body := regexp_replace(safe_body,'\n{3,}',E'\n\n','g');
  end if;

  return jsonb_build_object(
    'ok',true,'id',row_data.id,'title',row_data.title,'description',row_data.description,
    'body',safe_body,'type',row_data.type,'source',row_data.source,'url',row_data.url,
    'tags',row_data.tags,'status',row_data.status,'view_count',row_data.view_count,
    'earnings_ksh',row_data.earnings_ksh,'created_at',row_data.created_at,
    'submitted_by',row_data.submitted_by,'viewer_is_author',viewer_is_author,
    'teacher_content_redacted',had_teacher_content and not can_see_teacher_content
  );
end;
$$;
revoke all on function public.get_vibelearn_content_reader(uuid) from public, anon;
grant execute on function public.get_vibelearn_content_reader(uuid) to authenticated, service_role;

create or replace function public.hq_data_api_product_gate()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_role text;
  v_product_key text;
  v_policy_key text;
  v_request_path text := coalesce(nullif(current_setting('request.path',true),''),'');
  v_registry public.hq_policy_registry%rowtype;
  v_config public.hq_product_configs%rowtype;
  v_enabled boolean;
  v_candidate jsonb;
begin
  if v_uid is null then return; end if;
  if public.is_platform_owner() then return; end if;
  if v_request_path in ('/rpc/product_access_state','/rpc/student_twin_policy_state') then return; end if;

  select public.get_my_role() into v_profile_role;
  v_product_key := case v_profile_role
    when 'student' then 'student' when 'teacher' then 'teacher' when 'parent' then 'parent'
    when 'admin' then 'school_admin' else null end;
  if v_product_key is null then return; end if;

  v_policy_key := case v_product_key
    when 'student' then 'student.enabled' when 'teacher' then 'teacher.enabled'
    when 'parent' then 'parent.enabled' when 'school_admin' then 'school_admin.enabled' end;

  select pr.* into v_registry from public.hq_policy_registry pr
  where pr.policy_key=v_policy_key and pr.active;
  if not found then
    raise sqlstate 'PGRST' using
      message=json_build_object('code','HQ_POLICY_UNAVAILABLE','message','Product policy unavailable','details',v_product_key,'hint','Contact VibeSchool support')::text,
      detail=json_build_object('status',503,'status_text','Service Unavailable')::text;
  end if;

  select pc.* into v_config from public.hq_product_configs pc
  where pc.product_key=v_product_key and pc.config_key=v_policy_key and pc.active and pc.effective_at<=now()
  order by pc.updated_at desc limit 1;
  v_candidate := case when found then v_config.config_value else v_registry.default_value end;
  if jsonb_typeof(v_candidate)<>'boolean' then
    v_enabled := case when v_registry.failure_mode='fail_open' then true else false end;
  else
    v_enabled := (v_candidate #>> '{}')::boolean;
  end if;
  if not v_enabled then
    raise sqlstate 'PGRST' using
      message=json_build_object('code','HQ_PRODUCT_DISABLED','message','This VibeSchool product is temporarily unavailable','details',v_product_key,'hint','Use product_access_state for current policy status')::text,
      detail=json_build_object('status',503,'status_text','Service Unavailable')::text;
  end if;
end;
$$;
revoke all on function public.hq_data_api_product_gate() from public, anon;
grant execute on function public.hq_data_api_product_gate() to authenticated, service_role;

create or replace function public.hq_product_runtime_handshake(p_product_key text,p_route text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_policy_key text;
  v_state jsonb;
  v_enabled boolean;
  v_school_id uuid;
  v_event_key text;
  v_event_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select public.get_my_role(),p.school_id into v_role,v_school_id from public.profiles p where p.id=v_uid;
  v_policy_key:=case p_product_key
    when 'student' then 'student.enabled' when 'teacher' then 'teacher.enabled'
    when 'parent' then 'parent.enabled' when 'school_admin' then 'school_admin.enabled'
    when 'vibelearn' then 'vibelearn.enabled' when 'vibebooks' then 'vibebooks.enabled'
    when 'vibelabs' then 'vibelabs.enabled' when 'twin' then 'twin.enabled'
    when 'billing' then 'billing.enabled' else null end;
  if v_policy_key is null then raise exception 'Unknown product'; end if;

  if p_product_key in ('student','teacher','parent','school_admin') and not public.is_platform_owner() then
    if (p_product_key='student' and v_role<>'student')
      or (p_product_key='teacher' and v_role<>'teacher')
      or (p_product_key='parent' and v_role<>'parent')
      or (p_product_key='school_admin' and v_role<>'admin') then
      raise exception 'Product role mismatch';
    end if;
  end if;

  v_state:=public.hq_evaluate_policy(p_product_key,v_policy_key,jsonb_build_object('surface','product_runtime_handshake','route',left(coalesce(p_route,''),240)));
  v_enabled:=coalesce((v_state->'value')::boolean,false);
  perform public.hq_record_runtime_policy_observation(p_product_key,v_policy_key,to_jsonb(v_enabled),'client_runtime_handshake');

  v_event_key:=format('runtime:%s:%s:%s:%s',v_uid,p_product_key,date_trunc('hour',now())::text,md5(coalesce(p_route,'')));
  insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,idempotency_key)
  values('product.runtime_seen',v_uid,v_role,v_school_id,'product',null,
    jsonb_build_object('product_key',p_product_key,'policy_key',v_policy_key,'enabled',v_enabled,'route',left(coalesce(p_route,''),240)),v_event_key)
  on conflict(idempotency_key) where idempotency_key is not null do update
    set occurred_at=excluded.occurred_at,metadata=excluded.metadata
  returning id into v_event_id;

  return jsonb_build_object('product',p_product_key,'policy',v_policy_key,'enabled',v_enabled,'event_id',v_event_id,'state',v_state);
exception when others then
  if v_policy_key is not null then
    perform public.hq_record_policy_failure(p_product_key,v_policy_key,sqlstate,sqlerrm,jsonb_build_object('surface','product_runtime_handshake','route',left(coalesce(p_route,''),240)));
  end if;
  raise;
end;
$$;
revoke all on function public.hq_product_runtime_handshake(text,text) from public, anon;
grant execute on function public.hq_product_runtime_handshake(text,text) to authenticated, service_role;

commit;
