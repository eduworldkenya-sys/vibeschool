-- Stage 1 of KICD taxonomy depth expansion.
-- Additive only — no FKs, no backfill, nothing else references these
-- columns yet. Safe to run standalone.

alter table cbc_strands add column if not exists sub_strand text;
alter table cbc_strands add column if not exists strand_order int;
alter table cbc_strands add column if not exists sub_strand_order int;
alter table cbc_strands add column if not exists learning_outcomes text[] default '{}'::text[];
alter table cbc_strands add column if not exists key_inquiry_questions text[] default '{}'::text[];
alter table cbc_strands add column if not exists suggested_experiences text[] default '{}'::text[];
alter table cbc_strands add column if not exists core_competencies text[] default '{}'::text[];
alter table cbc_strands add column if not exists core_values text[] default '{}'::text[];
alter table cbc_strands add column if not exists term int;
alter table cbc_strands add column if not exists week int;
alter table cbc_strands add column if not exists source_ref text;

comment on column cbc_strands.sub_strand is
  'KICD official sub-strand name. NULL on legacy rows that only had strand-level data.';
comment on column cbc_strands.learning_outcomes is
  'KICD official outcome statements for this sub-strand, verbatim from curriculum design.';
comment on column cbc_strands.core_values is
  'KICD official CBC values list (e.g. respect, unity, responsibility) tagged per sub-strand.';
comment on column cbc_strands.source_ref is
  'Citation back to the official KICD curriculum design document/page for auditability.';
