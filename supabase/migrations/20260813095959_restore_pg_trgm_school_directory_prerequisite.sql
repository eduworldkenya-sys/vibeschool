-- TBL-011 prerequisite repair for School Directory V2.
-- The tracked 20260813100000 migration was authored against a production
-- `public.schools` shape richer than the reconstructed blank-replay baseline.
-- Restore the complete pre-existing directory identity/location surface that
-- School Directory V2 reads or indexes before it adds its own new columns.
--
-- School Directory V2 explicitly calls extensions.similarity(...), so pg_trgm
-- must be installed in Supabase's extensions schema before that migration.
--
-- This migration is intentionally ordered one second before School Directory V2,
-- is idempotent, and does not modify Worker Engine runtime state.

create extension if not exists pg_trgm with schema extensions;

alter table public.schools
  add column if not exists name_normalized text,
  add column if not exists county text,
  add column if not exists sub_county text,
  add column if not exists ward text,
  add column if not exists school_type text,
  add column if not exists school_category text,
  add column if not exists knec_code text,
  add column if not exists nemis_code text,
  add column if not exists gps_lat numeric,
  add column if not exists gps_lng numeric;
