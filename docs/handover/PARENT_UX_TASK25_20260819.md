# VibeSchool Task 25 — Parent UX Final Pilot Certification Handover

Date: 2026-08-19
Branch: `cert/parent-ux-task25-20260819`
Draft PR: #291
Stacked foundation: Task 6 PR #285 head `23c515e1bc922c25558c59c60d956a40c27d3432`
Shared-foundation state: **HOLD — do not merge or mutate production.**

## Mission

Certify one understandable, privacy-safe family-school Parent experience:

`Login -> Parent authority -> verified child relationship -> child context -> Home -> Attendance -> Schoolwork -> Progress/Results -> Messages -> Profile -> Logout -> Re-login`

Task 6 is the authorization/functionality floor. Task 25 does not replace backend authorization with frontend child state.

## Starting state

The Parent app already had Command Center R1 and Task 6 security/functionality work, but the family experience still exposed internal product architecture and several trust defects:

- `Home / Inbox / VibeLearn / Learn / Children` primary navigation;
- competing `/parent/messages`, `/parent/connect` and `/parent/inbox` communication entries;
- zero attendance records indistinguishable from a real 0% attendance value;
- `excused` attendance included in some rate denominators and therefore capable of reducing the displayed rate like absence;
- UTC date derivation in child attendance instead of Kenya-local school date;
- Parent `Add Child` wording inconsistent with verified relationship authority;
- dead `/parent/settings` entry;
- React-only notification toggles that looked saveable but had no authoritative persistence;
- raw relationship terminology on Profile;
- Results defaulted silently to a child and had no visible sibling switcher;
- Homework exposed implementation submission states and due-date ordering rather than family action priority;
- no privacy-safe Report Problem route.

## Implemented repairs

### Parent information architecture

Primary navigation is now:

`Home / Children / Schoolwork / Progress / Messages`

The shell and legacy `/parent/connect` converge on `/parent/inbox`. Deep child routes remain child-scoped.

### Parent Home

`app/parent/page.tsx` was reduced to a family-first command surface:

1. `Needs attention`;
2. explicit child cards;
3. today attendance;
4. recorded attendance;
5. open/overdue homework and recent communication signals behind child-scoped actions.

The Home query keeps released assessment summary behind `getParentAssessmentSummary` and does not expose draft results.

### Attendance trust semantics

Home, Children and child detail now use the same rule:

- countable rate denominator = `present | late | absent`;
- attended numerator = `present | late`;
- `excused` is excluded from the rate denominator and is not treated as absence;
- no countable attendance records => no percentage, never synthetic 0%;
- a genuine 0% remains a real displayed value;
- no record today explicitly says it does not mean the learner was absent;
- child date boundary uses `Africa/Nairobi`.

Read-only production inspection confirmed current attendance values include `present`, `absent` and `excused`, making this distinction operationally necessary.

### Verified child relationship UX

All repaired child-linking affordances use `Link or request access` and `/parent/link-child`. Copy states that knowing a learner name is not enough to gain access.

Profile shows `Verified family relationship` instead of surfacing the raw production relationship value.

### Multiple-child / stale sibling state

- Task 6 Schoolwork retains request-version and empty-state reset before child data loads.
- Results now has an explicit sibling switcher with selected-state semantics.
- Results clears prior summary before a child switch and rechecks the requested learner through RLS before requesting the governed assessment summary.
- Homework clears prior learner data and invalidates stale async responses when child context changes.

Read-only production inspection currently finds two linked parent accounts with one linked learner each. Therefore production cannot prove the multi-child case today; deterministic branch contracts must cover it, and an authenticated disposable multi-child fixture is still required for final browser certification.

### Homework

Family-facing states are normalized to:

- `Overdue` only when no submitted work is recorded and the due date has passed;
- `Due soon`;
- `Assigned`;
- `Started`;
- `Submitted`;
- `Marked`.

Submitted/marked work is never downgraded to overdue merely because the due date passed. Read-only production inspection confirmed `homework.due_date` is a date and current submission statuses are `submitted` / `marked`.

### Results / progress

Results now always identifies the active learner and class, exposes a sibling switcher when needed, explains that draft/unreleased marks are hidden, shows score/max-score context when available, and avoids interpreting missing results as poor performance.

### Profile / settings

- account identity remains editable where persistence already exists;
- linked learners derive from `parent_student_links`;
- fake local-only notification switches are removed;
- existing relationship-level alert state is descriptive only;
- child linking stays in the verified flow;
- logout remains explicit;
- Report Problem is available.

### Support

`/parent/support` captures privacy-minimized context: Parent role, support screen, timestamp, online/offline state and an ephemeral reference. It contains no learner/student identifier and warns against sending passwords, PINs, full assessment records or screenshots containing unrelated learner information.

### Mobile/accessibility shell

- semantic primary `<nav>`;
- `aria-current` for the active tab;
- 44px header controls;
- bottom safe-area padding;
- focus-visible treatment;
- lightweight loading/error states;
- child switch controls expose selection state.

## Permanent regression protection

Added:

- `scripts/validate-parent-ux-task25.py`;
- `.github/workflows/parent-ux-task25-contract.yml`.

The Task 25 contract checks navigation, Parent Home attention hierarchy, Kenya-local attendance semantics, excused handling, no-child verified linking, child-scoped routes, Homework state semantics, stale sibling clearing, Results publication/context behavior, Profile truthfulness and privacy-safe support.

Task 6 `Parent Core Journey Contract` remains required alongside it.

## Read-only production evidence

No production mutation was performed.

Observed only as aggregates/schema metadata:

- active Parent links: 2;
- parents with links: 2;
- linked learners: 2;
- each current linked Parent has one learner;
- current relationship text values: `parent`;
- current attendance rows include present/absent/excused;
- current homework submission values include submitted/marked;
- `homework.due_date` is a PostgreSQL `date`.

These observations were used only to validate UX semantics; no relationship, attendance, homework or configuration row was changed.

## CI / validation state

Task 25 is still running branch-level certification. On earlier Task 25 heads, inherited Parent Core Journey, migration security, Student One and production-build contracts were green. The latest exact head must still complete its newly triggered CI after the Parent Home/Profile refinements.

Required exact-candidate gates before completion:

1. Parent UX Task 25 Contract;
2. Parent Core Journey Contract;
3. TypeScript + production build;
4. Auth gateway/onboarding contracts;
5. Student identity/full-journey contracts;
6. migration/RLS security contracts;
7. deterministic multi-child/revocation/cross-child scenarios;
8. authenticated Android/browser Parent E2E;
9. final production mobile smoke after intended deployment.

## Browser/mobile limitation in this gated phase

The hosting project was inspected read-only and no deployment was created. The available execution runtime does not currently expose the browser CLI required by the installed browser skill, and production has no multi-child fixture. Therefore branch/mobile browser evidence must not be fabricated. Static/mobile interaction contracts and CI continue; authenticated mobile E2E remains a final gate.

## Shared-foundation dependencies

Do not merge Task 25 while the hold is active. Reconcile after the relevant foundations land, including:

- Task 1 Auth/Onboarding PR #281;
- Task 3 canonical Student identity PR #283;
- Task 6 Parent Core Journey PR #285;
- Task 8 authorization/privacy PR #288 where it affects Parent/global authorization;
- Task 12 telemetry PR #289;
- Task 21 measurement work for final Parent analytics event naming/measurement alignment.

Current `main` remains `77051a4011d7712a275f76af41efed382f017398`; no false exact-main certification has been claimed while those dependencies remain open.

Final sequence:

`fetch exact current main -> reconcile Parent/auth/student/relationship/security/telemetry changes -> rerun privacy + multi-child + revoked-link + mobile + TypeScript/build -> exact candidate -> intended deployment -> production Parent smoke`

## Production safety log

- production Supabase mutation: **NONE**;
- production migrations: **NONE**;
- production RLS/grant changes: **NONE**;
- production relationship repair: **NONE**;
- Edge Function deployment: **NONE**;
- intentional Vercel deployment: **NONE**;
- merge: **FORBIDDEN while hold remains**.

## Certification state

**NOT FINAL / HOLD.**

There are no known unresolved P0 defects introduced by Task 25. Confirmed Parent UX P1 defects found in this audit have branch repairs, but Task 25 cannot be declared pilot-certified until the exact-current-main, latest CI/build/privacy suite, deterministic multi-child proof, authenticated Android/browser E2E and post-deployment production smoke are green.