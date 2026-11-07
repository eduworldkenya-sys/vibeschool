-- Independent learner identity is NOT a school enrolment.
-- It is intentionally inaccessible to browsers until the canonical student
-- authorization, verified guardian consent and school-linking gates are certified.
-- access: service-only public.independent_learner_identities
-- authorization-test: public.independent_learner_identities
-- Verify anon/authenticated have no SELECT/INSERT/UPDATE/DELETE and RLS=true;
-- verify service_role can SELECT/INSERT/UPDATE only, and no public policies exist.
create table if not exists public.independent_learner_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_state text not null default 'restricted'
    check (account_state in ('restricted', 'guardian_review', 'eligible', 'suspended')),
  age_band text not null default 'unconfirmed'
    check (age_band in ('unconfirmed', 'under_18', 'adult')),
  learner_email_verified_at timestamptz,
  guardian_consent_request_id uuid references public.learner_guardian_consent_requests(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint independent_learner_not_eligible_without_email
    check (account_state <> 'eligible' or learner_email_verified_at is not null),
  constraint independent_minor_not_eligible_without_consent
    check (account_state <> 'eligible' or age_band <> 'under_18'
      or guardian_consent_request_id is not null)
);
alter table public.independent_learner_identities enable row level security;
revoke all on public.independent_learner_identities from public, anon, authenticated;
grant select, insert, update on public.independent_learner_identities to service_role;
-- No public policies: the role must never be acquired from Google metadata or
-- a school directory selection. Guardian approval must be checked live from
-- the existing consent ledger, not inferred solely from this reference.
comment on table public.independent_learner_identities is
  'Restricted independent learner record; not a students row, school membership, or authorization grant.';
