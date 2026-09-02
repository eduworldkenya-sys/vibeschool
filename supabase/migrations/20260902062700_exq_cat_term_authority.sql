begin;

create or replace function public.exq_resolve_cumulative_cat_outcomes(
  p_seed_lesson_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  seed public.lesson_plans%rowtype;
  seed_scheme public.scheme_of_work%rowtype;
  effective_term integer;
  payload jsonb;
  completed_lessons integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into seed from public.lesson_plans where id = p_seed_lesson_plan_id;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if seed.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if seed.class_id is null or seed.subject_id is null then raise exception 'lesson_context_required'; end if;
  if seed.scheme_id is null then raise exception 'lesson_plan_scheme_required'; end if;

  select * into seed_scheme from public.scheme_of_work where id = seed.scheme_id;
  if not found then raise exception 'scheme_item_not_found'; end if;
  if seed_scheme.teacher_id is distinct from caller
     or seed_scheme.class_id is distinct from seed.class_id
     or seed_scheme.subject_id is distinct from seed.subject_id
  then raise exception 'lesson_scheme_mismatch'; end if;

  effective_term := coalesce(seed.term, seed_scheme.term);
  if effective_term is null then raise exception 'cat_term_authority_required'; end if;

  with completed as (
    select distinct lp.id, lp.body, lp.scheme_id
    from public.lesson_plans lp
    join public.scheme_of_work sow on sow.id = lp.scheme_id
    join public.teaching_occurrences occ
      on occ.timetable_slot_id = lp.timetable_slot_id
     and occ.occurrence_date = lp.taught_date
     and occ.teacher_id = lp.teacher_id
     and occ.class_id = lp.class_id
     and occ.subject_id = lp.subject_id
     and occ.lifecycle = 'completed'
    where lp.teacher_id = caller
      and lp.class_id = seed.class_id
      and lp.subject_id = seed.subject_id
      and coalesce(lp.term, sow.term) = effective_term
  ), resolved as (
    select distinct clo.id, clo.outcome_text, clo.outcome_code, clo.status
    from completed c
    join public.scheme_of_work sow on sow.id = c.scheme_id
    join public.curriculum_learning_outcomes clo
      on clo.curriculum_id = sow.curriculum_id
     and clo.status <> 'retired'
    where c.body is not null
      and position(clo.outcome_text in c.body) > 0
  )
  select
    (select count(*) from completed),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'outcome_text', r.outcome_text,
      'outcome_code', r.outcome_code,
      'status', r.status
    ) order by r.outcome_code nulls last, r.outcome_text), '[]'::jsonb)
  into completed_lessons, payload
  from resolved r;

  return jsonb_build_object(
    'ok', true,
    'seed_lesson_plan_id', seed.id,
    'class_id', seed.class_id,
    'subject_id', seed.subject_id,
    'term', effective_term,
    'completed_lesson_count', coalesce(completed_lessons, 0),
    'outcomes', payload
  );
end;
$$;

revoke all on function public.exq_resolve_cumulative_cat_outcomes(uuid) from public, anon;
grant execute on function public.exq_resolve_cumulative_cat_outcomes(uuid) to authenticated, service_role;

commit;
