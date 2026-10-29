# Success Wishes group checkout — 29 October 2026

## Contract

One existing guest order holds two, three or four immutable text-card snapshots and costs KSh 100. Existing single orders remain KSh 50. The existing Daraja checkout, callback and independent provider query are reused; settlement compares the callback amount to the stored order amount. Each item has a separate private gift capability, receiver claim and opening state. Sharing uses the existing WhatsApp actions.

The database claim is atomic and cannot request a second STK for a pending order. Gift issuance runs in one transaction; failed issuance is retried on status/recovery without another payment. The sender retains private recovery keys in browser storage and can restore any saved order or enter its key on another device. Refunded/expired/revoked cards are unavailable. No automatic WhatsApp or SMS delivery is introduced. Promotional single-card checkout is unchanged.

## Activation and rollback

`mpesa_runtime_control.success_wishes_group_enabled` defaults to false and only gates group payment claims. Existing payment switches still apply. Deploy the additive migration, deploy the updated `success-wishes-checkout` Edge Function, merge/deploy the app, then verify the exact production revision before controlled commissioning. Disabling the group switch stops new group payment claims without hiding paid cards or changing KSh 50 checkout. Do not revert the multi-item schema after group purchases exist. Keep the extended settlement verifier deployed to reconcile existing group orders.

Real KSh 100 payment, receipt verification, receiver opening and sender recovery must be observed before declaring production certification. Local and synthetic CI evidence is not a real payment. Group payments remain OFF until the controlled payment gate is authorized and verified.

## Verification

Local contract suite: 141 existing tests pass; additional group tests cover counts/pricing, snapshot conflicts, wrong callback amount, idempotent payment, failed issuance/recovery, distinct links, refunds and sibling privacy. Local PGlite subset tests exercise the group schema and payment/issuance functions. GitHub's disposable PostgreSQL suite reconstructs the complete fixture, applies the group migration and reruns single checkout/PIN regressions.

Browser harness at 320/390/768/1280 pixels exercises 2/3/4 students, one simulated payment, individual WhatsApp links and restoration without another payment. This harness stubs the API and is not live Daraja proof. TypeScript and production build results are recorded separately in the PR/CI; no production completion is implied by this document.
