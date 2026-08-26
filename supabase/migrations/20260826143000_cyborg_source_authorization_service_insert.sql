begin;

-- hq_cyborg_register_capability is SECURITY INVOKER and records a replay-proof
-- source authorization after validating the exact Chemistry stage lease.
-- service_role already has only SELECT on this RLS-protected table, which makes
-- the final insert fail with 403. Grant the minimum missing privilege only.
grant insert on table public.hq_cyborg_source_authorizations to service_role;

-- Preserve the deny-by-default posture for browser roles.
revoke all on table public.hq_cyborg_source_authorizations from public, anon, authenticated;

commit;
