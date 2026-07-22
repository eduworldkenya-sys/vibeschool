#!/usr/bin/env python3
"""
TBL-003 self-tests for scripts/validate-migration-classification.py.

Read-only, self-contained: builds temporary migrations directories and
classification JSON fixtures under a tempdir for each scenario, calls
run_validation() directly, and asserts on the returned errors. Does not
touch the real repository, Supabase, or any migration file.

Run:
    python3 scripts/test_validate_migration_classification.py

Exit code 0 = all scenarios passed. Exit code 1 = at least one failed
(prints which scenario and why).
"""
import importlib.util
import os
import sys
import tempfile

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
VALIDATOR_PATH = os.path.join(THIS_DIR, "validate-migration-classification.py")

# The validator's filename contains a hyphen, so it can't be imported with a
# normal `import` statement — load it explicitly by path instead.
_spec = importlib.util.spec_from_file_location("validate_migration_classification", VALIDATOR_PATH)
validator = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(validator)


def make_fixture(tmp_dir, local_files, entries, live_ledger_snapshot=None,
                  required_known_entries=None, local_ledger=None):
    """Writes a migrations dir + classification.json under tmp_dir and
    returns (classification_path, migrations_dir).
    """
    migrations_dir = os.path.join(tmp_dir, "migrations")
    os.makedirs(migrations_dir, exist_ok=True)
    for fname in local_files:
        with open(os.path.join(migrations_dir, fname), "w") as f:
            f.write("-- fixture migration, not executed\n")

    if local_ledger is None:
        # Default: derive local_ledger directly from the files we just wrote,
        # so the disk-vs-JSON cross-check passes unless a test deliberately
        # overrides it.
        local_ledger = []
        for fname in local_files:
            version = fname.split("_", 1)[0]
            local_ledger.append({"version": version, "file": fname, "name": fname})

    classification_path = os.path.join(tmp_dir, "migration_classification.json")
    import json
    data = {
        "entries": entries,
        "required_known_entries": required_known_entries or [],
        "live_ledger_snapshot": live_ledger_snapshot or [],
        "local_ledger": local_ledger,
    }
    with open(classification_path, "w") as f:
        json.dump(data, f)

    return classification_path, migrations_dir


def run_case(name, local_files, entries, live_ledger_snapshot=None):
    with tempfile.TemporaryDirectory() as tmp_dir:
        classification_path, migrations_dir = make_fixture(
            tmp_dir, local_files, entries, live_ledger_snapshot=live_ledger_snapshot,
        )
        # required_ids_expected=set() so these isolated scenarios aren't
        # tripped up by the repo's own fixed required_known_entries list,
        # which is unrelated to pending-deployment logic.
        errors, stats = validator.run_validation(
            classification_path, migrations_dir, required_ids_expected=set(),
        )
        return errors, stats


def test_valid_pending_passes():
    version = "20260722000000"
    fname = f"{version}_some_pending_thing.sql"
    entries = [{
        "version": version,
        "local_file": fname,
        "classification": "PENDING_DEPLOYMENT",
        "reason": "Feature is flagged off until the Q3 launch window.",
        "target_environment": "production",
        "approval_status": "APPROVED",
        "follow_up": "Deploy after the Q3 launch date is confirmed.",
    }]
    errors, _ = run_case("valid_pending_passes", [fname], entries)
    assert errors == [], f"expected no errors, got: {errors}"


def test_pending_missing_reason_fails():
    version = "20260722000001"
    fname = f"{version}_some_pending_thing.sql"
    entries = [{
        "version": version,
        "local_file": fname,
        "classification": "PENDING_DEPLOYMENT",
        "reason": "",
        "target_environment": "production",
        "approval_status": "APPROVED",
        "follow_up": "Deploy after the Q3 launch date is confirmed.",
    }]
    errors, _ = run_case("pending_missing_reason_fails", [fname], entries)
    assert any("'reason'" in e for e in errors), f"expected a missing-reason error, got: {errors}"


def test_pending_missing_approval_status_fails():
    version = "20260722000002"
    fname = f"{version}_some_pending_thing.sql"
    entries = [{
        "version": version,
        "local_file": fname,
        "classification": "PENDING_DEPLOYMENT",
        "reason": "Waiting on data migration window.",
        "target_environment": "production",
        "approval_status": "",
        "follow_up": "Deploy once the data window is scheduled.",
    }]
    errors, _ = run_case("pending_missing_approval_status_fails", [fname], entries)
    assert any("'approval_status'" in e for e in errors), f"expected a missing-approval_status error, got: {errors}"


def test_pending_already_live_fails():
    version = "20260722000003"
    fname = f"{version}_some_pending_thing.sql"
    entries = [{
        "version": version,
        "local_file": fname,
        "classification": "PENDING_DEPLOYMENT",
        "reason": "Believed not yet deployed.",
        "target_environment": "production",
        "approval_status": "AWAITING_APPROVAL",
        "follow_up": "Confirm deployment status before next release.",
    }]
    # This version IS present in the live ledger snapshot — contradicts
    # "pending deployment".
    live_snapshot = [{"version": version, "name": "some_pending_thing"}]
    errors, _ = run_case("pending_already_live_fails", [fname], entries, live_ledger_snapshot=live_snapshot)
    assert any("already present in the live ledger" in e for e in errors), (
        f"expected an already-live error, got: {errors}"
    )


def test_unclassified_local_only_fails():
    version = "20260722000004"
    fname = f"{version}_some_unclassified_thing.sql"
    # No entries at all — the local file on disk has no classification.
    errors, _ = run_case("unclassified_local_only_fails", [fname], [])
    assert any("is unclassified" in e for e in errors), f"expected an unclassified error, got: {errors}"


def test_stale_repo_only_not_treated_as_pending():
    version = "20260722000005"
    fname = f"{version}_some_stale_thing.sql"
    # STALE_REPO_ONLY entry deliberately omits every pending-only field
    # (reason, target_environment, approval_status) — this must NOT fail,
    # because those fields are only required for PENDING_DEPLOYMENT.
    entries = [{
        "version": version,
        "local_file": fname,
        "classification": "STALE_REPO_ONLY",
        "follow_up": "Confirmed stale; leave in place without repair.",
    }]
    errors, _ = run_case("stale_repo_only_not_treated_as_pending", [fname], entries)
    assert errors == [], f"expected no errors for a well-formed STALE_REPO_ONLY entry, got: {errors}"


def test_duplicate_local_version_still_fails():
    version = "20260722000006"
    fname_a = f"{version}_thing_a.sql"
    fname_b = f"{version}_thing_b.sql"
    entries = [{
        "version": version,
        "local_file": fname_a,
        "classification": "PENDING_DEPLOYMENT",
        "reason": "Should never pass — duplicate version key.",
        "target_environment": "production",
        "approval_status": "APPROVED",
        "follow_up": "Resolve the duplicate version key.",
    }]
    errors, _ = run_case("duplicate_local_version_still_fails", [fname_a, fname_b], entries)
    assert any("Duplicate local version" in e for e in errors), f"expected a duplicate-version error, got: {errors}"
    assert any("corresponds to more than one" in e for e in errors), (
        f"expected a pending-specific duplicate error, got: {errors}"
    )


def test_invalid_classification_value_still_fails():
    version = "20260722000007"
    fname = f"{version}_some_thing.sql"
    entries = [{
        "version": version,
        "local_file": fname,
        "classification": "NOT_A_REAL_CLASSIFICATION",
        "follow_up": "n/a",
    }]
    errors, _ = run_case("invalid_classification_value_still_fails", [fname], entries)
    assert any("invalid classification value" in e for e in errors), f"expected an invalid-classification error, got: {errors}"


TESTS = [
    test_valid_pending_passes,
    test_pending_missing_reason_fails,
    test_pending_missing_approval_status_fails,
    test_pending_already_live_fails,
    test_unclassified_local_only_fails,
    test_stale_repo_only_not_treated_as_pending,
    test_duplicate_local_version_still_fails,
    test_invalid_classification_value_still_fails,
]


def main():
    failures = []
    for test in TESTS:
        name = test.__name__
        try:
            test()
            print(f"  PASS  {name}")
        except AssertionError as e:
            print(f"  FAIL  {name}: {e}")
            failures.append(name)
        except Exception as e:
            print(f"  ERROR {name}: {type(e).__name__}: {e}")
            failures.append(name)

    print()
    if failures:
        print(f"TBL-003 SELF-TESTS FAILED — {len(failures)} of {len(TESTS)} failed: {failures}")
        sys.exit(1)

    print(f"TBL-003 SELF-TESTS PASSED — {len(TESTS)}/{len(TESTS)}")
    sys.exit(0)


if __name__ == "__main__":
    main()
