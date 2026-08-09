-- HQ Digital Workforce Engine
-- Deterministic-first: worker-to-worker coordination is structured database state,
-- not LLM conversation. Paid AI is opt-in and disabled by default at application level.

create table if not exists public.hq_worker_templates (
  key text primary key,
  name text not null,
  description text not null default '',
  definition jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_workers (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null unique,
  title text not null,
  department_key text not null references public.hq_departments(key),
  manager_worker_id uuid references public.hq_workers(id) on delete set null,
  template_key text references public.hq_worker_templates(key),
  mission text not null,
  definition jsonb not null default '{}'::jsonb,
  execution_order text[] not null default array['deterministic','local_ai','human','external_ai'],
  status text not null default 'draft' check (status in ('draft','probation','active','restricted','suspended','retired')),
  paid_ai_allowed boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_worker_messages (
  id uuid primary key default gen_random_uuid(),
  message_type text not null check (message_type in ('assign','request','consult','review','escalate','approve','reject','inform','handoff','verify')),
  from_worker_id uuid not null references public.hq_workers(id),
  to_worker_id uuid not null references public.hq_workers(id),
  work_item_id uuid references public.hq_work_items(id) on delete set null,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','claimed','completed','rejected','failed')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists hq_worker_messages_inbox_idx
  on public.hq_worker_messages(to_worker_id, status, priority, created_at);

create table if not exists public.hq_worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.hq_workers(id),
  workflow_key text not null,
  work_item_id uuid references public.hq_work_items(id) on delete set null,
  execution_mode text not null check (execution_mode in ('deterministic','local_ai','human','external_ai')),
  status text not null check (status in ('running','completed','blocked','approval_required','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists hq_worker_runs_worker_idx
  on public.hq_worker_runs(worker_id, started_at desc);

create table if not exists public.hq_worker_kpis (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.hq_workers(id) on delete cascade,
  metric_key text not null,
  label text not null,
  direction text not null check (direction in ('higher','lower','boolean')),
  target numeric,
  unit text,
  current_value numeric,
  measured_at timestamptz,
  unique(worker_id, metric_key)
);

create table if not exists public.hq_worker_certifications (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.hq_workers(id) on delete cascade,
  scenario_key text not null,
  passed boolean not null,
  evidence jsonb not null default '{}'::jsonb,
  certified_at timestamptz not null default now(),
  unique(worker_id, scenario_key)
);

alter table public.hq_worker_templates enable row level security;
alter table public.hq_workers enable row level security;
alter table public.hq_worker_messages enable row level security;
alter table public.hq_worker_runs enable row level security;
alter table public.hq_worker_kpis enable row level security;
alter table public.hq_worker_certifications enable row level security;

comment on table public.hq_workers is 'Persistent HQ digital worker identities. Workers default to zero paid-AI authority.';
comment on table public.hq_worker_messages is 'Structured deterministic worker-to-worker work bus; payloads replace LLM conversations.';
comment on column public.hq_workers.paid_ai_allowed is 'Explicit opt-in kill switch. False by default to enforce AI-free operation.';
