-- HQ Notifications R2 security signal compatibility.
-- Production currently exposes an hq_security_events relation, while a clean repository
-- rebuild has the canonical security_audit_events source plus the owner RPC. Keep the
-- signal collector portable without introducing a second security-event store.

begin;

do $$
begin
  if to_regclass('public.hq_security_events') is null then
    execute $view$
      create view public.hq_security_events
      with (security_invoker = true)
      as
      select event_type, outcome, created_at
      from public.security_audit_events
    $view$;

    revoke all on public.hq_security_events from public, anon, authenticated;
    grant select on public.hq_security_events to service_role;
  end if;
end $$;

commit;
