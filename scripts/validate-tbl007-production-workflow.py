#!/usr/bin/env python3
"""Static safety validator for the TBL-007 production workflow."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/tbl007-production-migration-repair.yml"

if not WORKFLOW.is_file():
    print("TBL-007 workflow validation FAILED: workflow missing")
    raise SystemExit(1)

text = WORKFLOW.read_text(encoding="utf-8")

required = {
    "manual dispatch": "workflow_dispatch:",
    "serialized execution": "group: production-migration-repair",
    "no cancellation": "cancel-in-progress: false",
    "read-only repository permission": "contents: read",
    "protected environment": "environment: production-migration-repair",
    "pinned project": "EXPECTED_PROJECT_REF: yauqsxggtuxuykcbrtzf",
    "exact approved checkout": "ref: ${{ inputs.expected_head }}",
    "main-head verification": 'REMOTE_MAIN="$(git rev-parse origin/main)"',
    "confirmation phrase": (
        "EXPECTED_CONFIRMATION="
        '"REPAIR $VERSION $STATUS ON $EXPECTED_PROJECT_REF"'
    ),
    "classification validator": (
        "python3 scripts/validate-migration-classification.py"
    ),
    "collision validator": (
        "python3 scripts/validate-tbl006-collision-register.py"
    ),
    "preflight gate": (
        "python3 scripts/tbl007-migration-repair-gate.py"
    ),
    "authorized executor": (
        "python3 scripts/tbl007-authorized-migration-repair.py"
    ),
    "fresh ledger before": "live-ledger-before.txt",
    "fresh ledger after": "live-ledger-after.txt",
    "always-run postflight capture": "if: always()",
    "executable TBL-008 postflight": (
        "python3 scripts/tbl008-migration-postflight.py"
    ),
    "postflight JSON report": "postflight-report.json",
    "approved version passed to postflight": (
        "--version '${{ inputs.migration_version }}'"
    ),
    "approved status passed to postflight": (
        "--status '${{ inputs.repair_status }}'"
    ),
    "evidence upload": "actions/upload-artifact@v4",
    "artifact retention": "retention-days: 90",
}

errors = [
    f"missing {label}: {needle}"
    for label, needle in required.items()
    if needle not in text
]

for forbidden in (
    "pull_request:",
    "push:",
    "schedule:",
    "cancel-in-progress: true",
    "permissions: write-all",
):
    if forbidden in text:
        errors.append(f"forbidden workflow trigger/control present: {forbidden}")

repair_count = text.count("supabase migration repair")
if repair_count != 0:
    errors.append(
        "workflow must invoke only the authorized Python executor; "
        "raw supabase migration repair command found"
    )

executor_count = text.count(
    "python3 scripts/tbl007-authorized-migration-repair.py"
)
if executor_count != 1:
    errors.append(
        f"authorized executor must appear exactly once; found {executor_count}"
    )

if errors:
    print("TBL-007 workflow validation FAILED:")
    for error in errors:
        print("  -", error)
    raise SystemExit(1)

print("TBL-007 production workflow static validation PASSED")
