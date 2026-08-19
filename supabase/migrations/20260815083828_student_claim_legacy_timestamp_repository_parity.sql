-- Repository reconstruction parity for a production-preexisting claim field.
-- Production's historical student_claim_codes shape already exposed claimed_at
-- before 20260815083829_unify_student_claim_codes. The reconstructed baseline
-- did not, so a clean replay could not execute the production-recorded migration.
-- This is intentionally idempotent and is a no-op on production.

alter table public.student_claim_codes
  add column if not exists claimed_at timestamptz;
