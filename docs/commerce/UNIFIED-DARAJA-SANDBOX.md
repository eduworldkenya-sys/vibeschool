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
- `.github/workflows/unified-commerce-sandbox.yml`: CI tests + repository typecheck.
- No existing Edge Functions, deployed endpoints, migrations, customer data, payments, or environment values are changed by this PR.

### Run the test locally
```sh
npm ci --ignore-scripts --no-audit --no-fund
node --import ./scripts/register-typescript.mjs --test lib/commerce/unified/sandbox.test.ts
npm run typecheck
```

**Do not import the sandbox adapter from a publicly callable production route.** The adapter returns an STK acknowledgement, not a settlement; its callback URL contract is reserved for a *future* isolated sandbox function, which **does not exist in this PR**. There is no durable unified order table or test provider session yet.

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
