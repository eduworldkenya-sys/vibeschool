-- Repository parity for the Content Engine orchestration run ledger.
-- Production already contains this relation and run_connected_content_engine() writes to it,
-- but the historical CREATE TABLE was never captured in the Git migration lineage.
-- This migration is intentionally idempotent: clean rebuilds create the canonical contract;
-- production preserves its existing rows and converges privileges without destructive DDL.
-- access: service-only public.content_engine_orchestration_runs
-- authorization-test: public.content_engine_orchestration_runs

create table if not exists public.content_engine_orchestration_runs (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.vibe_publications(id) on delete cascade,
  trigger_type text not null default 'scheduled'
    check (trigger_type in ('scheduled','manual','post_release','recovery')),
  status text not null default 'running'
    check (status in ('running','completed','blocked','failed')),
  stages jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid
);

alter table public.content_engine_orchestration_runs enable row level security;

-- The ledger is infrastructure evidence. Client roles consume governed projections/RPCs,
-- never the raw orchestration relation.
revoke all on table public.content_engine_orchestration_runs from public, anon, authenticated;
grant all on table public.content_engine_orchestration_runs to service_role;

comment on table public.content_engine_orchestration_runs is
  'Canonical Content Engine orchestration evidence ledger. Service-side writes only; HQ consumes governed projections.';
