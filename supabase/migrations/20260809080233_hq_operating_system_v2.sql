-- Recovered from the production Supabase migration ledger for L0 replay parity.
-- Production version 20260809080233 added the HQ operating-system state that
-- later repository migrations already assume exists.

create table if not exists public.hq_company_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  captured_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb
);

create table if not exists public.hq_findings (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  finding_type text not null,
  department_key text not null,
  severity text not null check (severity in ('info','warning','high','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','in_progress','resolved','dismissed')),
  title text not null,
  explanation text not null,
  why_it_matters text not null,
  decision_required boolean not null default false,
  recommended_action text,
  evidence jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hq_findings_one_active_fingerprint
  on public.hq_findings(fingerprint)
  where status in ('open','acknowledged','in_progress');

create table if not exists public.hq_automation_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null check (status in ('running','succeeded','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  error text
);

alter table public.hq_work_items
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.hq_work_items add column if not exists acted_at timestamptz;
alter table public.hq_work_items
  add column if not exists verification_status text not null default 'pending'
  check (verification_status in ('pending','verified','failed','not_required'));
alter table public.hq_work_items
  add column if not exists verification_evidence jsonb not null default '{}'::jsonb;
alter table public.hq_work_items
  add column if not exists action_taken jsonb not null default '{}'::jsonb;

alter table public.hq_incidents add column if not exists owner_department text;
alter table public.hq_incidents
  add column if not exists verification_status text not null default 'pending'
  check (verification_status in ('pending','verified','failed'));
alter table public.hq_incidents
  add column if not exists recovery_evidence jsonb not null default '{}'::jsonb;

alter table public.hq_company_snapshots enable row level security;
alter table public.hq_findings enable row level security;
alter table public.hq_automation_runs enable row level security;
revoke all on table public.hq_company_snapshots, public.hq_findings, public.hq_automation_runs
  from public, anon, authenticated;
grant select on table public.hq_company_snapshots, public.hq_findings, public.hq_automation_runs
  to authenticated;

drop policy if exists hq_company_snapshots_owner_read on public.hq_company_snapshots;
create policy hq_company_snapshots_owner_read on public.hq_company_snapshots
  for select to authenticated using (public.is_platform_owner());
drop policy if exists hq_findings_owner_read on public.hq_findings;
create policy hq_findings_owner_read on public.hq_findings
  for select to authenticated using (public.is_platform_owner());
drop policy if exists hq_automation_runs_owner_read on public.hq_automation_runs;
create policy hq_automation_runs_owner_read on public.hq_automation_runs
  for select to authenticated using (public.is_platform_owner());

-- authorization-test: public.hq_company_snapshots anon denied; platform owner allowed
-- authorization-test: public.hq_findings anon denied; platform owner allowed
-- authorization-test: public.hq_automation_runs anon denied; platform owner allowed
