-- TBL-011 reproducible-baseline prerequisite.
-- Production confirms lesson_plans.topic is a nullable text column and
-- FND-002B depends on it for deterministic scheme reconciliation.
-- Restore only the missing historical column; later migrations keep owning
-- their own lesson-plan changes.

alter table public.lesson_plans
  add column if not exists topic text;
