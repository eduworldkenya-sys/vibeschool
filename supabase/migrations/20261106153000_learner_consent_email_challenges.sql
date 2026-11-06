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
