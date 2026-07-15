-- Stage 2: nullable sub_strand_id FK columns linking curriculum,
-- scheme_of_work, and vibe_chapters back to the real cbc_strands
-- taxonomy. Additive only — existing free-text columns (strand,
-- sub_strand, cbc_strand) stay untouched. Nothing breaks; old code
-- keeps working off the text fields until app logic is updated.

alter table curriculum
  add column if not exists sub_strand_id uuid references cbc_strands(id);

alter table scheme_of_work
  add column if not exists sub_strand_id uuid references cbc_strands(id);

alter table vibe_chapters
  add column if not exists sub_strand_id uuid references cbc_strands(id);

create index if not exists idx_curriculum_sub_strand_id
  on curriculum(sub_strand_id);

create index if not exists idx_scheme_of_work_sub_strand_id
  on scheme_of_work(sub_strand_id);

create index if not exists idx_vibe_chapters_sub_strand_id
  on vibe_chapters(sub_strand_id);
