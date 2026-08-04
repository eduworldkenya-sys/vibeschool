-- FND-002B — deterministic historical lesson-plan scheme reconciliation
--
-- Purpose:
--   Backfill lesson_plans.scheme_id only when exactly one authoritative
--   scheme_of_work row matches the same:
--
--     teacher
--     school
--     class
--     subject
--     normalized topic
--
-- Safety:
--   - never guesses by week alone;
--   - never crosses teacher/class/subject boundaries;
--   - never overwrites an existing scheme_id;
--   - leaves unmatched and ambiguous plans unchanged;
--   - idempotent on repeated execution.
--
-- Verified live before repository reconciliation:
--   rows_updated        = 0
--   ambiguous_candidates = 0
--   remaining_unmatched = 4
--
-- The four unmatched historical plans are Science and Technology plans,
-- while the school currently has scheme rows only for English and Mathematics.
-- They must remain unlinked rather than receiving fabricated relationships.

do $$
declare
  v_updated integer := 0;
  v_ambiguous integer := 0;
  v_unmatched integer := 0;
begin
  with candidate_matches as (
    select
      lp.id as lesson_plan_id,
      (array_agg(sw.id order by sw.id))[1] as scheme_id,
      count(*) as candidate_count
    from public.lesson_plans lp
    join public.scheme_of_work sw
      on sw.teacher_id = lp.teacher_id
     and sw.school_id = lp.school_id
     and sw.class_id = lp.class_id
     and sw.subject_id = lp.subject_id
     and lower(trim(coalesce(sw.topic, ''))) =
         lower(trim(coalesce(lp.topic, '')))
    where lp.scheme_id is null
    group by lp.id
  ),
  deterministic as (
    select
      lesson_plan_id,
      scheme_id
    from candidate_matches
    where candidate_count = 1
  ),
  updated as (
    update public.lesson_plans lp
       set scheme_id = d.scheme_id,
           curriculum_id = coalesce(
             lp.curriculum_id,
             sw.curriculum_id
           ),
           updated_at = now()
      from deterministic d
      join public.scheme_of_work sw
        on sw.id = d.scheme_id
     where lp.id = d.lesson_plan_id
       and lp.scheme_id is null
    returning lp.id
  )
  select count(*)
    into v_updated
    from updated;

  with candidate_matches as (
    select
      lp.id as lesson_plan_id,
      count(*) as candidate_count
    from public.lesson_plans lp
    join public.scheme_of_work sw
      on sw.teacher_id = lp.teacher_id
     and sw.school_id = lp.school_id
     and sw.class_id = lp.class_id
     and sw.subject_id = lp.subject_id
     and lower(trim(coalesce(sw.topic, ''))) =
         lower(trim(coalesce(lp.topic, '')))
    where lp.scheme_id is null
    group by lp.id
  )
  select count(*)
    into v_ambiguous
    from candidate_matches
   where candidate_count > 1;

  select count(*)
    into v_unmatched
    from public.lesson_plans
   where scheme_id is null;

  raise notice
    'FND-002B reconciliation: updated=%, ambiguous=%, remaining_unmatched=%',
    v_updated,
    v_ambiguous,
    v_unmatched;
end;
$$;
