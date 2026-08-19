# Task 5 — Student Core Journey Certification Handover

## Promotion state

**RECONCILE REQUIRED / SHARED-FOUNDATION HOLD**

Task 5 remains draft, production-disconnected and unmerged. Production access is read-only until all upstream shared-foundation dependencies required by the promotion chain have merged and Task 5 has reconciled against exact-current `main`.

Promotion chain: `T2 → T1 → T3 → T8 → T4 → T5 → T6 → T7`.

## Candidate

- PR: #284
- Branch: `agent/task5-student-core-journey`
- Original base: `77051a4011d7712a275f76af41efed382f017398`
- Last observed current main during this reconciliation pass: `30dc14a4fff04ed671e034cb4c3be9156dd3d976`
- Task 5 head after migration-security contract repair: `5dec7dc0a703840ff4b5348201035cf49a329288`
- Exact-head evidence is invalidated whenever candidate SHA changes.

## Upstream reconciliation

### Task 2 / Task 1

Current main advanced 32 commits beyond the Task 5 original base and contains Task 2 reconstruction work plus the Task 1 authorization/claim-boundary merge.

Material Student-facing contracts added/changed upstream include:

- auth callback/session continuation
- auth routing and logout behavior
- Student UUID auth-resolution repair
- profile authority grants
- claim-role production reconciliation
- private identity anonymous-grant hardening
- teacher-directory authority guard
- legacy parent child-creation tombstone
- identity-role transition guards
- repository reconstruction for `public.notifications`

Task 5 must not treat the old base as certified after these changes.

### Notifications reconstruction conflict — P0 security/reconstruction blocker

Task 2 now owns reconstruction of `public.notifications` via `20260819222000_task2_notifications_reconstruction.sql`.

Task 5 previously carried its own earlier reconstruction migration `20260819023400_restore_notifications_prerequisite.sql`. This creates overlapping ownership and must be reconciled before promotion.

More importantly, the Task 2 migration recreates `notifications_admin_insert` with a school-admin existence check that does not bind `school_members.school_id` to `notifications.school_id`. That repository contract is weaker than the currently observed production policy, which is school-bound.

Task 5 must not inherit or certify a cross-school notification insertion boundary. Final reconciliation must leave one canonical reconstruction path and a school-bound authorization policy.

## Production read-only forensics

Project inspected read-only: `yauqsxggtuxuykcbrtzf`.

Observed `public.notifications` state during this pass:

- relation exists
- 1 notification row currently present
- observed event type: `homework_submitted`
- own-read policy binds `user_id = auth.uid()`
- own-update policy binds `user_id = auth.uid()`
- current production admin-insert policy is materially stricter than the Task 2 repository migration because it binds authorization to the notification school and a legitimate target relationship
- production still exposes authenticated DELETE table privilege, which differs from the Task 2 intended canonical grant set and must be classified during final drift reconciliation

No production data, RLS, grants, functions, migrations or Edge Functions were modified.

## Task 5 local repairs already present

Candidate branch includes work for:

- Africa/Nairobi learner-day semantics
- current-grade unfinished Continue Learning
- KCSE/Form isolation
- StudentProvider recovery
- homework retry/submission integrity
- exercise draft/submit/feedback lifecycle
- assessment grounding reconciliation
- VibeLearn publication/subject reconciliation
- actionable learner notifications
- Student navigation and Progress access
- Student Core Journey regression coverage

These remain candidate repairs, not final certification.

## CI evidence

At pre-reconciliation head `6814366da7a4945b94c5032798845fc519a1fef7`, all visible Task 5 workflows passed except Supabase Migration Security Contract.

Root cause: `20260819023400_restore_notifications_prerequisite.sql` created `public.notifications` without the required `-- authorization-test: public.notifications` declaration.

Repair commit: `5dec7dc0a703840ff4b5348201035cf49a329288`.

At that exact head, the Supabase Migration Security Contract passed, along with:

- Student Core Journey Pilot
- Student One Full Journey
- Student One Legacy Identity Recovery
- Student Provisioning Contract
- Deterministic Twin Contract
- CI Production Build Contract

Additional workflows were still running when this manifest was updated. No queued/running workflow is recorded as PASS until completion.

## Required final attack matrix

### Identity and authorization

- canonical `students.id` resolution
- no use of account UUID as learner identity except explicit bridges
- Student A cannot SELECT/INSERT/UPDATE/DELETE Student B-owned data
- RPC/direct URL/cache attacks remain denied
- profile/class/grade institutional truth cannot be self-mutated

### Grade and curriculum

- primary → KCSE deny/hide
- Grade 4 → Grade 10 automatic action deny
- stale historical grade does not dominate current eligibility
- Senior School CBE and legacy Form/KCSE remain distinct

### Homework / practice / assessment

- homework submit idempotency under concurrent retries
- submitted homework cannot revert to draft
- exercise has complete execution lifecycle
- assessment start creates/resumes one logical attempt
- assessment submit is deterministic under duplicates
- unreleased results remain invisible
- grounding requirements remain intact

### Learning state

- Continue Learning is unfinished/currently eligible
- reading progress is durable and does not imply mastery
- progress/mastery semantics remain evidence-based
- revision does not recycle completed work indefinitely
- Twin advises and never overrides canonical academic truth

### Notifications

- one canonical reconstruction migration path
- school-bound insert authorization
- student-owned reads/updates only
- actionable/deduplicated event emission
- destination reauthorization
- stale destination failure is safe

### Reliability / mobile

- weak-network retry semantics
- no false submitted state before durable server acceptance
- narrow Android viewport core journey
- no permanent spinners or wrong-learner flashes
- accessible forms/status changes

## Remaining upstream gates

Final Task 5 promotion remains blocked until:

- Task 3 merged and reconciled
- Task 8 merged and reconciled
- Task 4 merged and reconciled
- Task 5 synchronized with exact-current main
- all affected exact-head gates rerun
- production advisors reviewed after any intended DDL is promoted
- controlled positive and negative production Student E2E pass
- no owned P0/P1 remains

## Safety constraints

Until the shared-foundation hold clears:

- do not merge Task 5
- do not mutate production Student data
- do not apply production migrations
- do not modify production RLS/grants
- do not deploy Edge Functions
- do not activate feature flags
- do not intentionally trigger Vercel deployment

## Completion rule

Only exact-current-main, exact-head evidence counts. Any upstream contract change or candidate SHA change invalidates affected certification evidence and returns Task 5 to `RECONCILE REQUIRED` or `RECONCILING` until rerun.
