# Auth recovery handover — 2026-08-18

## Incident

Users could authenticate successfully but were trapped on `/auth/error?reason=onboarding_resolution_failed`. The recovery button pointed to `/login`, while middleware rewrote anonymous `/login` to `/`, making the retry path appear non-responsive.

Production Supabase API logs also showed repeated `404` responses for `POST /rest/v1/rpc/get_my_onboarding_state` while `get_my_auth_access_state` and `auth/v1/user` returned `200`.

## Root causes

1. `middleware.ts` explicitly rewrote anonymous `/login` to the public homepage.
2. Production PostgREST continued returning 404 for the existing `public.get_my_onboarding_state()` resolver even after the schema-visibility migration and reload. PostgreSQL itself confirms the function exists, is SECURITY INVOKER, returns `jsonb`, and grants EXECUTE only to `authenticated` and `service_role`.
3. The first `/login` remediation deployment failed because the page used `styled-jsx` without being a Client Component; that earlier build defect was repaired before this closure branch.

## Remediation

- Removed the anonymous `/login` rewrite. `/login` is a stable public auth route and renders the dedicated role chooser.
- Applied production migration `20260818201759_auth_onboarding_rpc_schema_visibility_repair` to normalize the onboarding resolver metadata, preserve SECURITY INVOKER, authenticated/service-role-only execution, and force a PostgREST schema reload.
- Added a fail-closed application fallback specifically for PostgREST `PGRST202` schema-cache misses. It derives the same governed destinations from authenticated relationship data for teacher and parent accounts, `current_student_id()` for learner identity, and fixed role destinations for admin/global users. Other onboarding RPC errors still fail closed.
- Changed the VibeSchool wordmark on the auth error screen to a hard `/` anchor so it always returns to the public home page even if client-side routing is unhealthy.
- Kept `scripts/test-auth-recovery-routing.mjs` as the regression guard for the `/login` route and RPC visibility contract.

## Safety

- No role authority, learner identity mapping, onboarding destination, or RLS rule was weakened.
- `anon` remains unable to execute `get_my_onboarding_state()`.
- The primary resolver remains authoritative; the fallback activates only for the known PostgREST schema-cache miss code.
- Any unrelated resolver error remains fail-closed.
- Production Vercel promotion should occur only after the repository change is certified and merged.

## Verification required after promotion

1. `GET https://vibeschool.co.ke/login` must match `/login`, not `/`.
2. Anonymous user sees the role chooser.
3. The VibeSchool wordmark on `/auth/error` must navigate directly to `/`.
4. A `PGRST202` response from `get_my_onboarding_state` must resolve through the governed fallback rather than loop to the error page.
5. A ready account reaches its authorised dashboard; an incomplete account reaches its governed onboarding destination.
6. Non-`PGRST202` resolver errors continue to fail closed.
