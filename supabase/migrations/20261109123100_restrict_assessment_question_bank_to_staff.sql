begin;

-- The reusable bank stores answer keys and is an educator surface. Learners
-- receive sanitized items and released corrections through the attempt RPCs.
create policy assessment_questions_staff_only
  on public.assessment_questions
  as restrictive
  for all
  to authenticated
  using ((select public.get_my_role()) in ('teacher', 'admin', 'head_teacher')
    or (select public.is_platform_owner()))
  with check ((select public.get_my_role()) in ('teacher', 'admin', 'head_teacher')
    or (select public.is_platform_owner()));

create or replace function public.exq_list_question_bank(
  p_subject_id uuid default null,
  p_search text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  result jsonb;
  safe_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
  normalized_search text:=nullif(btrim(coalesce(p_search,'')),'');
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.get_my_role(), '') not in ('teacher', 'admin', 'head_teacher')
     and not public.is_platform_owner() then
    raise exception 'question_bank_staff_required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'question_text',q.question_text,'question_type',q.question_type,
    'marks',q.marks,'difficulty',q.difficulty,'bloom_level',q.bloom_level,
    'competency_tag',q.competency_tag,'subject_id',q.subject_id,
    'learning_outcome_id',q.learning_outcome_id,'review_status',q.review_status,
    'usage_count',q.usage_count,'updated_at',q.updated_at
  ) order by q.usage_count desc,q.updated_at desc),'[]'::jsonb)
  into result
  from (
    select * from public.assessment_questions aq
    where aq.review_status='approved'
      and (p_subject_id is null or aq.subject_id=p_subject_id)
      and (normalized_search is null or aq.question_text ilike '%'||normalized_search||'%')
    order by aq.usage_count desc,aq.updated_at desc
    limit safe_limit
  ) q;
  return jsonb_build_object('ok',true,'questions',result);
end;
$$;

commit;
