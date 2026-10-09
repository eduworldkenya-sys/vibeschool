# Issue 753 reconciliation

Baseline: `df3a4405a9a801c2dd7f6783740e0f8c4effd4b8` (merged PR 752). GitHub issue 753 remains open. The owner now authorizes completion and merge after verification; the earlier three-concept visual approval requirement is superseded.

## Implemented corrections

- Attendance completion is labeled attendance marked, never lesson taught/day complete. Rendered regression exercises fully marked attendance without teaching-completion evidence.
- Today hero, lesson flow, urgent rules and summary use the all-class snapshot. Selected class/subject remains contextual for Quick tools. Notifications navigate to their actual destination.
- Navigation uses one inventory of 36 destinations with longest boundary matching, route family fallbacks, keyboard-operable sheets and desktop navigation.
- Claim codes remain absent from rendered roster text until an explicit Reveal action; Copy and regeneration remain explicit operations under existing database permissions. This is presentation privacy, not a replacement for RLS.
- Class tools use responsive minimum-width columns, readable neutral surfaces and 44px actions. Roster, bulk entry, groups, workbook and operations retain their handlers and canonical contracts.
- Subject creation uses the shared focus-trapped dialog, labeled controls and the existing create assignment RPC. Subject summary uses shared neutral surfaces.

## Current evidence and boundaries

The route ledger remains the detailed source of verification coverage. Design tokens across existing screens are not evidence that every screen, state or journey is fully redesigned or verified.

Isolated DOM tests verify workbook editing, zero marks, export parity, conflicts, classroom seating/save recovery, progress filtering, archived recovery, closed support and published-report protection. Isolated SQL tests verify responsibility authorization and reproduce/correct the canonical JSON school-context defect. These do not prove connected-project persistence.

Connected project backup metadata remains unavailable because secure management credentials are missing. No application record writes, live migration or grant changes were performed. Live credit balance is denied, school information RPC is missing, and responsibility readers fail on the JSON/table mismatch. The responsibility correction is prepared and tested only in isolated PostgreSQL. Deployed schema/grant drift must be inspected before repair; do not blindly replay migrations.

GitHub Git read works and current main equals the baseline. GitHub API access recovered after the saved network update. The redesign branch is pushed and draft PR #754 is open. Required CI and independent review remain gates; branch-protection metadata returns integration permission denial. Netlify reports a successful deploy preview for the initial pushed commit; no Vercel deployment or production release has been verified. Full route/state verification and connected write journeys remain incomplete.
