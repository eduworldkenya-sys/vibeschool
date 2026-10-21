# Success Wishes delivery checkpoint

Status: implementation in progress; NOT CERTIFIED. Service defaults OFF.
Base: 22af786b62620618e230f582fd7861c98febfa82. Branch: feat/success-wishes.

## Delivered in this branch

- Public sender and private-inbox interfaces, responsive CSS, school access form.
- Participating canonical school projection; no public learner search.
- Sponsored text submission API, recipient matching contract, capability-based withdrawal and idempotent retry.
- Secure guest sessions with school/enrollment/epoch/expiry revalidation.
- Candidate accepts requests before content appears; hide/report actions.
- Staff code issuance via existing authenticated school-admin authority.
- Cloudflare private-video adapter with injected-fetch tests; not connected to a user upload endpoint.
- Proposed private schema, atomic limiter/actions, audited reset and bounded cleanup.
- School-scoped staff candidate lookup and administrator school picker; no public learner list.
- Explicit school consent/opt-in, opt-out with guest session revocation, and school abuse-report resolution contracts. Staff onboarding has an independent, default-OFF `SUCCESS_WISHES_STAFF_SETUP_ENABLED` guard so school preparation does not turn on public sending.
- Staff report queue showing reason/time only; message content and attachments remain private.
- Optional 30-minute browser-tab draft with explicit restore/discard; off by default for shared devices.
- Retry payload binding, stale inbox-response invalidation, fail-closed logout cookie and corresponding tests.
- Dedicated GitHub Actions Success Wishes contracts gate (17 unit/contract checks and disabled-service HTTP smoke).

## Boundaries

No schema was applied, no school opted in, no real messages created and no payments initiated. M-Pesa initiation was independently queried and is OFF. The schema is deliberately a proposal in docs, not an executable migration in an unowned scope.

Text submission works only after schema verification/installation, explicit service configuration, school opt-in, pre-issued inbox, and explicit school sponsorship. It does not bypass a paid checkout: unsponsored submissions are refused.

Media controls are local previews only. Video hosting adapter tests use injected provider responses; they do not prove a live upload. Voice hosting, media quota reservation, upload/retry reconciliation, guest checkout, refunds and ongoing media cleanup are not implemented.

## Requirement ledger

| Requirement | Current evidence / state |
|---|---|
| Canonical identities | Code/migration inspection plus live metadata inspection; no new identities |
| Public school selection | API/UI written; opted-in data contract not executed |
| Recipient matching | Proposed SQL; runtime unverified |
| Text | Sponsored path written; live send/receive blocked by schema |
| Voice/video | Local previews and video provider adapter only; incomplete |
| Draft/retry recovery | Opt-in 30-minute tab-only draft and retry capability added; actual shared-device/browser E2E still unverified |
| Payment | Canonical authenticated commerce inspected; guest extension incomplete |
| Inbox privacy | Server checks and tests; live isolation unverified |
| Invitation | Not implemented |
| Reporting/withdrawal | Candidate report/withdraw plus authorised staff triage and audit contracts written; live DB unverified |
| Sender blocking | Not implemented; current action hides a message only |
| Access recovery | Staff RPC/form written; execution unverified |
| Retention | Bounded SQL proposal and provider scheduled deletion; scheduled operational cleanup incomplete |
| School operations | Administrator school/candidate picker, opt-in/out and report interface written; delivery pilot unverified |
| Android/shared devices | CSS and sign-out logic written; visual/device tests unverified |
| Required CI/merge/production | Scoped contract suite passes on committed heads; exact-head full build, DB/media/payment integration, independent QA, merge and live activation remain release gates |

## Release blockers and owners

1. School-management features added after the baseline are still code/proposal only: candidate search, school opt-in/out, report resolution, private draft recovery. The SQL functions and APIs have not been installed in production; include them in the canonical migration after reconciliation and test role isolation.
2. Migration ownership: teacher mission CYBORG-20261011060017-a545fa holds unreleased supabase/migrations, supabase/tests and scripts scopes. Coordinate an additive migration lease without releasing its unrelated work. Owner: repository mission coordinator.
3. Database proof: turn reviewed proposal into a canonical migration, reconstruct, verify RLS/grants and run two-school/candidate tests. Owner: database engineer after scope coordination.
4. Hosting: configure an approved video provider and private voice storage; implement bounded upload lifecycle, reconciliation, signed playback and deletion. Owner: media engineer/provider account owner.
5. Commerce: extend canonical commerce for guest message orders, verified settlement, retries and refunds. Preserve initiation kill switch until authorised commissioning. Owner: payments engineer/account owner.
6. Product closure: invitation, durable sender recovery, real sender blocking and school delivery/support workflow. Owner: product/backend.
7. Environment: browser executable unavailable; download returned invalid archive. Complete actual Android-width visual and shared-device tests in a working browser environment. Owner: QA.
8. Independent assurance, exact-head CI, preview, merge and post-merge production tests remain outstanding. Owner: release lead/QA.

## Rollback and activation

Keep `SUCCESS_WISHES_ENABLED` unset/false until all release gates pass. `SUCCESS_WISHES_STAFF_SETUP_ENABLED` is independent, defaults OFF, and requires a separately reviewed schema, credentials, school administrator permissions and staff pilot approval. No existing Teacher OS or identity writers are changed. If enabled later, disabling that flag closes this API. Provider uploads/payments must have separate verified readiness and canonical activation gates. Do not delete tables or messages as a code rollback. Revoke sessions/capabilities, preserve necessary payment/audit records, and follow retention policy for personal content.

## Verify locally

```
node --import ./scripts/register-typescript.mjs --import ./lib/success-wishes/test-resolver.mjs --test lib/success-wishes/*.test.ts
npm run typecheck
node node_modules/next/dist/bin/next lint --dir app/api/success-wishes --dir app/success-wishes --dir components/success-wishes --dir lib/success-wishes
node lib/success-wishes/http-check.cjs
node lib/success-wishes/browser-check.cjs
```

HTTP test starts its own disabled-service dev server; browser test requires an existing localhost:3000 server and Playwright Chromium. Neither constitutes funded media delivery or production verification.
