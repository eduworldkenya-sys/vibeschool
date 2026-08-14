-- TBL-011 prerequisite repair for School Directory V2.
-- The 20260813100000 school-directory migration creates GIN trigram indexes
-- before the later 20260813101422 migration installs pg_trgm. Blank replay
-- therefore fails before reaching that later extension migration.
-- This prerequisite is intentionally ordered one second before School Directory V2.
-- It is idempotent and does not modify Worker Engine runtime state.

create extension if not exists pg_trgm;
