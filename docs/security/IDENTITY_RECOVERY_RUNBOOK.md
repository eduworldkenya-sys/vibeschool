# Security & Identity — Account Recovery Runbook

Owner: HQ / Security & Identity

## Authority boundaries
- HQ owner recovery is a dedicated, isolated authentication surface.
- HQ recovery initiation is owner-only and returns a generic response for every submitted address.
- `hq_check_owner_access` remains the final authority gate; password possession alone never grants HQ authority.
- Admin/Teacher/Student/Parent recovery is separate from HQ owner recovery.
- No operator may view or retrieve an existing password.

## Standard recovery
1. User requests recovery from their product sign-in surface.
2. Supabase sends a recovery link to the account email.
3. The reset page establishes the PKCE recovery session (`exchangeCodeForSession` when a code is present).
4. User chooses a new password.
5. Recovery session is signed out after success.
6. User signs in cleanly with the new credential.

## HQ initiated user recovery
Security & Identity may initiate a recovery email for a user after account lookup and authorization. The user chooses the new password. The action must be recorded in `hq_security_events`; direct password disclosure is forbidden.

## Incident controls
For suspected compromise: revoke sessions, lock/disable access where supported, send user notification, preserve audit evidence, investigate source, restore access only after identity verification.

## Required regression suite
- HQ login does not replace Student/Teacher/Admin/Parent sessions.
- Non-owner authentication never grants HQ access.
- Non-owner HQ recovery request receives a generic response and no HQ recovery email.
- Owner recovery link opens the HQ reset UI and permits one valid reset.
- Expired/reused recovery links fail safely.
- Admin recovery link opens Admin reset UI and completes password update.
- Successful recovery signs out the recovery session.
- Admin recovery does not alter an isolated HQ session.
- Password policy rejects weak credentials.
- Security-sensitive actions produce audit evidence.

## Production release gate
Do not merge auth changes to `main` until TypeScript/build checks pass and the real email-link flows have been exercised against the production-equivalent Supabase redirect allowlist. Never weaken owner authority to make a test pass.
