-- Task 7 hard release gate: authenticated/anon clients must never have table-level
-- TRUNCATE authority. PostgreSQL RLS does not apply to TRUNCATE, so leaving this
-- privilege on school, learner, attendance, assessment, finance or HQ tables
-- creates a destructive privilege-escalation path outside all row policies.

revoke truncate on all tables in schema public from anon, authenticated;

-- Prevent future tables created by the migration owner from reintroducing the
-- same unsafe baseline. Row-level write authority remains governed by explicit
-- INSERT/UPDATE/DELETE grants plus RLS/RPC contracts.
alter default privileges in schema public revoke truncate on tables from anon, authenticated;
