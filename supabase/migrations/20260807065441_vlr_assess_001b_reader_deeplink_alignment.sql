-- VLR-ASSESS-001B: align grounded review links with the existing reader query contract.
create or replace function public.student_get_grounded_chapter_practice(p_publication_id uuid,p_chapter_id uuid,p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $function$
declare v_profile_id uuid:=auth.uid(); v_student_id uuid; v_source jsonb; v_limit integer:=greatest(1,least(coalesce(p_limit,10),20)); v_questions jsonb:='[]'::jsonb;
begin
 if v_profile_id is null then raise exception 'Authentication required'; end if;
 select s.id into v_student_id from public.students s where s.profile_id=v_profile_id and s.deleted_at is null limit 1;
 if v_student_id is null then raise exception 'Learner identity not found'; end if;
 v_source:=public.student_resolve_vibelearn_assessment_source(p_publication_id,p_chapter_id);
 select coalesce(jsonb_agg(q.obj order by q.sequence),'[]'::jsonb) into v_questions
 from (
  select b.sequence,jsonb_build_object('id',b.id,'source_kind','content_block','publication_id',b.publication_id,'chapter_id',b.chapter_id,'content_block_id',b.id,'outcome_id',l.outcome_id,'question_type','authored_text','prompt',case when position('Answer:' in b.plain_text)>0 then btrim(left(b.plain_text,position('Answer:' in b.plain_text)-1)) else b.plain_text end,'answer',case when position('Answer:' in b.plain_text)>0 then btrim(substring(b.plain_text from position('Answer:' in b.plain_text)+7)) else null end,'difficulty',coalesce(o.difficulty,'mixed'),'bloom_level',o.bloom_level,'review_url','/read/textbook/'||b.publication_id::text||'?chapter='||b.chapter_id::text||'&block='||b.id::text) obj
  from public.content_blocks b
  left join lateral (select cbol.outcome_id from public.content_block_outcome_links cbol where cbol.content_block_id=b.id order by cbol.created_at limit 1) l on true
  left join public.curriculum_learning_outcomes o on o.id=l.outcome_id and o.status='verified'
  where b.publication_id=p_publication_id and b.chapter_id=p_chapter_id and b.status='published' and b.is_teacher_only=false and b.is_assessable=true and b.block_type='question' and nullif(btrim(coalesce(b.plain_text,'')),'') is not null
  order by b.sequence limit v_limit
 ) q;
 return v_source||jsonb_build_object('practice_mode','grounded_authored','question_count',jsonb_array_length(v_questions),'questions',v_questions);
end;$function$;

create or replace function public.student_record_grounded_practice_answer(p_content_block_id uuid,p_is_correct boolean,p_response_text text default null,p_response_ms integer default null,p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_profile_id uuid:=auth.uid(); v_student_id uuid; v_block public.content_blocks%rowtype; v_pub public.vibe_publications%rowtype; v_chapter public.vibe_chapters%rowtype; v_outcome_id uuid; v_event_id uuid; v_evidence_id uuid; v_subject text; v_topic text;
begin
 if v_profile_id is null then raise exception 'Authentication required'; end if;
 if p_is_correct is null then raise exception 'Correctness is required'; end if;
 if p_response_ms is not null and p_response_ms<0 then raise exception 'Invalid response time'; end if;
 if p_response_text is not null and length(p_response_text)>10000 then raise exception 'Response too long'; end if;
 select s.id into v_student_id from public.students s where s.profile_id=v_profile_id and s.deleted_at is null limit 1;
 if v_student_id is null then raise exception 'Learner identity not found'; end if;
 select * into v_block from public.content_blocks b where b.id=p_content_block_id and b.status='published' and b.is_teacher_only=false and b.is_assessable=true and b.block_type='question';
 if not found then raise exception 'Question not available'; end if;
 select * into v_pub from public.vibe_publications p where p.id=v_block.publication_id and p.status='published'; if not found then raise exception 'Publication not available'; end if;
 select * into v_chapter from public.vibe_chapters c where c.id=v_block.chapter_id and c.publication_id=v_block.publication_id and c.status in ('published','locked');
 if not found or not public.can_viewer_read_chapter(v_block.chapter_id,v_profile_id) then raise exception 'Chapter not available'; end if;
 select l.outcome_id into v_outcome_id from public.content_block_outcome_links l join public.curriculum_learning_outcomes o on o.id=l.outcome_id and o.status='verified' where l.content_block_id=v_block.id order by l.created_at limit 1;
 v_subject:=coalesce(v_pub.cbc_subject,'General'); v_topic:=coalesce(v_chapter.title,'Current unit');
 insert into public.student_learning_events(student_id,event_type,source_type,source_id,xp_awarded,occurred_at,metadata) values(v_profile_id,'practice_answered','content_block',v_block.id,case when p_is_correct then 2 else 1 end,now(),jsonb_build_object('publication_id',v_block.publication_id,'chapter_id',v_block.chapter_id,'outcome_id',v_outcome_id,'subject',v_subject,'topic',v_topic,'correct',p_is_correct,'response_ms',p_response_ms,'session_id',p_session_id,'response_text',left(coalesce(p_response_text,''),1000))) returning id into v_event_id;
 if v_outcome_id is not null then insert into public.competency_evidence_ledger(student_id,outcome_id,evidence_source,evidence_id,score,max_score,proficiency,observed_by,observed_at,notes,weight) values(v_student_id,v_outcome_id,'quiz',v_event_id,case when p_is_correct then 1 else 0 end,1,case when p_is_correct then 'meeting' else 'needs_intervention' end,v_profile_id,now(),'Grounded VibeLearn authored question block',1) returning id into v_evidence_id; end if;
 return jsonb_build_object('ok',true,'correct',p_is_correct,'learning_event_id',v_event_id,'evidence_id',v_evidence_id,'publication_id',v_block.publication_id,'chapter_id',v_block.chapter_id,'content_block_id',v_block.id,'outcome_id',v_outcome_id,'review_url','/read/textbook/'||v_block.publication_id::text||'?chapter='||v_block.chapter_id::text||'&block='||v_block.id::text);
end;$function$;

revoke execute on function public.student_get_grounded_chapter_practice(uuid,uuid,integer) from public,anon;
grant execute on function public.student_get_grounded_chapter_practice(uuid,uuid,integer) to authenticated;
revoke execute on function public.student_record_grounded_practice_answer(uuid,boolean,text,integer,uuid) from public,anon;
grant execute on function public.student_record_grounded_practice_answer(uuid,boolean,text,integer,uuid) to authenticated;
