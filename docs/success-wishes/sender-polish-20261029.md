# Sender form, payment feedback and sharing polish

Scope: preserve the four card designs, guest payment backend and existing collapsible form. Improve the sender's spacing, progress visibility, suggestions, optional sound and confirmed-success sharing.

## Contract

- Required sections count toward progress after editing starts; optional school does not block completion. Active fields remain open while typing; completed details collapse on leaving and can be edited.
- “Need a wish?” and starter buttons precede the editable message. Replacing existing writing requires confirmation.
- Sound defaults off, with a visible remembered toggle. First message editing plays one short melody when enabled. Further keystrokes do not restart it. Confirmed card availability/provider-accepted SMS may chime; opening a sharing app does not imply sending.
- Pending/uncertain payments retain their order and cannot offer duplicate payment. Checking is automatic with a manual status button and bounded waiting message; closing/reloading restores the same order.
- A settled order with an issued private link shows card-ready confirmation, checkmark and brief sparkles. Provider-accepted SMS shows invitation-sent wording, without claiming handset delivery. Failed, refunded, pending and linkless orders cannot celebrate a ready/sent card.
- WhatsApp and native sharing retain the complete private fragment. Copy has explicit feedback; long links stay under “View link”. Cancelling a share cannot change the payment/delivery status.
- Reduced-motion preferences suppress decorative movement. Keyboard focus skips controls hidden inside closed disclosures.

## Verification

- Full Success Wishes contract suite: 135 passed, including state/acceptance and personalized-link regressions.
- TypeScript and targeted ESLint passed.
- Production build passed on the implementation; final candidate verification is enforced by required CI.
- Synthetic Chromium UI checks at 320/360/390/412/768/1280 cover review, payment retry, uncertain recovery, refresh, optional-school progress, suggestions above editor, preserving existing writing, complete sharing tokens and no horizontal overflow.
- Additional 320px controls verify silence before opt-in, four-note melody exactly once while editing, native-share cancellation, copy feedback, and restored provider-accepted invitation confirmation.
- Real M-Pesa charges, SMS delivery, production activation and deployment were not exercised by these synthetic tests.

## Findings and recovery

The baseline placed starters below the editor and played the reveal sound on field focus. It exposed duplicate sharing/link controls and lacked a distinct ready-versus-sent success state. These are repaired in the existing canonical components. Existing retry/idempotency, payment security, card designs and receiver access are preserved.

Browser download/package setup failed in this host; a disposable Chromium package was used outside the repository. No package/lockfile change or browser binary is part of the product diff.

Rollback: revert this UI change; it adds no migration, provider setting or payment activation.
