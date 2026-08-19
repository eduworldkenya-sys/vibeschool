-- Task 8 — post-merge production authorization reconciliation.
--
-- This migration repairs authorization drift proven against production after the
-- historical Task 8 merge. It is intentionally additive: do not edit or replay
-- the historical Task 8 migrations as if they were new production work.
--
-- Invariants enforced here:
--   * future postgres-created public objects are opt-in for ordinary clients
--   * ordinary clients retain no structural relation authority
--   * ordinary clients cannot UPDATE public sequences
--   * future public functions require explicit EXECUTE grants
--   * the legacy same-school homework-photo SELECT policy cannot OR-bypass the
--     current Teacher -> class -> learner relationship policy
--
-- PostgreSQL 15 remains the repository reconstruction baseline while production
-- currently runs PostgreSQL 17. MAINTAIN is therefore revoked through dynamic
-- SQL only when the server supports it.

-- Future objects created by the application migration owner must be explicitly
-- exposed. Existing objects are not stripped of normal DML here; their current
-- grants + RLS remain the compatibility boundary.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- PostgreSQL 17 introduced MAINTAIN as a table privilege. Keep the migration
-- parseable on PostgreSQL 15 by using dynamic SQL behind a version guard.
do $task8$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end
$task8$;

-- Supabase's internal supabase_admin role owns a separate default ACL. PostgreSQL
-- only permits a non-superuser migration role to alter another role's defaults
-- when it has legitimate role authority. Apply the same hardening when that
-- authority exists (for example in an environment whose executor is a member),
-- but never manufacture role membership or escalate solely to mutate a managed
-- internal role.
do $task8$
begin
  if current_user = 'supabase_admin' or pg_has_role(current_user, 'supabase_admin', 'member') then
    execute 'alter default privileges for role supabase_admin in schema public revoke select, insert, update, delete, truncate, references, trigger on tables from anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke usage, select, update on sequences from anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from public, anon, authenticated';

    if current_setting('server_version_num')::integer >= 170000 then
      execute 'alter default privileges for role supabase_admin in schema public revoke maintain on tables from anon, authenticated';
    end if;
  end if;
end
$task8$;

-- Existing relations always lose structural privileges. ON ALL TABLES covers
-- tables, partitions, views and materialized views in the schema. This is safe
-- for ordinary clients because structural privileges are not required for normal
-- SELECT/INSERT/UPDATE/DELETE application traffic.
revoke truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

do $task8$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
  end if;
end
$task8$;

-- Ordinary client roles do not need to advance database sequences directly.
revoke update on all sequences in schema public from anon, authenticated;

-- Remove the exact permissive Storage policies previously proven capable of
-- broadening homework-photo visibility through PostgreSQL's OR semantics.
drop policy if exists storage_objects_homework_photos_staff_select on storage.objects;
drop policy if exists homework_photos_school_staff_select on storage.objects;
drop policy if exists homework_photos_staff_read on storage.objects;

-- Fail the migration if the client-facing postconditions controlled by this
-- migration are not actually true. Managed supabase_admin default ACL ownership
-- is certified separately because the application migration role may not have
-- authority to mutate that internal role.
do $task8$
declare
  unsafe_relations bigint;
  unsafe_sequences bigint;
  legacy_homework_policies bigint;
begin
  select count(*)
    into unsafe_relations
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p','v','m','f')
    and (
      has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('anon', c.oid, 'REFERENCES')
      or has_table_privilege('anon', c.oid, 'TRIGGER')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'REFERENCES')
      or has_table_privilege('authenticated', c.oid, 'TRIGGER')
    );

  if unsafe_relations <> 0 then
    raise exception 'TASK8_POSTMERGE: % public relations retain ordinary-client structural privileges', unsafe_relations;
  end if;

  if current_setting('server_version_num')::integer >= 170000 then
    execute $sql$
      select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r','p','v','m','f')
        and (
          has_table_privilege('anon', c.oid, 'MAINTAIN')
          or has_table_privilege('authenticated', c.oid, 'MAINTAIN')
        )
    $sql$ into unsafe_relations;

    if unsafe_relations <> 0 then
      raise exception 'TASK8_POSTMERGE: % public relations retain ordinary-client MAINTAIN', unsafe_relations;
    end if;
  end if;

  select count(*)
    into unsafe_sequences
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'S'
    and (
      has_sequence_privilege('anon', c.oid, 'UPDATE')
      or has_sequence_privilege('authenticated', c.oid, 'UPDATE')
    );

  if unsafe_sequences <> 0 then
    raise exception 'TASK8_POSTMERGE: % public sequences retain ordinary-client UPDATE', unsafe_sequences;
  end if;

  select count(*)
    into legacy_homework_policies
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'storage_objects_homework_photos_staff_select',
      'homework_photos_school_staff_select',
      'homework_photos_staff_read'
    );

  if legacy_homework_policies <> 0 then
    raise exception 'TASK8_POSTMERGE: legacy homework Storage policy survived cleanup';
  end if;
end
$task8$;
