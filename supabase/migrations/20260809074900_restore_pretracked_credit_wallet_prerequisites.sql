-- L0 replay prerequisite reconstructed from the production catalog.
-- These billing relations predate the repository's first recorded billing DDL.
create table if not exists public.vibe_credits (
  teacher_id uuid primary key references public.profiles(id),
  balance integer default 3,
  total_earned integer default 3,
  total_spent integer default 0,
  updated_at timestamptz default now()
);
create table if not exists public.vibe_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles(id),
  school_id uuid,
  type text,
  feature text,
  amount integer,
  balance_after integer,
  mpesa_ref text,
  notes text,
  created_at timestamptz default now()
);
create table if not exists public.vibe_credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  price_kes integer,
  credits integer,
  unlocks text[],
  is_active boolean default true
);
alter table public.vibe_credits enable row level security;
alter table public.vibe_credit_transactions enable row level security;
alter table public.vibe_credit_packages enable row level security;
drop policy if exists vibe_credits_teacher_own on public.vibe_credits;
create policy vibe_credits_teacher_own on public.vibe_credits for all using (teacher_id = auth.uid());
drop policy if exists "Teachers read own transactions" on public.vibe_credit_transactions;
create policy "Teachers read own transactions" on public.vibe_credit_transactions for select to authenticated using (teacher_id = (select auth.uid()));
drop policy if exists "Anyone can read active packages" on public.vibe_credit_packages;
create policy "Anyone can read active packages" on public.vibe_credit_packages for select using (is_active = true);
