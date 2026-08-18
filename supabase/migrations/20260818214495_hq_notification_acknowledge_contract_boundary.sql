-- HQ Notifications R2 acknowledgement return-contract boundary.
-- Production has the legacy owner-only acknowledgement RPC returning void.
-- R2 returns boolean so callers can distinguish a missing/resolved signal.
-- PostgreSQL cannot change a function return type through CREATE OR REPLACE.

begin;

drop function if exists public.hq_acknowledge_notification(uuid);

commit;
