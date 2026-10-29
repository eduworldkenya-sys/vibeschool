-- Requests are untrusted leads for independent recovery verification, never authorization.
-- access: service-only public.success_wish_recovery_reviews
-- authorization-test: public.success_wish_recovery_reviews
create table if not exists public.success_wish_recovery_reviews (
  id uuid primary key default gen_random_uuid(),
  phone_digest text not null check (phone_digest ~ '^[a-f0-9]{64}$'),
  name_digest text not null check (name_digest ~ '^[a-f0-9]{64}$'),
  exam_year text not null check (exam_year ~ '^20[0-9]{2}$'),
  status text not null default 'pending' check (status in ('pending','reviewing','rejected','completed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  evidence_reference text
);
alter table public.success_wish_recovery_reviews enable row level security;
revoke all on public.success_wish_recovery_reviews from public, anon, authenticated;
grant select, insert, update on public.success_wish_recovery_reviews to service_role;
create index if not exists success_wish_recovery_reviews_status_created
 on public.success_wish_recovery_reviews (status,created_at desc);
comment on table public.success_wish_recovery_reviews is
 'Unverified recovery enquiries. Never use this table alone to issue PIN sessions, replace recovery capabilities or transfer gift ownership.';

do $$
begin
  if has_table_privilege('anon','public.success_wish_recovery_reviews','SELECT')
     or has_table_privilege('anon','public.success_wish_recovery_reviews','INSERT')
     or has_table_privilege('authenticated','public.success_wish_recovery_reviews','SELECT')
     or has_table_privilege('authenticated','public.success_wish_recovery_reviews','INSERT')
  then
    raise exception 'Recovery reviews must not be publicly accessible';
  end if;
end $$;
