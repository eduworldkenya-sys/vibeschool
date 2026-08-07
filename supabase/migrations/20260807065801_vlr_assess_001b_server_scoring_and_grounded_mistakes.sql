-- VLR-ASSESS-001B: make grounded practice server-scored and reuse the mistake notebook.
alter table public.student_mistake_notebook
  alter column exam_question_id drop not null,
  alter column correct_index drop not null;

alter table public.student_mistake_notebook
  drop constraint if exists student_mistake_notebook_source_check;
alter table public.student_mistake_notebook
  add constraint student_mistake_notebook_source_check
  check (exam_question_id is not null or source_block_id is not null);

create unique index if not exists student_mistake_notebook_student_source_block_key
  on public.student_mistake_notebook(student_id,source_block_id)
  where source_block_id is not null;

create or replace function public.student_record_grounded_practice_answer(p_content_block_id uuid,p_response_text text,p_response_ms integer default null,p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
 v_profile_id uuid:=auth.uid(); v_student_id uuid; v_block public.content_blocks%rowtype; v_pub public.vibe_publications%rowtype; v_chapter public.vibe_chapters%rowtype;
 v_outcome_id uuid; v_event_id uuid; v_evidence_id uuid; v_subject text; v_topic text; v_expected text; v_expected_norm text; v_response_norm text; v_correct boolean; v_existing_mistake uuid;
begin
 if v_profile_id is null then raise exception 'Authentication required'; end if;
 if p_response_text is null or nullif(btrim(p_response_text),'') is null then raise exception 'Response is required'; end if;
 if length(p_response_text)>10000 then raise exception 'Response too long'; end if;
 if p_response_ms is not null and p_response_ms<0 then raise exception 'Invalid response time'; end if;
 select s.id into v_student_id from public.students s where s.profile_id=v_profile_id and s.deleted_at is null limit 1;
 if v_student_id is null then raise exception 'Learner identity not found'; end if;
 select * into v_block from public.content_blocks b where b.id=p_content_block_id and b.status='published' and b.is_teacher_only=false and b.is_assessable=true and b.block_type='question';
 if not found then raise exception 'Question not available'; end if;
 select * into v_pub from public.vibe_publications p where p.id=v_block.publication_id and p.status='published'; if not found then raise exception 'Publication not available'; end if;
 select * into v_chapter from public.vibe_chapters c where c.id=v_block.chapter_id and c.publication_id=v_block.publication_id and c.status in ('published','locked');
 if not found or not public.can_viewer_read_chapter(v_block.chapter_id,v_profile_id) then raise exception 'Chapter not available'; end if;
 if position('Answer:' in coalesce(v_block.plain_text,''))=0 then raise exception 'This authored question does not have a markable answer'; end if;
 v_expected:=btrim(substring(v_block.plain_text from position('Answer:' in v_block.plain_text)+7));
 if nullif(v_expected,'') is null then raise exception 'This authored question does not have a markable answer'; end if;
 v_expected_norm:=lower(regexp_replace(v_expected,'[[:space:][:punct:]]+','','g'));
 v_response_norm:=lower(regexp_replace(btrim(p_response_text),'[[:space:][:punct:]]+','','g'));
 v_correct:=v_response_norm=v_expected_norm;
 select l.outcome_id into v_outcome_id from public.content_block_outcome_links l join public.curriculum_learning_outcomes o on o.id=l.outcome_id and o.status='verified' where l.content_block_id=v_block.id order by l.created_at limit 1;
 v_subject:=coalesce(v_pub.cbc_subject,'General'); v_topic:=coalesce(v_chapter.title,'Current unit');
 insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata)
 values(v_profile_id,'practice_answered','content_block',v_block.id,case when v_correct then 2 else 1 end,now(),jsonb_build_object('publication_id',v_block.publication_id,'chapter_id',v_block.chapter_id,'outcome_id',v_outcome_id,'subject',v_subject,'topic',v_topic,'correct',v_correct,'response_ms',p_response_ms,'session_id',p_session_id,'response_text',left(p_response_text,1000))) returning id into v_event_id;
 select m.id into v_existing_mistake from public.student_mistake_notebook m where m.student_id=v_profile_id and m.source_block_id=v_block.id limit 1;
 if v_correct then
  if v_existing_mistake is not null then update public.student_mistake_notebook set status='resolved',resolved_at=now(),last_correct_at=now(),source_publication_id=v_block.publication_id,source_chapter_id=v_block.chapter_id,outcome_id=v_outcome_id where id=v_existing_mistake; end if;
 else
  if v_existing_mistake is null then
   insert into public.student_mistake_notebook(student_id,exam_question_id,subject,topic,prompt_snapshot,selected_index,correct_index,explanation_snapshot,hint_snapshot,repeat_count,status,first_missed_at,last_missed_at,source_publication_id,source_chapter_id,source_block_id,outcome_id)
   values(v_profile_id,null,v_subject,v_topic,case when position('Answer:' in v_block.plain_text)>0 then btrim(left(v_block.plain_text,position('Answer:' in v_block.plain_text)-1)) else v_block.plain_text end,null,null,'Review the exact source section and retry.',null,1,'open',now(),now(),v_block.publication_id,v_block.chapter_id,v_block.id,v_outcome_id);
  else
   update public.student_mistake_notebook set repeat_count=repeat_count+1,status='open',last_missed_at=now(),resolved_at=null,source_publication_id=v_block.publication_id,source_chapter_id=v_block.chapter_id,outcome_id=v_outcome_id where id=v_existing_mistake;
  end if;
 end if;
 if v_outcome_id is not null then
  insert into public.competency_evidence_ledger(student_id,outcome_id,evidence_source,evidence_id,score,max_score,proficiency,observed_by,observed_at,notes,weight)
  values(v_student_id,v_outcome_id,'quiz',v_event_id,case when v_correct then 1 else 0 end,1,case when v_correct then 'meeting' else 'needs_intervention' end,v_profile_id,now(),'Grounded VibeLearn authored question block',1) returning id into v_evidence_id;
 end if;
 return jsonb_build_object('ok',true,'correct',v_correct,'expected_answer',v_expected,'learning_event_id',v_event_id,'evidence_id',v_evidence_id,'publication_id',v_block.publication_id,'chapter_id',v_block.chapter_id,'content_block_id',v_block.id,'outcome_id',v_outcome_id,'review_url','/read/textbook/'||v_block.publication_id::text||'?chapter='||v_block.chapter_id::text||'&block='||v_block.id::text);
end;$function$;

revoke execute on function public.student_record_grounded_practice_answer(uuid,text,integer,uuid) from public,anon;
grant execute on function public.student_record_grounded_practice_answer(uuid,text,integer,uuid) to authenticated;
drop function if exists public.student_record_grounded_practice_answer(uuid,boolean,text,integer,uuid);
