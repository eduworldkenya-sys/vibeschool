-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
create table if not exists public.hq_workforce_roles (
  key text primary key,
  name text not null,
  function_key text not null,
  responsibilities jsonb not null default '[]'::jsonb,
  required_competencies jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.hq_workforce_jobs (
  key text primary key,
  title text not null,
  purpose text not null,
  role_keys jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.hq_workforce_workers (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null unique,
  worker_kind text not null check (worker_kind in ('digital','human','contractor','automation')),
  title text not null,
  department_key text not null,
  job_key text,
  manager_worker_key text,
  mission text not null,
  status text not null default 'draft' check (status in ('draft','probation','active','restricted','suspended','retired')),
  reasoning_mode text not null default 'deterministic' check (reasoning_mode in ('deterministic','local_ai','human','external_ai')),
  paid_ai_allowed boolean not null default false,
  competencies jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  approval_boundaries jsonb not null default '[]'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hq_workforce_paid_ai_guard check (paid_ai_allowed = false or reasoning_mode = 'external_ai')
);
create table if not exists public.hq_workforce_assignments (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete cascade,
  role_key text not null references public.hq_workforce_roles(key) on update cascade on delete restrict,
  department_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(worker_key, role_key)
);
create table if not exists public.hq_workforce_engine_contract (
  singleton boolean primary key default true check (singleton),
  mission text not null,
  responsibilities jsonb not null,
  exclusions jsonb not null,
  routine_paid_ai_required boolean not null default false check (routine_paid_ai_required = false),
  updated_at timestamptz not null default now()
);
insert into public.hq_workforce_engine_contract(singleton, mission, responsibilities, exclusions, routine_paid_ai_required)
values (true,'Ensure every necessary Vibeschool business function has the safest, least-cost capable owner and that work is executed, verified, measured, and improved without requiring paid AI for routine operation.','["model_company_functions","detect_unowned_or_duplicate_work","select_automation_digital_human_or_contractor_capacity","create_and_certify_digital_workers","route_and_supervise_work","enforce_authority_and_approval_boundaries","verify_outcomes_against_evidence","measure_workforce_performance_and_capacity","preserve_operational_memory","recommend_workforce_changes"]'::jsonb,'["autonomous_human_hiring_or_termination","autonomous_salary_or_contract_commitments","autonomous_spending","self_granting_worker_authority","paid_ai_as_required_runtime_dependency"]'::jsonb,false)
on conflict (singleton) do update set mission=excluded.mission,responsibilities=excluded.responsibilities,exclusions=excluded.exclusions,routine_paid_ai_required=false,updated_at=now();
alter table public.hq_workforce_roles enable row level security;
alter table public.hq_workforce_jobs enable row level security;
alter table public.hq_workforce_workers enable row level security;
alter table public.hq_workforce_assignments enable row level security;
alter table public.hq_workforce_engine_contract enable row level security;
revoke all on public.hq_workforce_roles from anon, authenticated;
revoke all on public.hq_workforce_jobs from anon, authenticated;
revoke all on public.hq_workforce_workers from anon, authenticated;
revoke all on public.hq_workforce_assignments from anon, authenticated;
revoke all on public.hq_workforce_engine_contract from anon, authenticated;
grant select on public.hq_workforce_roles, public.hq_workforce_jobs, public.hq_workforce_workers, public.hq_workforce_assignments, public.hq_workforce_engine_contract to service_role;
grant insert, update, delete on public.hq_workforce_roles, public.hq_workforce_jobs, public.hq_workforce_workers, public.hq_workforce_assignments to service_role;
