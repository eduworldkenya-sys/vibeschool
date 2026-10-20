# Success Wishes — independent assurance

Decision: **NOT CERTIFIED**. This review does not authorise merge or launch.

Assessor: `/root/assurance`, separate from implementation agents. Review performed against an uncommitted worktree based on `22af786b62620618e230f582fd7861c98febfa82`, branch `feat/success-wishes`, on 2026-10-20. This is a changing candidate, not an immutable release revision. Any material repair requires fresh review. Risk is high: child identity, guest access capabilities and intended payments.

## Evidence collected independently

- Read API routes, security/validation helpers, media adapter, SQL proposal and frontend.
- Ran `node --import ./scripts/register-typescript.mjs --test lib/success-wishes/media.test.ts`: six tests passed. Fetch is injected; no real provider or paid request was made.
- Added and ran six reproducible tests in `lib/success-wishes/security.test.ts` (including the original 14 assertions and additional abuse inputs). Also proved the safety test fails when a temporary copy forces `enabled()` to return true. Coverage: configuration fails closed without credentials; access-code normalization; mismatch and malformed hash rejection; 256-bit token length; valid text submission; rejection of missing consent, malformed UUID, unsupported format, oversized body, control character and invalid idempotency key.
- Inspected service-worker public-route allowlist. Wishes pages are absent and API requests are excluded. This is static evidence, not a browser-cache/sign-out test.
- SQL is explicitly a proposal under docs. It has not been migrated, reconstructed or exercised against PostgreSQL by this assessor.

## Findings sent to delivery lead

| ID | Severity | Finding | Required repair/proof |
|---|---|---|---|
| SW-A01 | High | Login and session validation do not revalidate current school enrollment. A removed/transferred learner's existing inbox capability can survive until expiry. | Check canonical current enrollment and non-deleted learner/school on every protected operation; test removal and cross-school denial. |
| SW-A02 | High | Text withdrawal sets `body=null`, but proposed table CHECK requires nonempty body for all text rows. Withdrawal fails. | Permit erased content for withdrawn/expired state or use a compatible deletion lifecycle; execute regression against real constraints. |
| SW-A03 | Medium | Report action changes message state but writes no report/reason into the reports table. | Persist report with a support-review workflow and ensure transactional failure handling. |
| SW-A04 | Medium | Lost initial submission response loses sender management token; idempotent retry returns no reference/token. | Recover using a sender-held capability supplied before submission or an equivalent authenticated recovery design; test lost response. |
| SW-A05 | Low | Session expiry `Date.parse(x) <= now` admits malformed dates as NaN. DB type protects normal values, but helper should fail closed. | Require a finite future timestamp; negative control. |

Fresh static re-review observed repairs for SW-A01 (eligible enrollment checks at login and each session), SW-A02 (withdrawn/expired content permitted), SW-A03 (atomic message action RPC inserts report and audit), SW-A04 (management capability deterministically recovered from caller-held idempotency key and scoped retry), and SW-A05 (strict future-date checks). SQL and full API execution are still unverified; these findings are **statically addressed, runtime proof pending**, not certified repaired.

Additional finding SW-A06 (Medium): UI says “Block sender” but the backend hides one message only. No verified sender identity or sender-block list exists. Rename to “Hide message” and retain actual sender blocking as an unresolved product gate, or implement the promised behavior. A sender can submit another message today.

## Remaining release blockers

- Migration scope is owned by another active mission; schema remains unapplied and SQL runtime/permissions tests are missing.
- Text is only a school-sponsored proposed slice. Payment checkout, settlement, refunds and guest commerce are not implemented.
- Voice/video upload and playback are not connected to public endpoints or inbox. Provider credentials, real format/duration/upload-retry and cost enforcement are unverified.
- Staff participation setup/code distribution/support interface is missing. SQL reset function alone is not an operational workflow.
- Retention only filters expiry; physical content deletion, storage cleanup and backup-retention handling need implementation and verification.
- Existing authenticated student inbox entry is not implemented.
- No two-school/two-student database isolation proof, real browser full journey, exact-head CI, PR review, merged main, deployed revision or post-deployment smoke evidence.
- Sender identity is a label, not verified identity. Message requests reduce immediate exposure but do not prevent impersonation or repeated unwanted submissions. School/recipient-level quotas are vulnerable to targeted denial of service; sender verification and abuse controls remain unresolved.

## Release assessment

No release score is awarded. The candidate is not immutable, required full-service journeys are incomplete and database/integration evidence is missing. Source inspection and helper tests cannot establish a 9/10 production score.

| Area | Evidence state |
|---|---|
| Functionality | Partial text/API implementation; media, commerce and school journeys incomplete |
| Usability | States present in source; complete browser journey unverified |
| Privacy/security | Core capability tests pass; live isolation/recovery proof missing |
| Reliability | Six adapter and six independent security tests pass; DB/concurrency/network proof missing |
| Payments | Unavailable, no paid journey proven |
| School operations | Contracts/reset proposal, no complete staff workflow |
| Maintainability | Bounded directories; exact candidate, CI and runtime contract evidence pending |

Overall: **NOT READY / NOT CERTIFIED**. No production mutation was performed by this assessor. This decision must be refreshed against a committed candidate after material changes.
