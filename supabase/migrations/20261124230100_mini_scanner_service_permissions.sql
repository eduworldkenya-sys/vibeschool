-- access: service-only scanner permissions; no public or authenticated role changes
-- NON-ACTIVATING: requires the existing safety scans migration and separate commissioning.
-- The trusted API reads the submitted version and only updates moderation-owned columns.
grant select on public.mini_lessons, public.mini_requests, public.mini_comments to service_role;
grant update(status,reviewed_at,published_at,moderation_note) on public.mini_lessons to service_role;
grant update(status,reviewed_at,moderation_note,updated_at) on public.mini_requests to service_role;
grant update(status,reviewed_at) on public.mini_comments to service_role;
grant select on public.mini_safety_scans to service_role;
grant update(verdict,reason,model,checked_at,lease_until) on public.mini_safety_scans to service_role;
-- Explicitly preserve the service-only scan log.
revoke all on public.mini_safety_scans from public,anon,authenticated;
