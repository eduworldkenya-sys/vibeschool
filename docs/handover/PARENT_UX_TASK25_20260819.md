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

The Parent app already had Command Center R1 and Task 6 security/functionality work, but the family experience still exposed internal product architecture and trust defects:

- `Home / Inbox / VibeLearn / Learn / Children` primary navigation;
- competing `/parent/messages`, `/parent/connect` and `/parent/inbox` communication entries;
- zero attendance records indistinguishable from a real 0% attendance value;
- `excused` attendance capable of reducing some displayed rates like absence;
- UTC date derivation in child attendance instead of Kenya-local school date;
- Parent `Add Child` wording inconsistent with verified relationship authority;
- dead `/parent/settings` entry;
- React-only notification toggles that looked saveable without authoritative persistence;
- raw relationship terminology on Profile;
- Results silently defaulted to a child and had no visible sibling switcher;
- Homework exposed implementation submission states instead of family action priority;
- academic `Learning & progress` incorrectly routed to physical height/weight `growth`;
- Family Inbox exposed technical acknowledgement language and trusted stored action routes too broadly;
- child messaging could expose raw backend error text and lacked an explicit in-flight duplicate-send guard;
- no privacy-safe Report Problem route.

## Implemented repairs

### Parent information architecture

Primary navigation is now:

`Home / Children / Schoolwork / Progress / Messages`

The shell and legacy `/parent/connect` converge on `/parent/inbox`. Deep child routes remain child-scoped.

### Parent Home

`app/parent/page.tsx` is now a family-first command surface:

1. `Needs attention`;
2. explicit child cards;
3. today attendance;
4. recorded attendance;
5. open/overdue homework and recent communication signals behind child-scoped actions.

Released assessment evidence remains behind `getParentAssessmentSummary`; draft results are not promoted on Home.

### Attendance trust semantics

Home, Children and child detail now share one rule:

- rate denominator = `present | late | absent`;
- attended numerator = `present | late`;
- `excused` is excluded and is not treated as absence;
- no countable records => no percentage, never synthetic 0%;
- a real 0% stays a real displayed value;
- no record today explicitly says it does not mean the learner was absent;
- child date boundary uses `Africa/Nairobi`.

Read-only production inspection confirmed current attendance rows include `present`, `absent` and `excused`, so this distinction is operationally necessary.

### Verified child relationship UX

All repaired child-linking affordances use `Link or request access` and the verified `/parent/link-child` flow. Copy states that knowing a learner name is not enough to gain access. The legacy `/parent/connect-child` route remains only as a compatibility redirect.

Profile shows `Verified family relationship` instead of the raw production relationship value.

### Academic progress vs physical growth

A confirmed semantic/privacy defect routed academic `Learning & progress` to `/parent/child/[id]/growth`, which is a physical height/weight feature.

Task 25 adds `/parent/child/[id]/progress` as the academic family route. It:

- rechecks the child through RLS before reading progress;
- reads only `parent_learning_summaries` with `status = published`;
- shows strengths, focus areas and teacher comments;
- distinguishes missing summary data from poor learner performance;
- links released assessment results separately.

The physical growth route remains a legacy/non-core feature and is no longer represented as academic progress in the certified child journey.

### Multiple-child / stale sibling state

- Task 6 Schoolwork retains request-version and empty-state reset before child data loads.
- Results now has an explicit sibling switcher with selected-state semantics.
- Results clears prior summary before a child switch and rechecks the requested learner through RLS before requesting the governed assessment summary.
- Homework clears prior learner data and invalidates stale async responses when child context changes.
- child-scoped progress/homework/results/messages links preserve the selected learner rather than relying on implicit first-child selection.

Read-only production inspection currently finds two linked parent accounts with one linked learner each. Production therefore cannot prove the multi-child case today; deterministic branch contracts cover stale-state invariants and an authenticated disposable multi-child fixture remains a final browser gate.

### Homework

Family-facing states are normalized to:

- `Overdue` only when no submitted work is recorded and the due date passed;
- `Due soon`;
- `Assigned`;
- `Started`;
- `Submitted`;
- `Marked`.

Submitted/marked work is never downgraded to overdue merely because its due date passed. Read-only production inspection confirmed `homework.due_date` is a PostgreSQL `date` and current submission statuses include `submitted` / `marked`.

### Results

Results always identifies the active learner and class, exposes a sibling switcher where needed, explains that draft/unreleased marks are hidden, shows score/max-score context where available, and avoids interpreting missing results as low performance.

### Family Inbox / notifications

The unified inbox now groups information into:

- Action needed;
- Child updates;
- School notices;
- Account & other updates.

Technical `ACK REQUIRED` language is replaced with `Needs your confirmation`. Child-scoped events name the learner. Stored action links are constrained to the `/parent` namespace before navigation.

Critically, a failed authoritative Inbox load has its own fatal state. The UI clears stale events and says `Family updates are unavailable`; it will not tell a parent `You are caught up` when the backend event stream cannot be confirmed.

### Child messaging

- parent/child relationship is checked before messaging;
- available staff comes from the learner's assigned class context;
- raw RPC/database error text is not rendered;
- send uses an explicit in-flight guard against repeat taps;
- failure keeps the draft and says the message was not confirmed as sent;
- successful backend insert produces `Message sent.`;
- child and school context remain visible in the conversation.

### Profile / settings

- account identity remains editable only where persistence exists;
- linked learners derive from `parent_student_links`;
- fake local-only notification switches are removed;
- relationship-level alert state is descriptive only;
- child linking stays in the verified flow;
- logout remains explicit;
- Report Problem is available.

### Support

`/parent/support` captures privacy-minimized context: Parent role, timestamp, online/offline state, an ephemeral reference and a sanitized source screen. Child route identifiers are replaced with safe labels. It warns against sending passwords, PINs, full assessment records or screenshots containing unrelated learner information.

### Mobile/accessibility shell

- semantic primary `<nav>`;
- `aria-current` for active tab;
- >=44px primary controls;
- bottom safe-area padding;
- focus-visible treatment;
- lightweight loading/error states;
- child switch controls expose selected state.

## Permanent regression protection

Added:

- `scripts/validate-parent-ux-task25.py`;
- `.github/workflows/parent-ux-task25-contract.yml`.

The contract now covers family navigation, Parent Home hierarchy, Kenya-local attendance semantics, excused handling, verified no-child linking, academic-vs-physical progress routing, published progress summaries, child-scoped routes, Homework semantics, stale sibling clearing, child messaging recovery/duplicate-send behavior, Results publication/context behavior, useful Inbox grouping and fatal-load truth, Profile truthfulness, and privacy-safe support.

Task 6 `Parent Core Journey Contract` remains required alongside it.

## Read-only production evidence and drift

No production mutation was performed.

Observed only through aggregate/schema/policy reads:

- active Parent links: 2;
- parents with links: 2;
- linked learners: 2;
- each current linked Parent has one learner;
- relationship text values currently: `parent`;
- attendance rows include present/absent/excused;
- homework submissions include submitted/marked;
- `homework.due_date` is a PostgreSQL `date`;
- core Parent-facing tables have RLS for student/attendance/homework/submission/learning/message boundaries.

### Production drift blocker 1 — Parent event stream not deployed

Repository migration `20260818184500_parent_event_inbox_and_fee_truth.sql` creates the governed `public.parent_events` inbox, its RLS and event emitters.

Read-only production inspection on 2026-08-19 returns `to_regclass('public.parent_events') = null`.

Therefore the production Family Inbox is **not deploy-complete** and cannot be certified today. Task 25 does not hide this with a fallback and does not apply the migration while the shared-foundation hold is active.

### Production drift blocker 2 — assessment publication policy is pre-Task-6

The live `assessment_gradebook_entries` Parent SELECT policy is relationship-scoped, but the inspected production policy does not itself require a released/published timestamp. Task 6 owns the backend publication hardening for the final Parent candidate.

Task 25 therefore refuses to certify the current production database as the final privacy state. Exact-candidate RLS must be rechecked after the shared Parent/security foundation reaches production.

### Other global security advisory

Supabase Security Advisor reports leaked-password protection disabled plus broader platform function search-path advisories. These are tracked as shared Auth/security foundation concerns rather than changed from Task 25.

## CI / validation state

Exact implementation head before this handover refresh was `c6b639eb0ef456436d68d62c406320a9f52152a9`. Its CI suite was queued/in progress at the time of recording because the repository Actions queue is busy.

Earlier Task 25 heads demonstrated green inherited Parent Core Journey, migration-security, Student One and production-build contracts. These earlier greens are supporting evidence only and are **not** substituted for the exact-head gate.

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

The Vercel project was inspected read-only and no deployment was created. The available execution runtime does not expose the installed browser skill's required `agent-browser` CLI, and production has no multi-child Parent fixture. Branch/mobile browser evidence is therefore not fabricated. Authenticated mobile E2E remains a final gate.

## Shared-foundation dependencies

Do not merge Task 25 while the hold is active. Reconcile after the relevant foundations land, including:

- Task 1 Auth/Onboarding PR #281;
- Task 3 canonical Student identity PR #283;
- Task 6 Parent Core Journey PR #285;
- Task 8 authorization/privacy PR #288 where it affects Parent/global authorization;
- Task 12 telemetry PR #289;
- Task 21 measurement work for final Parent analytics event naming/measurement alignment.

Observed `main` remains `77051a4011d7712a275f76af41efed382f017398`; no false exact-main certification is claimed while those dependencies remain open.

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

No Task-25-introduced P0 defect is known at this branch state. The confirmed Parent UX P1 defects found during this audit have branch repairs and regression assertions, but Task 25 cannot be declared pilot-certified until shared foundations are merged/reconciled, the exact candidate CI/privacy suite is green, the production event-stream/publication-policy drift is deployed and reverified, multi-child mobile/browser proof is available, and the intended production Parent smoke passes.