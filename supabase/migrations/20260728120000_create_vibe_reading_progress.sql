-- READ-002 — reading progress table.
--
-- Identity: viewer_id = auth.uid() = profiles.id, matching the canonical
-- reader's existing contract (get_vibetextbook_reader, get_vibelearn_content_reader).
-- Deliberately NOT keyed on students.id — the five legacy vibelearn_*
-- engagement tables (history/completed/saved/points/streaks) key on
-- students.id, have 0 live rows, and 114/115 students rows have no
-- profile_id (no login) — they are not reusable here and are left untouched.

create table if not exists public.vibe_reading_progress (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  reading_position jsonb,
  started_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_vibe_reading_progress_viewer_chapter unique (viewer_id, publication_id, chapter_id)
);

create index if not exists idx_vibe_reading_progress_resume
  on public.vibe_reading_progress (viewer_id, publication_id, last_read_at desc);

alter table public.vibe_reading_progress enable row level security;

drop policy if exists "vibe_reading_progress_owner_select" on public.vibe_reading_progress;
create policy "vibe_reading_progress_owner_select"
  on public.vibe_reading_progress
  for select
  using (viewer_id = auth.uid());

revoke all on public.vibe_reading_progress from public, anon;
grant select on public.vibe_reading_progress to authenticated;

comment on table public.vibe_reading_progress is
'Per-viewer, per-chapter reading progress for the canonical VibeTextbook reader. viewer_id = auth.uid() = profiles.id. Written only via record_reading_progress(); read directly here (RLS: own rows only) or via get_vibetextbook_reader()''s embedded progress/resume fields.';
