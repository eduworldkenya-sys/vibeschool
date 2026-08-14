-- access: authenticated=select; service_role=all; anon=none
-- authorization-test: public.billing_subscriptions authenticated users can read only their own subscription rows (or platform owners); anon has no access; service_role retains billing mutation authority.
--
-- TBL-011 production-derived prerequisite reconstruction.
-- public.billing_subscriptions exists in production before the tracked entitlement
-- boundary migration, but its original creation is absent from repository history.

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  plan_key text not null,
  status text not null check (status in ('trialing','active','past_due','cancelled','expired')),
  currency text not null default 'KES',
  amount numeric not null check (amount >= 0),
  billing_interval text not null check (billing_interval in ('month','year')),
  started_at timestamptz not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  ended_at timestamptz,
  source text not null default 'vibeschool',
  external_ref text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_profile_status_idx
  on public.billing_subscriptions(profile_id,status);
create unique index if not exists uq_billing_one_current_subscription
  on public.billing_subscriptions(profile_id)
  where status in ('trialing','active','past_due');

alter table public.billing_subscriptions enable row level security;

drop policy if exists billing_subscriptions_owner_or_self_read on public.billing_subscriptions;
create policy billing_subscriptions_owner_or_self_read
  on public.billing_subscriptions
  for select
  to authenticated
  using (public.is_platform_owner() or profile_id = auth.uid());

revoke all on table public.billing_subscriptions from public, anon, authenticated;
grant select on table public.billing_subscriptions to authenticated;
grant all on table public.billing_subscriptions to service_role;
