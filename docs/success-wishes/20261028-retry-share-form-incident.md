# SW-20261028-RETRY-SHARE-FORM

State: VERIFYING. Owner: Success Wishes maintainer. Scope: sender and private gift UI.
Base/source and initial production: `fa9ab06c5f816fc1372bab9fbb12e4fc1f5fdb13`.
Initial production deployment: `dpl_6qiDzDnEhyjMnagCLJ41tjtctLDr`, READY, production alias verified through Vercel.
All times below are Africa/Nairobi on 28 October 2026. Customer identifiers, tokens and receipt numbers are intentionally excluded.

## Production facts

Read-only Supabase evidence established that the reported KSh 50 attempt created at 20:14:07 received a callback with result 1037 at 20:14:19 and ended in failed state. The later attempt created at 20:37:24 settled at 20:38:04: callback result 0, independent query result 0, receipt present, provider verification and settlement timestamps populated. Exactly one paid gift for that successful order was issued at 20:38:05 and opened at 20:40:33. The hash of the user-provided private URL matches that gift. The gift is unrevoked and expires on 26 January 2027. No SMS delivery ledger entry exists for that order; SMS receipt is not claimed.

The screenshot shows airplane mode and Wi-Fi. Phone/SIM reachability is a plausible contributor to the failed attempt, but the exact device-level root cause remains unproven. No new payment, SMS or reveal request was initiated in this investigation.

## Confirmed defects and causal repairs

- Failed checkout displayed only a generic message. Recovery was hidden inside order details. Add a visible Try again action, re-read status before resetting, preserve the immutable card and recipient phone plus payer phone, generate a fresh key, and require a further explicit Pay tap. Never retry pending or uncertain outcomes automatically. Existing six-second bounded status polling is retained; there is no full-page auto-refresh or automatic charge.
- Checkout and private gift page had no WhatsApp action. Reuse one validated canonical-link helper and one UI component. Encode the complete URL fragment in WhatsApp text; sending remains the user's action. Exclude message/phone/receipt from the share text, enforce the trusted origin/path/token shape, and retain no-referrer/noopener protections.
- Candidate collapse was gated on touching the default exam year. Remove that extra prerequisite; the valid default year suffices. Typing retains the active field; leaving valid fields collapses them; invalid fields remain open; summaries preserve one-tap editing.
- A white completed-section override diverged from the dark/gold form. Restore the existing dark surfaces and gold check/edit icons. Keep all four designs and envelope/book animation code unchanged.
- Message starters lived outside the message disclosure, allowing focus to move into a collapsed textarea. Keep starters and character count inside that section. Reset disclosure/progress state when clearing a draft.
- Intrinsic-size disclosure animation lacked interpolation support. Add a feature-gated 230ms intrinsic-size transition and retain native fallback and reduced-motion behavior. Disappearing fields were not reproduced in the available browser; no claim of that root cause is made.

Dependency classification: non-blocking UX/recovery defects. No canonical payment backend, schema, RLS, merchant setting, activation flag or receipt contract changes. Blast radius: sender form, checkout modal, gift-page share affordance. Rollback: revert this UI change set; existing paid gift links remain valid.

## Evidence and regressions

- Checkout browser acceptance: 320, 360, 390, 412, 768, 1280 pixels; pending refresh, uncertain/missing order denial, failed status recheck, preserved recipient vs payer, fresh retry key, one explicit payment request, settlement sharing, sealed gift sharing.
- Sender browser acceptance: valid/invalid collapse, one-tap edit, default-year handling, progress timing, clear/reset, draft refresh, school selection/editing, four templates, opening/closing and private-message boundaries.
- Sharing unit tests: exact fragment round trip and hostile/malformed origin/path/token rejection.
- Positive control: the authentic settled production order and opened gift are separate evidence from synthetic browser tests.
- No actual WhatsApp message is sent by tests. Native WhatsApp handoff on Android remains a device-level validation, not a claimed automated result.

Preflight failures are retained in local evidence: a full Chromium launch was prohibited by the host socket sandbox; the installed headless shell worked. An overlapping dev/build run collided in the generated Next cache and failed with ENOENT; the production build was rerun in an isolated workspace. Older browser tests attempted to focus hidden fields after intended collapse; tests now exercise the visible edit controls and retain validation assertions.

Closure requires exact-head CI and integration/deployment verification. Until those pass, this record remains VERIFYING and is not a production certification.

Local verification: 133/133 Success Wishes contract tests passed; typecheck passed; lint passed with existing repository warnings; production build passed in the isolated workspace; checkout browser tests passed at all six widths; sender browser tests passed at all seven widths, including school edits, private invitations, sound and sealed/opened state. These are local/synthetic results and do not claim native WhatsApp delivery.

Regression sensitivity: restoring the old touched-exam-year guard in an isolated source copy made the new default-year browser assertion fail (5-second timeout). The unmodified repaired candidate passed the same assertion at six widths.
