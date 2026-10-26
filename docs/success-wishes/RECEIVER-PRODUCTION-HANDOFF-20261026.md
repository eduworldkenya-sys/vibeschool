# Success Wishes receiver — production handoff (26 October 2026)

**Status:** implementation candidate, NOT a production-certified paid service.
**Branch/PR:** feat/success-wishes-receiver-20261026 / #820. Feature flag defaults OFF; no real payment or SMS launch.
**Checkout authority:** existing learning-product commerce (not the simulated #817 flow).

## Implemented behind default-OFF receiver flag

- Service-only, RLS-protected tables for verified receiver identities, one paid card per payment attempt, hashed link/code capabilities, sessions, SMS status, OTPs, shared-phone recovery, wish requests, privacy reports and data-rights requests.
- Database trigger independently checks *real* settled M-Pesa attempt, zero provider result code, receipt, verified callback, exact KSh 50 order, unrefunded status, and order product kind success_wish_text.
- Service-role-only atomic RPC success_wish_issue_verified_paid_card, returning a high-entropy private link secret and sender backup code **once**. A replay returns only the card ID.
- Separate public single-card bearer access (does not grant the inbox); a new paid recipient receives only a sealed envelope while consent is pending. Message content cannot be revealed until trusted-route OTP and explicit adult/guardian acknowledgment are recorded. Sender stays concealed until permitted reveal. Server validates current settlement/revocation/expiry on open.
- Verified inbox based on recipient-specific OTP session. Distinct recipients can share one phone; recovery also requires a separate 128-bit student secret. A fresh OTP from a valid card rotates the recovery secret, invalidating the old code. Inbox lists recheck real-paid status and omit refunds/simulated payments; card reveal is pinned to the selected card ID to prevent wrong-tab disclosure.
- Premium phone-first pages: /success-wishes/inbox, /open, /verify, /recover, /request, /invite, /settings; existing animated BookCard reused at /invitation.
- Africa's Talking verification and notification adapters, provider-acceptance status distinguished from confirmed handset delivery; SMS settings are off unless commissioned.
- Privacy settings support hide, report and a queued access/deletion request without pretending to complete statutory request processing.
- Seven-day tokenized wish requests. WhatsApp prefill and device SMS compose; actual sending is controlled by the student. Sender studio prefill is a handoff, not a completed paid purchase.

## Production integration — mandatory open work

1. **Guest checkout:** Existing commerce payment attempts require an authenticated learning-product order; there is no verified guest KSh 50 success_wish_text checkout today. Extend that canonical commerce flow with a durable purchaser identity, recipient binding, server-set price, retries, and real Daraja settlement. **Never accept** settled_simulated/simulated_access or client-entered receipts.
2. **Recipient onboarding and consent:** The paid issuer now permits a sealed, paid gift for a pre-provisioned `pending` recipient. The `consent_route` is trusted server data (`adult` or `guardian`), and an under-18 guardian must have a separately pre-provisioned phone before consent SMS is accepted. The OTP is bound to that route and the recipient; reveal and inbox access remain blocked until consent is acknowledged. **Still outstanding:** authenticated or otherwise independently checked guest recipient provisioning, accurate age/guardian relationship verification, operational consent withdrawal, legal approval and real carrier delivery. Phone/SMS and a checked guardian box do **not** by themselves prove lawful guardianship.
3. **Payment to gift handoff:** Bind the exact approved card snapshot, sender identity, receiver ID and optional wish-request ID to the immutable purchase record. Trigger the RPC only after verified settlement. Store the one-time private URL/backup code securely in the purchaser's authorized fulfilment record and show a recovery path for network loss. Simulated #817 checkout must not be merged as real payment.
4. **SMS:** Provision live sender ID, credentials, budgets, consent/opt-out requirements and provider delivery receipts. The receiver adapter currently sends a card link/code only when commissioned. Implement tested retry policies, callback delivery status and sender recovery if SMS fails.
5. **Request fulfilment:** Wish-request links currently prefill only; the verified payment record must bind the requestId/receiverId authoritatively and ignore tampered recipient fields.
6. **Data protection and support:** Operational review/handling for reports, access/deletion requests, blocking/revocation, retention and age/guardian consent; finish production privacy copy and rate-limit/abuse evidence.
7. **Deployment/release:** Review actual Supabase schema migration and constraints, apply ordered receiver migrations in production using controlled change management, test two-school and shared-phone isolation against actual RLS, verify browser accessibility on Android and desktop, then conduct real KSh 50 STK → receipt → single card → SMS → private reveal → revisit → OTP recovery from independent devices. Keep public payment enabled OFF until all are certified.

## Environment flags and runtime safety

- SUCCESS_WISHES_ENABLED must be commissioned with Supabase server credentials.
- SUCCESS_WISHES_RECEIVER_ENABLED must be explicitly true for new APIs to serve data.
- SUCCESS_WISHES_RECEIVER_SMS_ENABLED explicitly enables SMS after Africa's Talking live credentials, mode and verification pepper are commissioned.
- SUCCESS_WISHES_PUBLIC_BASE_URL must be a configured HTTPS public origin, not a client-controlled Host header.
- SUCCESS_WISHES_VERIFICATION_SECRET must have at least 32 characters.
- Public /api/success-wishes/config still reports paymentsEnabled: false. Do not change this to true until the full payment/fulfilment gate passes.
- New private card-access and receiver tables are service-role-only; no anonymous/authenticated PostgREST policies.

## Verification evidence and limits

- Migration security contract validates per-table RLS/grants/authorization labels.
- Disposable PostgreSQL Success Wishes job applies the receiver schema, validates role restriction, rejects simulated/unrelated/duplicate payments, confirms link/code digests, atomic idempotency, pending sealed gifts and guardian-purpose challenge isolation. This is **synthetic SQL proof**, not Daraja proof.
- Success Wishes contract suite includes pure trusted-route consent tests; an additional controlled-provider browser journey checks the sealed invitation, guardian OTP approval, multi-gift inbox, refresh and recovery at 320/390/768/1280 px. These are *mocked* service responses, not end-to-end carrier, database or payment proof.
- Don't describe a passing PR or a configured test payment as customer-ready delivery.
