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
