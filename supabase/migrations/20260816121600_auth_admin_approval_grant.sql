-- The approval function contains the authoritative is_platform_owner() gate.
-- It must be callable by an authenticated platform owner session, not anonymous users.
revoke all on function public.approve_pending_school_registration(uuid,text) from public, anon;
grant execute on function public.approve_pending_school_registration(uuid,text) to authenticated;
