# KSh 50 frontend checkout delivery record

## Goal and implementation

Four existing text cards → exact preview → durable guest order → explicit KSh 50 STK confirmation to Till 949529 (shortcode 961580) → independent provider settlement verification → exact private card link and backup code → recovery.

The review-only modal is replaced by `WishCheckout`. Review makes no payment request. Order creation and STK confirmation are separate actions. A 256-bit private order key is saved before the first request; only its domain-separated hash is persisted in the database. Refresh and duplicate clicks restore the same order. Pending/uncertain orders cannot send a second prompt. Card access is reproducible from the private sender key even if the first fulfillment response is lost.

The server sets KSh 50, validates all four designs and card fields, and binds the immutable order to a verified recipient's private wish request. Arbitrary names, a directory school result, a phone number or a client-supplied UUID are not recipient verification. The recipient's school is optional in the product; when a request contains one, the exact preview must agree with it.

Service-only orders use RLS, explicit grants and transactional single-claim initiation. Both shared initiation and the dedicated default-OFF `success_wishes_enabled` switch apply. The callback authenticates a per-attempt capability, stores the first event and cannot settle money. An authenticated query to Safaricom must independently confirm the matching checkout/merchant result. SQL additionally requires matching amount, phone, receipt and query evidence before allowing the settled state or issuing a card. Uncertain responses require reconciliation, never automatic repayment. Refunded orders cannot issue/open cards.

Guest cards extend the canonical receiver cards/access/session/inbox tables without inventing a purchaser profile or weakening existing registered-commerce checks. Only text wishes are purchasable; voice/video remain previews. Delivery in this checkout is sender copy/share of the private link, not an assertion that SMS was delivered.

## Verified locally on the recovered implementation

- All 101 Success Wishes tests pass, including new request-link validation, cross-origin and disabled-route denials, wrong amount/phone/receipt/reference rejection, callback capability checks, provider-query settlement, idempotency and ambiguous STK handling.
- Full TypeScript check passes. Changed-file lint passes without warnings.
- Clean Next.js production build passes with dummy public configuration. Initial build was invalidated by a development process sharing `.next`; browser verification now uses an isolated copied workspace and a clean production build was rerun successfully.
- Disposable PostgreSQL/PGlite reconstruction and committed SQL assertions pass: default OFF, public privilege denial, one STK claim, immutable card, denied unpaid issuance, denied settlement without matching provider evidence, idempotent issuance, tamper denial and refund denial.
- Chromium checkout at 320/360/390/412/768/1280 pixels passes review-without-charge, saved order, single payment action despite duplicate clicks, waiting state, refresh without another prompt, synthetic receipt and exact private link/code.
- These browser/provider/SQL payment records are explicitly synthetic; they are not evidence of a live Safaricom payment or carrier delivery.

## Production and release state

The Supabase connection refresh resolved the earlier expired-request errors. Migration `20261026184056_success_wishes_guest_checkout` is now applied in production. Both dedicated Edge Functions are ACTIVE at version 1: checkout requires JWT plus exact service credential; callback requires its per-attempt capability. HTTP denial checks return 401 for an unauthenticated checkout request and 403 for a callback without a valid capability. RLS is enabled; anon cannot SELECT orders or execute payment claims; authenticated cannot UPDATE orders; service_role can execute claims. Both `initiation_enabled` and `success_wishes_enabled` remain false. Production contains zero guest orders and zero verified recipients. No live STK/charge was initiated.

Current checkout deliberately requires an already verified recipient request. General guest recipient onboarding is a separate, genuine dependency. No test student, guardian relationship, consent or recipient identity was fabricated to bypass it.

The original candidate `9b280107` passed all 25 GitHub workflows. Release remains NOT CERTIFIED pending checks for the migration-lineage update, independent financial/security review, frontend integration/hosting verification, a real verified recipient, and a designated controlled M-Pesa test phone. Backend schema and dedicated functions are deployed; this does not activate checkout or prove payment settlement. Production credential acceptance alone is not proof of passkey/STK/settlement success. No payment or receiver flags have been enabled by this implementation.

## Recovery and rollback

Set `mpesa_runtime_control.success_wishes_enabled=false` to stop new guest STKs. Keep reconciliation and already-paid card access available. Do not delete orders/callback evidence/cards or rewrite migration history. Never resend an STK for a submitting/reconciliation-required order; reconcile the provider record and process any necessary refund through the authorised financial process.

## Durable source checkpoints

Frontend checkpoint `54e8c390b6c49be64e146bd390eb8c868ced11c7` and backend checkpoint `3e14c7778ac5ccb4ea6e43217784baeec1551ff1` were saved to GitHub before further verification. Final candidate includes the subsequent tests and fixes. Earlier local work lost during runtime reset was reconstructed and reverified; its old test claims were not used as proof for this candidate.

## Pre-payment recipient setup correction — 27 October

The original receiver verification route depended on a paid-card session while guest checkout requires an already verified recipient. That circular dependency prevented the first real purchase. The same verification route now also accepts a trusted-operator-issued, expiring adult setup capability. It looks up the stored adult identity and fixed phone, then uses the existing purpose-bound SMS OTP and affirmative adult consent. The capability alone cannot verify consent or create an inbox session. Guardian registration continues to require its existing school/guardian route.

Setup provisioning is service-only, for a trusted adult identity: generate a cryptographically random 32-byte hex token; store only SHA256(`success-wishes:receiver-setup:` + token) with the pending adult receiver and an expiry within 24 hours of creation. Deliver `/success-wishes/verify#setup=<token>` privately. No phone, token, OTP or recovery code belongs in source control. Reopening an active setup link after a lost response requires a fresh phone OTP, including after consent has been recorded. The receiver can then create a private wish request in their inbox before checkout. Expired capabilities require operator assistance; they do not bypass recovery.

Production environment metadata checked: the required `SUCCESS_WISHES_AT_USERNAME`, `SUCCESS_WISHES_AT_API_KEY`, and `SUCCESS_WISHES_AT_MODE` are absent, and receiver SMS is disabled. No alternative generic SMS credentials were present. These must be configured securely in the production Vercel project before a real OTP can be sent. Production activation, a provisioned verified receiver, independent assurance, frontend deployment and the controlled real transaction remain unproven. No live STK request has been sent. The pre-setup candidate head 23c7c5c passed all 25 GitHub workflows; new setup changes require fresh CI.
