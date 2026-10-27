# Receiver HTML design harmonisation

Scope: reconcile PRs #833–#849 into one frontend change from cad6da8e. The owner's pasted HTML is the visual reference: obsidian, gold/emerald/crimson, local Cinzel/Jakarta/script fonts, glass panels, desktop sidebar, mobile drawer and one five-item bottom bar, wax-seal envelope and keepsake message.

Canonical contracts remain unchanged: six-digit server-verified SMS, consent, card-scoped private access, immutable paid card content, inbox recovery, safety operations and device logout. No API, database, payment activation or external SMS changes.

## Reconciliation

- #833 superseded by #839 inbox structure plus shared shell; remove invalid JSX and fake security/audio controls.
- #834 sender wrapper intentionally excluded: preserve the existing sender studio and checkout; shared website entry links cover discoverability.
- #835 rejected as malformed: React in a CSS file, simulated audio/reactions and a noncanonical opening API. Existing Receiver.module.css remains intact.
- #836/#837/#838/#843/#845/#847/#848 retain their frontend designs and canonical calls; repair label associations and clipboard feedback.
- #840 retained; #844 duplicate rejected (three misspelled finally blocks).
- #841/#846 background/frame intent handled by the shared receiver layout rather than duplicate wrappers.
- #842 keeps its existing private token, consent, reveal-generation race protection and logout logic; ReceiverEnvelope renders the requested wax-seal design.
- #849 public header/footer entry links retained. Its competing bottom bar is replaced by the single shared ReceiverShell.

## Deliberate prototype substitutions

Real recipient details/counts replace sample identities. Opened/unopened states replace unsupported verification/payment states. Voice/photo attachments, simulated four-digit OTP, fictitious high fives, automated-message alerts and unsupported encryption/signature claims are excluded. Access links use existing VibeSchool routes. Personal messages are not sent to the browser before authorised reveal.

## Verification and rollback

Run TypeScript, changed receiver lint, production build, all Success Wishes contracts, existing controlled receiver/checkout/disabled-service browser journeys, and public trust contracts. Browser fixtures are synthetic and do not prove real SMS or payment commissioning. Browser assertions retain consent, wrong-card, expired-code, refresh, no-cropping and delayed-reveal/logout checks; update only the intended palette/heading expectations.

Rollback is a normal revert of the consolidated frontend commit; no data migration is involved. Required exact-head CI and visual browser review must pass before merge.
