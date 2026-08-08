-- P1: learner-authorized transformable source discovery.
-- Live Supabase ledger: 20260808003334

create or replace function public.student_list_learning_transform_sources(p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=auth.uid(); v_student_id uuid; v_limit integer:=greatest(5,least(coalesce(p_limit,30),60)); v_tasks jsonb; v_result jsonb;
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
 if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
 v_tasks:=public.student_list_my_tasks();
 with current_classes as (
   select class_id,school_id from public.student_classes where student_id=v_student_id and is_current=true
 ), sources as (
   select 'chapter'::text source_type,c.id source_id,coalesce(c.title,p.title,'Textbook unit') title,concat_ws(' · ',p.title,nullif(c.cbc_strand,'')) subtitle,greatest(coalesce(rp.last_read_at,c.updated_at),c.updated_at) touched_at,10 rank
   from public.vibe_reading_progress rp join public.vibe_chapters c on c.id=rp.chapter_id join public.vibe_publications p on p.id=c.publication_id
   where rp.viewer_id=v_uid and public.can_viewer_read_chapter(c.id,v_uid)
   union all
   select 'homework',(t->>'source_id')::uuid,coalesce(t->>'title','Homework'),concat_ws(' · ',t->>'subject',replace(coalesce(t->>'status','ready'),'_',' ')),coalesce((t->>'assigned_at')::timestamptz,now()),case when t->>'status' in ('overdue','returned','in_progress','ready') then 1 else 20 end
   from jsonb_array_elements(coalesce(v_tasks->'tasks','[]'::jsonb)) t where t->>'task_type'='homework'
   union all
   select 'teacher_content',tc.id,coalesce(tc.title,'Teacher material'),'Teacher material',coalesce(tc.published_at,tc.created_at,now()),5
   from public.teacher_content tc where tc.published=true and exists(select 1 from current_classes cc where tc.class_id=cc.class_id or (tc.class_id is null and tc.school_id=cc.school_id)) and nullif(btrim(coalesce(tc.body,'')),'') is not null
   union all
   select 'vibelearn_content',vc.id,vc.title,coalesce(vc.description,'VibeLearn content'),coalesce(vc.updated_at,vc.created_at,now()),12
   from public.vibelearn_content vc where vc.status='published' and nullif(btrim(coalesce(vc.body,'')),'') is not null and (vc.school_id is null or exists(select 1 from current_classes cc where cc.school_id=vc.school_id))
   union all
   select 'resource',lr.id,lr.title,coalesce(lr.description,concat_ws(' · ',lr.grade,lr.subject,lr.strand)),lr.updated_at,15
   from public.learning_resources lr where lr.status='published' and lr.visibility='public' and (lr.chapter_id is not null or nullif(btrim(coalesce(lr.description,'')),'') is not null)
 ), dedup as (
   select distinct on(source_type,source_id) source_type,source_id,title,subtitle,touched_at,rank from sources order by source_type,source_id,rank,touched_at desc
 )
 select coalesce(jsonb_agg(jsonb_build_object('source_type',source_type,'source_id',source_id,'title',title,'subtitle',subtitle,'touched_at',touched_at,'priority',rank) order by rank,touched_at desc) filter(where rn<=v_limit),'[]'::jsonb)
 into v_result from (select d.*,row_number() over(order by rank,touched_at desc) rn from dedup d) ranked;
 return jsonb_build_object('student_id',v_student_id,'sources',coalesce(v_result,'[]'::jsonb));
end $$;

revoke all on function public.student_list_learning_transform_sources(integer) from public,anon;
grant execute on function public.student_list_learning_transform_sources(integer) to authenticated;
