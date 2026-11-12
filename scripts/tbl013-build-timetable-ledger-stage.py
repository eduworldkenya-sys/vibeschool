#!/usr/bin/env python3
"""TBL-013: stage only the audited timetable migrations for a read-only dry run.

Reuse the existing ledger-aligned staging engine. A CLI dry run does not
authorize production execution, migration repair, or a claim of schema parity.
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

SOURCE = Path(__file__).with_name("worker-engine-build-ledger-aligned-stage.py")
spec = importlib.util.spec_from_file_location("timetable_shared_stage", SOURCE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

TIMETABLE_MIGRATIONS = {
    "20261112101500": "20261112101500_timetable_canonical_grades_and_allocations.sql",
    "20261112101600": "20261112101600_timetable_school_period_authority.sql",
    "20261112101700": "20261112101700_timetable_allocation_baseline_and_load.sql",
    "20261112101800": "20261112101800_timetable_dated_scheme_binding.sql",
    "20261112154500": "20261112154500_unscheduled_teaching_occurrence.sql",
}
APPROVED_TIMETABLE_VERSIONS = frozenset(TIMETABLE_MIGRATIONS)


def configure_timetable_scope(migrations_dir: Path = Path("supabase/migrations")) -> None:
    for version, filename in sorted(TIMETABLE_MIGRATIONS.items()):
        source = migrations_dir / filename
        if not source.is_file():
            raise module.StageFailure(
                f"approved timetable migration missing or renamed: {version} {filename}"
            )
        matching = list(migrations_dir.glob(f"{version}_*.sql"))
        if len(matching) != 1 or matching[0].name != filename:
            raise module.StageFailure(
                f"ambiguous timetable migration version: {version}"
            )
    # No second staging implementation or migration version generator:
    # reuse the same immutable ledger-alignment mechanism already in the repo.
    module.APPROVED_WORKER_ENGINE_VERSIONS = set(APPROVED_TIMETABLE_VERSIONS)
    module.VERSION_PLACEHOLDER_OVERRIDES = {}


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--migrations-dir", default="supabase/migrations")
    known, _ = parser.parse_known_args()
    try:
        configure_timetable_scope(Path(known.migrations_dir))
    except module.StageFailure as exc:
        print("TBL-013 TIMETABLE DRY-RUN STAGE BLOCKED")
        print(str(exc))
        return 1
    print("TBL-013 TIMETABLE LEDGER STAGE: READ-ONLY PREFLIGHT")
    return module.main()


if __name__ == "__main__":
    raise SystemExit(main())
