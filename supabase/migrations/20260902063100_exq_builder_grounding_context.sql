begin;

create or replace function public.exq_list_builder_assessment(p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  ad public.assessment_definitions%rowtype;
  sections jsonb;
  unsectioned jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into ad from public.assessment_definitions where id = p_assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'instructions', s.instructions,
    'display_order', s.display_order,
    'marks', s.marks,
    'estimated_minutes', s.estimated_minutes,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ai.id,
        'question_type', ai.question_type,
        'prompt', ai.prompt,
        'marks', ai.marks,
        'difficulty', ai.difficulty,
        'bloom_level', ai.bloom_level,
        'order_num', ai.order_num,
        'status', ai.status,
        'outcome_count', (select count(*) from public.assessment_item_outcomes aio where aio.assessment_item_id = ai.id)
      ) order by ai.order_num)
      from public.assessment_items ai
      where ai.section_id = s.id
    ), '[]'::jsonb)
  ) order by s.display_order), '[]'::jsonb)
  into sections
  from public.assessment_sections s
  where s.assessment_id = ad.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ai.id,
    'question_type', ai.question_type,
    'prompt', ai.prompt,
    'marks', ai.marks,
    'difficulty', ai.difficulty,
    'bloom_level', ai.bloom_level,
    'order_num', ai.order_num,
    'status', ai.status,
    'outcome_count', (select count(*) from public.assessment_item_outcomes aio where aio.assessment_item_id = ai.id)
  ) order by ai.order_num), '[]'::jsonb)
  into unsectioned
  from public.assessment_items ai
  where ai.assessment_id = ad.id and ai.section_id is null;

  return jsonb_build_object(
    'ok', true,
    'assessment', jsonb_build_object(
      'id', ad.id,
      'title', ad.title,
      'description', ad.description,
      'instructions', ad.instructions,
      'assessment_type', ad.assessment_type,
      'status', ad.status,
      'total_marks', ad.total_marks,
      'estimated_minutes', ad.estimated_minutes,
      'subject_id', ad.subject_id,
      'generation_source', ad.generation_source,
      'generation_status', ad.generation_status
    ),
    'sections', sections,
    'unsectioned_items', unsectioned
  );
end;
$$;

revoke all on function public.exq_list_builder_assessment(uuid) from public, anon;
grant execute on function public.exq_list_builder_assessment(uuid) to authenticated, service_role;

commit;
