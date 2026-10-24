# VibeSchool unified commerce — Daraja sandbox-only foundation

**Decision (2026-10-22):** Daraja is the first payment-provider adapter. All existing production merchant/payment controls remain OFF. This contribution is a safe contract and transport foundation, not a new live payment route or proof of actual settlement.

## Verified starting point
- There are **two deployed Supabase Edge payment stacks**:
  - Teacher credits: `mpesa-stk-push`, `mpesa-callback`, `mpesa-payment-status`; legacy `mpesa_payment_attempts`.
  - Learning products: `learning-product-stk-push`, `learning-product-mpesa-callback`; `commerce_payment_attempts`.
- Their callback functions store raw callback evidence then invoke PostgreSQL settlement functions; STK acknowledgement is not settlement.
- Live SQL checked 2026-10-22: `mpesa_runtime_control.initiation_enabled = false`; `commerce_payment_attempts` and `learning_product_orders` each contain 0 rows.
- `commerce_payment_attempts.order_id` is NOT NULL and references `learning_product_orders`; `payer_profile_id` is NOT NULL and references `profiles`. Guest Success Wishes, subscription and other product types **cannot** simply be inserted into this learning-product-only schema.
- Original learning-product and legacy teacher-credit STK code use `CustomerPayBillOnline`; using a Till needs `CustomerBuyGoodsOnline`, correct `PartyB` and proper merchant provisioning.
- Original code formats its Daraja timestamp in UTC; Daraja supplies a Kenya-time `YYYYMMDDHHmmss` timestamp in standard examples. Resolve and regression-test against current provider contract before a real production release.
- Original callbacks guard with a shared secret in query string. Review ingress hardening, rotation, logging and network allowlisting in production; an unauthenticated public webhook body alone must never grant goods.
- No live merchant credentials or operational settlement were verified. The Vercel env list is not evidence of Supabase Edge Function secret values; do not infer their absence/presence.

## Exact official Daraja prerequisites
### Sandbox (no live Till/Paybill required)
1. Register or sign in at https://developer.safaricom.co.ke/ (individual developer accounts are supported).
2. Create a sandbox app with the M-PESA Express product.
3. Obtain **sandbox** Consumer Key and Consumer Secret from that app.
4. Use the M-PESA Express simulator's test shortcode, passkey and test phone; never use a customer's phone for test traffic.
5. Sandbox OAuth: `https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`
6. Sandbox STK: `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest`
7. Test the asynchronous outcome and verify the exact callback body with a dedicated *isolated* callback ingress and persistent payment attempt. Do not count HTTP 200 or `ResponseCode = 0` as payment.

### Production — separate commissioning
1. Obtain an eligible live M-PESA Paybill or Till (or approved merchant contract), with organisation and Business Admin/Manager access.
2. Apply through Daraja **Go Live**, link the merchant shortcode and enable the M-PESA Express API product.
3. Receive and securely provision distinct production Consumer Key/Secret, shortcode/Till configuration and passkey. Confirm `CustomerPayBillOnline` for a Paybill or `CustomerBuyGoodsOnline` for a Till; `PartyB` may differ from `BusinessShortCode` for Till.
4. Configure an externally reachable HTTPS callback, provider-origin protections, immutable callback records and reconciliation.
5. Prove a small authorised real transaction, receipt, settlement, fulfilment and reversal/refund operations with independent QA. Activate `mpesa_runtime_control` **only** as a separate reviewed commissioning step.

Official documentation:
- https://developer.safaricom.co.ke/apis/GettingStarted
- https://developer.safaricom.co.ke/apis/MpesaExpressSimulate
- https://developer.safaricom.co.ke/faqs

## This branch: isolated, runnable core
- `lib/commerce/unified/sandbox.ts`: common typed order covering credits, learning products, exams, wishes, subscriptions and premium features; server-trusted integer KES prices, guest/profile owner contracts, idempotency-key shape, Kenya phone normalization and strict callback matching. Every object is tagged `mode:'sandbox'`. Sandbox settlements **cannot grant live entitlements**.
- `lib/commerce/unified/daraja-sandbox.ts`: isolated Daraja adapter with **hardcoded sandbox host**, preview/development gate and explicit `COMMERCE_DARAJA_SANDBOX_ENABLED=true` plus `MPESA_ENV=sandbox`. It rejects production, real/customer phones other than an explicitly configured simulator test phone, non-HTTPS/different callback targets and missing durable reservation. Test caller must inject or configure a reserved attempt.
- `lib/commerce/unified/sandbox.test.ts`: unit regression using injected fake HTTP responses, **no network, secrets, production calls or database writes**.
- `qa/commerce/unified-sandbox-fixture.sql` and `qa/commerce/unified-sandbox-assertions.sql`: disposable PostgreSQL-only ledger with six product types, guest/profile ownership, immutable price/receipt evidence, duplicate attempts/callback rejection, and private schema/RLS safeguards. **Not a deployable migration.**
- `.github/workflows/unified-commerce-sandbox.yml`: CI TypeScript tests, typecheck and ephemeral PostgreSQL contract verification.
- No **production** Edge Functions, payment migrations, customer data, real payments, or environment values were changed. Three uniquely named staging-only functions and a private sandbox schema are hosted separately.

### Run the test locally
```sh
npm ci --ignore-scripts --no-audit --no-fund
node --import ./scripts/register-typescript.mjs --test lib/commerce/unified/sandbox.test.ts
npm run typecheck
# For disposable Postgres only (as in CI):
# psql -v ON_ERROR_STOP=1 -f qa/commerce/unified-sandbox-fixture.sql
# psql -v ON_ERROR_STOP=1 -f qa/commerce/unified-sandbox-assertions.sql
```

**Do not import the sandbox adapter from a publicly callable production route.** The adapter returns an STK acknowledgement, not a settlement. Isolated Edge Function source exists in this PR but is **not deployed**. A disposable, persistent PostgreSQL ledger is exercised in CI; no hosted sandbox database or real Daraja test session has been provisioned or verified by this PR.

## Next engineering work, safely sequenced
1. Coordinate the `supabase/migrations` and commerce scopes with their current owners. Design one additive provider-independent `commerce_orders` + `commerce_attempts` + immutable `commerce_events` + `commerce_fulfilments` ledger, typed `product_kind` and optional verified guest owner. Do not weaken existing learning-product foreign keys or silently rewrite existing paid state.
2. Implement a nonproduction Supabase sandbox project/local Postgres fixture with service-only access, no `anon` direct writes, RLS on exposed objects, atomic reservation/idempotency, one open attempt/order, provider-message-id uniqueness and independent refund states.
3. Build a sandbox callback ingress with secret/token controls, payload constraints, provider-origin checks where supported, immutable event insertion, row locking, replay/reordering defence and reconciliation. Route only pre-approved test shortcodes/phones to Daraja sandbox. **Do not treat the synthetic `evaluateSandboxCallback` helper as proof of authentic provider callbacks.**
4. Connect a server-verified catalogue price resolver for each product type and restricted checkout API. Reuse existing working credit and learning-product semantics through adapters without replacing their live tables until data migration/reconciliation is proven.
5. Run end-to-end Daraja sandbox OAuth → STK → callback → settled simulated order → simulated entitlement **inside isolated environment**, plus cancellations, amount/phone mismatches, duplicate callbacks, early callbacks, stale attempts and unknown provider outcomes. Record exact logs/screenshots but never keys or real PII.
6. Obtain real merchant approval, independently review security and accounting, then commission and activate live mode separately. Until then, keep all real charges disabled.

## Release invariants
- Server chooses product price. A client-provided amount or receipt never establishes paid status.
- `MPESA_ENV=production` and `VERCEL_ENV=production` are rejected by the sandbox adapter; its HTTP host is *always* `sandbox.safaricom.co.ke`.
- No payment initiation without an atomic, durable, deduplicated reservation in the eventual database.
- No dual fulfilment even if a valid callback is duplicated or arrives before STK attachment.
- A successful STK response is never a provider settlement.
- Unknown provider states are quarantined, **never** blindly retried.
- Simulation never unlocks real goods/services.
- The existing `mpesa_runtime_control.initiation_enabled=false` stays unchanged.

## Stage 2 — isolated checkout, callback and status (2026-10-22)

Source now implemented on PR #790:
- `lib/commerce/unified/daraja-reconciliation.ts`: sandbox OAuth-protected STK Query, strict callback parsing, amount/phone/receipt checks, and joint independent verification. `1037` becomes **expired**, never paid.
- `lib/commerce/unified/callback-ingress.ts`: method/content-length/token gate, immutable callback persistence **before** acknowledgement, early-callback safety and independent Daraja query. The callback URL token is NOT a provider signature; it only limits unsolicited HTTP traffic. Independently verify the provider's status before simulated settlement.
- `qa/commerce/unified-sandbox-lifecycle.sql`: isolated server-priced catalogue (six product kinds), idempotent orders, one-time compare-and-swap STK claim, immutable events, independent query observations, locked reconciliation, and a sandbox-only simulated entitlement table. NOT a production migration.
- `qa/commerce/unified-sandbox-lifecycle-assertions.sql` and `qa/commerce/unified-sandbox-integration.test.mjs`: ephemeral real PostgreSQL + mocked HTTP STK/Query/callback proof, including early arrival and one simulated entitlement.
- `supabase/functions/unified-commerce-sandbox-checkout/index.ts`: **operator-only** staging API. Server loads authoritative catalogue price, reserves an order and atomically claims one STK request before making any external call.
- `supabase/functions/unified-commerce-sandbox-callback/index.ts`: token-protected staging webhook; saves evidence, independently queries Daraja and reconciles private PostgreSQL tables.
- `supabase/functions/unified-commerce-sandbox-status/index.ts`: operator-only staging Query/reconciliation and simulated confirmation. This is not a public customer-facing confirmation endpoint.
- CI runs Node sandbox tests, disposable PostgreSQL assertions, joined Node/Postgres synthetic checkout and isolated Edge Function typechecks. All HTTP responses and test provider credentials are fake.

### Safe manual commissioning prerequisites (isolated Supabase project ONLY)

> **2026-10-23 second convenience update:** Hosted Edge Functions now fall back to Supabase's built-in `SUPABASE_DB_URL` if no `COMMERCE_SANDBOX_DATABASE_URL` was explicitly configured; existing database host/project checks remain enforced. If `COMMERCE_DARAJA_SANDBOX_CALLBACK_URL` is not set, the functions construct it from their own `SUPABASE_URL` and the private `COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN`. These two settings no longer need manual entry when platform defaults work. **Still required:** distinct strong `COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN` and `COMMERCE_SANDBOX_OPERATOR_TOKEN`, plus sandbox Consumer Key, Consumer Secret and passkey. Do not share private tokens in GitHub/chat. Verify platform DB URL matches the isolated project before test; no production payment grant is enabled.


> **2026-10-23 additional simulator defaults:** This isolated test project's deployed function code also defaults the public simulator values `COMMERCE_DARAJA_SANDBOX_SHORTCODE=174379`, `COMMERCE_DARAJA_SANDBOX_PARTY_B=174379` and `COMMERCE_DARAJA_SANDBOX_TEST_PHONE=254708374149`. The values can still be overridden in Edge Function Secrets for an explicitly approved alternative simulator. **Do not put the real Till number or a real payer phone into this sandbox.** The Daraja passkey and other private values are NOT defaulted and must be added securely in Supabase Secrets.

> **2026-10-23 isolated test-project convenience:** The deployed checkout, callback, and status Edge Functions now contain only the four *non-secret* sandbox default values: `COMMERCE_SANDBOX_PROJECT_REF=ufqjgyzspavamdpkdxmc`, `COMMERCE_SANDBOX_ISOLATED_PROJECT=true`, `COMMERCE_DARAJA_SANDBOX_ENABLED=true`, and `MPESA_ENV=sandbox`. You no longer need to enter those four manually in Edge Function Secrets. Explicit environment overrides still work; actual `SUPABASE_URL` must exactly match the isolated project (production refuses), and the rest of the sensitive credentials/tokens are **still required** in the Edge Function Secrets UI. These defaults do **not** appear in the Supabase Custom Secrets list. Live payment initiation remains OFF.

The separate existing test project `ufqjgyzspavamdpkdxmc` now contains the private commerce test schema and three isolated sandbox-only Edge Functions. No real Daraja payment has been initiated by these functions; secrets have NOT been provisioned.

Only in a separate Supabase project (never `yauqsxggtuxuykcbrtzf`):
1. **Completed:** The private schema is already applied in the isolated test project. Do not reapply these non-idempotent fixture files. Hosted assertions passed. Synthetic KES 50 wish success and KES 300 `1037` timeout were verified.
2. Configure these **isolated project server secrets** through Supabase Dashboard → Edge Functions → Secrets (never GitHub/chat):
   - `COMMERCE_SANDBOX_PROJECT_REF` = isolated project reference, not the VibeSchool production reference.
   - `COMMERCE_SANDBOX_ISOLATED_PROJECT=true`
   - `COMMERCE_DARAJA_SANDBOX_ENABLED=true`
   - `MPESA_ENV=sandbox`
   - `COMMERCE_SANDBOX_DATABASE_URL` = password-bearing database URI of **the same isolated project** (direct DB host or pooler with matching ref); no query parameters.
   - `COMMERCE_DARAJA_SANDBOX_CONSUMER_KEY`, `COMMERCE_DARAJA_SANDBOX_CONSUMER_SECRET` = credentials of the Daraja sandbox app.
   - `COMMERCE_DARAJA_SANDBOX_SHORTCODE`, `COMMERCE_DARAJA_SANDBOX_PASSKEY`, `COMMERCE_DARAJA_SANDBOX_PARTY_B`, `COMMERCE_DARAJA_SANDBOX_TEST_PHONE` = Safaricom simulator test data.
   - `COMMERCE_DARAJA_SANDBOX_WEBHOOK_TOKEN` = random secret ≥32 characters, unrelated to any Daraja or Supabase key.
   - `COMMERCE_DARAJA_SANDBOX_CALLBACK_URL` = `https://<isolated-ref>.supabase.co/functions/v1/unified-commerce-sandbox-callback?sandbox_token=<the-webhook-token>`; **never expose in client code**.
   - `COMMERCE_SANDBOX_OPERATOR_TOKEN` = separate random secret ≥32 characters, only accessible to an authorised test operator.
3. **Completed:** Three staging-only Edge Functions are ACTIVE: `unified-commerce-sandbox-checkout`, `unified-commerce-sandbox-callback`, and `unified-commerce-sandbox-status`. They refuse payment initiation until test-project secrets are configured. No production project functions were changed. Operator tokens must never appear in browser code.
4. Use an approved simulator test phone and an internal operator script to submit `product_kind`, `item_reference`, `owner_type`, `owner_reference`, `idempotency_key`, `phone`. A customer-supplied `amount` is ignored. These APIs are *not* suitable for public customer sign-up or guest access; those require session ownership and consent checks before production rollout.
5. Verify OAuth → STK → webhook → Query → same-order settlement → **simulated** entitlement. When callbacks are absent use operator status query; when Daraja gives `1037`, expect no entitlement. Rotate the callback token if it is exposed in HTTP access logs. Refund/reversal operations remain a separate commissioning gate.

### Evidence classification
- **Passed:** Mocked Daraja request/query plus real disposable PostgreSQL synthetic receipt, strict callbacks, all six product kinds, idempotent attempts, simulated entitlement, timeout 1037, amount/phone/receipt mismatch, one-time claim and nonproduction guard.
- **Hosted staging verified:** separate private commerce schema with six catalogue offers, synthetic successful wish (one simulated entitlement), and expired 1037 learning product (zero entitlements); three sandbox-only Edge Functions ACTIVE. No real charges.
- **Not passed/not attempted:** real network OAuth against founder's app credentials from the hosted test service, successful actual Daraja sandbox callback-to-DB roundtrip, independent security review, secure guest/signed-in customer-facing ownership verification, refunds/reversals and migration of existing business payment systems.
- **Release:** PR remains draft and production M-Pesa initiation remains OFF.

### Security note
Safaricom M-Pesa Express callbacks are not inherently signed with an application HMAC. The callback URL token is a gate, not cryptographic proof that payment settled. Even a signed ingress must not unlock access without a matching provider status query and durable server-side ledger checks. For production monetary settlement, add independent receipt validation and financial reconciliation.

### Hosted staging isolation audit
- Hosted test project: `ufqjgyzspavamdpkdxmc` (`success-wishes-test-20261022`), not production `yauqsxggtuxuykcbrtzf`. Existing Success Wishes tables unchanged.
- New schema: `commerce_sandbox`; seven forced-RLS tables, intentionally no public RLS policies or grants. Supabase advisor notes these private tables as informational `rls_enabled_no_policy`.
- Staging contains two **synthetic** orders in the private schema only: one KES 50 `settled_simulated` with exactly one simulated entitlement, and one KES 300 timeout result 1037 with zero entitlements.
- The connected Supabase tool cannot set or view Edge Function secrets; the founder must use the test project's Dashboard to store credentials securely. Do not send keys or passkeys in chat.


## Hosted provider proof runner — 2026-10-23

A guarded operator-only runner is included at `scripts/commerce/hosted-daraja-sandbox-proof.mjs`. It always uses the existing isolated project `ufqjgyzspavamdpkdxmc` and **never** calls the production Supabase project.

Run offline contract tests (mocked HTTP, no Daraja traffic, no secrets):

```sh
node --test scripts/commerce/hosted-daraja-sandbox-proof.test.mjs
```

After completing the **sandbox-only** secret checklist above in the isolated Supabase project's Edge Function Secrets screen, set the *separate* operator token and approved **simulator** phone securely in your terminal environment (do not paste these values into chat or GitHub). Then explicitly execute:

A previously acknowledged checkout can be inspected *without any new STK*
using `--status-only`, for example the observed October 24 expired order:

```powershell
node scripts/commerce/hosted-daraja-sandbox-proof.mjs --status-only 7ac68783-577a-42c3-86ca-fc20e61a0a53
```

This is one authenticated **status** call only; it cannot create an order,
and it requires the same private operator token and simulator phone variables
as the proof runner. **Do not use `--execute` to check an existing order.**

The status endpoint may temporarily return HTTP 409 with
`reconciliation_required` even though Safaricom already delivered a callback.
The proof runner now retries **status-only** within the original bounded poll
window, but only for same-order, non-live, explicitly recoverable provider-query
or database-reconciliation errors. Mismatched identities, real-access flags,
unauthorized responses and malformed data still fail closed. After 30 status
checks without independent verification, the test remains unconfirmed and
must not be restarted automatically.

Verified local operator evidence from 2026-10-24: one new KES 50 sandbox
STK acknowledgement, callback `ResultCode=1037`, then a subsequent
status-only reconciliation returning `expired` with **zero** simulated
access grants. This establishes a working callback/failure path, not a
provider-confirmed successful purchase.

Safaricom's official M-Pesa Express documentation describes successful
payment as callback `ResultCode=0` with receipt metadata; a successful STK
**acknowledgement alone is not a settlement**. For a success scenario, use
the signed-in Safaricom Daraja **M-Pesa Express simulator/test data**, verify
the specific scenario it supports, and collect a matching provider callback
plus independent STK Query for the *same* order before accepting success.
The static sandbox test number does not guarantee a response or a success
outcome. Never fabricate a receipt, manually mark a sandbox payment as paid,
or enable real production charges as a workaround.


```sh
node scripts/commerce/hosted-daraja-sandbox-proof.mjs --execute
```

Acceptance: a fresh KES 50 `success_wish` order (not a reused synthetic record), one actual Daraja SANDBOX STK acknowledgement, independently queried status, authentic callback persistence, and precisely one `simulated_entitlements` row for that order. The runner polls only the status endpoint and **never retries STK Push**, even after failures. A successful run reports a simulated entitlement with `real_access:false`. It does not constitute proof of real money, live card delivery, refunds, or production merchant readiness.

To independently confirm its order after success (use the printed UUID; run on the **isolated** project only):

```sql
select o.id, o.product_kind, o.amount_kes, o.state,
       (select count(*) from commerce_sandbox.provider_inbox p
         join commerce_sandbox.payment_attempts a
           on a.checkout_request_id=p.checkout_request_id
         where a.order_id=o.id) as callback_count,
       (select count(*) from commerce_sandbox.simulated_entitlements e
         where e.order_id=o.id) as simulated_grants
  from commerce_sandbox.orders o
 where o.id='<UUID printed by the hosted proof runner>'::uuid;
```

A real provider proof must report `callback_count >= 1`, `simulated_grants = 1` and `state = settled_simulated`. If any one is missing, the proof has **not** passed. Never substitute previous synthetic rows for this fresh provider-issued order. Keep real payment initiation OFF.


## Localhost browser commissioning (sandbox STK; not live payment)

The Success Wishes checkout has two explicit **development-only** modes. The default
mode performs a local synthetic success/failure test; the optional **Daraja sandbox
STK** mode sends one provider test request through the existing isolated Supabase
checkout Edge Function and checks status through its separate status Edge Function.

Requirements: run `next dev` on `localhost` or `127.0.0.1`, with the existing
Success Wishes local test feature enabled. In your **private local development
environment**, supply:

```dotenv
VIBESCHOOL_SUCCESS_WISHES_TEST_MODE=1
VIBESCHOOL_DARAJA_HOSTED_TEST_ENABLED=1
MPESA_ENV=sandbox
COMMERCE_SANDBOX_PROJECT_REF=ufqjgyzspavamdpkdxmc
COMMERCE_SANDBOX_TEST_PHONE=254708374149
COMMERCE_SANDBOX_OPERATOR_TOKEN=<rotated isolated-project operator token, private server only>
```

Also supply the ordinary development Supabase public settings needed by the app.
Never use a `NEXT_PUBLIC_` prefix for the operator token; do not commit or
paste private credentials. Hosted commissioning is automatically denied in
production builds and on **all Vercel deployments**, including previews.

From `/success-wishes`, create a KES 50 **Text Wish**, open checkout,
select **Daraja sandbox STK**, and use the fixed approved test phone. Prepare
the order, then explicitly select **Send one sandbox STK**. The browser talks
only to `/api/success-wishes/test-daraja`; the route keeps the operator token
server-side and calls the pinned test project. **Check payment status** calls
only the isolated provider-status endpoint; it never starts another STK.

On a provider-confirmed **sandbox simulated** settlement, one **local
test invitation** may be released for recipient-journey QA. This is not a
receipt for real money, a real entitlement, a production order, or verified
customer delivery. Expired or failed tests issue no invitation. If submission
is uncertain, **do not retry**: the original test order stays blocked for
operator reconciliation.

Run all network-free contracts:

```sh
node --test scripts/test-success-wishes-local-checkout.mjs
node --test scripts/test-success-wishes-hosted-daraja.mjs
node --test scripts/test-success-wishes-hosted-http.mjs
```

The last command starts a localhost Next.js development server and intercepts
the *two pinned* isolated provider endpoints using a synthetic CI fixture.
**It does not contact Safaricom or Supabase.** It also verifies one-time
submission and the private test invitation through the real Next.js routes.
Do not run it if there is existing `.success-wishes-test-data.json` because
the test intentionally expects an empty test store.

Remaining certification: actual Safaricom success `ResultCode: 0` with a
matching real sandbox callback/query and receipt; a browser UI walkthrough
with the founder's approved test environment; and separate, explicitly
authorised production commissioning. Keep live initiation OFF.

## Stage 3 — separate STK prompt recipient (2026-10-24)

Daraja M-Pesa Express supports a `PartyA` sender and separate
`PhoneNumber` STK prompt recipient. The signed-in portal simulator returned
an acknowledgement for `PartyA=254708374149` with a separately controlled
recipient number, and the operator provided an SMS indicating a KES 1 sandbox
confirmation. **This was not a VibeSchool order, and the confirmation SMS
alone does not certify the VibeSchool checkout.**

The isolated checkout adapter now supports:

- `COMMERCE_DARAJA_SANDBOX_TEST_PHONE`: trusted simulator `PartyA`
  (defaults to `254708374149`); **do not change it to the recipient**.
- `COMMERCE_DARAJA_SANDBOX_STK_RECIPIENT_PHONE`: optional, private,
  separately approved `PhoneNumber` receiving the STK prompt.
  **Set this only in the isolated Supabase Edge Function Secrets**.
  Without this secret, `PhoneNumber` defaults to the test `PartyA`,
  maintaining the prior fail-closed behavior.
- `COMMERCE_SANDBOX_TEST_PHONE`: operator CLI environment variable.
  With a separate recipient configured, set it privately to the **same
  approved recipient**, not the simulator `PartyA`. The CLI never
  exposes the operator token in its output.

The checkout validates the requested recipient against that exact server-side
allowlist **before creating an order**. It reserves the payment attempt
with the recipient phone, so a genuine success callback must independently
prove the correct amount, recipient phone, receipt and provider IDs. An
unapproved number is rejected. The sandbox callback and query still jointly
decide settlement; **one simulated grant**, **zero real grants**.

The recipient's choice was established by a user-controlled Daraja simulator
test. No further STK should be sent automatically. After merging and
deploying the checkout function **only** to
`ufqjgyzspavamdpkdxmc`, save the approved recipient secret privately
on that test project, then run **one** authorized fresh KES 50 test using
`node scripts/commerce/hosted-daraja-sandbox-proof.mjs --execute`.
Confirm the request on the approved phone, then inspect the returned order.
Do not use the previous simulator receipt to settle a VibeSchool order.

### Guardrails

- This is explicitly a sandbox-only behavior; the production payment
  switch remains OFF and no live/customer M-Pesa routing is enabled.
- `PartyA` and `PhoneNumber` may differ **only for this isolated
  developer test scenario**. Production merchant configurations must
  follow Safaricom onboarding rules and the actual payer/consent flow.
- Do not log/upload payment credentials, operator tokens, callback tokens,
  personal PINs, or a full STK push payload with credentials.

