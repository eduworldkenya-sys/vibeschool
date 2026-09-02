begin;

create or replace function public.exq_prepare_certified_cat_assessment(
  p_seed_lesson_plan_id uuid,
  p_request_key text,
  p_title text,
  p_generation_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  truth jsonb;
  completed_count integer;
  outcome_count integer;
begin
  truth := public.exq_resolve_cumulative_cat_outcomes(p_seed_lesson_plan_id);
  completed_count := coalesce((truth->>'completed_lesson_count')::integer, 0);
  outcome_count := jsonb_array_length(coalesce(truth->'outcomes', '[]'::jsonb));

  if completed_count < 2 then raise exception 'cat_requires_multiple_completed_lessons'; end if;
  if outcome_count < 2 then raise exception 'cat_requires_multiple_taught_outcomes'; end if;

  return public.exq_prepare_grounded_cat_assessment(
    p_seed_lesson_plan_id,
    p_request_key,
    p_title,
    p_generation_metadata
  );
end;
$$;

revoke all on function public.exq_prepare_certified_cat_assessment(uuid, text, text, jsonb) from public, anon;
grant execute on function public.exq_prepare_certified_cat_assessment(uuid, text, text, jsonb) to authenticated, service_role;

commit;
