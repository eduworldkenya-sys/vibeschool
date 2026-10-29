# Receiver inbox: restore the gift experience

Mission: CYBORG-20261029114348-35bebc. Base: 598b2b64dfefa354a71e311405c6f90565104048.

## Outcome and scope

Restore themed gift covers, personal greeting, unopened/all filters, sender/design search, meaningful loading/empty/error states, opening feedback and real collection summary. Keep canonical PIN/legacy access, recipient isolation, server-authorised reveal and the existing four book designs. Use the shared sound preference for gift opening. Prevent shell logout leaving PIN content visible in other tabs. Do not modify checkout, payments, database schema, PIN policy, expiry policy or delivery.

The cover shown in the inbox is a lightweight themed representation, using the shared card palette/headlines. It does not render private message content or disclose the sender before opening. Dates render only when the current response provides a valid createdAt; no dates are inferred from expiry. Newer collection responses do not currently provide creation dates.

## Cause and repair

The PIN-access integration replaced the previous gift grid with generic rows, removed filtering, search and per-card progress, and stopped updating ReceiverShell's collection summary. The new inbox keeps that integration but restores gift presentation and useful controls. A synchronous opening lock prevents repeat taps. Session invalidation is separate from collection refresh, so changing tab during a legacy opening cannot strand every card disabled; unmount invalidates late navigation. Search never indexes an unopened sender, even if supplied by a legacy response.

Restoring the shell summary exposed its legacy Sign out action. Shell sign-out now notifies both canonical session channels so PIN inbox/gift tabs clear private content too. A failed sign-out is not represented as confirmed server revocation.

## Verification and rollback

Run focused lint, full typecheck/production build, all Success Wishes contract tests and qa/success-wishes/receiver-browser.cjs. Browser coverage includes 320/360/390/412/768/1280 widths, all four themes, filters/search/no-match, unopened sender protection, shared mute, book reveal/reclose, PIN unlock/recovery, cross-tab lock, delayed reveal/load, sidebar logout and legacy opening during visibility refresh. Fixtures are synthetic and are not production delivery proof. Fresh independent review is required before merge; exact-head CI is authoritative for integration.

Rollback: revert this change set. No database migration or stored-data rewrite is involved. Access model shortcomings (new-device inbox links and link-based recovery), the account form's field count and universal creation-date metadata remain separate work, not hidden UI promises.

## Blocking dependency discovered by CI

PR 902 at 7c918c891b91600d193f06af3a7854012cdaa1cd failed disabled-service browser acceptance because the floating offer introduced on base main intercepted the sender preview's Send this wish button. The failed job was 123432973019 (run 40869598927). This prevents the shared sender-to-receiver journey from passing; it is a blocking dependency, not a receiver access defect. The receiver work and its passed checks were checkpointed at that SHA.

Repair the existing offer behavior only: stop showing it once personalisation/preview enters view or the sender interacts with personalisation/payment. Preserve its approved appearance, copy, price choices and explicit offer-preview mode. The disabled browser acceptance now verifies the advert is hidden during editing. Re-run that full acceptance journey, receiver suite, exact-head CI and independent review on the final candidate. No payment initiation or service activation is changed.
