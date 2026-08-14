-- Historical replay repair for School Directory unified search.
-- 20260813100000 creates search_school_directory(...) with one OUT-row shape.
-- 20260813101450 replaces the same signature with a wider row shape including
-- cluster/source. PostgreSQL cannot change OUT parameters through CREATE OR REPLACE.
-- Drop the old signature immediately before the intentional replacement.
-- No data mutation and no Worker Engine runtime change.

drop function if exists public.search_school_directory(text,text,text,text,numeric,numeric,integer);
