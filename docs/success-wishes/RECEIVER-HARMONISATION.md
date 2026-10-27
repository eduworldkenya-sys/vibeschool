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
- #842 keeps its existing private token, consent, reveal-generation race protection and logout logic; ReceiverEnvelope delegates to the canonical shared BookCard: sender and receiver use the same four palettes, headline, text, details and cover faces. The dark receiver shell and crimson wax seal remain.
- #849 public header/footer entry links retained. Its competing bottom bar is replaced by the single shared ReceiverShell.

## Deliberate prototype substitutions

Real recipient details/counts replace sample identities. Opened/unopened states replace unsupported verification/payment states. Voice/photo attachments, simulated four-digit OTP, fictitious high fives, automated-message alerts and unsupported encryption/signature claims are excluded. Access links use existing VibeSchool routes. Personal messages are not sent to the browser before authorised reveal.

## Verification and rollback

Run TypeScript, changed receiver lint, production build, all Success Wishes contracts, existing controlled receiver/checkout/disabled-service browser journeys, and public trust contracts. Browser fixtures are synthetic and do not prove real SMS or payment commissioning. Browser assertions retain consent, wrong-card, expired-code, refresh, no-cropping and delayed-reveal/logout checks; update only the intended palette/heading expectations.

Rollback is a normal revert of the consolidated frontend commit; no data migration is involved. Required exact-head CI and visual browser review must pass before merge.

## Final review convergence (#833–#853)

- #852 recording styling and disclosure plus #853 draft feedback are integrated. Empty-draft copy describes future saving instead of claiming a nonexistent saved wish.
- #851 is replaced by a focused shared `BookCard.tsx` and `BookCard.module.css`: explicit sealed/unsealing/opening/opened/closing phases; synchronous interaction guard before awaiting authorisation; unmount generation checks; separate outside/inside cover faces; sender close/replay; reduced-motion handling. Typing and restored requests never auto-open a gift. The compact live preview remains available while editing. Existing form-start sound and error associations are retained.
- 97 competing book CSS rules were removed from the studio stylesheet. Four canonical palettes/headlines now live in `card-themes.ts`, shared by the gallery and sender/receiver book.
- Private text is rendered only after authorised opening and removed from the DOM on closing. Delayed-reveal/logout and cross-tab regressions remain required.
- Superseded page PRs must be closed after the consolidated exact candidate reaches main; no obsolete CSS/React or `fontally` duplicate is merged.
- The five expired public notices were substantively reviewed and updated; see `PUBLIC-NOTICE-REVIEW-20261027.md`. No provider, database, API, payment switch or runtime activation changes.
- Validation must cover all four themes, intentional opening, replay/close, draft restore/clear, microphone fixtures, consent, recovery, logout outage and delayed-reveal isolation. Synthetic/browser evidence is not a physical Android certification or a live payment/SMS commissioning claim.

Recovery inputs and submit remain disabled until client hydration completes, preventing a native form GET on slow devices. The receiver browser regression explicitly requires the recovery POST response before continuing to OTP.
