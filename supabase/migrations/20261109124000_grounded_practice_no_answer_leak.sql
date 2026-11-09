-- Remove raw solution text from student-facing question delivery. Server-only marking remains unchanged.
CREATE OR REPLACE FUNCTION public.student_get_grounded_chapter_practice(p_publication_id uuid, p_chapter_id uuid, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_profile_id uuid := auth.uid();
  v_student_id uuid;
  v_source jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit,10), 20));
  v_questions jsonb := '[]'::jsonb;
begin
  if v_profile_id is null then raise exception 'Authentication required'; end if;
  select s.id into v_student_id from public.students s where s.profile_id=v_profile_id and s.deleted_at is null limit 1;
  if v_student_id is null then raise exception 'Learner identity not found'; end if;
  v_source := public.student_resolve_vibelearn_assessment_source(p_publication_id,p_chapter_id);
  select coalesce(jsonb_agg(q.obj order by q.sequence), '[]'::jsonb) into v_questions
  from (
    select b.sequence,
      jsonb_build_object(
        'id',b.id,'source_kind','content_block','publication_id',b.publication_id,'chapter_id',b.chapter_id,'content_block_id',b.id,
        'outcome_id',l.outcome_id,'question_type','authored_text',
        'prompt',case when position('Answer:' in b.plain_text)>0 then btrim(left(b.plain_text,position('Answer:' in b.plain_text)-1)) else b.plain_text end,
        'difficulty',coalesce(o.difficulty,'mixed'),'bloom_level',o.bloom_level,
        'review_url','/read/textbook/'||b.publication_id::text||'?chapter='||b.chapter_id::text||'&block='||b.id::text
      ) obj
    from public.content_blocks b
    left join lateral (select cbol.outcome_id from public.content_block_outcome_links cbol where cbol.content_block_id=b.id order by cbol.created_at limit 1) l on true
    left join public.curriculum_learning_outcomes o on o.id=l.outcome_id and o.status='verified'
    where b.publication_id=p_publication_id and b.chapter_id=p_chapter_id and b.status='published' and b.is_teacher_only=false and b.is_assessable=true and b.block_type='question' and nullif(btrim(coalesce(b.plain_text,'')),'') is not null
    order by b.sequence limit v_limit
  ) q;
  return v_source || jsonb_build_object('practice_mode','grounded_authored','question_count',jsonb_array_length(v_questions),'questions',v_questions);
end;
$function$

revoke execute on function public.student_get_grounded_chapter_practice(uuid,uuid,integer) from public, anon;
grant execute on function public.student_get_grounded_chapter_practice(uuid,uuid,integer) to authenticated;
