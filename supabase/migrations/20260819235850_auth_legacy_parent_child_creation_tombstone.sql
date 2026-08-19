begin;

-- Task 1 owns the verified relationship boundary. Clean reconstruction must not
-- depend on the downstream Task 3 branch having created this historical RPC.
-- Keep the legacy signature only as a fail-closed compatibility tombstone so
-- stale clients receive an authorization failure rather than gaining a learner
-- provisioning path or causing migration-order drift.
create or replace function public.create_child_for_parent(
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

commit;
