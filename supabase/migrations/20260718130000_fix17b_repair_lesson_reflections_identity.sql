-- Fix 17B: repair lesson_reflections write path.
-- lesson_id (legacy, NOT NULL) and lesson_plan_id (new canonical FK) both
-- reference lesson_plans.id. App code writes lesson_plan_id going forward;
-- lesson_id is kept in sync temporarily until reads are audited and it can
-- be retired. A plain (non-partial) unique index is used deliberately —
-- Postgres treats NULLs as distinct for uniqueness, so no partial predicate
-- is needed, and a partial index would not be usable as an ON CONFLICT
-- arbiter for a plain `onConflict: 'lesson_plan_id'` upsert.

alter table public.lesson_reflections
  alter column lesson_id drop not null;

create unique index if not exists lesson_reflections_lesson_plan_id_key
on public.lesson_reflections (lesson_plan_id);
