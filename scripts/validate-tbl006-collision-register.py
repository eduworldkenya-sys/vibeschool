#!/usr/bin/env python3
"""
TBL-006 validator.

Static, repository-only. Makes no network or database calls.

Fails (non-zero exit) when:
  1. A migration file dated after the baseline (20260520000000) references
     a baseline-owned object (timetable_slots, teacher_classes) but has no
     entry in tbl006_collision_register.json.
  2. A migration_filename recorded in the register no longer exists on disk.
  3. A baseline-owned object is touched but not declared anywhere in the
     register's entries.
  4. The known duplicate-ownership flag (excl_room_overlap) is missing from
     duplicate_or_contradictory_ownership_flags without an explicit
     resolution recorded.

Run from repo root:
    python3 scripts/validate-tbl006-collision-register.py
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
REGISTER_PATH = (
    REPO_ROOT / "supabase" / "reconciliation" / "tbl006_collision_register.json"
)

BASELINE_VERSION = "20260520000000"
BASELINE_OBJECTS = ["timetable_slots", "teacher_classes"]

VERSION_RE = re.compile(r"^(\d{8,14})")

failures = []
warnings = []


def load_register():
    if not REGISTER_PATH.exists():
        failures.append(f"Register file missing: {REGISTER_PATH}")
        return None
    with open(REGISTER_PATH) as f:
        return json.load(f)


def migration_version(path: Path) -> str:
    m = VERSION_RE.match(path.name)
    return m.group(1) if m else ""


def references_baseline_object(text: str) -> list:
    hits = []
    for obj in BASELINE_OBJECTS:
        if re.search(rf"\b{re.escape(obj)}\b", text):
            hits.append(obj)
    return hits


def main():
    register = load_register()
    if register is None:
        report()
        return

    registered_filenames = {e["migration_filename"] for e in register["entries"]}

    # Check 1 + 3: every later migration touching a baseline object is registered
    if not MIGRATIONS_DIR.exists():
        failures.append(f"Migrations directory missing: {MIGRATIONS_DIR}")
    else:
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            version = migration_version(path)
            if not version or version <= BASELINE_VERSION:
                continue
            text = path.read_text(errors="ignore").lower()
            hits = references_baseline_object(text)
            if hits and path.name not in registered_filenames:
                failures.append(
                    f"UNDECLARED COLLISION: {path.name} touches baseline object(s) "
                    f"{hits} but has no entry in the register."
                )

    # Check 2: every registered file still exists
    for fname in registered_filenames:
        if not (MIGRATIONS_DIR / fname).exists():
            failures.append(
                f"STALE REGISTER ENTRY: {fname} is recorded in the register "
                f"but no longer exists in supabase/migrations/."
            )

    # Check 4: known duplicate-ownership flag must remain present and unresolved-tracked
    flags = register.get("duplicate_or_contradictory_ownership_flags", [])
    room_overlap_flag = next(
        (
            f
            for f in flags
            if f.get("constraint") == "excl_room_overlap"
            and f.get("object") == "public.timetable_slots"
        ),
        None,
    )
    if room_overlap_flag is None:
        failures.append(
            "MISSING FLAG: excl_room_overlap duplicate-ownership finding "
            "(timetable_slots) is not present in "
            "duplicate_or_contradictory_ownership_flags. If this was "
            "resolved by editing 20260718054252_timetable_room_conflict_fix12.sql "
            "to drop-before-add, update this validator's expectation "
            "deliberately -- do not silently drop the flag."
        )
    elif room_overlap_flag.get("severity") != "HIGH":
        warnings.append(
            "excl_room_overlap flag severity changed from HIGH -- confirm "
            "this reflects an actual resolution, not an accidental edit."
        )

    report()


def report():
    if warnings:
        print("WARNINGS:")
        for w in warnings:
            print(f"  - {w}")
    if failures:
        print("TBL-006 validation FAILED:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print("TBL-006 static validation PASSED")
    print(f"Validated: {REGISTER_PATH.relative_to(REPO_ROOT)}")
    sys.exit(0)


if __name__ == "__main__":
    main()
