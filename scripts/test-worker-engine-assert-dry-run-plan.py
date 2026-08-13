#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).with_name("worker-engine-assert-dry-run-plan.py")
spec = importlib.util.spec_from_file_location("dry_run_assert", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def expect_failure(expected: set[str], output: str, text: str) -> None:
    try:
        module.assert_plan(expected, output)
    except ValueError as exc:
        assert text in str(exc), (text, str(exc))
    else:
        raise AssertionError(f"expected failure containing {text!r}")


def main() -> None:
    expected = {"20260812191500", "20260812191600"}

    # Supabase CLI prints migration filenames in its migration list/push UX.
    good = """Connecting to remote database...\nDo you want to push these migrations to the remote database?\n • 20260812191500_worker_engine_we_l1_authority_lifecycle.sql\n • 20260812191600_worker_engine_we_l1_contract_hardening.sql\n"""
    summary = module.assert_plan(expected, good)
    assert "planned_migration_count=2" in summary

    # Duplicate filename mentions do not inflate the migration set.
    duplicate = good + "Applying migration 20260812191500_worker_engine_we_l1_authority_lifecycle.sql...\n"
    module.assert_plan(expected, duplicate)

    expect_failure(
        expected,
        " • 20260812191500_worker_engine_we_l1_authority_lifecycle.sql\n",
        "not all approved migrations",
    )
    expect_failure(
        expected,
        good + " • 20260813000100_unrelated_security.sql\n",
        "unapproved migrations",
    )
    expect_failure(expected, "Linked project is up to date.\n", "not all approved migrations")

    print("Worker Engine dry-run output assertion regression suite PASSED")


if __name__ == "__main__":
    main()
