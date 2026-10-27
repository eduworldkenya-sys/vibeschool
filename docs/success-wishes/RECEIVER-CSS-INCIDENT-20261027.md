# Receiver tap failure — 27 October 2026

Incident: WISHES-RECEIVER-CSS-20261027. Owner: VibeSchool engineering.
Severity: high. Status: VERIFYING (release and live verification required).

The owner reported that `/success-wishes/open` did not open. Live browser
inspection on main `6680a023e3409fec87e0f88d6b4b942ca5e36438` reproduced
nonresponsive pointer clicks on the submit button and demo link. Keyboard Enter
submitted the form and returned the correct invalid-code response; keyboard
navigation also reached the demo. No customer credentials or wishes were used.

The receiver root's computed style was `pointer-events: none`, with a rotating
transform. The matching live stylesheet rule was `.receiver-theme`, containing
`pointer-events: none`, `position: relative`, and `animation: var(--animate-spin)`.
This contradicts the earlier production-readiness claim. A successful HTTP
response and development-mode browser tests did not establish working production
controls. The prior frontend certification is invalid for receiver pointer use.

## Cause and affected dependencies

The Tailwind 4 generator emitted native nested utilities under `.receiver-theme`.
The Next 14 optimized CSS pipeline collapsed their declarations onto the wrapper.
`pointer-events-none` and `animate-spin`, intended for decorative elements and
loading icons, consequently affected every receiver route. The sender does not
use this scoped utility wrapper. API access validation was observed working via
keyboard. No evidence points to a payment, database or permission failure.

This is a blocking shared frontend dependency: generator → receiver utilities →
receiver shell → open, invitation, consent, inbox, recovery, settings and demo.
Unrelated teacher, backend, provider and commissioning work stays outside scope.
No runtime or security switch is changed. No speculative deployment is needed.

## Canonical repair and regression

Flatten the generated PostCSS AST before Next processes it, retaining selector
scope, declaration order, media/support queries, keyframes and property rules.
Reject leftover nested rules or nesting selectors in the generator. Regenerate
the checked-in stylesheet; do not override the wrapper as a symptom workaround.

`qa/success-wishes/receiver-browser.cjs` now builds and serves production instead
of development. With ordinary motion enabled, check the wrapper is tappable,
stationary and unanimated at 320, 390, 560 and 1280 pixels, then click submit and
the demo link. Preserve the existing six-width private recipient, guardian,
recovery, isolation, logout and delayed-reveal tests against that same production
server. The production root observation is the negative control; working
invalid-code feedback and demo navigation are positive controls. No live SMS or
financial actions are required.

Regression ID: receiver-production-css-hit-targets. Monitoring improvement:
the existing required Success Wishes browser workflow now evaluates optimized
CSS, making the deployment-only defect visible before merge.

## Release and recovery gates

Require local generation check, lint, typecheck, production build/browser tests,
fresh exact-head GitHub checks, evidence-packet validation and verified-head
merge. Then separately verify the automatic production deployment and pointer
interaction on the public URL. Record exact candidate, merged and deployed SHAs
in the PR/evidence journal. No readiness claim applies before those gates pass.
Rollback is a scoped revert of the repair if necessary; restoring the broken
stylesheet is not an acceptable long-term recovery. Payment commissioning and a
valid private-card production journey remain separate from this CSS incident.
