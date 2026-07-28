-- Fix 3: chapter-level exact curriculum linkage (publication-level curriculum_id
-- rejected in the plan as too coarse for a multi-week book — cbc_subject/cbc_grade
-- already exist on vibe_publications for the coarse book-level tag).
alter table vibe_publications
  add column if not exists curriculum_framework text not null default 'CBC';

alter table vibe_chapters
  add column if not exists curriculum_id uuid references curriculum(id);

alter table vibe_chapters
  add column if not exists curriculum_content_id uuid references curriculum_content(id);

alter table vibe_chapters
  add column if not exists content_pack_version integer;

-- Fix 4: replace the unverifiable boolean with a real workflow state.
-- cbc_aligned stays as-is (marketplace tagging, per the doc's own note) —
-- alignment_status is the one that actually gates the Teacher OS resolver later.
alter table vibe_chapters
  add column if not exists alignment_status text not null default 'unclaimed'
  check (alignment_status in ('unclaimed','creator_claimed','pending_review','verified','rejected'));

alter table vibe_chapters
  add column if not exists verified_by uuid references profiles(id);

alter table vibe_chapters
  add column if not exists verified_at timestamptz;

alter table vibe_chapters
  add column if not exists verification_notes text;

-- Backfill existing rows honestly: a self-declared cbc_strand claim without
-- curriculum_id is a creator claim, not verified. Nothing gets auto-verified.
update vibe_chapters
set alignment_status = 'creator_claimed'
where cbc_strand is not null
  and alignment_status = 'unclaimed';

-- Wire Mumbi's test chapter to its real, already-confirmed Layer 2 record —
-- this is the one legitimate exact match that exists today.
update vibe_chapters
set curriculum_id = 'c78ad6f2-1797-48f0-94f3-c8572eec77f7',
    curriculum_content_id = '3c5abe3f-75a1-4567-82e9-c9116d19ee15',
    content_pack_version = 1,
    alignment_status = 'creator_claimed'
where id = 'f95c252a-da2d-477c-b4cb-33b5f8338e10';
