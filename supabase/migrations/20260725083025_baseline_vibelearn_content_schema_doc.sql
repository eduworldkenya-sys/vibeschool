-- Baseline documentation migration for public.vibelearn_content.
-- This table was created out-of-band (no prior migration file exists for it).
-- No structural changes here — this migration only records the live shape
-- as of 2026-07-25 so future changes have a tracked starting point.

comment on table public.vibelearn_content is
  'Teacher content marketplace/discovery index (VibeLearn). Rows are either
   (a) externally-linked epage/ebook submissions (url required), or
   (b) bridged VibeTextbook publications (vibe_publication_id required),
   sourced from public.vibe_publications/vibe_chapters.
   Baselined 2026-07-25; pre-existing columns, indexes, RLS, and triggers
   at that date are documented below, not altered by this migration.';

comment on column public.vibelearn_content.type is
  'Content kind. Live check constraint as of baseline: epage | ebook only.
   textbook added in a follow-up migration (add_textbook_bridge_constraint).';

comment on column public.vibelearn_content.vibe_publication_id is
  'Bridge to public.vibe_publications.id. Present in schema at baseline but
   not yet enforced by a check constraint or unique index — added in
   add_textbook_bridge_constraint.';

comment on column public.vibelearn_content.url is
  'External link for epage/ebook rows, or an internal /global/read/publication/:id
   route for bridged textbook rows (observed usage at baseline, not yet a
   named/stable route).';

comment on column public.vibelearn_content.earnings_ksh is
  'Derived by trigger vl_earnings_trigger -> vibelearn_update_earnings():
   flat view_count * 5 KSh, no self-view/duplicate-view/textbook-specific
   logic as of baseline. Flagged for review before textbook views feed this.';

-- Baseline-known duplicate: vibelearn_search_vector_trigger and
-- vl_search_vector_trigger both fire vibelearn_search_vector_update() on
-- INSERT OR UPDATE. Redundant, not incorrect. Left as-is here; candidate
-- for a separate cleanup migration, out of scope for the textbook bridge.
