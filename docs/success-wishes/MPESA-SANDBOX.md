# Success Wishes — guest M-Pesa sandbox lane (NOT LIVE)

This work is staged separately from PR #780 to avoid concurrent edits to the
Success Wishes and Teacher OS leased directories. It is designed to integrate
into PR #780 after review. **No customer checkout has been enabled.**

## What is testable without a business shortcode

Safaricom's Daraja portal permits individuals to create a sandbox app.
The M-Pesa Express sandbox issues a Consumer Key and Consumer Secret, and its
simulator provides a sandbox shortcode, passkey and test phone data. No live
PayBill or Till is required for these developer tests.

The local contract tests use a *fake* OAuth/STK provider and synthetic
callbacks. They prove validation and state rules only; they do not prove
connectivity to Safaricom or that money settles.

Run:
```sh
node --import ./scripts/register-typescript.mjs --import ./lib/success-wishes/test-resolver.mjs --test lib/success-wishes/guest-mpesa-contract.test.ts
```

## Sandbox-only environment settings

Use a **separate sandbox database/project**, never the live learner database.
Set secrets through server/Edge Function secret settings, never in `NEXT_PUBLIC_`
variables or GitHub. Configure on an isolated preview:

```ini
MPESA_ENV=sandbox
VERCEL_ENV=preview
SUCCESS_WISHES_MPESA_TRANSPORT_ENABLED=true
SUCCESS_WISHES_MPESA_GUEST_CHECKOUT_ENABLED=true
SUCCESS_WISHES_ENABLED=true
MPESA_CONSUMER_KEY=<sandbox-app-consumer-key>
MPESA_CONSUMER_SECRET=<sandbox-app-consumer-secret>
MPESA_SHORTCODE=<sandbox-shortcode-from-daraja>
MPESA_PASSKEY=<sandbox-passkey-from-daraja>
SUCCESS_WISHES_MPESA_CALLBACK_URL=https://<sandbox-project>.supabase.co/functions/v1/success-wishes-mpesa-callback?secret=<unique-sandbox-callback-secret>
SUCCESS_WISHES_PRICE_TEXT_KES=<approved-test-price>
SUCCESS_WISHES_PRICE_VOICE_KES=<approved-test-price>
SUCCESS_WISHES_PRICE_VIDEO_KES=<approved-test-price>
```

The sandbox flags in this document are **not** a complete switch-on procedure:
the new guest order APIs, isolated migration, server-authorised callback
receiver, independently confirmed settlement and candidate-message release
are now **staged in code**, but still require an isolated database, exact-head
CI, security review and a real provider sandbox transaction. Refund execution,
provider dispute tooling and operational reconciliation certification remain open.

## Safaricom account setup

1. Register as an **individual** at https://developer.safaricom.co.ke/.
2. Create a sandbox Daraja app with M-Pesa Express.
3. Read **Test Credentials** in Daraja; obtain your sandbox consumer credentials,
   shortcode, passkey and simulator values. Use those only in the isolated
   environment, not in chat or source control.
4. After guest orders, STK dispatch and provider-verified callback processing are
   integrated, test an approved simulated success, cancellation, missing callback,
   amount mismatch, duplicate callback, timeout/reconciliation and failed query.
5. To collect **real** money later, register a business Till or PayBill and
   complete Daraja Go Live. Production credentials and passkey are separate.

## Non-negotiable engineering controls

* Neither a successful STK HTTP response nor a callback alone is settlement.
  A callback-URL secret is a routing guard, not a Safaricom digital signature.
* The backend must persist immutable callback evidence and use a verified provider
  query/status reconciliation before marking a payment as settled.
* Reference, amount, payer phone and merchant checkout identifiers must match.
  Uncertain state blocks a retry and never unlocks a candidate message.
* Quoted prices are server-owned KES integers; the browser must not send price.
* A guest payment must not be forced into `learning_product_orders` by creating
  a fake profile.
* The production `mpesa_runtime_control.initiation_enabled` remains OFF.
  Do not change this flag as part of sandbox tests.
* Once a Till or PayBill is acquired, verify the exact STK transaction type and
  receiving business shortcode in Safaricom's documentation and live credentials.

Official source: https://developer.safaricom.co.ke/apis/MpesaExpressSimulate

## Added on the isolated work branch

- `supabase/migrations/20261021170000_success_wishes_guest_mpesa_ledger.sql`:
  isolated private order, STK attempt and event tables; canonical runtime-control
  claim; atomic provider-confirmed message settlement.
- `app/api/success-wishes/payments/checkout`: server-quoted verified guest
  order; at-most-one STK attempt; separate sandbox gate.
- `app/api/success-wishes/payments/status`: verified sender receipt/status
  recovery and replay of early provider-confirmed callbacks.
- `app/api/success-wishes/payments/reconcile`: secret-gated batch
  reconciliation. It **never** issues a new STK. A scheduler still needs
  commissioning in the isolated environment.
- `supabase/functions/success-wishes-mpesa-callback`: draft sandbox-only
  callback handler. It stores the event *before* querying Daraja and releases
  the wish only when result code, checkout, merchant, phone, amount and receipt
  reconcile.
- `qa/success-wishes/guest-mpesa-ledger-assertions.sql`: disposable
  PostgreSQL settlement, idempotency, cancellation-prevention and grant tests.

### Mandatory operational review before enabling

Confirm an entirely separate Supabase project, sandbox credentials and SMS
verification provider; apply migrations there and deploy the callback only
there with its callback secret (minimum 32 characters). Never use production
student records, payment switches or secrets in the sandbox. Verify all
required test cases with Safaricom and independent QA.

**Not done yet:** real Daraja sandbox calls, active callback deployment,
live reconciliation job, automatic refunds/reversals, support workflow,
approved prices, independent privacy review, and a business shortcode for
production. These are release blockers; green unit tests alone do not
complete the payment service.
