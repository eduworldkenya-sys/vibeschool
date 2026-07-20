VIBESCHOOL TIMETABLE HANDOVER

Purpose

This file carries verified project state between Claude Code sessions.

Claude must read this file before working and update it before ending a session.

Do not rely on previous chat memory.

Repository state, Supabase state, git history, "TIMETABLE_FIX_REGISTER.md", and this file are the continuity mechanism.

---

CURRENT STATE

Active fix

FIX ID: TBL-002
TITLE: Classify every migration
STATUS: OPEN
PRIORITY: P0

Previous verified fix

FIX ID: TBL-001
TITLE: Repair malformed and misversioned migration filenames
STATUS: VERIFIED

Current branch

BRANCH:
LATEST COMMIT:
WORKING TREE:

Connected environments

SUPABASE ENVIRONMENT: UNKNOWN
SUPABASE PROJECT REF:
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
