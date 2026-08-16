-- Worker Engine authority-plane hardening.
-- Forward-only: do not rewrite historical migrations.
--
-- Invariant: possession of service_role is infrastructure privilege, not Worker
-- Engine authority. Authority-bearing state may be consumed through approved
-- SECURITY DEFINER functions, but direct service-role DML must not be an
-- alternative authority issuance/widening path.

-- Explicit security declaration: these relations are internal authority-plane
-- state. RLS remains enabled, and application roles receive no direct DML.

revoke all on table public.hq_workforce_capability_grants from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.hq_workforce_capability_grants from service_role;
grant select on table public.hq_workforce_capability_grants to service_role;

revoke all on table public.hq_workforce_certifications from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.hq_workforce_certifications from service_role;
grant select on table public.hq_workforce_certifications to service_role;

revoke all on table public.hq_workforce_creation_contracts from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.hq_workforce_creation_contracts from service_role;
grant select on table public.hq_workforce_creation_contracts to service_role;

revoke all on table public.hq_workforce_runtime_policies from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.hq_workforce_runtime_policies from service_role;
grant select on table public.hq_workforce_runtime_policies to service_role;

revoke all on table public.hq_workforce_workers from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.hq_workforce_workers from service_role;
grant select on table public.hq_workforce_workers to service_role;

-- Preserve fail-safe revocation as a narrow gateway. It may only reduce
-- authority and requires a non-empty reason; it cannot issue or widen authority.
revoke all on function public.hq_workforce_revoke_certification(text, text) from public, anon, authenticated;
grant execute on function public.hq_workforce_revoke_certification(text, text) to service_role;

revoke all on function public.hq_workforce_revoke_identity(text, text) from public, anon, authenticated;
grant execute on function public.hq_workforce_revoke_identity(text, text) to service_role;

-- Assertion helpers are read/decision surfaces, not mutation gateways.
revoke all on function public.hq_workforce_assert_certification(text) from public, anon, authenticated;
grant execute on function public.hq_workforce_assert_certification(text) to service_role;

revoke all on function public.hq_workforce_assert_capability(text, text, text, text) from public, anon, authenticated;
grant execute on function public.hq_workforce_assert_capability(text, text, text, text) to service_role;

comment on table public.hq_workforce_capability_grants is
  'Worker Engine internal authority state. Direct service-role DML is revoked; authority is governed by certified internal gateways.';
comment on table public.hq_workforce_certifications is
  'Worker Engine internal certification evidence. Direct service-role DML is revoked; issuance remains internal and revocation is a narrow fail-safe gateway.';
comment on table public.hq_workforce_creation_contracts is
  'Worker Engine internal creation authority contracts. Direct service-role DML is revoked.';
comment on table public.hq_workforce_runtime_policies is
  'Worker Engine internal runtime policy state. Direct service-role DML is revoked; policy changes require a separately governed operator path.';
comment on table public.hq_workforce_workers is
  'Worker Engine internal worker registry. Direct service-role DML is revoked; worker creation/lifecycle changes must traverse internal governed functions.';
