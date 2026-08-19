-- Task 8 — future-object least privilege for the public API schema.
--
-- Existing-object revokes are not sufficient: Supabase/Postgres default ACLs can
-- silently reintroduce structural table privileges and direct function EXECUTE
-- on objects created after Task 8. Keep normal DML grants explicit per domain.
-- This migration intentionally touches public only; managed storage/graphql
-- schemas remain owned by their platform-specific security model.

-- Migrations normally create application objects as postgres.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Supabase-managed migrations/extensions can create public API objects as
-- supabase_admin. Harden that creation path as well so new public objects do not
-- regain broad client authority merely because of their creator role.
alter default privileges for role supabase_admin in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke update on sequences from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from public, anon, authenticated;

-- Existing public relations must also lose structural privileges. This repeats
-- the earlier Task 8 invariant deliberately so reconstruction and upgrades end
-- in the same state even if an intermediate migration created another relation.
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
      'revoke truncate, references, trigger, maintain on table %I.%I from anon, authenticated',
      r.nspname,
      r.relname
    );
  end loop;
end
$$;
