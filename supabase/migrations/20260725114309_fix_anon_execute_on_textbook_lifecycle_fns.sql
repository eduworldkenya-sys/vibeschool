-- This project auto-grants EXECUTE to anon on every new function in public
-- via a default-privileges rule (confirmed via pg_default_acl). Plain
-- `revoke ... from public` does not remove anon's separate explicit grant.
--
-- get_vibetextbook_reader and increment_publication_reads are NOT touched
-- here — anonymous/incognito reading of published free content is a real,
-- tested product requirement and keeps its anon grant.

revoke all on function public.publish_textbook(uuid) from anon;
revoke all on function public.unpublish_textbook(uuid) from anon;
revoke all on function public.remove_textbook_from_vibelearn(uuid) from anon;
revoke all on function public.reconcile_textbook_index(uuid) from anon;
revoke all on function public.sync_vibelearn_textbook_index(uuid) from anon, public;

-- admin_reconcile_vibelearn_textbook_index: real, live gap. No internal
-- auth.uid() check by design (service_role/admin-only tool), so anon
-- execute meant any unauthenticated caller could force a re-sync of any
-- teacher's vibetextbook publication into the marketplace index without
-- consent. service_role/postgres only, as originally intended.
revoke all on function public.admin_reconcile_vibelearn_textbook_index(uuid) from anon, authenticated, public;
