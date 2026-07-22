#!/usr/bin/env python3
"""
Documentation-only reconciliation of HANDOVER.md.

Records verified migration-ledger findings for:
- duplicate live fix28 ledger entries;
- fix18e_d_qualify_scheme_id version mismatch;
- current live-ledger versus repository-version differences.

Touches HANDOVER.md only.

Does not:
- modify application code;
- modify TIMETABLE_FIX_REGISTER.md;
- create or apply SQL;
- modify Supabase;
- repair migration history;
- rename migration files;
- commit or push.

Safe to re-run:
- validates every source anchor before writing;
- writes atomically;
- exits successfully without changes if already applied.
"""

import os
import sys

REPO = os.getcwd()
HANDOVER_PATH = os.path.join(REPO, "HANDOVER.md")
ALREADY_APPLIED_MARKER = "CORRECTED 2026-07-20"


def abort(message: str) -> None:
    sys.stderr.write(f"ABORT: {message}\n")
    sys.stderr.write("No files have been modified.\n")
    sys.exit(1)


def atomic_write(path: str, content: str) -> None:
    temporary_path = path + ".tmp_patch"

    with open(
        temporary_path,
        "w",
        encoding="utf-8",
        newline="\n",
    ) as file:
        file.write(content)

    os.replace(temporary_path, path)


def require_exact_count(
    source: str,
    anchor: str,
    expected: int,
    label: str,
) -> None:
    count = source.count(anchor)

    if count != expected:
        abort(
            f"anchor '{label}' found {count} time(s); "
            f"expected {expected}.\n\nAnchor text:\n{anchor!r}"
        )


if not os.path.isfile(HANDOVER_PATH):
    abort(f"{HANDOVER_PATH} does not exist")

with open(HANDOVER_PATH, "r", encoding="utf-8") as file:
    source = file.read()

if ALREADY_APPLIED_MARKER in source:
    print(
        "Already applied: HANDOVER.md contains "
        f"'{ALREADY_APPLIED_MARKER}'."
    )
    print("No changes made.")
    sys.exit(0)


# ---------------------------------------------------------------------------
# Anchor 1: replace stale migration-risk statements.
# ---------------------------------------------------------------------------

RISKS_OLD = """Known open migration risks

- 7 live migration versions currently have no repository file.
- "20260711150000" is currently believed to be stale repository-only.
- The historical removal of "assessments" and "assessment_scores" is undocumented.
- Historical fix18e placeholders require explicit classification.
- Synthetic baselines require explicit classification.
- "20260720120000_fix18e_d_qualify_scheme_id.sql" is believed to be pending deployment, subject to live verification."""

RISKS_NEW = """Known open migration risks

- 14 live ledger versions currently have no same-version migration file in the repository. CORRECTED 2026-07-20 by a read-only comparison of current GitHub main against the live Supabase migration ledger; the previous count was 7. The affected live versions are: 20260520000000, 20260717220005, 20260718062000, 20260718082408, 20260718141521, 20260718184230, 20260719132810, 20260720142114, 20260720143830, 20260720143840, 20260720143847, 20260720143903, 20260720143912, and 20260720200607.
- "20260711150000" is currently believed to be stale repository-only.
- The historical removal of "assessments" and "assessment_scores" is undocumented.
- Historical fix18e placeholders require explicit classification.
- Synthetic baselines require explicit classification.
- "20260720120000_fix18e_d_qualify_scheme_id.sql" — CORRECTED 2026-07-20: no live migration-ledger entry exists under version 20260720120000. The intended change is present under live ledger version "20260720143903" with name "fix18e_d_qualify_scheme_id". No same-version repository migration file currently corresponds to 20260720143903.
- "fix28_create_timetable_slot_error_codes_and_grants" is recorded under two live ledger versions: "20260720142114" and "20260720200607". The later entry is a harmless redundant reapplication of the same functional end state. Repeated REVOKE and GRANT statements are idempotent and do not by themselves prove that an earlier migration failed. The repository source-controlled representation is "supabase/migrations/20260720123500_fix28_create_timetable_slot_error_codes_and_grants.sql"; its executable database change is functionally equivalent to both live fix28 entries. The live ledger must not be deleted, renamed, or rewritten to remove either entry."""

require_exact_count(
    source,
    RISKS_OLD,
    1,
    "Known open migration risks block",
)


# ---------------------------------------------------------------------------
# Anchor 2: append a read-only investigation entry to the work log.
# ---------------------------------------------------------------------------

WORK_LOG_OLD = """Entry template

DATE:
SESSION:
ACTION:
EVIDENCE:
RESULT:

---

APPROVAL GATES"""

WORK_LOG_NEW = """Entry template

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

APPROVAL GATES"""

require_exact_count(
    source,
    WORK_LOG_OLD,
    1,
    "SESSION WORK LOG template boundary",
)


patched = source.replace(
    RISKS_OLD,
    RISKS_NEW,
    1,
).replace(
    WORK_LOG_OLD,
    WORK_LOG_NEW,
    1,
)

if ALREADY_APPLIED_MARKER not in patched:
    abort(
        "post-patch validation failed: correction marker "
        "was not present in generated content"
    )

if patched == source:
    abort("generated content is identical to the original file")

atomic_write(HANDOVER_PATH, patched)

print("Patched:")
print("  - HANDOVER.md")
print()
print("Not changed:")
print("  - TIMETABLE_FIX_REGISTER.md")
print()
print(
    "Reason: TBL-002 already reads OPEN in the register, "
    "which matches the verified repository state."
)
