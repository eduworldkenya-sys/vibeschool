begin;

-- Task 3 reconciliation with the canonical Task 1 verified-relationship boundary.
-- Earlier Task 3 work made direct parent child creation retry-safe, but Task 1
-- production attack testing established that ordinary Parents must not be able to
-- manufacture canonical learners or parent relationships at all.
--
-- PostgreSQL preserves input parameter names across CREATE OR REPLACE. The earlier
-- Task 3 implementation used p_name/p_dob while the canonical Task 1 compatibility
-- tombstone uses p_child_name/p_date_of_birth. There are no database dependants on
-- this RPC, so replace the obsolete callable atomically with the canonical deny
-- signature instead of leaving reconstruction sensitive to historical arg names.
drop function if exists public.create_child_for_parent(text,date,uuid);

create function public.create_child_for_parent(
  p_child_name text,
  p_date_of_birth date,
  p_class_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  raise exception 'verified_parent_child_relationship_required' using errcode='42501';
end;
$$;

revoke all on function public.create_child_for_parent(text,date,uuid)
  from public, anon, authenticated, service_role;

comment on function public.create_child_for_parent(text,date,uuid) is
  'Disabled compatibility tombstone. Canonical learner relationships require verified school/claim evidence.';

-- Historical receipt rows remain evidence and are never deleted. New parent
-- creation receipts cannot be generated because the RPC is no longer executable.
-- Keep the operation value accepted for reconstruction/history compatibility.

commit;
