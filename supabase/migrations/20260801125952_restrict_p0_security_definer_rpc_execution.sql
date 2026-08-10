-- Duplicate production-ledger entry retained for parity. The immediately
-- preceding 20260801125800 migration conditionally hardens every known exact
-- signature and is the canonical repository implementation.
do $$
begin
  raise notice 'P0 hardening duplicate: canonical migration already applied';
end;
$$;
