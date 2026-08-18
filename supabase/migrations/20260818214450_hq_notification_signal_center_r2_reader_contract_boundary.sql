-- HQ Notifications R2 return-contract boundary.
-- PostgreSQL cannot CREATE OR REPLACE a function when its RETURNS TABLE shape changes.
-- This ordered migration removes the old owner-only reader immediately before R2 recreates it.

begin;

drop function if exists public.hq_list_notifications(integer);

commit;
