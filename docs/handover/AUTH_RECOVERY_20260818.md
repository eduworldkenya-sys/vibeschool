# Auth recovery handover — 2026-08-18

## Incident

Users could authenticate successfully but were trapped on `/auth/error?reason=onboarding_resolution_failed`. The recovery button pointed to `/login`, while middleware rewrote anonymous `/login` to `/`, making the retry path appear non-responsive.

Production Supabase API logs also showed repeated `404` responses for `POST /rest/v1/rpc/get_my_onboarding_state` while `get_my_auth_access_state` and `auth/v1/user` returned `200`.

## Root causes

1. `middleware.ts` explicitly rewrote anonymous `/login` to the public homepage.
2. Production PostgREST was not exposing the existing `public.get_my_onboarding_state()` resolver from its live schema cache despite the function and authenticated EXECUTE grant existing in PostgreSQL.
3. The first `/login` remediation deployment failed because the page used `styled-jsx` without being a Client Component; that earlier build defect was repaired before this closure branch.

## Remediation

- Removed the anonymous `/login` rewrite. `/login` is now a stable public auth route and renders the dedicated role chooser.
- Applied production migration `20260818201759_auth_onboarding_rpc_schema_visibility_repair` to normalize the onboarding resolver metadata, preserve SECURITY INVOKER, authenticated/service-role-only execution, and force a PostgREST schema reload.
- Added the exact production migration to the repository.
- Added `scripts/test-auth-recovery-routing.mjs` to prevent regression of the `/login` route and RPC visibility contract.

## Safety

- No role authority, learner identity mapping, onboarding destination, or RLS rule was weakened.
- `anon` remains unable to execute `get_my_onboarding_state()`.
- The resolver remains fail-closed and relationship/role routing remains authoritative.
- Production Vercel promotion is deferred until the repository change is complete and merged, to avoid unnecessary hobby-plan deployments.

## Verification required after promotion

1. `GET https://vibeschool.co.ke/login` must match `/login`, not `/`.
2. Anonymous user sees the role chooser.
3. Authenticated sign-in calls both authority RPCs without a 404.
4. A ready account reaches its authorised dashboard; an incomplete account reaches its governed onboarding destination.
5. `/auth/error` retry no longer loops or appears inert.
