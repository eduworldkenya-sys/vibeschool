-- Non-breaking columns for verified external learner email and guardian email invitation.
-- Existing school learner identity @vs.internal remains unchanged.
alter table public.learner_guardian_consent_requests
  add column if not exists learner_token_hash text,
  add column if not exists learner_token_expires_at timestamptz,
  add column if not exists guardian_invite_sent_at timestamptz;
create unique index if not exists learner_consent_learner_token_idx
  on public.learner_guardian_consent_requests (learner_token_hash)
  where learner_token_hash is not null;
create index if not exists learner_consent_learner_user_idx
  on public.learner_guardian_consent_requests (learner_user_id, created_at desc);
-- Existing tables have RLS enabled and no direct client grants.
revoke all on public.learner_guardian_consent_requests from anon, authenticated;
revoke all on public.learner_guardian_consent_events from anon, authenticated;

-- The prior private ledger tables revoke anon/authenticated, but did not
-- grant the server's service_role SQL privileges. Service API writes fail
-- without explicit grants even though service_role bypasses row policies.
grant select, insert, update, delete on public.learner_guardian_consent_requests to service_role;
grant select, insert on public.learner_guardian_consent_events to service_role;
revoke update, delete on public.learner_guardian_consent_events from service_role;

-- One outstanding/approved request per learner, even with concurrent requests.
create unique index if not exists learner_consent_one_active_request
  on public.learner_guardian_consent_requests (learner_user_id)
  where learner_user_id is not null and status in ('pending', 'approved');
