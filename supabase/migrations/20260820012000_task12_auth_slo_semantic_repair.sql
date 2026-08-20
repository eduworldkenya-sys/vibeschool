-- Task 12 auth SLO semantic repair.
-- The client telemetry ingress is authenticated-only by design, so it cannot truthfully
-- measure pre-auth credential attempts or failures. The pilot auth SLO therefore begins
-- at an authenticated Supabase session and measures completion of the application entry
-- contract: role/identity/onboarding resolution -> authorized workspace reached.
-- Credential-provider failure metrics remain a separate Auth/SRE signal and must not be
-- fabricated from client telemetry.

begin;

update public.pilot_slo_contract
set
  slo_key = 'auth.workspace_entry_after_auth',
  attempt_event_name = 'auth.login_succeeded',
  success_event_name = 'auth.dashboard_reached',
  target_percent = 98.00,
  owner_key = 'authentication',
  updated_at = now()
where journey = 'authentication';

update public.pilot_event_contract
set
  success_semantics = 'Authenticated Supabase session established; begins the post-auth application entry SLI, not a credential-attempt denominator',
  event_class = 'journey_started',
  updated_at = now()
where event_name = 'auth.login_succeeded';

update public.pilot_event_contract
set
  success_semantics = 'Authenticated user resolved through canonical role, identity and onboarding authority and reached an authorized workspace',
  event_class = 'journey_completed',
  updated_at = now()
where event_name = 'auth.dashboard_reached';

comment on table public.pilot_slo_contract is 'Task 12 internal pilot SLI/SLO registry. Auth SLI intentionally starts after authentication because anonymous client events are untrusted and cannot be used as an authoritative credential-attempt denominator.';

commit;
