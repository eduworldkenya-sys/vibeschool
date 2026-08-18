-- Production auth recovery: keep the canonical onboarding resolver visible and callable through PostgREST.
-- This is a metadata/security repair only; it does not change role or destination semantics.

alter function public.get_my_onboarding_state() stable;
alter function public.get_my_onboarding_state() security invoker;

revoke all on function public.get_my_onboarding_state() from public, anon;
grant execute on function public.get_my_onboarding_state() to authenticated, service_role;

comment on function public.get_my_onboarding_state() is
  'Canonical authenticated onboarding resolver. Exposed to authenticated/service_role through PostgREST; fail-closed client routing authority.';

select pg_notify('pgrst','reload schema');
