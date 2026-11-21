# Live Voice — two-account Daily pilot (21 November 2026)

**Owner-approved pilot**: use the existing Daily integration for a private trial with the authenticated Mumbi2 teacher account and the linked Test Student login. This is an isolated-in-authority production pilot, NOT permission to activate audio for every account. The production database has other registered accounts, so a user assertion that there are no real customers is not an authorization mechanism.

## Release boundary

- `NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED=true`: shows voice join/mic controls in the current Live classroom.
- `VIBE_LIVE_VOICE_SERVER_ENABLED=true`: permits the canonical authenticated token endpoint.
- `VIBE_LIVE_VOICE_ACCESS_SCOPE=pilot`: required. Other/missing values fail closed (HTTP 503).
- `VIBE_LIVE_VOICE_PILOT_USER_IDS=<comma-separated *authenticated* Supabase UUIDs>`: must contain **only** the intended teacher and test learner user IDs, not student-record IDs. No ID list is compiled into client code. Other/missing/malformed IDs fail closed (403).
- `VIBE_LIVE_VOICE_PILOT_UNTIL=<UTC ISO timestamp>`: finite pilot expiry. After expiry, new audio tokens are denied (503) while authorized teacher room closure remains possible.
- `DAILY_API_KEY`: server-side sensitive secret, unchanged and never shared with a preview client.
- Set the three server-only pilot variables **before** both activation switches. Enable the public switch before the server switch only after the updated exact-head code is merged, checked and deployed. Never set these flags on stale unguarded deployments.
- `VIBE_LIVE_VOICE_ACCESS_SCOPE=pilot` does **not** replace `vibe_live_command(get)`, real JWT authentication, school/tuition/homeschool membership, active-lesson status, role mapping, learner identity or raised-hand acknowledgement. Every request passes **both** the allowlist and canonical authorization checks.

## Critical behavior and limitations

- The teacher voluntarily joins audio then clicks Speak to request mic capture from the browser. Learners join receive-only and individually grant their microphone only after teacher acknowledgement and provider participant permission.
- A two-account allowlist protects **new token issuance**, not previously admitted provider participants. Media meeting tokens are valid for at most 120 seconds and request provider ejection at expiry. Live provider enforcement must be verified in the pilot; no claim of immediate server-side revocation is made.
- The client UI can show Join audio to other eligible Live users because the build-time voice UI switch is global; the server must return 403 before contacting Daily for anyone outside the pilot. A separate per-user UI eligibility check is future work. Do not equate a visible icon with audio permission.
- No video, recording, transcription, public rooms or learner self-approval.
- Owner confirmation of pilot use is not evidence of no other database accounts, current Daily credit, real device sound/permissions, provider participant-admin behavior or end-to-end security assurance.

## Required acceptance / evidence log before widening

1. Two actual authenticated devices, one signed in to Mumbi2 and the other to Test Student, in the **same authorized active Live session**.
2. Both audio tokens issued server-side; room private; no unauthorized session/cross-tenant/third-account joins. Attempt a third account: expect 403 before provider interaction.
3. Teacher hears a device permission prompt, starts/mutes/restarts mic; student hears teacher.
4. Student raise hand; teacher acknowledges; student mic stays off until student taps Speak. Teacher revokes: student can no longer publish.
5. End session, sign out, mobile-data/Wi-Fi handoff, refresh, expired token, background/suspended browser and forced disconnect. Verify end/expiry provider ejects.
6. Verify provider account free-credit/billing exposure, logs and budget. Stop if unexpected billing or privacy behavior occurs.
7. Record device models, session mode, time, evidence, security reviewer, and exact released Git SHA. These steps have NOT been proven by repo unit tests.

## Rollback

Immediately set `VIBE_LIVE_VOICE_SERVER_ENABLED=false` and redeploy production to stop new media token issuance; set the public flag false and redeploy to restore disabled UI. Existing Daily room participants must be independently ejected or rooms deleted by authorized provider API; flags alone do not immediately drop existing connections.

This pilot is not broad production authorization. Do not remove `VIBE_LIVE_VOICE_ACCESS_SCOPE=pilot` or the allowlist until separate security/operational commissioning.
