# Receiver PIN collection — implementation and release contract

Repository baseline: a0ab26bf6d9cf535cf989dbf1c3f0bf3c2630d61. Repository risk R5 (authentication); all security and independent-assurance gates apply. No payment or SMS switches are changed.

## Locked outcome

1. Sender personalises, previews and completes the existing KSh50 checkout. Share through the sender's WhatsApp only after verified payment.
2. Recipient phone is the delivery address, separate from M-Pesa. It is not proof of ownership. Names, shared numbers and schools never merge collections.
3. A private gift link opens its one envelope without registration or SMS. Existing designs, message, signature, sound, animation and close/reopen are preserved.
4. Keep your wishes creates a canonical receiver record with a salted, server-peppered four-digit PIN and a 90-day HttpOnly browser session. Adult/guardian acknowledgement is recorded without falsely marking phone ownership verified.
5. A remembered browser opens My wishes without another login. Lock/sign-out revokes PIN, legacy inbox and legacy card capabilities. Learner switching uses remembered non-secret collection IDs and a PIN, with no public phone lookup.
6. Recovery uses a separate private 256-bit link. Reset rotates the capability and session epoch and revokes old sessions. A nonce-bound retry recovers a lost response; explicit confirmation closes the retry window. Ordinary gift/request links cannot recover an account.
7. Opening a new gift while the correct collection is selected saves only that gift. Concurrent claims are serialized; claimed gifts cannot move to another collection. A gift cannot be bulk-claimed by phone/name.
8. Request a wish works after no-SMS collection setup. Requests are shared manually on WhatsApp, expire after seven days and carry a contribution-only reference through checkout. Recipient fields are prefilled and server-bound.
9. Payment settlement makes a request-addressed order available in its collection independently of WhatsApp sharing or sender status polling. Unaddressed orders remain unclaimed until their link is shared. There is no safe phone-only discovery when ownership has not been established.
10. My wishes uses simple envelope rows: sender name for opened gifts, A wish for you for unopened gifts, one unread indicator, one Request a wish action. Account/lock/recovery options are in the menu.
11. Status distinguishes payment, inbox availability and opening. Launching WhatsApp never proves delivery. Sender can reshare a paid gift.
12. A purchaser may correct an unopened/unclaimed address using their order capability. Correction rotates the gift link, invalidates the old one and returns the replacement. Opened/claimed corrections require support via /contact; support cannot automatically grant access by phone alone.
13. Gifts retain the established 90-day paid availability. Loading, error, expired, revoked, empty, missing-link and locked states remain actionable. Losing all access requires a sender to reshare an individual gift; it does not recover other gifts.
14. Existing phone-verified collections remain readable and can upgrade through their authenticated legacy session. Legacy card consent and ownership remain enforced. Existing legacy SMS recovery is available explicitly at /success-wishes/recover?legacy=1, independently of the new no-SMS journey.

## Dependency and rollback

Additive migration extends existing receivers, sessions, guest orders and free gifts; no competing identity tables or grants. New RPCs are SECURITY INVOKER and executable by service_role only. RLS and anon/authenticated revocations are preserved.

Apply the additive migration before deploying routes requiring it. Roll back application code to the baseline if necessary; retain the additive columns and already purchased gifts. Do not drop records, rewrite migration history, activate payment/SMS flags or run synthetic payment traffic against production.

## Verification inventory

Required: all Success Wishes contract tests; typecheck; changed-component lint; production build; full PostgreSQL fixture reconstruction; ownership/permission/recovery/address-rotation SQL assertions; no-SMS browser journey at 320/360/390/412/768/1280; cross-tab and delayed-response privacy; existing sender checkout and disabled-service browser suites; independent exact-head review; exact-head CI; merge lineage and deployment read checks.

Test-schema evidence is isolated in the designated Supabase test project. It is not production or physical Android certification. Final CI/review/deployment results must be checked separately before any completion claim.

## Findings and learning

- Reject phone/name discovery: self-asserted records can squat an address. Only recipient-provided contribution references directly address an established collection.
- Use immutable collection IDs for PIN verification: duplicate self-asserted names must not deny legitimate access.
- Revoke all generations of receiver capabilities together; a legacy cookie must not reopen a locked inbox.
- Compare expected collection IDs before gift/request mutations so account switching cannot target another learner.
- Broadcast both before and after revocation; invalidate every pending load/reveal and ignore own-tab identity signals.
- Serialize address correction and paid reveal on the order row; recheck the bearer hash after acquiring the lock.
- Keep setup and recovery retries idempotent. Never report a gift saved merely because account creation succeeded.
- Workspace reset removed an earlier uncommitted attempt. This implementation is checkpointed in Git and all earlier evidence is revalidated against the restored candidate.
