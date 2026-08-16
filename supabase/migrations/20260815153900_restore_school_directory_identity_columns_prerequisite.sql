-- TBL-011 / P0.10 prerequisite reconstruction.
--
-- Production already contains these columns and the FK, but their original
-- creation was never tracked before the national school identity matching
-- migration started reading/writing them. Restore that pre-tracked schema
-- contract so a blank database reaches the same shape deterministically.
--
-- This migration adds no new client privilege and does not alter existing RLS.

alter table public.schools_directory
  add column if not exists knec_code text;

alter table public.schools_directory
  add column if not exists ingest_batch_id uuid
  references public.school_directory_ingest_batches(id);

comment on column public.schools_directory.knec_code is
  'Source-observed KNEC identifier for discovery/reconciliation evidence; presence does not itself grant canonical authority.';
comment on column public.schools_directory.ingest_batch_id is
  'Provenance link to the school directory ingest batch that most recently staged this directory identity.';
