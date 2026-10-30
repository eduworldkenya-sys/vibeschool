# Success Wishes simplification

This extends the existing receiver, session, guest-order and gift ledgers. No replacement account, commerce or delivery engine is introduced.

## Identity and access

A phone is a delivery address. It is never an account lookup or an access credential. Shared numbers and duplicate names remain valid. Each previously unassigned gift obtains a distinct canonical receiver reference. An explicit recipient request retains the existing account assignment. Anonymous deliveries are not silently matched to an account by name, phone or school.

Opening a private gift reads its book directly and remembers that specific gift in an HttpOnly, SameSite=Strict browser cookie backed by the existing receiver-session table. The session has no receiver/account authority and cannot be used as a PIN or legacy verified session. My wishes displays only gifts already opened by this browser, in separate recipient collections. If a different PIN collection is already signed in, both authorised collections remain visible; gifts already in that PIN collection are not duplicated. It never enumerates people at an entered number. PIN setup is optional; existing PIN, recovery, consent and reporting routes remain available. An explicit authenticated attach still controls account membership. A gift link never unlocks other gifts belonging to its recipient.

New provisional recipients can lack a phone when the existing free sender flow supplies only a private link. This does not weaken PIN setup's server-side phone validation or mark the recipient verified. Automatic account attachment based only on matching names has been removed.

## Verified delivery

New guest orders store only the derived link hashes at creation, alongside existing immutable card snapshots. On a verified transition to settled, the database invokes the existing single/group issuers transactionally. Callback/status retries cannot create duplicate gifts or intended recipients. Unpaid, unverified, refunded and revoked gifts remain unavailable. Historical orders without stored delivery hashes retain their existing status/recovery issuance path. No provider API, price, merchant destination, payment verification rule or activation switch changes.

The existing authorised HQ ledger now exposes the chain from card ID through order/receipt, intended recipient ID and delivery address, with search by those references. Private gift tokens are not required or returned.

## Compatibility and rollout

Apply the additive migration before deploying the app. It fills only missing gift recipient references; existing cards, account owners, messages, links, payment evidence and PIN epochs remain unchanged. Existing application code continues to work with the extended schema. Roll back application code if required; retain the additive schema and do not delete issued cards or payment records. Removing only the automatic-delivery trigger restores status-driven issuance without changing settlement checks or access links. Payment initiation switches remain as commissioned; this change does not activate any switch.

## Verification boundaries

The disposable database fixture covers Joe and Apex Plaster sharing a number, duplicate names, existing-account preservation, automatic verified delivery, failed-payment rejection, group delivery, retries, anonymous session isolation and existing checkout/PIN/group regressions. Next handler tests cover private links, secure cookies, unrelated gift denial, revoked consent, refunded/revoked gifts and sign-out. Browser checks use synthetic API responses and are not evidence of a new real M-Pesa transaction. Production payment and deployment status must be verified separately; no such certification follows from this document.

The public browser contract now asserts that uncommissioned voice/video controls remain hidden behind the existing text-card price choices. Recording/media implementation remains covered by the existing unit contracts. Legacy invitation opening, duplicate-name isolation, sender draft restoration, all four designs, sound controls, private links and independent-context sign-out remain in the browser regression suite.
