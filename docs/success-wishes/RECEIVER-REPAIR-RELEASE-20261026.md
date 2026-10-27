# Receiver repair release — 26 October 2026

This release repairs the receiver access, consent, recovery and support boundary. It does not certify public launch or claim a 10/10 rating. Checkout and M-Pesa infrastructure remain outside its scope.

## Implemented behaviour

- A copied card link/code identifies an envelope but cannot reveal a message until the intended receiver verifies the registered contact on that device. An unrelated receiver session is rejected. The sender remains hidden until reveal.
- Either sign-out revokes both receiver capabilities and clears both cookies, even when public receiver access is stopped. Local content clears on errors; another tab receives a non-sensitive logout signal. Visibility revalidation does not reload and lose an OTP form. Late reveal responses cannot restore content after logout.
- Ordinary verification does not rotate an existing recovery secret. A lost code can be explicitly replaced only after a fresh verification; the UI explains invalidation of the old code. If the replacement response is lost, the original card link plus another OTP verification remains the replacement route.
- Grant and withdrawal have distinct OTP purposes and action-labelled SMS. Atomic SQL consumes the OTP, changes consent, records the exact notice version and removes both session types on withdrawal. Consent records are append-only for the service role.
- Authenticated school-linked guardians can withdraw with public receiver flags OFF. SMS still requires its separate kill switch/provider settings. No-account or lost-phone rights requests use the existing Contact route and require manual authority review; this is not automatic phone-based proof of guardianship.
- School administrators have a receiver-specific privacy case queue, scoped through original school provisioning. It records reviewed/completed/rejected case transitions with an append-only evidence reference. Closing a case attests to completed manual work: it does not itself export or erase records.
- Saved envelope colour follows the card theme, not list position; code-entry links are corrected; guardian loading/action errors are separate; a slow/failed reveal keeps the envelope closed instead of showing placeholder content.

## Database and release order

Apply `20261026183710_success_wishes_receiver_access_hardening.sql` after the six existing receiver migrations, before deploying code that calls the new consent/privacy RPCs. It adds two private audit tables and service-only functions, widens purpose constraints, and preserves direct client denials. It enables no public capability and sends no SMS.

The migration was initially created by `supabase migration new`, restored after a scratch reset, and then named to match version 20261026183710 assigned by the production Supabase migration tool. The SQL content is unchanged from the tested candidate. Production verification confirmed both audit tables have RLS, no anon/authenticated SELECT, no service-role UPDATE/DELETE, and both new RPCs deny anon/authenticated EXECUTE. Do not edit already-applied historical migrations.

Rollback: keep public access disabled. The additive tables/functions may remain; do not remove evidence or restore the previous partial logout/bearer disclosure behaviour merely to roll back UI. Withdrawal OTPs created under the new purposes cannot be redeemed by old code. Use a forward repair if required.

## Verification contract

1. Run all wishes Node contract tests, including actual Next handler/Supabase-client tests with explicitly stubbed Auth/PostgREST/SMS transports. These do not prove production DB or handset delivery.
2. Disposable PostgreSQL CI applies the new migration and `receiver-hardening-assertions.sql`: wrong/expired/replayed/action-swapped OTP denial, event accounting, removal of both session types, cross-school privacy denial, mandatory review transition and public/append-only grant checks.
3. Browser CI runs mock receiver flows at 320/360/390/412/768/1280px, incorrect OTP recovery, delayed reveal plus logout, and second-tab purge. Existing disabled browser safety must also pass. These are UI proofs, not DB-backed SMS certification.
4. TypeScript, lint, production build, migration security and governance checks must pass on the final exact PR head. Record actual outcomes in the PR; never infer them from this checklist.
5. Independently review the exact diff, then verify merge SHA, deployment SHA and production schema separately. A green CI run does not authorise public activation.

Local consent/privacy SQL reconstruction can use PGlite without pgcrypto, but that limited run deliberately does not exercise cryptographic card issuance. The PostgreSQL CI run retains real pgcrypto and the full existing fixture sequence. Local build/browser infrastructure failures must be reported separately from product failures; CI remains the exact-head authority when the local native runtime is unavailable.

## Gates that this release does not close

The 17-issue audit remains authoritative by issue, with these bounded dispositions:

| Audit item | Disposition |
|---|---|
| R01 confirmed-gift issuance/handoff | Still open: adjacent confirmed-gift contract must bind immutable receiver/card details, invoke issuer and recover one-time delivery material safely. No fake settlements in production. |
| R02 production configuration | Remains OFF pending commissioning; receiver/base URL/verification secret and provider configuration require verification. |
| R03 identity/guardian authority and pre-consent processing | Technical consent audit improved; school procedure, correct guardian authority and legal/privacy review remain owner gates. A phone OTP is not legal guardianship proof. |
| R04 copied-link disclosure | Repaired by receiver-bound device verification; handler and browser proof required. |
| R05 partial logout | Repaired, including stale tab and late-response handling; exact-head verification required. |
| R06 SMS reliability | Still open: real account/sender approval, funded balance, actual handset delivery, trusted delivery reports, durable safe retry/uncertain-submission handling and cost reconciliation. Provider acceptance is not handset delivery. |
| R07 privacy/support | Queue and audited manual transitions added; assign a named trained operator, response targets and account-free authority-verification procedure. Demonstrate actual export/deletion/correction/abuse handling before pilot. |
| R08 enabled API isolation | Actual handlers tested with stub transports; full enabled DB-backed browser journey and supervised real-school evidence remain required. |
| R09 recovery rotation | Repaired for normal verification; explicit lost-code reissue supported. Lost phone plus lost card access still needs verified support. |
| R10 action separation/rate limits | Distinct withdrawal purposes, action-labelled SMS and 60-second receiver cooldown added. Shared-phone quota/cost-abuse operational evidence remains required. |
| R11 access revocation | Existing card sessions now recheck card access revocation/expiry. |
| R12 public/adult identity onboarding | Deferred outside the restricted school-minor pilot; not completed or advertised as generally available. |
| R13 retention | Still open: implement/operate approved expiry-to-erasure/anonymisation policy, legal holds and backup retention; access expiry alone does not erase records. |
| R14 UX/mobile | Core defects repaired and six-width mock tests added; physical low-cost Android, SMS-app transition and intermittent-network proof remain unverified until performed. |
| R15 unwanted-sender blocking | New receiver reporting queue available; manual known-sender containment only for a tiny supervised pilot. Automatic sender restriction remains required before expansion. |
| R16 request-a-wish | Defer for first pilot; current links remain prefill-only without authoritative confirmed-gift binding. |
| R17 theme/wording | Theme consistency and entry/recovery wording repaired. |

## Minimum pilot operations

Before collecting real minor data, assign the school verifier and privacy/support owner; approve the notice and prior-authorisation basis; verify guardian authority and school records. Limit admission to one school and 5–10 invited minors with known guardians/senders. Keep adults/external schools/request-a-wish out of the pilot.

For every support case: verify authority without asking for OTPs or full private links; log a case reference; investigate only necessary records; perform the authorised correction/export/deletion or record a lawful refusal/hold; only then close the queue item. Never place message text, passwords, tokens or identity documents into evidence-reference fields. Test an account-free lost-access request, a content report and an access/deletion request with synthetic records before taking real cases.

Provider delivery and gift handoff, legal/guardian procedure, retention operations and real participants are hard gates. No environment switch or numerical rating substitutes for them. This release therefore cannot truthfully be described as all audit findings closed, 100/100 launch-ready or production-certified.
