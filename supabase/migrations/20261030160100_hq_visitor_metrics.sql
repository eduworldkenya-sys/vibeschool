-- Anonymous aggregate traffic events. Only server-side service role can read or write.
create table if not exists public.hq_visitor_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  visitor_hash text not null check (length(visitor_hash) = 64),
  page_path text not null check (length(page_path) between 1 and 160)
);
create index if not exists hq_visitor_events_occurred_idx on public.hq_visitor_events (occurred_at desc);
alter table public.hq_visitor_events enable row level security;
revoke all on public.hq_visitor_events from anon, authenticated;
-- No client policies: reporting and ingestion are performed by authenticated server routes.
