# Receiver premium frontend — 27 October 2026

## Requested outcome
Match the existing sender studio: dark navy background, warm gold actions, fewer instructions, and a gift visible immediately. Frontend only; no database, API, payment, SMS, consent policy or authentication changes.

## Implementation
- One receiver stylesheet covers open-code, verify, inbox, recovery, request, safety, guardian and school-support screens.
- Invitation uses the same receiver shell. A theme-matched sealed cover is visible before consent; the existing envelope/book reveal remains behind its existing verification and reveal calls. No private sender/message is added to the public cover.
- Inbox shows all four themed covers before secondary utilities. Open/reopen, filters, ask, privacy, recovery and logout remain available.
- Secondary privacy guidance moves into native disclosure controls. Adult/guardian consent declarations and consequential withdrawal explanations remain explicit.
- `BookCard.receiverView` is an optional presentation hook. Only invitation enables it. Opened receiver pages stack naturally on small phones, keeping long messages readable. Sender layout and event handlers are unchanged.
- Focus after reveal uses `preventScroll` so the gift does not jump offscreen.

## Evidence collected locally
- TypeScript: pass.
- Changed TSX ESLint: pass, no warnings.
- All 89 Success Wishes contracts: pass, using the repository's scoped Next.js test resolver.
- Existing receiver controlled journey: pass at 320, 360, 390, 412, 768 and 1280 pixels; guardian approval, multi-card inbox, exact reveal, wrong OTP, refresh, recovery, delayed reveal/logout and cross-tab purge.
- Existing unified sender/recipient development journey: pass; four sender sizes, two separate same-name recipients, sound/mute, saved message, refresh, invalid invitation and sign-out isolation. Real payment/sending remains off.
- Additional fixture-driven UI inspection: 10 receiver/support screens at 320, 360, 412 and 1280 pixels; dark background and no horizontal overflow. Sealed, failed reveal and empty inbox checked. No page errors.
- Visual review found the narrow two-page mobile message and repaired it with a receiver-only vertical layout.

Browser fixtures and development-only local test APIs are UI evidence, not live SMS, database-journey or payment certification. Existing browser assertions were updated for the new labels; privacy and session assertions were preserved. A longer message protects the mobile crop regression.

## Integration and limits
Base: `8de5b2110104ff52218a1223c1074cab5b0ec355`. Changes are isolated from checkout PR #830. That PR also changes the verify page; preserve its setup-token logic during any later three-way reconciliation. No code from that PR is included here.

Required before production claims: exact-head CI, applicable review, merge confirmation, and deployed-revision/UI verification. This document records implementation and local evidence only. The public receiver/pilot activation gates remain unchanged.

Rollback: revert this frontend change set; there are no migrations or data transformations to reverse.

## Synthetic mobile screenshots

[Sealed gift](sealed-mobile.png) · [Opened message](opened-mobile.png) · [Private inbox](inbox-mobile.png)

All names, messages and schools in these screenshots are synthetic browser fixtures.
