-- TBL-011 prerequisite repair for School Directory V2.
-- The 20260813100000 school-directory migration assumes two production-derived
-- prerequisites that are absent on a blank historical replay:
--   1. pg_trgm must exist before GIN indexes use gin_trgm_ops;
--   2. public.schools.name_normalized must exist before it is indexed/backfilled.
-- The later school-discovery migration installs pg_trgm, but that is too late.
-- This prerequisite is intentionally ordered one second before School Directory V2.
-- It is idempotent and does not modify Worker Engine runtime state.

create extension if not exists pg_trgm;

alter table public.schools
  add column if not exists name_normalized text;
