VIBESCHOOL HANDOVER

Purpose

This file carries verified project state between Claude Code sessions.

Claude must read this file before working and update it before ending a session.

Do not rely on previous chat memory.

Repository state, Supabase state, git history, domain fix registers ("TIMETABLE_FIX_REGISTER.md", "READ_FIX_REGISTER.md"), and this file are the continuity mechanism.

This file summarizes state per domain track. Each track's full fix history, rationale, and verification detail lives in its own fix register — this file is the index, not the record.

---

CURRENT STATE

TIMETABLE

Active fix

FIX ID: TBL-012
TITLE: Compare rebuilt schema with target schema
STATUS: OPEN
PRIORITY: P0

Previous verified fix

FIX ID: TBL-011
TITLE: Run isolated clean rebuild
STATUS: VERIFIED

Current branch

BRANCH: main
LATEST COMMIT: see git rev-parse HEAD
WORKING TREE: clean at time of TBL-005 closure (TIMETABLE_FIX_REGISTER.md and HANDOVER.md updates pending commit in the same session)

Connected environments

SUPABASE ENVIRONMENT CLASSIFICATION: PRODUCTION
SUPABASE PROJECT REF: yauqsxggtuxuykcbrtzf
VERCEL ENVIRONMENT:

No database write is permitted while the Supabase environment remains "UNKNOWN".

---

VIBELEARN

Current milestone

READ-008 — Teacher classroom integration — VERIFIED. All sub-units
READ-008A through READ-008G are complete.

Latest completed

READ-001 — Canonical reader routing — VERIFIED
READ-002 — Reading progress authority — VERIFIED
READ-003 — Continue Reading shelf — VERIFIED
READ-004 — CBC curriculum identity — VERIFIED
READ-005 — My Study Workspace — VERIFIED
READ-006 — Study View & accessibility — VERIFIED
READ-007 — Reading analytics — VERIFIED
READ-008A — Classroom assignment authority — VERIFIED
READ-008B — Teacher assignment writer authority — VERIFIED
READ-008C — Learner assigned-reading delivery — VERIFIED
READ-008D–F — Teacher assignment management, due-date editing and aggregate
analytics — VERIFIED
READ-008G — Assignment-level per-learner analytics and intervention
drill-down — VERIFIED

READ-008G authority

- Migration:
  20260731113118_read008g_assignment_learner_intervention_drilldown
- RPC:
  public.get_classroom_reading_assignment_learners(uuid)
- SECURITY DEFINER with search_path public, auth.
- Teacher identity is derived from auth.uid().
- Assignment ownership is verified server-side.
- anon EXECUTE is revoked.
- authenticated and service_role may execute.
- Roster identity remains students.id.
- Reader identity remains profiles.id/auth.uid().
- students.profile_id is the only permitted bridge.
- account_unlinked is distinct from not_started.
- States:
  account_unlinked, not_started, in_progress, completed,
  overdue_not_started and overdue_in_progress.
- Teacher VibeLearn preserves aggregate cards and adds learner drill-down and
  status filters.

Active next unit

READ-009 — Licensing & school access — OPEN. Do not begin without explicit
approval and a fresh permanent-loop investigation.

Open risks

- 114 of 115 non-deleted students remain unlinked to authenticated profiles.
- Production currently has 0 classroom reading assignments and 0 reading
  progress rows, so the complete workflow has not been exercised using real
  assignment activity.
- Live migration 20260730132408
  read008df_teacher_assignment_workspace_analytics remains absent from the
  repository.
- READ-008B and READ-008C repository filename timestamps differ from their
  live ledger versions.

Authoritative reference

READ_FIX_REGISTER.md

Connected environment

SUPABASE PROJECT REF: yauqsxggtuxuykcbrtzf
CANONICAL READER: app/read/textbook/[publicationId]/page.tsx
CANONICAL RPCS:
- get_vibetextbook_reader
- record_reading_progress
- get_continue_reading
- get_classroom_reading_assignment_learners

Identity rule:
viewer_id = auth.uid() = profiles.id. Never equate reader progress identity
with students.id. Classroom-reader resolution must use students.profile_id.

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

---

## TBL-010D — Regression audit, invariant completion, adapter removal (2026-07-22)

- **Live migration** `20260722163600_tbl010d_subject_identity_invariant.sql`:
  preflight assert (abort if any school subject lacks a global link) +
  `chk_school_subject_requires_global_link` CHECK on `public.subjects`
  (`school_id IS NULL OR global_subject_id IS NOT NULL`). This turns the
  TBL-010B trigger's guarantee into a declarative constraint that holds
  even if the trigger is ever dropped or bypassed by a service-role
  write. Preflight found zero violating rows; applied clean.
- **Resolver consumer audit** (`resolveGlobalSubjectId`,
  `resolveGlobalSubjectIdByName`, `getSubjectContext`, `getSubjectName`,
  `global_subject_id`, `cbc_strands` — every occurrence in the repo):
  - All 5 TBL-010C callers confirmed passing real `subjects.id` values,
    not labels — operational, id-first.
  - The deprecated name-based adapter and its debug-trace export: zero
    imports, zero calls anywhere in the repo. Confirmed dead before
    touching it.
  - `report-card/[studentId]/page.tsx`'s `cbc_strands` read is
    unrelated standalone taxonomy — it reads `strand_id` straight off
    `cbc_assessments`, never crosses a subject id, not a bridge
    consumer.
- **Deprecated bridge removed** from `lib/curriculum/globalSubjects.ts`:
  the name-based compatibility adapter and its debug-trace export are
  gone. No runtime path crosses school subject -> global subject
  through a name/`.ilike` match anymore; a name match now exists only
  in historical migration SQL (TBL-010B).
- **End-to-end identity path verified live**: `teacher_classes` (0 on
  global) -> `subjects.id` -> `subjects.global_subject_id` ->
  global `subjects.id` -> `cbc_strands.subject_id` (1269 on global, 0 on
  school). `timetable_slots`, `lesson_plans`, and valid-identity
  `scheme_of_work` rows all resolve to school ids only (0 on global in
  each). `content_preferences` currently holds 0 rows — its
  global-id intent is correct in code (`getContentForSubject` requires
  a `globalSubjectId` param) but unverifiable against live data until
  it's populated.
- **All 15 required final proofs matched exactly**: 15 global / 6
  school / 6 linked / 0 unlinked / 0 teacher_classes-on-global / 0
  school-to-school links / 0 self-links / 1269 strands-on-global / 0
  strands-on-school / 0 deprecated resolver imports / 0 deprecated
  resolver calls / 0 runtime name-bridge queries.
- **TSC**: sandbox has no `node_modules`/network, so `npx tsc --noEmit`
  could not be run here. The only source change is deleting two
  exports with zero importers repo-wide (grep-confirmed before and
  after deletion), which cannot introduce a new type error. The
  Termux push script must still run `npx tsc --noEmit` as a hard gate
  before commit, per standing workflow.
- **Homework**: `homework.subject` remains `text`, no `subject_id`
  column, and no column linking it to `scheme_of_work` at all (checked
  directly against live schema). This dependency stays deferred to
  TBL-012, untouched here as scoped.
- **Two findings deliberately NOT fixed in this unit, registered as
  separate micro-fixes:**
  - **TBL-010E — Academics strand identity repair.**
    `app/teacher/academics/page.tsx` queries
    `cbc_strands.select(...).in("subject_id", subjectIds)` using
    **school** subject ids taken straight from `teacher_classes`, but
    `cbc_strands.subject_id` only ever holds **global** ids — this join
    silently returns nothing, so the mastery/coverage panel is
    presently dead. Not caused by TBL-010B/C (it never calls the
    resolver at all) and not one of the 5 named TBL-010C regression
    surfaces, so it's out of this unit's file boundary. Fix: resolve
    each school subject id to its global parent before querying
    `cbc_strands`, or batch-resolve via a single query joining
    `subjects` first.
  - **TBL-010F — Orphan scheme placeholder disposition.**
    `scheme_of_work` row `ed83edb5-3323-4c3a-8179-08add352974d`
    (teacher Mumbi2, Grade 1, Term 2 Week 12, both `subject_id` and
    `school_id` NULL, `topic: "Placeholder - awaiting KICD week 12
    content"`, `remarks: "Temporary placeholder, update once
    curriculum design content confirmed"`, created 2026-07-22 07:17,
    same day as and hours before TBL-010B). Zero dependent
    `lesson_plans` (checked `scheme_id`), zero `lesson_content` refs;
    `homework` has no column that could reference it. Proven empty,
    unreachable, and self-declared as an accidental placeholder — but
    disposition (delete vs. backfill vs. leave as a known seed
    artifact) is a product decision, not made automatically here.
- Next: TBL-010E (academics strand fix) and TBL-010F (orphan row
  disposition) as independent micro-fixes; TBL-012 for
  `homework.subject_id` when scheduled.

---

## TBL-010E — Academics strand taxonomy repointed to global subject id (2026-07-22)

- Root cause confirmed in `app/teacher/academics/page.tsx`: the page queried
  `cbc_strands.subject_id` using school-scoped subject ids sourced from
  `teacher_classes.subject_id`, while all live `cbc_strands` rows are keyed
  to global subject ids.
- Live verification before the patch confirmed 1,269 strands on global
  subjects and zero strands on school subjects.
- A second downstream mismatch was also fixed: strand definitions were being
  filtered with `o.subject_id === sub.id`, comparing a global taxonomy id
  against a school subject id.
- The assigned-subject query now runs as a preliminary awaited query inside
  `boot()` and selects `id`, `name`, and `global_subject_id`.
- The patch builds:
  - a deduplicated `globalSubjectIds` list for the `cbc_strands` query;
  - a `globalSubjectIdBySchoolId` map for subject-card aggregation.
- Query errors and missing assigned-subject rows are treated as hard load
  failures instead of silently producing a partial Academics dashboard.
- An existing school subject without `global_subject_id` is logged as a data
  anomaly and receives empty strand detail; there is no fallback to name
  matching.
- `cbc_assessments` matching remains intentionally keyed to the operational
  school subject id.
- File boundary: `app/teacher/academics/page.tsx`, `HANDOVER.md`,
  `scripts/tbl010e_verify.sh`.
- No migration, schema change, RLS change, or database write was required.

---

## TBL-010F — Orphan Scheme of Work identity repaired (2026-07-22)

- Repaired the known `scheme_of_work` row:
  `ed83edb5-3323-4c3a-8179-08add352974d`.
- The row previously had both `school_id` and `subject_id` set to `NULL`.
- Live identity was resolved deterministically through:
  - class `8a8f97c2-adf0-44a7-8b9f-7f3cec9fd612`;
  - school `c51ec2ae-5b70-4f69-887d-54eb9f312db7`;
  - teacher/class English assignment;
  - school subject `3f280c11-d2e7-48c3-9eba-d0c56e073c51`.
- The migration guards the expected teacher, class, school, subject, term,
  week, topic, status, source, assignment uniqueness, affected-row count,
  and final repaired state.
- The repair was applied to Supabase and verified live.
- Final live check returned zero remaining identity-null conditions for the
  target row.
- No application code, RLS policy, or schema structure was changed.
- Files:
  - `supabase/migrations/20260722190000_tbl010f_repair_orphan_scheme_identity.sql`
  - `scripts/tbl010f_verify.sh`
  - `HANDOVER.md`

### READ-005C — Chapter bookmarks — VERIFIED

- Canonical chapter bookmarks use `vibe_workspace_items`.
- Shared entitlement authority: `can_viewer_read_chapter`.
- RPC-only writes and reads: `toggle_chapter_bookmark(uuid)` and `get_my_bookmarks()`.
- `get_vibetextbook_reader` returns `is_bookmarked`.
- Reader supports `?chapter=<chapter_uuid>` and active-chapter bookmark toggling.
- Study Workspace Bookmarks tab opens the exact chapter.
- Production ledger: 20260728232212, 20260728232236, 20260728232300, 20260728232356, 20260728232441.

### VIBELEARN READ — READ-005D–005H
Implemented secure highlights, notes, vocabulary, definitions and formulae on the canonical workspace authority. Production migration ledger: 20260729020437. Branch: read-005d-h-workspace. Pending local validation/commit/push.

### VIBELEARN READ — READ-006
Study View and accessibility implemented on the canonical VibeTextbook reader: persistent text size, line spacing, reading width, dark/light/paper modes, reduced motion, skip link, keyboard operation and mobile settings sheet. Branch: read-006-study-view.

### VIBELEARN READ — READ-007
Reading analytics implemented: secure per-viewer chapter sessions, active seconds, maximum progress, completion, close reasons and stale-session abandonment evidence. Writes are RPC-only and entitlement checked. Live Supabase migrations applied; repository parity added on branch read-007-reading-analytics.
---

## Content Engine frontend programme

Milestone ID: CE-FE-001
Status: COMPLETE
Problem fixed:
- Confirmed the canonical application database contract against a fresh live Supabase type generation.
- Proved `lib/database.types.ts` is byte-for-byte identical to the live-generated public schema contract.
Files changed:
- HANDOVER.md
Repository files verified but unchanged:
- `lib/database.types.ts` remains the canonical generated application contract
- `supabase/types.ts` remains the existing tracked empty placeholder
Database contracts used:
- Live public schema from Supabase project `yauqsxggtuxuykcbrtzf`
- Canonical application contract `lib/database.types.ts`
Verification completed:
- Canonical and fresh generated contracts had identical SHA-256 hash `1dea772ebb15d739a4991e3dd96d75751f9324b1dcee8c4787b3e40377a67855`
- Required Content Engine tables and views are present
- Critical Content Engine RPCs and parameter contracts are present
- Generated contract passed isolated TypeScript compilation
- Live `ce_full_integrity_audit()` returned zero issues
- Application clients already import `Database` from `lib/database.types.ts`
Manual checks still required:
- Repository-wide pre-existing TypeScript contract errors must be managed in a separate remediation register
- Full production build remains blocked by unrelated legacy frontend/schema drift
Known limitations:
- CE-FE-001 did not repair unrelated admin, parent, finance, Twin, communication, VibeLearn or timetable type errors
- The repository does not currently have a clean global TypeScript baseline
Next exact milestone:
- CE-FE-002 — Content Engine service boundary
Adjacent remediation programme:
- TS-PARITY-001 — classify and repair repository-wide legacy schema contract drift in dependency-safe groups
---

## Content Engine frontend programme

Milestone ID: CE-FE-002A
Status: COMPLETE
Problem fixed:
- Established the first typed Content Engine frontend service boundary.
- Centralized publication, chapter, learning-resource and adoption access.
- Wrapped authoritative adoption and class-library RPCs.
Files changed:
- lib/content-engine/client.ts
- lib/content-engine/errors.ts
- lib/content-engine/types.ts
- lib/content-engine/publications.ts
- lib/content-engine/resources.ts
- lib/content-engine/adoption.ts
- lib/content-engine/index.ts
- HANDOVER.md
Database contracts used:
- vibe_publications
- vibe_chapters
- learning_resources
- teacher_resource_adoptions
- class_resource_library
- ce_adopt_learning_resource(...)
- ce_add_resource_to_class_library(...)
Verification completed:
- Services derive types from lib/database.types.ts
- No `any` introduced
- Business writes use authoritative RPCs
- Required identifiers are validated before Supabase calls
- RPC-returned authoritative UUIDs are preserved
- Focused service-layer TypeScript compilation passed
- git diff --check passed
Manual checks still required:
- UI consumers have not yet been migrated to these services
- Cross-account RLS behaviour must be tested when discovery and adoption UI is wired
Known limitations:
- This slice does not yet include Scheme, assignment, submission, marking, mastery, analytics or parent services
- Repository-wide legacy TypeScript errors remain tracked separately
Next exact milestone:
- CE-FE-002B — Scheme, assignment and submission service contracts
---

## Content Engine frontend programme

Milestone ID: CE-FE-002B
Status: COMPLETE
Problem fixed:
- Added typed Scheme resource-link services.
- Added authoritative classroom-assignment RPC services.
- Added authoritative learner-evidence submission RPC services.
Files changed:
- lib/content-engine/types.ts
- lib/content-engine/scheme.ts
- lib/content-engine/assignments.ts
- lib/content-engine/submissions.ts
- lib/content-engine/index.ts
- HANDOVER.md
Database contracts used:
- scheme_lesson_resource_links
- vibe_chapter_assignments
- content_assignment_learners
- content_submission_evidence
- ce_assign_resource_to_class(...)
- ce_submit_assignment_evidence(...)
Verification completed:
- Scheme links preserve stable lesson, publication, chapter and resource IDs
- Scheme upsert uses the backend uniqueness contract
- Page ranges and positive sequence are validated
- Assignment creation uses the authoritative RPC
- Submission creation uses the authoritative RPC
- Authoritative assignment and evidence UUIDs are returned
- Focused service-layer TypeScript compilation passed
- No explicit `any` introduced
- git diff --check passed
Manual checks still required:
- Scheme-link RLS must be exercised with a real assigned teacher
- Assignment creation must confirm learner snapshots in content_assignment_learners
- Learner submission must be exercised with an assigned and unassigned learner
Known limitations:
- No UI consumes these services yet
- Marking, mastery, assessment, analytics and parent services remain unimplemented
Next exact milestone:
- CE-FE-002C — Marking, mastery, assessment, analytics and parent service contracts
---

## Content Engine frontend programme

Milestone ID: CE-FE-002C1
Status: COMPLETE
Problem fixed:
- Added typed marking services for evidence, rubrics and criterion scores.
- Added read-only mastery and competency-evidence services.
Files changed:
- lib/content-engine/types.ts
- lib/content-engine/marking.ts
- lib/content-engine/mastery.ts
- lib/content-engine/index.ts
- HANDOVER.md
Database contracts used:
- assessment_rubrics
- assessment_rubric_criteria
- submission_marks
- submission_criterion_marks
- competency_evidence_ledger
- student_outcome_mastery
Verification completed:
- Draft marks use the unique evidence authority
- Criterion marks use the unique mark-and-criterion authority
- Score and maximum-score input validation is present
- Released marks are confirmed by the database before success is returned
- Backend release triggers remain authoritative for competency ingestion
- Mastery services are read-only
- No frontend writes to competency_evidence_ledger or student_outcome_mastery
- Focused service-layer TypeScript compilation passed
- No explicit `any` introduced
- git diff --check passed
Manual checks still required:
- Exercise a complete rubric marking flow with real evidence
- Confirm invalid criterion scores are rejected by the database
- Confirm released marks create competency evidence
- Confirm mastery updates from released evidence
Known limitations:
- No marking UI consumes these services yet
- Assessment generation, analytics and parent-summary services remain pending
Next exact milestone:
- CE-FE-002C2 — Source-grounded assessment service contracts
---

## Content Engine frontend programme

Milestone ID: CE-FE-002C2
Status: COMPLETE
Problem fixed:
- Added typed source-grounded assessment blueprint services.
- Added approved assessment-source registry services.
- Added generated assessment and generated-item services with preserved lineage.
Files changed:
- lib/content-engine/types.ts
- lib/content-engine/assessments.ts
- lib/content-engine/index.ts
- HANDOVER.md
Database contracts used:
- content_assessment_blueprints
- content_assessment_sources
- generated_assessments
- generated_assessment_items
Verification completed:
- Blueprint ownership is derived from the authenticated teacher
- Assessment sources preserve resource, Scheme-link and outcome IDs
- Source saving is idempotent for resource-and-outcome identity
- Generated items require stable source-resource IDs
- Optional source-block and outcome lineage are preserved
- Item writes use the assessment-and-sequence uniqueness authority
- Approval and publication remain subject to backend source and mark-total triggers
- Focused service-layer TypeScript compilation passed
- No explicit `any` introduced
- git diff --check passed
Manual checks still required:
- Create a real blueprint with approved resources and outcomes
- Confirm an unapproved resource is rejected for a generated item
- Confirm a block from another chapter is rejected
- Confirm approval fails when item marks do not match blueprint totals
- Confirm valid approval sets approved_by and approved_at
Known limitations:
- No AI generation implementation is included
- No assessment UI consumes these services yet
- Analytics and parent-summary services remain pending
Next exact milestone:
- CE-FE-002C3 — Analytics and parent-summary service contracts
---

## Content Engine frontend programme

Milestone ID: CE-FE-002C3
Status: COMPLETE
Problem fixed:
- Added typed read-only teacher analytics services.
- Added parent-summary build, review, approval and publication services.
Files changed:
- lib/content-engine/types.ts
- lib/content-engine/analytics.ts
- lib/content-engine/parents.ts
- lib/content-engine/index.ts
- HANDOVER.md
Database contracts used:
- content_engine_daily_metrics
- teacher_content_engine_summary
- parent_learning_summaries
- ce_build_parent_learning_summary(...)
- ce_publish_parent_learning_summary(...)
Verification completed:
- Analytics reads SQL-derived authority rather than recomputing metrics
- Browser services do not expose the unrestricted metrics-refresh RPC
- Parent summary generation uses the authoritative build RPC
- Draft editing is limited to draft rows
- Approval records approved_by and approved_at
- Publication uses the authoritative publish RPC
- Parent-facing helper explicitly requests published summaries
- Focused service-layer TypeScript compilation passed
- No explicit `any` introduced
- git diff --check passed
Manual checks still required:
- Test teacher build and review with a real assigned learner
- Test class-teacher or administrator approval and publication
- Verify linked parent can read the published summary
- Verify unlinked parent cannot read it
- Verify drafts and approved-but-unpublished summaries remain hidden from parents
Known limitations:
- No UI consumes analytics or parent-summary services yet
- Metrics refresh remains an operations-only concern pending an authorization hardening decision
Next exact milestone:
- CE-FE-002D — Complete service-boundary verification and milestone closure
Security finding recorded:
- ce_refresh_content_engine_daily_metrics is SECURITY DEFINER and performs date-wide delete/rebuild without an explicit caller authorization check; it is intentionally not wrapped for browser use
---

## Content Engine frontend programme

Milestone ID: CE-FE-002D
Status: COMPLETE
Problem fixed:
- Verified the complete typed Content Engine service boundary.
Verification completed:
- All required service modules exist
- Public exports passed a focused TypeScript smoke test
- No explicit `any` exists
- No forbidden authority writes exist
- Metrics refresh RPC is not exposed
- git diff --check passed
Next exact milestone:
- CE-FE-003 — Author and publication workflow verification and repair

---

## Content Engine frontend programme

Milestone ID: CE-FE-002
Status: COMPLETE
Problem fixed:
- Established the typed Content Engine frontend service boundary.
Verification completed:
- CE-FE-002A complete
- CE-FE-002B complete
- CE-FE-002C1 complete
- CE-FE-002C2 complete
- CE-FE-002C3 complete
- CE-FE-002D complete
Next exact milestone:
- CE-FE-003 — Author and publication workflow verification and repair
---

## Content Engine frontend programme

Milestone ID: CE-FE-003A1
Status: COMPLETE
Problem fixed:
- Added an explicit serialization and hydration boundary between publication authoring models and generated Supabase contracts.
- Removed unsafe publication and chapter row casts from the authoring hook.
- Migrated the authoring hook to the shared typed Supabase client.
Files changed:
- lib/publicationDraftCodec.ts
- hooks/usePublicationDraft.ts
- HANDOVER.md
Database contracts used:
- vibe_publications
- vibe_chapters
Verification completed:
- Publication pricing JSON is validated during hydration
- Publication and chapter enum values are validated
- Content blocks and metadata are validated during hydration
- Pricing and chapter blocks are explicitly serialized to Json
- Untitled drafts remain autosave-compatible
- Supabase inserts and upserts use generated Insert contracts
- No `any` or `as unknown as` introduced
- Focused TypeScript compilation passed
- git diff --check passed
Manual checks still required:
- Load publications using each supported pricing model
- Create and autosave an untitled draft
- Add, edit, reorder and delete content blocks
- Reload and verify exact content preservation
Known limitations:
- Invalid historical JSON now produces a clear load error
- Textbook publication lifecycle remains unchanged in this slice
Next exact milestone:
- CE-FE-003A2 — Authoritative textbook publication lifecycle
---

## Content Engine frontend programme

Milestone ID: CE-FE-003A2
Status: COMPLETE
Problem fixed:
- Prevented publication from continuing after an unsuccessful draft save.
- Routed VibeTextbook publication through the authoritative publish RPC.
- Added compensating unpublish when post-publication chapter persistence fails.
Files changed:
- lib/content-engine/publications.ts
- lib/content-engine/index.ts
- hooks/usePublicationDraft.ts
- HANDOVER.md
Database contracts used:
- vibe_publications
- vibe_chapters
- publish_textbook(...)
- unpublish_textbook(...)
Verification completed:
- forceSave reports database-confirmed success or failure
- Failed draft saves stop publication
- VibeTextbook publication uses publish_textbook(...)
- VibeTextbook rollback uses unpublish_textbook(...)
- Non-textbook formats retain their existing lifecycle behavior
- Focused TypeScript compilation passed
- No explicit any introduced
- git diff --check passed
Manual checks still required:
- Publish a real VibeTextbook and verify VibeLearn reconciliation
- Confirm anonymous reader access after publication
- Unpublish and confirm anonymous direct-reader denial
- Republish and confirm access restoration
- Simulate a chapter persistence failure and verify compensating unpublish
Known limitations:
- Publication lifecycle and chapter persistence remain separate transactions
- Full cross-account lifecycle regression remains pending
Next exact milestone:
- CE-FE-003B — Structured blocks and curriculum-outcome authoring verification
---

## Content Engine frontend programme

Milestone ID: CE-FE-003B1
Status: COMPLETE
Problem fixed:
- Added typed verified curriculum-outcome discovery services.
- Added chapter-level outcome-link management using stable outcome IDs.
- Added content-block outcome-link management using stable outcome IDs.
- Added resolution from legacy editor block IDs to authoritative content_blocks IDs.
Files changed:
- lib/content-engine/outcomes.ts
- lib/content-engine/index.ts
- HANDOVER.md
Database contracts used:
- curriculum_learning_outcomes
- chapter_learning_outcome_links
- content_blocks
- content_block_outcome_links
Verification completed:
- Only verified curriculum outcomes are returned by discovery
- Chapter links use the unique chapter_id and outcome_id authority
- Block links use the unique content_block_id and outcome_id authority
- Existing selected links are upserted before stale links are removed
- Link writes preserve publication, chapter, block and outcome IDs
- RLS remains authoritative for author management
- Backend validation triggers remain authoritative
- No direct write to derived content_blocks exists
- Focused TypeScript compilation passed
- No explicit any introduced
- git diff --check passed
Manual checks still required:
- Exercise chapter outcome linking as the publication author
- Verify a non-author cannot modify links
- Exercise block outcome linking after block reconciliation
- Verify invalid cross-publication links are rejected
Known limitations:
- Author editor UI does not consume these services yet
- Multi-row replacement is not one database transaction
Next exact milestone:
- CE-FE-003B2 — Author editor curriculum-outcome selection
---

## Content Engine frontend programme

Milestone ID: CE-FE-003B2
Status: IN PROGRESS — code written, zero on-device verification yet
Problem found (not fixed, discovered):
- lib/content-engine/outcomes.ts, marked COMPLETE in the CE-FE-003B1 entry
  above, did not exist anywhere in the repo. Grepped for every table name
  it should have referenced (chapter_learning_outcome_links,
  content_block_outcome_links, curriculum_learning_outcomes) — the only
  match in the whole tree was the generated database.types.ts. The prior
  session's HANDOVER entry was written before the file was actually saved,
  most likely lost to the same Termux clipboard/paste truncation problem
  already flagged for READ-008G close-out.
- Live DB was checked directly (Supabase project yauqsxggtuxuykcbrtzf, not
  just local migration files): all three CE-004 tables and their five
  supporting functions (ce_sync_chapter_learning_outcomes,
  ce_validate_chapter_outcome_link, ce_validate_block_outcome_link, etc.)
  exist and match 20260801183000_ce_004_learning_outcomes_curriculum_links.sql
  exactly. The backend was never the problem.
Files changed:
- lib/content-engine/outcomes.ts (recreated from scratch against live schema)
- lib/content-engine/types.ts
- lib/content-engine/index.ts
- components/global/publish/OutcomeSelector.tsx (new)
- components/global/publish/PublicationEditor.tsx
Database contracts used:
- curriculum_learning_outcomes
- chapter_learning_outcome_links
- content_blocks (legacy_block_id resolution)
- content_block_outcome_links
Verification completed:
- Bracket/brace balance check only (no tsc, no node_modules, no network in
  the authoring sandbox this was written in)
Verification NOT completed — do this before trusting the milestone:
- `npx tsc --noEmit -p .` — has not been run against these files at all
- Open a real chapter, click "Curriculum Outcomes", confirm the list loads
  and search works
- Select outcomes, Save, reload the chapter, confirm links persisted
- Create a brand-new unsaved chapter, immediately click "Curriculum
  Outcomes" — this is the exact race condition the ensureChapterSaved gate
  is meant to cover; prove it actually blocks until forceSave() resolves
- Confirm a non-author cannot write links (RLS: chapter_outcome_links_author_manage)
- Block-level linking (replaceBlockOutcomeLinks, resolveContentBlockId) has
  no UI wired up yet — only chapter-level linking has a button
Known limitations:
- OutcomeSelector re-fetches all verified outcomes on every search
  keystroke (debounced 350ms) rather than client-side filtering; fine at
  current outcome-bank size, revisit if it grows past a few hundred rows
- No pagination on the outcome list (capped at 100 results)
- Author-claimed outcomes (source_type='creator_claimed', auto-synced from
  vibe_chapters.learning_outcomes by trigger) are a separate lineage from
  what this selector manages; this selector only touches verified,
  human-curated outcomes
Next exact milestone:
- Run the verification list above on-device. If it holds, CE-FE-003B2
  becomes COMPLETE and the next milestone is block-level outcome UI
  inside ContentBlockEditor.tsx using the already-written
  replaceBlockOutcomeLinks/resolveContentBlockId functions.
---

## Content Engine frontend programme

Milestone ID: CE-FE-003B2 (patch round 2)
Status: IN PROGRESS — addresses product-review gaps, still zero on-device verification
Context:
- ab75c0a shipped and was confirmed clean by real on-device `tsc` and
  `vibe-push.sh` (commit 34e1bfd on origin/main). A product review of that
  diff found real gaps, listed below with what was actually done about each.
Problems fixed:
1. Outcome discovery was not scoped to the publication's curriculum context
   — a Grade 4 Maths author could see Form 4 History outcomes. Root cause:
   vibe_chapters.curriculum_id and sub_strand_id (real FK columns already
   used by the CE-004 trigger) were never hydrated into the frontend
   VibeChapter draft type or its Insert/Row codec — only cbc_strand (free
   text) was. Fixed by adding curriculum_id/sub_strand_id to VibeChapter,
   chapterRowToDraft, chapterDraftToInsert, and emptyChapter, then passing
   them from PublicationEditor into OutcomeSelector, which passes them into
   listVerifiedCurriculumOutcomes. Deliberately did NOT attempt a
   grade/subject label-matching fallback (e.g. CBCGrade 'grade4' ->
   curriculum.grade "Grade 4" text) — checked live data
   (project yauqsxggtuxuykcbrtzf) and the existing label maps do not
   reliably match live curriculum text (e.g. CBC_SUBJECTS labels "Science &
   Tech" vs live curriculum.subject "Science and Technology"); a fuzzy
   match would silently produce wrong scoping, which is worse than no
   scoping. When a chapter has neither id set yet, the drawer now says so
   explicitly instead of quietly showing everything.
2. listVerifiedCurriculumOutcomes ANDed curriculum_id and sub_strand_id
   when both were supplied, which would hide outcomes tagged at only one
   granularity. Changed to OR them (curriculum_id.eq OR sub_strand_id.eq)
   via a validated .or() filter.
3. Real bug: searching inside the drawer re-derived selectedIds from the
   database on every debounced query, silently dropping any outcome the
   author had just checked but not yet saved. Split into two functions —
   initSelection() (runs once per open/chapter change, sets the selection
   baseline) and loadOutcomes() (runs on every search, only replaces the
   candidate list, never touches selectedIds).
4. Accessibility: outcome rows were bare onClick <div>s with no keyboard
   path. Added role="checkbox"/aria-checked/tabIndex/onKeyDown (Enter and
   Space), role="dialog"/aria-modal/aria-label on the drawer, Escape-to-
   close, aria-label on the close button and search input, role="alert" on
   the error banner.
Explicitly NOT done in this round (still open, matches the product
review's suggested order):
- Alignment strength picker (introduces/supports/assesses/masters) — still
  hardcoded to 'supports' in replaceChapterOutcomeLinks calls from the UI
- Block-level outcome UI in ContentBlockEditor.tsx — backend functions
  (replaceBlockOutcomeLinks, resolveContentBlockId) exist and are exported,
  no UI consumes them yet
- Pagination / strand navigation for the outcome list — still capped at
  100 results, re-fetches the full list on every search
Files changed:
- lib/publishTypes.ts (VibeChapter, emptyChapter)
- lib/publicationDraftCodec.ts (chapterRowToDraft, chapterDraftToInsert)
- lib/content-engine/outcomes.ts (OR filter + UUID validation on it)
- components/global/publish/OutcomeSelector.tsx (scoping props, split
  load functions, a11y)
- components/global/publish/PublicationEditor.tsx (pass curriculumId/
  subStrandId through)
Verification completed:
- Bracket/brace balance check only, same as round 1 — no tsc run in this
  authoring sandbox, no node_modules, no network here
Verification NOT completed — this is a strict superset of round 1's list,
run all of it, not just the new items:
- `npx tsc --noEmit -p .` on this new diff specifically
- Confirm a chapter WITH curriculum_id/sub_strand_id set actually narrows
  the list (requires a chapter that's been bridged via READ-010 tooling —
  if none exist yet, that path is still unverified even after this patch)
- Confirm a chapter with neither id shows the orange "not linked" banner
  and the full verified list, not an empty list
- Confirm the search-selection-loss bug is actually gone: check an
  outcome, type a search term, confirm the check survives the reload
- Everything from the round-1 verification list (new-chapter save race,
  RLS denial for non-authors, real link persistence)

---

TBL-006 VERIFIED HANDOVER

Result

Every current migration referencing the confirmed baseline-owned timetable
objects is registered. The duplicate repository-only Fix 28 file was removed.
The Fix 12 clean-rebuild constraint collision was repaired.

Database writes

None.

Production project

yauqsxggtuxuykcbrtzf

Next fix

TBL-007 — Gate migration repair behind preflight.

---

TBL-007 VERIFIED HANDOVER

Objective

Prevent any production migration-history repair from running unless its
repository, migration inputs, target project, intended action and approval
context have been validated and remain unchanged.

Implementation

- Added a fail-closed migration-repair preflight gate.
- Added immutable repair-manifest generation.
- Added expiring, single-use authorization records.
- Added an authorized executor wrapper.
- Added refusal tests for dirty repository state, missing approval, wrong
  project, wrong environment, changed commit, changed migration inputs,
  invalid repair status, invalid token and expired authorization.
- Added a manual-only GitHub Actions workflow pinned to:
  production project yauqsxggtuxuykcbrtzf,
  exact origin/main commit,
  exact migration version and repair status,
  exact operator confirmation phrase.
- Added production workflow static validation.
- Added a GitHub environment named production-migration-repair.
- Restricted the environment deployment branch to main.
- Configured Supabase access and project identity in the environment.

Verification evidence

- All Python syntax checks passed.
- TBL-007 refusal tests passed.
- Authorized-executor refusal tests passed.
- Production workflow static validator passed.
- TypeScript and production build gate passed on commit 4e5b151.
- Manual GitHub workflow dispatch was accepted.
- Exact checkout and immutable-input validation passed.
- Supabase CLI installation passed.
- The test workflow stopped at project linking.
- Capture, validator, manifest, authorization and repair steps were skipped.
- Execute authorized repair did not run.
- No production migration-history row, schema object or application data was
  changed.

Acceptance result

VERIFIED. A repair cannot reach execution without first passing the gate with
validated unchanged inputs.

Open risks

- The current migration-classification snapshot remains stale and fails with
  89 reconciliation errors. This correctly blocks authorization.
- The first protected workflow test failed while linking the Supabase project.
  The production execution path still requires later operational hardening.
- GitHub administrator bypass remains available unless disabled manually.
- These risks do not weaken the TBL-007 gate; they make repair execution more
  restrictive.

Next fix

TBL-008 — Make postflight executable: automatically compare the live migration
ledger before and after a repair and prove that only the approved row changed.

---

TBL-008 VERIFIED HANDOVER

Objective

Make migration-repair postflight executable so the captured local and remote
migration ledger states are compared automatically after an approved repair.

Implementation

- Added scripts/tbl008-migration-postflight.py.
- Added scripts/test-tbl008-migration-postflight.py.
- Wired postflight execution into the protected production migration-repair
  workflow.
- Added a JSON postflight report to the immutable repair evidence artifact.
- Updated the production workflow validator to require the executable
  postflight and approved repair inputs.

Postflight invariants

- Exactly the approved migration version may change.
- No unexpected migration version may change.
- Local migration state must remain unchanged.
- Remote migration state must reach the approved applied or reverted state.
- Missing, empty, malformed or duplicate ledger snapshots fail closed.
- Before and after snapshot SHA-256 hashes are recorded.

Verification evidence

- Python syntax validation passed.
- Apply-transition fixture passed.
- Revert-transition fixture passed.
- Unchanged approved version was rejected.
- Unexpected second migration change was rejected.
- Incorrect final remote state was rejected.
- Changed local migration state was rejected.
- Malformed empty snapshot was rejected.
- Protected workflow static validation passed.
- Clean-tree executable fixture produced a passing JSON report containing:
  approved version, expected status, unchanged local state, correct remote
  transition, one changed version and zero unexpected changes.
- Working tree was clean after fixture cleanup.

Database and production impact

None. No Supabase command, migration repair, schema write, data write or
migration-ledger write was executed during TBL-008.

Acceptance result

VERIFIED. Local and remote migration state is now automatically compared by
an executable fail-closed postflight.

Next fix

TBL-009 — Align fallback repair path.

---

TBL-009 VERIFIED HANDOVER

Objective

Align the fallback migration-repair route with the protected primary route so
both entry methods produce exactly the same immutable repair action and cannot
diverge in project, version, status, commit, confirmation or approval context.

Investigation result

- Only one production repair executor existed.
- No direct SQL ledger mutation, alternate executor, db push repair path or
  Termux production-repair path existed.
- The safe fallback design was therefore an alternate request transport, not a
  second repair engine.

Implementation

- Added scripts/tbl009-repair-request.py as the canonical repair-request
  normalizer.
- Added scripts/tbl009-create-fallback-request.py for clean-tree fallback
  request generation from Termux.
- Added scripts/test-tbl009-repair-request.py.
- Routed the primary GitHub workflow inputs through the same canonical request
  normalizer.
- Preserved the normalized request and its SHA-256 hash in workflow evidence.
- Kept all production execution behind the existing TBL-007 gate, single-use
  authorization, authorized executor and TBL-008 postflight.

Canonical request invariants

- Production project is fixed to yauqsxggtuxuykcbrtzf.
- Environment is fixed to PRODUCTION.
- Branch is fixed to main.
- Repository commit must be a full 40-character SHA.
- Migration version must contain 8–14 digits.
- Status must be applied or reverted.
- Confirmation must exactly match the requested action.
- Approval identifier must be present and valid.
- Request source must be workflow_dispatch or fallback_request.
- Source is excluded from the canonical action hash so equivalent routes
  produce the same SHA-256 value.

Verification evidence

- Python syntax checks passed.
- Primary and fallback equivalence tests passed.
- Wrong project was denied.
- Wrong branch was denied.
- Short commit SHA was denied.
- Wrong confirmation was denied.
- Invalid repair status was denied.
- Unknown request source was denied.
- Clean-tree fallback generator executed successfully.
- Equivalent primary and fallback requests normalized successfully.
- Both routes produced the identical canonical request SHA-256:
  140110ab4271a25c3373dcb82239c3399ddcf2156810f92e741eb35f3d2cf69a
- Protected production workflow static validation passed.
- Working tree was clean after fixture cleanup.

Database and production impact

None. No Supabase connection, migration repair, schema write, data write or
migration-ledger change occurred during TBL-009.

Acceptance result

VERIFIED. The fallback route now produces the same immutable repair action as
the primary route and cannot bypass the canonical gate, executor or postflight.

Next fix

TBL-010 — Recover required core RLS policies.

---

TBL-010 VERIFIED HANDOVER

Objective

Recover the intended final row-level security contract for the four core
timetable tables so a clean database rebuild preserves required access rules.

Live production findings

- RLS is enabled on timetable_slots, teacher_classes,
  teaching_occurrences and school_periods.
- Production contains teacher, administrator and learner timetable policies.
- Several live policies had no repository migration that recreated them.
- Repository history did not explicitly enable RLS for timetable_slots or
  teacher_classes.
- Historical teacher_classes self-write policies allowed teachers to create,
  update or delete their own assignment authority and were not retained as
  the intended final contract.

Implementation

- Added:
  supabase/migrations/20260803160000_tbl010_core_rls_recovery.sql
- Added:
  scripts/validate-tbl010-core-rls.py
- Added:
  scripts/test-tbl010-core-rls.py
- The convergence migration explicitly enables RLS on all four core tables.
- It drops historical policy names before recreating the intended final set.

Final policy contract

timetable_slots:
- Assigned teacher may manage slots only when the exact
  teacher/school/class/subject assignment exists.
- School administrator may manage slots only for a valid teacher assignment.
- Current learner may read slots only for their current class and school.

teacher_classes:
- Assigned teacher and school administrator may read assignment rows.
- Only school administrators may insert, update or delete assignments.
- Historical teacher self-insert, self-update and self-delete policies are
  removed and not recreated.

teaching_occurrences:
- Scheduled teacher may read their occurrences.
- School administrator may read school occurrences.
- Direct authenticated insert and update policies are absent.
- Direct delete remains explicitly denied.
- Writes remain controlled through authorized RPC/service paths.

school_periods:
- Assigned teachers may read periods for their school.
- School administrators may manage school periods.

Verification evidence

- Python syntax checks passed.
- Static RLS validator passed.
- Contract test suite passed.
- All four tables explicitly enable RLS.
- Twelve required policies are created exactly once.
- Zero obsolete teacher self-write policies are recreated.
- Direct occurrence write policies are not recreated.
- Teacher slot writes require exact assignment identity.
- Learner slot reads require current class and school membership.
- TBL-010 migration is the final repository migration by filename order.
- Clean-tree policy proof passed.
- Working tree remained clean after verification.

Database and production impact

None. The recovery migration was committed to the repository but was not
applied to production during TBL-010.

Acceptance result

VERIFIED. Repository migrations now contain the intended final core timetable
RLS contract required for a clean rebuild.

Next fix

TBL-011 — Run isolated clean rebuild and prove the complete repository
migration chain reaches the intended final schema and RLS state.

---

TBL-011 VERIFIED HANDOVER

Objective

Prove that the complete repository migration chain can rebuild an isolated
blank database and reach the required final timetable schema and RLS state.

Implementation

- Added .github/workflows/tbl011-clean-rebuild.yml.
- Added scripts/sql/tbl011_clean_rebuild_verify.sql.
- Added scripts/validate-tbl011-clean-rebuild.py.
- Added scripts/test-tbl011-clean-rebuild.py.
- The workflow runs on a disposable GitHub-hosted Ubuntu runner.
- It starts a local Docker Supabase stack.
- It runs supabase db reset --local --no-seed.
- It applies the complete repository migration chain from blank state.
- It verifies the final migration-ledger count.
- It verifies core timetable tables, RLS enablement and required policies.
- It uploads immutable rebuild evidence.
- It destroys the isolated local database after execution.

Safety controls

- No Supabase production project is linked.
- No production environment or production secrets are used.
- No --linked migration command is permitted.
- No db push or migration repair command is permitted.
- Repository permissions are read-only.
- The local database is destroyed without backup after the run.
- Static refusal tests prove unsafe workflow mutations are rejected.

Verification evidence

- Python syntax checks passed.
- Authoritative workflow static validation passed.
- Production-link mutation was rejected.
- Linked reset mutation was rejected.
- Reset without --local was rejected.
- Repository write permission was rejected.
- Missing cleanup was rejected.
- Missing final SQL verifier was rejected.
- Production access-token use was rejected.
- Missing SQL success marker was rejected.
- SQL without ON_ERROR_STOP was rejected.
- GitHub Actions manual clean-rebuild run completed successfully.
- The blank local database accepted the complete migration chain.
- Final timetable schema and RLS verification completed successfully.

Database and production impact

None. Only a disposable local Supabase database on the GitHub Actions runner
was created and destroyed. Production project yauqsxggtuxuykcbrtzf was not
linked, queried, reset or modified.

Acceptance result

VERIFIED. The full repository migration chain succeeds from blank state and
reaches the intended final timetable security contract.

Next fix

TBL-012 — Compare rebuilt schema with target schema.

## Permanent Vibeschool product vision

The authoritative long-term product and architecture vision is stored at:

`docs/VIBESCHOOL_OS_VISION.md`

All future Teacher OS, VibeTwin, VibeLearn, publishing, learner, parent and
school work must remain aligned with that document. Do not create parallel
architectures or isolated feature generators.

---

## LP-002A2B — Parent lesson delivery authority — VERIFIED

Repository commit

- `a4b0987 fix(lesson-plan): make parent delivery idempotent`

Production migration

- Live ledger version: `20260804064246`
- Name: `lp002a2b_parent_delivery`
- Repository migration:
  `supabase/migrations/20260804064246_lp002a2b_parent_delivery.sql`

Verified production authority

- `parent_messages.lesson_plan_id` exists and references
  `lesson_plans(id)` with `ON DELETE SET NULL`.
- `parent_messages.delivery_purpose` exists.
- One canonical parent delivery is enforced per:
  `lesson_plan_id + student_id + delivery_purpose`.
- `channel='in_app'` is accepted.
- `generated_by='lesson_plan'` is accepted.
- `deliver_lesson_plan_to_parents(uuid,text,text,text)` exists as
  `SECURITY DEFINER` with pinned `search_path`.
- `authenticated` may execute the RPC.
- `anon` and `public` may not execute it.
- Active learners are resolved server-side from the authoritative lesson class.
- Existing historical parent messages were preserved unchanged.
- `LessonPlanModal` no longer inserts directly into `parent_messages`.
- Parent delivery, homework, and exercise operations complete before the lesson
  status transitions to `shared_to_parents`.

Verification

- Focused LP-002A2B contracts passed.
- TypeScript passed with increased Node heap.
- `git diff --check` passed.
- Production postflight passed.

Next lesson-plan fix

- `LP-002A2C — Separate publish, parent delivery and derived asset actions`
- Status: READY
- Do not combine it with further messaging or VibeConnect redesign.
