create table if not exists public.vibe_reading_sessions (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  client_session_id uuid not null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  max_progress_percent smallint not null default 0 check (max_progress_percent between 0 and 100),
  completed_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viewer_id, client_session_id)
);

create index if not exists vibe_reading_sessions_viewer_idx
  on public.vibe_reading_sessions (viewer_id, last_active_at desc);
create index if not exists vibe_reading_sessions_chapter_idx
  on public.vibe_reading_sessions (chapter_id, started_at desc);

alter table public.vibe_reading_sessions enable row level security;

drop policy if exists vibe_reading_sessions_select_own
  on public.vibe_reading_sessions;

create policy vibe_reading_sessions_select_own
  on public.vibe_reading_sessions
  for select to authenticated
  using (viewer_id = auth.uid());

revoke all on public.vibe_reading_sessions from anon, authenticated;
grant select on public.vibe_reading_sessions to authenticated;
