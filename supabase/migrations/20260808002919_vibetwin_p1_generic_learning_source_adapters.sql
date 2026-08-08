-- P1: generalize dynamic transformations across learner-authorized learning sources.
-- Live Supabase ledger: 20260808002919

alter table public.student_learning_transformations add column if not exists source_type text not null default 'chapter';
alter table public.student_learning_transformations add column if not exists source_id uuid;
update public.student_learning_transformations set source_id=chapter_id where source_id is null;
alter table public.student_learning_transformations alter column source_id set not null;
alter table public.student_learning_transformations alter column publication_id drop not null;
alter table public.student_learning_transformations alter column chapter_id drop not null;
alter table public.student_learning_transformations drop constraint if exists student_learning_transformati_student_id_chapter_id_represe_key;
alter table public.student_learning_transformations drop constraint if exists student_learning_transformations_source_type_check;
alter table public.student_learning_transformations add constraint student_learning_transformations_source_type_check check (source_type in ('chapter','homework','teacher_content','vibelearn_content','resource'));
alter table public.student_learning_transformations add constraint student_learning_transformations_source_cache_key unique(student_id,source_type,source_id,representation,source_version,personalization_key);
create index if not exists student_learning_transformations_source_idx on public.student_learning_transformations(source_type,source_id,representation,updated_at desc);

create or replace function public.student_get_learning_source_context(p_source_type text,p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=auth.uid(); v_student_id uuid; v_brain jsonb; v_weak jsonb; v_source_text text; v_source_title text;
 v_source_version text; v_personalization_key text; v_mastery_bucket integer:=0; v_session_minutes integer:=25;
 v_publication_id uuid; v_chapter_id uuid; v_grade text; v_subject text; v_strand text; v_learning_outcomes text[]:='{}'; v_alignment text:='unclaimed';
 v_chapter public.vibe_chapters%rowtype; v_pub public.vibe_publications%rowtype; v_hw public.homework%rowtype; v_tc public.teacher_content%rowtype; v_vc public.vibelearn_content%rowtype; v_lr public.learning_resources%rowtype;
 v_tasks jsonb;
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 if p_source_type not in ('chapter','homework','teacher_content','vibelearn_content','resource') then raise exception 'unsupported_source_type'; end if;
 select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
 if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

 if p_source_type='chapter' then
   select * into v_chapter from public.vibe_chapters where id=p_source_id;
   if v_chapter.id is null then raise exception 'source_not_found'; end if;
   if not public.can_viewer_read_chapter(p_source_id,v_uid) then raise exception 'source_not_available'; end if;
   select * into v_pub from public.vibe_publications where id=v_chapter.publication_id;
   v_publication_id:=v_pub.id; v_chapter_id:=v_chapter.id; v_source_title:=coalesce(v_chapter.title,v_pub.title,'Learning chapter');
   select left(string_agg(case coalesce(b.value->>'type','paragraph') when 'heading1' then E'\n# '||coalesce(b.value->>'content','') when 'heading2' then E'\n## '||coalesce(b.value->>'content','') when 'heading3' then E'\n### '||coalesce(b.value->>'content','') when 'question' then E'\nQuestion: '||coalesce(b.value->>'content','') when 'activity' then E'\nActivity: '||coalesce(b.value->>'content','') else E'\n'||coalesce(b.value->>'content','') end,'' order by b.ordinality),45000)
   into v_source_text from jsonb_array_elements(case when jsonb_typeof(v_chapter.blocks)='array' then v_chapter.blocks else '[]'::jsonb end) with ordinality as b(value,ordinality);
   v_source_text:=regexp_replace(coalesce(v_source_text,''),'<[^>]+>',' ','g');
   v_source_version:=md5(v_chapter.updated_at::text||':'||coalesce(v_chapter.content_pack_version,0)::text||':'||v_chapter.blocks::text);
   v_grade:=v_pub.cbc_grade; v_subject:=v_pub.cbc_subject; v_strand:=v_chapter.cbc_strand; v_learning_outcomes:=v_chapter.learning_outcomes; v_alignment:=v_chapter.alignment_status;
 elsif p_source_type='homework' then
   v_tasks:=public.student_list_my_tasks();
   if not exists(select 1 from jsonb_array_elements(coalesce(v_tasks->'tasks','[]'::jsonb)) t where t->>'task_type'='homework' and t->>'source_id'=p_source_id::text) then raise exception 'source_not_available'; end if;
   select * into v_hw from public.homework where id=p_source_id; if v_hw.id is null then raise exception 'source_not_found'; end if;
   v_source_title:=v_hw.title; v_subject:=v_hw.subject; v_source_text:=concat_ws(E'\n\n',v_hw.title,v_hw.instructions); v_source_version:=md5(coalesce(v_hw.created_at,now())::text||':'||coalesce(v_hw.title,'')||':'||coalesce(v_hw.instructions,''));
 elsif p_source_type='teacher_content' then
   select tc.* into v_tc from public.teacher_content tc where tc.id=p_source_id and tc.published=true and exists(select 1 from public.student_classes sc where sc.student_id=v_student_id and sc.is_current=true and (tc.class_id=sc.class_id or (tc.class_id is null and tc.school_id=sc.school_id))) limit 1;
   if v_tc.id is null then raise exception 'source_not_available'; end if;
   v_source_title:=coalesce(v_tc.title,'Teacher learning material'); v_source_text:=concat_ws(E'\n\n',v_tc.title,v_tc.body); v_source_version:=md5(coalesce(v_tc.created_at,now())::text||':'||coalesce(v_tc.title,'')||':'||coalesce(v_tc.body,''));
   select name into v_subject from public.subjects where id=v_tc.subject_id;
 elsif p_source_type='vibelearn_content' then
   select vc.* into v_vc from public.vibelearn_content vc where vc.id=p_source_id and vc.status='published' and (vc.school_id is null or exists(select 1 from public.student_classes sc where sc.student_id=v_student_id and sc.is_current=true and sc.school_id=vc.school_id)) limit 1;
   if v_vc.id is null then raise exception 'source_not_available'; end if;
   v_source_title:=v_vc.title; v_source_text:=concat_ws(E'\n\n',v_vc.title,v_vc.description,v_vc.body); v_source_version:=md5(coalesce(v_vc.updated_at,v_vc.created_at,now())::text||':'||coalesce(v_vc.title,'')||':'||coalesce(v_vc.body,''));
   select name into v_subject from public.subjects where id=v_vc.subject_id;
 elsif p_source_type='resource' then
   select * into v_lr from public.learning_resources where id=p_source_id and status='published' and visibility='public';
   if v_lr.id is null then raise exception 'source_not_available'; end if;
   if v_lr.chapter_id is not null then return public.student_get_learning_source_context('chapter',v_lr.chapter_id); end if;
   v_source_title:=v_lr.title; v_source_text:=concat_ws(E'\n\n',v_lr.title,v_lr.description); v_source_version:=md5(v_lr.updated_at::text||':'||v_lr.canonical_key||':'||coalesce(v_lr.description,'')); v_grade:=v_lr.grade; v_subject:=v_lr.subject; v_strand:=v_lr.strand; v_learning_outcomes:=v_lr.learning_outcomes;
 end if;
 if nullif(btrim(coalesce(v_source_text,'')),'') is null then raise exception 'source_has_no_transformable_text'; end if;

 v_brain:=public.student_get_twin_brain_cached();
 if p_source_type='chapter' and exists(select 1 from public.chapter_learning_outcome_links where chapter_id=p_source_id) then
   select value into v_weak from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value where nullif(value->>'outcome_id','')::uuid in (select outcome_id from public.chapter_learning_outcome_links where chapter_id=p_source_id) order by coalesce((value->>'effective_mastery')::numeric,0),coalesce((value->>'forgetting_risk')::numeric,0) desc limit 1;
 end if;
 if v_weak is null then select value into v_weak from jsonb_array_elements(coalesce(v_brain #> '{mastery,outcomes}','[]'::jsonb)) value order by coalesce((value->>'effective_mastery')::numeric,0),coalesce((value->>'forgetting_risk')::numeric,0) desc limit 1; end if;
 v_mastery_bucket:=greatest(0,least(10,floor(coalesce((v_weak->>'effective_mastery')::numeric,0)/10)::integer));
 v_session_minutes:=greatest(10,least(90,coalesce((v_brain #>> '{study_time,session_minutes}')::integer,25)));
 v_personalization_key:=md5(v_student_id::text||':'||p_source_type||':'||p_source_id::text||':'||coalesce(v_weak->>'outcome_id','none')||':'||v_mastery_bucket::text||':'||v_session_minutes::text);
 return jsonb_build_object('student_id',v_student_id,'source_type',p_source_type,'source_id',p_source_id,'source_title',v_source_title,'publication_id',v_publication_id,'chapter_id',v_chapter_id,'source_version',v_source_version,'personalization_key',v_personalization_key,'source_text',left(v_source_text,45000),'source_truncated',length(v_source_text)>45000,'curriculum',jsonb_build_object('grade',v_grade,'subject',v_subject,'strand',v_strand,'learning_outcomes',v_learning_outcomes,'alignment_status',v_alignment),'learner',jsonb_build_object('weak_outcome',v_weak,'twin_confidence',v_brain->'confidence','session_minutes',v_session_minutes,'target_grade',v_brain #> '{exam,target_grade}','forgetting_risk',v_weak->'forgetting_risk','mastery_bucket',v_mastery_bucket));
end $$;

create or replace function public.student_get_cached_learning_source_transformation(p_source_type text,p_source_id uuid,p_representation text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ctx jsonb; v_student_id uuid; v_row public.student_learning_transformations%rowtype; begin
 if p_representation not in ('immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode') then raise exception 'unsupported_representation'; end if;
 v_ctx:=public.student_get_learning_source_context(p_source_type,p_source_id); v_student_id:=(v_ctx->>'student_id')::uuid;
 select * into v_row from public.student_learning_transformations t where t.student_id=v_student_id and t.source_type=p_source_type and t.source_id=p_source_id and t.representation=p_representation and t.source_version=v_ctx->>'source_version' and t.personalization_key=v_ctx->>'personalization_key' and t.expires_at>now() order by t.updated_at desc limit 1;
 if v_row.id is null then return null; end if;
 return jsonb_build_object('id',v_row.id,'source_type',v_row.source_type,'source_id',v_row.source_id,'representation',v_row.representation,'payload',v_row.payload,'source_version',v_row.source_version,'personalization_key',v_row.personalization_key,'generator',v_row.generator,'model',v_row.model,'quality',v_row.quality,'cached',true,'updated_at',v_row.updated_at,'expires_at',v_row.expires_at);
end $$;

create or replace function public.student_store_learning_source_transformation(p_source_type text,p_source_id uuid,p_representation text,p_source_version text,p_personalization_key text,p_payload jsonb,p_model text default null,p_quality jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ctx jsonb; v_student_id uuid; v_publication_id uuid; v_chapter_id uuid; v_id uuid; begin
 if p_representation not in ('immersive','simplify','mind_map','flashcards','quiz','audio_lesson','revision_sheet','worked_examples','visual_explainer','story_mode') then raise exception 'unsupported_representation'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_transformation_payload'; end if;
 v_ctx:=public.student_get_learning_source_context(p_source_type,p_source_id);
 if p_source_version is distinct from v_ctx->>'source_version' or p_personalization_key is distinct from v_ctx->>'personalization_key' then raise exception 'stale_transformation_context'; end if;
 v_student_id:=(v_ctx->>'student_id')::uuid; v_publication_id:=nullif(v_ctx->>'publication_id','')::uuid; v_chapter_id:=nullif(v_ctx->>'chapter_id','')::uuid;
 insert into public.student_learning_transformations(student_id,publication_id,chapter_id,source_type,source_id,representation,source_version,personalization_key,payload,model,quality,updated_at,expires_at)
 values(v_student_id,v_publication_id,v_chapter_id,p_source_type,p_source_id,p_representation,p_source_version,p_personalization_key,p_payload,p_model,coalesce(p_quality,'{}'::jsonb),now(),now()+interval '7 days')
 on conflict(student_id,source_type,source_id,representation,source_version,personalization_key) do update set payload=excluded.payload,model=excluded.model,quality=excluded.quality,updated_at=now(),expires_at=now()+interval '7 days' returning id into v_id;
 return jsonb_build_object('id',v_id,'stored',true);
end $$;

create or replace function public.student_get_learning_transform_context(p_chapter_id uuid) returns jsonb language sql security definer set search_path=public,pg_temp as $$ select public.student_get_learning_source_context('chapter',p_chapter_id) $$;
create or replace function public.student_get_cached_learning_transformation(p_chapter_id uuid,p_representation text) returns jsonb language sql security definer set search_path=public,pg_temp as $$ select public.student_get_cached_learning_source_transformation('chapter',p_chapter_id,p_representation) $$;
create or replace function public.student_store_learning_transformation(p_chapter_id uuid,p_representation text,p_source_version text,p_personalization_key text,p_payload jsonb,p_model text default null,p_quality jsonb default '{}'::jsonb) returns jsonb language sql security definer set search_path=public,pg_temp as $$ select public.student_store_learning_source_transformation('chapter',p_chapter_id,p_representation,p_source_version,p_personalization_key,p_payload,p_model,p_quality) $$;

revoke all on function public.student_get_learning_source_context(text,uuid) from public,anon;
revoke all on function public.student_get_cached_learning_source_transformation(text,uuid,text) from public,anon;
revoke all on function public.student_store_learning_source_transformation(text,uuid,text,text,text,jsonb,text,jsonb) from public,anon;
grant execute on function public.student_get_learning_source_context(text,uuid) to authenticated;
grant execute on function public.student_get_cached_learning_source_transformation(text,uuid,text) to authenticated;
grant execute on function public.student_store_learning_source_transformation(text,uuid,text,text,text,jsonb,text,jsonb) to authenticated;
