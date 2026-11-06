-- Foundation only: stores evidence for future email + guardian authorization.
-- This migration does NOT alter existing learner login, enrollment or activation.
-- All writes must come from reviewed server-side workflows; no direct client access.
create table if not exists public.learner_guardian_consent_requests (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid references auth.users(id) on delete set null,
  student_id uuid,
  learner_email text,
  learner_email_verified_at timestamptz,
  guardian_name text not null,
  guardian_email text not null,
  guardian_relationship text not null,
  guardian_user_id uuid references auth.users(id) on delete set null,
  guardian_email_verified_at timestamptz,
  consent_purpose text not null default 'personal_learning',
  policy_version text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn','expired','review_required')),
  token_hash text unique,
  token_expires_at timestamptz,
  declared_guardianship_at timestamptz,
  approved_at timestamptz,
  withdrawn_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_guardian_different_emails check (
    learner_email is null or lower(trim(learner_email)) <> lower(trim(guardian_email))
  )
);
create index if not exists learner_consent_student_idx on public.learner_guardian_consent_requests (student_id, created_at desc);
create index if not exists learner_consent_status_idx on public.learner_guardian_consent_requests (status, created_at desc);
alter table public.learner_guardian_consent_requests enable row level security;
revoke all on public.learner_guardian_consent_requests from anon, authenticated;

create table if not exists public.learner_guardian_consent_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.learner_guardian_consent_requests(id) on delete restrict,
  event_type text not null check(event_type in (
    'requested','learner_email_verified','guardian_email_verified',
    'guardianship_declared','approved','rejected','withdrawn','expired','review_requested','reviewed'
  )),
  actor_user_id uuid references auth.users(id) on delete set null,
  method text not null,
  policy_version text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists learner_consent_events_request_idx on public.learner_guardian_consent_events(request_id, occurred_at desc);
alter table public.learner_guardian_consent_events enable row level security;
revoke all on public.learner_guardian_consent_events from anon, authenticated;
-- No permissive RLS policies: confidential records must not be client-queryable.
-- Do not activate independent minor accounts from these tables alone.
