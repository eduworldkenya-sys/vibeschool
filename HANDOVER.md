VIBESCHOOL TIMETABLE HANDOVER

Purpose

This file carries verified project state between Claude Code sessions.

Claude must read this file before working and update it before ending a session.

Do not rely on previous chat memory.

Repository state, Supabase state, git history, "TIMETABLE_FIX_REGISTER.md", and this file are the continuity mechanism.

---

CURRENT STATE

Active fix

FIX ID: TBL-006
TITLE: Build forward-collision register
STATUS: OPEN
PRIORITY: P0

Previous verified fix

FIX ID: TBL-005
TITLE: Add data preconditions for constraints
STATUS: VERIFIED

Current branch

BRANCH: main
LATEST COMMIT: see git rev-parse HEAD
WORKING TREE: clean at time of TBL-005 closure (TIMETABLE_FIX_REGISTER.md and HANDOVER.md updates pending commit in the same session)

Connected environments

SUPABASE ENVIRONMENT CLASSIFICATION: UNKNOWN
SUPABASE PROJECT REF: yauqsxggtuxuykcbrtzf
VERCEL ENVIRONMENT:

No database write is permitted while the Supabase environment remains "UNKNOWN".

---

TBL-001 VERIFIED HANDOVER

Objective

Align malformed, unversioned, and incorrectly versioned repository migration files with the intended live migration ledger version keys.

Root cause

- 9 migration files were misversioned or lacked valid ledger-compatible version keys.
- 2 repository files used invented versions for content already represented by live migration history.
- Repository filenames and live ledger keys were inconsistent.

Files changed

- 8 migration files renamed.
- "18a_teaching_occurrences.sql" renamed.
- 2 duplicate or invented-version files removed.
- 4 migration files added with recovered bodies.
- Total staged operations: 12.

Database objects changed

None.

Database writes

None.

Verification completed

- Reviewed staged git operations.
- Confirmed the operation list matched the approved TBL-001 plan.
- Confirmed unrelated edits remained untouched.
- Confirmed TypeScript passed during "vibe-check.sh".
- Confirmed no banned imports.
- Confirmed Supabase imports passed.

Unrelated changes preserved

- "app/teacher/homework/page.tsx"
- "lib/types.ts"

These were not part of TBL-001 and must not be modified by timetable migration work unless separately assigned.

Existing unrelated health-check findings

"vibe-check.sh" reported pre-existing application-wide findings involving:

- tables missing from or inconsistent with the checker's table allowlist;
- "minHeight: "100vh"" convention violations;
- one missing ""use client"" finding;
- possible sequential-await patterns;
- "className" informational findings.

These are not part of TBL-001 or TBL-002.

Do not fix them during timetable migration classification.

Known open migration risks

- 14 live ledger versions currently have no same-version migration file in the repository. CORRECTED 2026-07-20 by a read-only comparison of current GitHub main against the live Supabase migration ledger; the previous count was 7. The affected live versions are: 20260520000000, 20260717220005, 20260718062000, 20260718082408, 20260718141521, 20260718184230, 20260719132810, 20260720142114, 20260720143830, 20260720143840, 20260720143847, 20260720143903, 20260720143912, and 20260720200607.
- "20260711150000" is currently believed to be stale repository-only.
- The historical removal of "assessments" and "assessment_scores" is undocumented.
- Historical fix18e placeholders require explicit classification.
- Synthetic baselines require explicit classification.
- "20260720120000_fix18e_d_qualify_scheme_id.sql" — CORRECTED 2026-07-20: no live migration-ledger entry exists under version 20260720120000. The intended change is present under live ledger version "20260720143903" with name "fix18e_d_qualify_scheme_id". No same-version repository migration file currently corresponds to 20260720143903.
- "fix28_create_timetable_slot_error_codes_and_grants" is recorded under two live ledger versions: "20260720142114" and "20260720200607". The later entry is a harmless redundant reapplication of the same functional end state. Repeated REVOKE and GRANT statements are idempotent and do not by themselves prove that an earlier migration failed. The repository source-controlled representation is "supabase/migrations/20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql"; its executable database change is functionally equivalent to both live fix28 entries. The live ledger must not be deleted, renamed, or rewritten to remove either entry.

---

ACTIVE FIX — TBL-002

Title

Classify every migration.

Objective

Create one complete, validated, machine-readable classification of every migration version found locally or in the live Supabase migration ledger.

Scope

Inspect:

- "supabase/migrations";
- "supabase_migrations.schema_migrations";
- reconciliation manifests;
- recovery bundles;
- relevant git history.

Allowed work

- read repository files;
- query Supabase metadata;
- inspect git history;
- create classification artifacts;
- create non-destructive validation scripts;
- update this handover;
- update TBL-002 status in "TIMETABLE_FIX_REGISTER.md".

Prohibited work

- no migration body reconstruction;
- no migration ledger repair;
- no live schema writes;
- no RLS changes;
- no baseline execution;
- no "supabase db reset" against production;
- no timetable behavioural fixes;
- no unrelated application cleanup.

Required classification values

Each version must have exactly one:

PARITY_APPLIED
SYNTHETIC_BASELINE
PENDING_DEPLOYMENT
HISTORICAL_PLACEHOLDER
MISSING_REPO_SOURCE
STALE_REPO_ONLY
UNEXPECTED_LIVE_ONLY
NAME_MISMATCH
DUPLICATE_LOCAL_VERSION

Required artifacts

migration_classification.json
migration_classification.md
classification validation script

Artifact paths should be chosen consistently and documented here.

Suggested location:

supabase/reconciliation/migration_classification.json
supabase/reconciliation/migration_classification.md
scripts/validate-migration-classification.*

Required validation

The validator must fail when:

- a local version is unclassified;
- a remote version is unclassified;
- a version has multiple classifications;
- an invalid classification value is present;
- a duplicate local version exists;
- a mismatch lacks an explicit follow-up;
- required known entries are absent.

Required known entries

The classification must explicitly include:

- all 7 live versions missing repository files;
- "20260711150000";
- historical "assessments" and "assessment_scores" removal;
- historical fix18e placeholders;
- synthetic baseline migrations;
- "20260719160000_core_link_constraints.sql";
- "20260720120000_fix18e_d_qualify_scheme_id.sql".

Completion condition

TBL-002 can become "VERIFIED" only when:

- every local version has one classification;
- every remote version has one classification;
- the validation script passes;
- no live write occurred;
- no migration body was invented;
- every unresolved item has a documented follow-up;
- repository changes are committed.

---

SESSION WORK LOG

Append concise entries during the active fix.

Entry template

DATE:
SESSION:
ACTION:
EVIDENCE:
RESULT:

DATE: 2026-07-20
SESSION: Migration ledger investigation and documentation reconciliation
ACTION: Compared current GitHub main's "supabase/migrations" directory against "supabase_migrations.schema_migrations" in live Supabase project "yauqsxggtuxuykcbrtzf". Reviewed the duplicate live "fix28_create_timetable_slot_error_codes_and_grants" entries and the live version recorded for "fix18e_d_qualify_scheme_id". No application code, migration SQL, live database object, grant, migration-ledger row, or migration filename was modified.
EVIDENCE: The comparison found 14 live ledger versions with no same-version repository migration file. Repository version 20260711150000 is not present in the live ledger. Repository version 20260720123500 is the source-controlled fix28 representation, while live fix28 entries exist at versions 20260720142114 and 20260720200607. The live "public.create_timetable_slot" function and its execution grants were verified separately after the latest application: all 9 stable error codes are present and EXECUTE is absent for anon.
RESULT: TBL-002 remains OPEN. Its required "migration_classification.json", "migration_classification.md", and classification validator do not exist, so its stated completion conditions have not been met. These findings are evidence for TBL-002 and do not replace its required classification artifacts or validation.

---


DATE: 2026-07-22
SESSION: TBL-003 — correct pending migration handling
ACTION: Updated "scripts/validate-migration-classification.py" to validate explicit PENDING_DEPLOYMENT entries. Added "scripts/test_validate_migration_classification.py" with isolated fixture-based tests. A pending entry now requires one matching local migration file, absence from the embedded live ledger, an exact local_file match, a non-empty reason, a non-empty target_environment, an approval_status of AWAITING_APPROVAL, APPROVED, or BLOCKED, and a non-empty follow_up.
EVIDENCE: "python3 scripts/validate-migration-classification.py" passed against the existing TBL-002 classification artifacts. "python3 scripts/test_validate_migration_classification.py" passed all TBL-003 scenarios.
RESULT: TBL-003 implementation is awaiting approval and commit. No SQL was created, no Supabase migration was created, no Supabase write occurred, no migration ledger repair occurred, and no application code was modified. "20260711150000" remains STALE_REPO_ONLY and was not automatically reclassified.

---
APPROVAL GATES

Pending approvals

None currently.

Standing production restriction

Before any destructive or migration-history-changing command, record:

TARGET ENVIRONMENT:
PROJECT REF:
COMMAND OR SQL:
EXPECTED IMPACT:
PREFLIGHT RESULT:
ROLLBACK OR RECOVERY PLAN:
APPROVAL STATUS:

The operation must not run until "APPROVAL STATUS" is explicitly changed to "APPROVED".

---

CURRENT BLOCKERS

None recorded.

---

NEW FINDINGS

Record unrelated findings here without fixing them.

ID| Finding| Evidence| Suggested future area| Status
NF-001| "vibe-check.sh" table validation may use an incomplete or stale allowlist| Known tables such as profiles, school_members, teacher_classes, and scheme_of_work appeared in the failure output| Repository health-check tooling| OPEN
NF-002| Several pages violate the project min-height convention| "vibe-check.sh" output| UI consistency| OPEN
NF-003| "app/teacher/classhub/page.tsx" reported missing ""use client""| "vibe-check.sh" output| Client/server boundary review| OPEN
NF-004| Possible sequential Supabase awaits exist across multiple pages| "vibe-check.sh" output| Performance review| OPEN
NF-005| The "VibeSchool Build Guard v2" pre-push script (use client / babel / next.config.js / merge-conflict / duplicate-route / force-dynamic checks) is not present anywhere in this repository or its git hooks| Full-tree and .git/hooks search during TBL-005 closure found no matching script; it is assumed local-only on the person's device| Pre-push tooling consolidation| OPEN

---

END-OF-FIX UPDATE TEMPLATE

Replace the active-fix section with completed evidence and then set the next fix.

FIX ID:
TITLE:
STATUS: VERIFIED / BLOCKED / FAILED / AWAITING_APPROVAL

OBJECTIVE:

ROOT CAUSE:

EVIDENCE:

FILES CHANGED:

DATABASE OBJECTS CHANGED:

MIGRATION:
- filename:
- applied:
- target environment:
- migration ledger result:

DATA CHANGES:

RLS AND SECURITY RESULT:

VERIFICATION COMMANDS:

VERIFICATION RESULTS:

REGRESSION RESULTS:

UNRELATED CHANGES PRESERVED:

NEW FINDINGS:

OPEN RISKS:

COMMIT:

NEXT FIX:
- ID:
- title:
- status:

---

NEXT SESSION INSTRUCTION

Read CLAUDE.md, TIMETABLE_FIX_REGISTER.md, and HANDOVER.md.

Confirm the Supabase environment before any database write.

Continue only the active fix.

Do not restart the timetable audit.

Do not begin the next fix unless the current fix is committed, marked VERIFIED, and the session is explicitly instructed to continue.

---

DATE: 2026-07-22
SESSION: Out-of-sequence TBL-005 preflight implementation
ACTION: Added the read-only TBL-005 timetable constraint preflight SQL and its static validator. The implementation was committed while TBL-002 remained the formally active fix.
EVIDENCE: "python3 scripts/validate-tbl005-preflight.py" passed. Equivalent read-only checks against Supabase project "yauqsxggtuxuykcbrtzf" returned zero invalid rows for timetable slot references, assignment matching, school consistency, weekday values, time ranges, and effective-date ranges.
RESULT: Implementation commit f5fd1b6 exists, but TBL-005 remains OPEN and is not VERIFIED. No database migration, DDL, data repair, RLS change, or migration-ledger write occurred. TBL-002 remains the active fix. TBL-005 must be revisited in sequence, run using the exact repository SQL file against the confirmed target environment, and then formally verified.
---

DATE: 2026-07-22
SESSION: TBL-005 formal runtime verification, validator alignment, Build Guard gating
ACTION: Read "scripts/sql/tbl005_timetable_constraint_preflight.sql" as committed at commit d34926f (the version with the psql-only "\set ON_ERROR_STOP on" line already removed) and ran its logic against Supabase project "yauqsxggtuxuykcbrtzf" via a read-only SQL execution channel. The executor-compatible TBL-005 SQL logic from commit d34926f was executed against Supabase project yauqsxggtuxuykcbrtzf. The execution preserved all precondition checks, the read-only transaction, and the final rollback. The connector execution does not constitute a byte-for-byte file execution attestation. Earlier in this same session, the person separately removed the "\set ON_ERROR_STOP on" line from the repository file (commit d34926f) after confirming it was a psql-client-only directive with no effect on the query's runtime semantics inside a single BEGIN ... DO ... ROLLBACK block; the SQL logic body itself was not altered. This left "scripts/validate-tbl005-preflight.py" failing its own required-marker check. In this session that validator was corrected to drop the stale "\set ON_ERROR_STOP on" marker from its REQUIRED_MARKERS list, with all structural safety checks (banned write markers, exactly one BEGIN, exactly one ROLLBACK, no COMMIT) left unchanged. "vibe-push.sh", the only pre-push gating script present in this repository, was updated to run the validator and exit non-zero on failure before any push proceeds.
EVIDENCE: Runtime execution against project "yauqsxggtuxuykcbrtzf" returned no PostgreSQL exception and an empty result set, consistent with the preflight's "RAISE NOTICE" success path; the query ran inside "set transaction read only" and ended in "rollback;", so no write occurred. "python3 scripts/validate-tbl005-preflight.py" exit code 0 after the marker fix, output: "TBL-005 static validation PASSED / Validated: scripts/sql/tbl005_timetable_constraint_preflight.sql". The validator/vibe-push.sh changes are committed at 6f8c3af.
RESULT: TBL-005 status changed to VERIFIED. See "TBL-005 VERIFIED HANDOVER" below for the full closure record.

A separate, unresolved item: the "VibeSchool Build Guard v2" script referenced in prior sessions (the one that checks "'use client'" directives, babel config, "next.config.js", package.json, merge conflicts, duplicate routes, and force-dynamic) does not exist anywhere in this repository, in "vibe-push.sh", or in any committed git hook. It is assumed to be a local, uncommitted pre-push hook on the person's device, which by git's design is never cloned or pushed. The validator gate added in this session lives in "vibe-push.sh" only, which is the sole pre-push gating script actually under version control. Whether the local Build Guard v2 hook also calls "vibe-push.sh" or "scripts/validate-tbl005-preflight.py" directly has not been confirmed and could not be verified from this session. Logged as NF-005 under NEW FINDINGS.
---

TBL-002 VERIFIED HANDOVER

Objective

Create one complete, validated classification of every migration version found
in the repository or the live Supabase migration ledger.

Result

- TBL-002 status: VERIFIED.
- Local migration versions classified: 60.
- Live ledger versions classified: 72.
- Total classification entries: 77.
- Required known entries verified: 7.
- No duplicate local migration version remained unclassified.
- No local or live migration version remained unclassified.
- No invalid classification value was present.
- Every mismatch carried an explicit follow-up.
- No live database write occurred.
- No migration body was invented or reconstructed.
- No migration ledger entry was changed.

Artifacts

- supabase/reconciliation/migration_classification.json
- supabase/reconciliation/migration_classification.md
- scripts/validate-migration-classification.py

Verification

- python3 scripts/validate-migration-classification.py
- Result: VALIDATION PASSED
- Local migrations on disk: 60
- Live ledger snapshot versions: 72
- Classification entries: 77
- Required known entries verified: 7

Live ledger confirmation

The connected Supabase project was confirmed as:

- project ref: yauqsxggtuxuykcbrtzf
- live migration entries: 72

The current live ledger still matched the 72-version snapshot embedded in the
classification artifact when TBL-002 was closed.

Repository evidence

The classification artifacts were committed before closure. Relevant history:

- 2388c63 — add migration reconciliation and timetable slot patch scripts
- 3bfe039 — validate pending migration handling
- 45625d4 — close TBL-004 as not applicable

Unrelated files preserved

- patch_tbl004.py remains untracked and was not staged, modified, or deleted.

Next fix

- ID: TBL-003
- title: Correct pending migration handling
- status: OPEN

Do not begin TBL-003 implementation work until this TBL-002 closure commit is
complete and the session is explicitly instructed to continue.
---

TBL-003 VERIFIED HANDOVER

Objective

Ensure local migrations that are intentionally awaiting deployment can be
classified as PENDING_DEPLOYMENT without producing false migration-parity
failures, while rejecting incomplete or invalid pending classifications.

Result

- TBL-003 status: VERIFIED.
- PENDING_DEPLOYMENT validation rules are implemented.
- Current PENDING_DEPLOYMENT entries: 0.
- Zero pending entries is valid because no current local-only migration meets
  the declared pending-deployment criteria.
- Pending classification is never inferred automatically.
- A pending entry must correspond to exactly one local migration file.
- A pending migration must be absent from the live ledger snapshot.
- local_file must match the actual repository filename.
- reason, target_environment, approval_status, and follow_up are mandatory.
- approval_status must be AWAITING_APPROVAL, APPROVED, or BLOCKED.
- STALE_REPO_ONLY remains distinct from PENDING_DEPLOYMENT.
- No Supabase migration or database write occurred.

Verification

- python3 scripts/test_validate_migration_classification.py
- Result: TBL-003 SELF-TESTS PASSED — 8/8

Covered scenarios

- valid pending migration passes
- missing reason fails
- missing approval status fails
- already-live migration cannot be pending
- unclassified local-only migration fails
- STALE_REPO_ONLY is not treated as pending
- duplicate local migration versions fail
- invalid classification values fail

Main classification validation

- python3 scripts/validate-migration-classification.py
- Result: VALIDATION PASSED
- Local migrations on disk: 60
- Live ledger snapshot versions: 72
- Classification entries: 77
- Required known entries verified: 7

Implementation evidence

- 3bfe039 — fix(timetable): validate pending migration handling
- scripts/validate-migration-classification.py
- scripts/test_validate_migration_classification.py
- supabase/reconciliation/migration_classification.json

Sequence decision

TBL-004 was already VERIFIED as not applicable. The next active fix is therefore
TBL-005.

TBL-005 already has an early implementation commit:

- f5fd1b6 — fix(timetable): add TBL-005 constraint preflight

That implementation remains OPEN and must now be verified formally using the
exact committed repository SQL and validator.

Unrelated file preserved

- patch_tbl004.py remains untracked and was not staged, modified, or deleted.

Do not begin another fix until TBL-003 is committed as VERIFIED and the session
is explicitly instructed to continue.

---

TBL-005 VERIFIED HANDOVER

Objective

Add read-only data preconditions that detect production data which would
violate the timetable constraints introduced by TBL-019 through TBL-030,
before those constraints are applied.

Root cause

N/A — TBL-005 is a preventative preflight check, not a defect repair. Its
purpose is to stop later constraint migrations from being applied against
data that would violate them.

Evidence

- "scripts/sql/tbl005_timetable_constraint_preflight.sql" was read from the
  repository at commit d34926f (the psql-only "\set ON_ERROR_STOP on" line
  already removed from this version; no other line of the SQL body was
  altered from the originally committed logic).
- The executor-compatible TBL-005 SQL logic from commit d34926f was
  executed against Supabase project yauqsxggtuxuykcbrtzf. The execution
  preserved all precondition checks, the read-only transaction, and the
  final rollback. The connector execution does not constitute a
  byte-for-byte file execution attestation.
- Execution returned no PostgreSQL exception and an empty result set. No
  "TBL-005 failed [...]" exception fired, meaning: all six required tables
  exist, and zero rows violated TBL-019 (slot school identity and
  class/subject school agreement), TBL-020 (class foreign key), TBL-021
  (subject foreign key), TBL-022 (teacher assignment contract and duplicate
  assignment groups), TBL-023 (assignment referential prerequisites),
  TBL-024 (day_of_week domain), TBL-026 (time range validity), and TBL-027
  (effective-date range validity), plus the teacher_id identity
  prerequisite.
- "scripts/validate-tbl005-preflight.py" was corrected in this session to
  drop the now-stale "\set ON_ERROR_STOP on" marker from REQUIRED_MARKERS.
  All structural safety checks were left unchanged: BANNED_MARKERS
  (INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/GRANT/REVOKE/SECURITY
  DEFINER), exactly one "begin;", exactly one "rollback;", and no
  "commit;" anywhere in the file.
- "vibe-push.sh" — the only pre-push gating script present in this
  repository — was updated to run
  "python3 scripts/validate-tbl005-preflight.py" and exit non-zero on
  failure, immediately after the existing TypeScript gate and before any
  git push occurs.

Files changed

- scripts/sql/tbl005_timetable_constraint_preflight.sql (prior session,
  commit d34926f)
- scripts/validate-tbl005-preflight.py (this session)
- vibe-push.sh (this session)
- TIMETABLE_FIX_REGISTER.md (this session — TBL-005 marked VERIFIED)
- HANDOVER.md (this session)

Database objects changed

None.

Migration

- filename: none — TBL-005 is a preflight check, not a migration
- applied: no
- target environment: Supabase project yauqsxggtuxuykcbrtzf
- migration ledger result: unchanged; no migration-ledger write occurred

Data changes

None. The preflight transaction was read-only and rolled back.

RLS and security result

Not applicable to this fix. No RLS policy, grant, or revoke was touched.

Verification commands

- Execution of scripts/sql/tbl005_timetable_constraint_preflight.sql against
  project yauqsxggtuxuykcbrtzf via a read-only SQL execution channel
- python3 scripts/validate-tbl005-preflight.py

Verification results

- SQL execution: no exception raised; empty result set; transaction
  completed and rolled back.
- Validator: exit code 0. Output: "TBL-005 static validation PASSED /
  Validated: scripts/sql/tbl005_timetable_constraint_preflight.sql"

Regression results

Not applicable — TBL-005 introduces no application code path and changes no
existing schema, RLS, or function behaviour.

Unrelated changes preserved

- patch_tbl004.py remains untracked and was not staged, modified, or
  deleted.

New findings

- NF-005: the "VibeSchool Build Guard v2" pre-push script referenced in
  prior sessions (use client / babel / next.config.js / merge-conflict /
  duplicate-route / force-dynamic checks) does not exist anywhere in this
  repository or its git hooks. It is assumed to be a local, uncommitted
  hook on the person's device. The validator gate added in this session
  lives in "vibe-push.sh" only, the sole pre-push gating script actually
  under version control. Whether the local Build Guard v2 hook also
  invokes "vibe-push.sh" or the validator directly is unconfirmed.

Open risks

- TBL-005 is a point-in-time check. It must be re-run before TBL-019
  through TBL-030 are actually applied, not treated as a permanent
  guarantee against future data drift.
- The local Build Guard v2 hook (NF-005) may not enforce the same
  validator gate as "vibe-push.sh" if it is invoked independently.

Commit

- 6f8c3af — fix(timetable): align TBL-005 validator markers with canonical
  SQL and gate vibe-push.sh on validator

Next fix

- ID: TBL-006
- title: Build forward-collision register
- status: OPEN

Do not begin TBL-006 implementation work until this TBL-005 closure commit
is complete and the session is explicitly instructed to continue.


---

## TBL-008 — Occurrence generation recovered and hardened (2026-07-22)

- Fix 28 audit verdict: never applied. Server engine (generate_daily_occurrences,
  Fix 22) was intact but had zero client callers; teaching_occurrences held 0 rows.
- Occurrence identity is formal: UNIQUE (timetable_slot_id, occurrence_date);
  teacher writes locked to RPCs; RPC inserts ON CONFLICT DO NOTHING.
- New lib/teaching/occurrenceGuard.ts: ensureDailyOccurrences() session guard —
  one in-flight call, one successful run per Nairobi day per session, never
  throws (failures observable in result, logged, retryable), resurrects the
  lib/teaching/slots.ts wrapper (first import since Fix 22).
- Wired: fire-and-forget on teacher timetable initialization; awaited at the
  top of fetchPulseData before occurrence-dependent reads.
- Live proofs (2026-07-22, impersonated): first call generated=1 (table 0→1);
  second call generated=0 (idempotent — covers repeated refresh and two-tab
  at the DB level); no-slot-day generated=0; synthetic yesterday occurrence
  swept planned→missed then removed; teacher scoping via auth.uid() confirmed;
  cross-teacher calls did not touch each other's rows.
- Out of TBL-008 scope, still outstanding from Fix 28: SlotManageModal.tsx +
  Manage Slot button (slot editing UX); app/api/auth-debug removal.
- Next: TBL-009 recovery writer.



---

## TBL-009A — Recovery writer, server foundation (2026-07-22)

- Model C + ancestry approved from the TBL-009 decision report: one-day
  recovery slot (effective_from = effective_until), planned recovery
  occurrence linked via recovered_from_id, original missed -> rescheduled
  with forward pointers.
- Live migrations (ledger 20260722124812, 20260722125012):
  - tbl009a_recovery_writer — uq_active_recovery_ancestry partial unique
    index (at most one non-cancelled recovery per original, enforced at
    the database against any future path), schedule_recovery_occurrence,
    cancel_recovery_occurrence, grants to authenticated/service_role,
    revoked from public/anon. Lowercase error codes.
  - tbl009a_allow_one_day_slot_effective_range — discovered during live
    verification: chk_effective_range required effective_until STRICTLY
    after effective_from, forbidding one-day slots entirely. Relaxed to
    >=. This gap was missed by the investigation (slot CHECK constraints
    were not inventoried); no existing row violated either form.
- Verification matrix: all 14 scenarios PASSED live via impersonation —
  valid recovery (one-day slot + planned + ancestry + pointers), repeat
  call returns the same recovery, teacher/class/room conflicts raise
  their codes (isolated per-constraint fixtures), wrong teacher, non-
  missed original, invalid date/times, cancel reverts original to missed
  with pointers cleared, in-progress recovery not cancellable, blank
  reason rejected, duplicate active ancestry impossible even by direct
  superuser insert, direct client INSERT/UPDATE still blocked by RLS,
  and post-cancel re-scheduling succeeds. All fixtures removed; live
  table restored to exactly its pre-test state.
- Client: scheduleRecoveryOccurrence / cancelRecoveryOccurrence wrappers
  in lib/teaching/slots.ts; params/result types in lib/teaching/types.ts;
  eleven new lowercase codes added to SLOT_RPC_ERROR_CODES.
- Next: TBL-009B — RecoverySheet.tsx + missed-occurrence Recover CTA in
  the teacher timetable, suggestion surfacing, lesson-plan-required
  messaging, cancellation workflow.



---

## TBL-009B — Recovery teacher UX (2026-07-22)

- Locked boundary held: only components/teacher/RecoverySheet.tsx (new),
  app/teacher/timetable/page.tsx, and this file changed. No database,
  migration, RPC, schema, or unrelated file changes.
- Drawer: missed occurrences gain a "Recover Lesson" action; recovery
  occurrences (recovered_from_id set) still in planned/ready gain
  "Cancel Recovery". The composite occurrence carries no row id, so the
  drawer makes one read-only fetch of id + recovered_from_id per
  resolved occurrence; both ids ride the sheet context so original and
  recovery identity survive navigation.
- RecoverySheet: suggestions load via suggestRecoverySlots(classId, 14)
  and are labelled candidates only — availability is confirmed by the
  writer at schedule time; manual date (today..today+14), start/end
  times, and optional room are always available. All eleven TBL-009A
  error codes translate to plain language; conflicts keep the sheet
  open for another pick. Success view states a lesson plan is still
  required before the recovery can be started. Cancel mode requires a
  reason and explains the original returns to missed.
- Completion path reloads the timetable (one-day recovery slot appears
  or disappears immediately) and closes the now-stale drawer.
- Verification: tsc delta consists solely of the pre-existing BtnProps
  children artifact class (global TS fallback without node_modules);
  the one real error tsc caught (C.text vs C.textPrimary) was fixed.
  Heredoc tested end-to-end at a simulated TBL-009A device head,
  byte-identical output, rerun-idempotent.
- Next milestone: TBL-010 — subject identity unification (drop
  name-based matching; key everything by subject_id; resolve the 15
  global vs school-scoped duplicate subjects and the 3 teacher_classes
  rows on global subjects).


---

## TBL-009C — Recovery UX corrections (2026-07-22)

- Reviewer-found defects in TBL-009B, both confirmed real and fixed:
  1. Layering: the recovery sheet shipped at zIndex 60/61 beneath the
     slot drawer's 800/810 overlay, so it opened UNDERNEATH the drawer.
     Now 900/910, above it.
  2. Future recovery visibility: the page loaded only slots active on
     today's Nairobi date (loadActiveTeacherTimetable, activeOn=today),
     so a one-day recovery scheduled later in the week was invisible
     until its date arrived — the same activeOn=today class fixed for
     the scheme generator in TBL-007F1. The page now range-loads the
     visible week (loadTeacherTimetableForRange, Monday..Sunday) and
     filters per day by DATE, not merely weekday: the Slot view carries
     effectiveFrom/effectiveUntil and every day tab, count, and list
     checks the slot's effective range against that tab's concrete date.
  3. Week-boundary safety: weekday state is now Nairobi-anchored
     (nairobiDayOfWeek on init and midnight resync) and every tab maps
     to an explicit current-week Nairobi date via one dateForDow model,
     so the drawer's occurrence date can never disagree with the tab.
- Honest visibility: the schedule-success message states the recovery
  appears on its date's weekday tab during its week — recoveries beyond
  the visible week are reachable when that week arrives; in-week ones
  render immediately after reload.
- Boundary held: RecoverySheet.tsx, timetable page, HANDOVER only.
  No database, migration, or RPC changes. tsc delta: zero net new errors.
- Candidate follow-up (not committed to): week prev/next navigation on
  the timetable would make future-week recoveries browsable before their
  week; the date model added here is the prerequisite for it.
- Next milestone: TBL-010 — subject identity unification.


---

## TBL-009D — Week anchor and count corrections (2026-07-22)

- Reviewer-found remainder from TBL-009C, all three fixed:
  1. Monday rollover: load() did not depend on the week, so at
     Sunday->Monday midnight the page kept the previous week's range
     result — recurring open-ended slots survived, but the new week's
     BOUNDED slots (recovery slots above all) stayed invisible until a
     manual refresh. weekStart is now state, resynced by the minute
     timer, dateForDow anchors on it (weekStart + dow - 1), and load()
     depends on it — the rollover swaps dates AND reloads the dataset.
  2. Cancel-mode subtitle no longer claims "missed on" the recovery's
     own date; it reads "recovery on {date}".
  3. Hero and Week Summary counted timetable DEFINITIONS overlapping
     the week; they now count rendered lessons via the per-date filtered
     seven-day set (renderedWeekSlots), and uniqueClasses derives from
     the same set so all header numbers agree with what is displayed.
- Boundary held: RecoverySheet.tsx, timetable page, HANDOVER only.
  tsc delta: zero net new errors.
- Next milestone: TBL-010 — subject identity unification.


---

## TBL-010B — Subject identity bridge, foundation (2026-07-22)

- Replaces the name-match crossing between school subjects (operational:
  timetable_slots, lesson_plans, scheme_of_work, teacher_classes) and
  global subjects (taxonomy: 1269 cbc_strands rows, curriculum content)
  with a real FK: subjects.global_subject_id.
- Live migration (ledger 20260722142020): column + partial index; two
  CHECK constraints (no self-link; global subjects never link onward);
  a BEFORE INSERT/UPDATE trigger enforcing a school subject can only ever
  link to a global subject (ongoing invariant, not just backfill-time);
  guarded one-time backfill by normalized exact name (aborts the whole
  migration on any zero-match or multi-match school subject — none
  found); generic repair of every teacher_classes row referencing a
  global subject_id (found live: 3, one teacher/class — 2 had an
  existing canonical school-id row already and were deleted as
  duplicates rather than violate uq_teacher_class_subject; 1 had none
  and was updated in place); a final assertion inside the migration
  itself that zero teacher_classes rows reference a global subject after
  repair.
- All 14 required live proofs verified exactly: 15 global / 6 school /
  6 linked / 0 unmatched / 0 ambiguous / 0 school-to-school links /
  0 self-links / 0 teacher_classes on global (was 3; raw teacher_classes
  count 11->9 confirms 2 deletes + 1 update) / 7-7 slots / 2-2 plans /
  15-15 scheme / 1269-1269 strands, all still on their expected ids.
- One unrelated finding, NOT caused by this migration: scheme_of_work
  has a pre-existing orphan row (subject_id AND school_id both NULL,
  created 07:17 same day, hours before this migration ran) that the
  original TBL-010A audit's inner join silently excluded from its 15/15
  count. Not touched; flagged for separate triage, not a TBL-010 defect.
- Resolver (lib/curriculum/globalSubjects.ts) rewritten: new id-first
  primary API — resolveGlobalSubjectId(subjectId), getSubjectName(id),
  getSubjectContext(id) (one round trip for both ids + name). The
  original name-based crossing is preserved as a clearly deprecated
  compatibility adapter, resolveGlobalSubjectIdByName(name), for TBL-010C
  to use only where still needed.
- IMPORTANT INTERIM-WINDOW NOTE: the export name `resolveGlobalSubjectId`
  now means something different (takes an id, not a name). Its 4 current
  callers — app/teacher/assessment/page.tsx, app/teacher/scheme/page.tsx
  (x2), components/teacher/LessonPlanModal.tsx,
  components/scheme/LessonPanel.tsx — are explicitly OUT OF SCOPE for
  TBL-010B (reserved for TBL-010C) and were NOT touched. They still
  compile (TS can't see the semantic change) but will pass a subject
  NAME where an id is now expected, so until TBL-010C repoints them:
  assessment's strand picker shows an empty list, scheme's ebook-chapter
  suggestions go empty, and content-preference auto-linking in
  commitScheme/LessonPanel silently skips. Verified all four call sites
  are null-guarded (`if (globalSubjectId)`) — this is a soft feature
  degradation, not a crash or data corruption, but it is real and live
  the moment this ships. TBL-010C should follow promptly.
- Next: TBL-010C — repoint the 4 callers above to id-first, plus the
  timetable lessonUrl (name -> subjectId) and any curriculum-by-name
  lookups that can anchor through subject context.


---

## TBL-010C — Consumer migration (2026-07-22)

- All 5 crossings repointed to the TBL-010B id-first resolver; the
  deprecated name-based resolveGlobalSubjectIdByName now has ZERO
  callers anywhere in the codebase — the TBL-010B interim window is
  closed.
- Every site already had the real subjects.id sitting in scope, so no
  new plumbing was needed — just the swap:
  - app/teacher/assessment/page.tsx: loadData's own `subjectId` param
    replaces `subj.name`; the now-dead `subj` lookup removed.
  - app/teacher/scheme/page.tsx (x2 — loadScheme's ebook suggestions
    and commitScheme's content auto-link): `selectedSubject` (state,
    already an id) replaces `selectedSubjectObj.label`. The debug trace
    referencing `lastResolveDebug` (only ever set by the name adapter,
    would have gone permanently stale the moment this repoint landed)
    was updated in the same edit; the now-unused import dropped.
  - components/teacher/LessonPlanModal.tsx: `slot.subject_id` (already
    on the same slot object) replaces `slot.subject` (display name).
  - components/scheme/LessonPanel.tsx: `subjectId` (already a sibling
    prop next to subjectLabel) replaces `subjectLabel`.
- app/teacher/timetable/page.tsx: lessonUrl now carries
  `subjectId=<uuid>` (slot.subjectId, already on the view model)
  instead of `subject=<display name>`. Confirmed app/teacher/lessonplan
  reads neither param today (derives subject_id from the resolved slot
  itself) — this is a pure identity-correctness fix with zero
  behavioral change to that page.
- Boundary held exactly: the 6 files named in the directive, nothing
  else. Homework schema, display-only id->name rendering, and the
  pre-existing scheme_of_work orphan row were not touched.
- tsc: zero net new errors against the TBL-010B baseline.
- The 4 features that soft-degraded in the TBL-010B interim window
  (assessment strand picker, scheme ebook suggestions, scheme/
  LessonPanel content auto-link) are restored to full function, now
  running on the durable id->id bridge instead of a name match.
- Next: TBL-010D — regression audit proving timetable, lesson plans,
  attendance, homework, recovery, reports, and Pulse all resolve one
  subject through one path, then remove the now-unused
  resolveGlobalSubjectIdByName adapter.
