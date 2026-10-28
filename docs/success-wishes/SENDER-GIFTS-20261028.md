# Sender-created text gifts — release contract (28 October 2026)

## Product rule
The sender chooses a card, candidate name, exam year and optional school, writes the message, previews the exact design, enters an M-Pesa number, creates an immutable KSh 50 order and explicitly requests STK. **No recipient request link, registration, phone number, school roster, or recipient/guardian consent is involved in purchasing or sending.** Voice and video remain preview-only.

## Settlement and delivery
The existing Safaricom code, callback, independent provider query and PostgreSQL settled-state constraints remain authoritative. An accepted STK request is not payment success. The database only allows one payment claim for a guest order; pending, uncertain, duplicate, refunded and forged payment records do not issue gifts.

After verified settlement, `success_wish_issue_unrequested_guest_gift` creates one service-only, 90-day bearer grant bound to the immutable order. The private gift URL is deterministic from the sender's 256-bit recovery key and reproducible after a lost response. Only its domain-separated SHA256 digest is stored. The checkout gives the link to the sender to share privately. **No SMS delivery is claimed** and no recipient phone is inferred. The link alone grants access: anyone who receives it can open the card; warn the sender and recipient not to post it publicly. The receiver can reopen that same link without registration; the stored message is withheld from the initial sealed-card response until they tap to open. Guest cards are not silently inserted into someone else's verified inbox.

Existing receiver-linked guest orders and registered paid cards continue to use their original invite and identity/consent access paths. They must remain recoverable through existing checkout keys. No attempt is made to create artificial receiver accounts or consent records.

## Operational release gates
- Apply and reconcile `20261028115500_success_wishes_sender_created_gifts.sql` on the primary production project **before** releasing this application code. Verify table RLS, revoked anon/authenticated grants, pairwise-null recipient fields, and service-only issuer permissions.
- Keep `mpesa_runtime_control.initiation_enabled=false` and `success_wishes_enabled=false` until an authorized live KSh 50 trial is ready. Do not change payment secrets or routing as part of this PR.
- Test an independent device, revoked/expired/refunded link, 320–1280 px browser journeys, refresh/revisit, provider pending/cancel/1037, replay and real callback/query evidence.
- After controlled live payment, confirm the receiving Till, receipt and single settlement match, immutable card contents and an accessible private gift.
- Keep the order recovery key private; if the receiver loses the link, the sender restores the saved order to recover it.
- Immediate rollback: keep both payment switches OFF to stop new STKs; preserve existing payment/callback ledger and private card grants; do not delete evidence.

This is design/implementation evidence, not a live payment certification.
