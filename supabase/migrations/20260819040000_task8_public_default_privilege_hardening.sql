-- Task 8 — future-object least privilege for the public API schema.
--
-- Existing-object revokes are not sufficient: Postgres default ACLs can silently
-- reintroduce structural table privileges and direct function EXECUTE on objects
-- created after Task 8. Keep normal DML grants explicit per domain.
-- This migration intentionally touches public only; managed storage/graphql
-- schemas remain owned by their platform-specific security model.
--
-- VibeSchool's certified Supabase reconstruction currently runs PostgreSQL 15.
-- MAINTAIN is a later PostgreSQL table privilege and is intentionally omitted here;
-- revoking unsupported syntax would make the security migration itself unreplayable.

-- Application migrations normally create public objects as postgres.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Some Supabase-managed operations create objects as supabase_admin. PostgreSQL
-- permits ALTER DEFAULT PRIVILEGES FOR ROLE only when the executing migration role
-- is that role or a member of it. Local/reconstruction environments intentionally
-- do not grant that membership. Apply the managed-role hardening whenever the
-- migration executor has legitimate authority; otherwise leave the managed role's
-- ACL ownership untouched instead of requiring privilege escalation to reconstruct.
do $$
begin
  if pg_has_role(current_user, 'supabase_admin', 'member') then
    execute 'alter default privileges for role supabase_admin in schema public revoke truncate, references, trigger on tables from anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke update on sequences from anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from public, anon, authenticated';
  end if;
end
$$;

-- Existing public relations always lose structural privileges regardless of creator.
-- This repeats the earlier Task 8 invariant deliberately so reconstruction and
-- upgrades end in the same client-facing state even when default-ACL ownership
-- differs between local and managed Supabase environments.
do $$
declare
  r record;
begin
  for r in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke truncate, references, trigger on table %I.%I from anon, authenticated',
      r.nspname,
      r.relname
    );
  end loop;
end
$$;
