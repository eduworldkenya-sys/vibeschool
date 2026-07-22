#!/usr/bin/env python3
"""
TBL-002 / TBL-003 validator: supabase/reconciliation/migration_classification.json

This script is READ-ONLY. It does not connect to Supabase, does not execute
SQL, and does not modify any migration file. It checks the classification
artifact for internal completeness and consistency against:

  1. The real local filesystem (supabase/migrations/*.sql), scanned fresh.
  2. The live ledger snapshot embedded in the classification JSON itself
     (captured via Supabase:list_migrations during the TBL-002 session —
     this script has no network path to Supabase and must not query it).

Exit code 0 = pass. Exit code 1 = fail (prints every failure found; does not
stop at the first one).

Checks performed (mirrors HANDOVER.md TBL-002 "Required validation"):
  - every local migration version has exactly one classification
  - every live (remote) migration version has exactly one classification
  - no version has multiple classification entries
  - every classification value is one of the 9 allowed values
  - no duplicate local migration filenames share a version key
  - every entry whose classification is not PARITY_APPLIED has a non-empty
    follow_up (i.e. "a mismatch lacks an explicit follow-up" fails)
  - every required known entry (from HANDOVER.md / TIMETABLE_FIX_REGISTER.md)
    is present and its satisfied_by versions actually appear in `entries`

TBL-003 additions (pending migration handling):
  - a PENDING_DEPLOYMENT entry is only permitted when all of the following
    hold, and fails otherwise:
      * the version exists as exactly one local migration file on disk
        (not zero, not a duplicate);
      * the version is absent from the embedded live ledger snapshot;
      * the entry's local_file matches the actual filename on disk;
      * reason is present and non-empty;
      * target_environment is present and non-empty;
      * approval_status is one of AWAITING_APPROVAL, APPROVED, BLOCKED;
      * follow_up is present and non-empty.
  - these checks apply only to entries classified PENDING_DEPLOYMENT, so
    STALE_REPO_ONLY (and every other classification) remains unaffected and
    distinct from pending-deployment handling.
  - an unclassified local-only version still fails regardless of whether it
    could have qualified as pending (classification is never inferred).
"""
import json
import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MIGRATIONS_DIR = os.path.join(REPO_ROOT, "supabase", "migrations")
CLASSIFICATION_PATH = os.path.join(REPO_ROOT, "supabase", "reconciliation", "migration_classification.json")

ALLOWED_CLASSIFICATIONS = {
    "PARITY_APPLIED",
    "SYNTHETIC_BASELINE",
    "PENDING_DEPLOYMENT",
    "HISTORICAL_PLACEHOLDER",
    "MISSING_REPO_SOURCE",
    "STALE_REPO_ONLY",
    "UNEXPECTED_LIVE_ONLY",
    "NAME_MISMATCH",
    "DUPLICATE_LOCAL_VERSION",
}

# Required fields for every PENDING_DEPLOYMENT entry (TBL-003).
PENDING_REQUIRED_FIELDS = (
    "version",
    "local_file",
    "classification",
    "reason",
    "target_environment",
    "approval_status",
    "follow_up",
)

# Non-empty-string fields checked individually so a missing field produces
# its own, specifically-named failure rather than one generic message.
PENDING_REQUIRED_NONEMPTY_FIELDS = (
    "local_file",
    "reason",
    "target_environment",
    "approval_status",
    "follow_up",
)

ALLOWED_APPROVAL_STATUSES = {
    "AWAITING_APPROVAL",
    "APPROVED",
    "BLOCKED",
}

# required_known_entries ids that must be present in production classification
# data. Exposed as a module default (rather than hardcoded inline) so tests
# can override it with an empty/custom set when exercising unrelated logic
# in isolation.
DEFAULT_REQUIRED_IDS_EXPECTED = {
    "live-only-14",
    "stale-repo-only-20260711150000",
    "historical-assessments-removal",
    "fix18e-historical-placeholders",
    "synthetic-baseline",
    "core-link-constraints-20260719160000",
    "qualify-scheme-id-20260720120000",
}

VERSION_RE = re.compile(r"^(\d+)_(.+)\.sql$")


def fail(errors, msg):
    errors.append(msg)


def scan_local_migrations(errors, migrations_dir):
    """Returns dict[version] -> list of filenames (list to expose duplicates)."""
    if not os.path.isdir(migrations_dir):
        fail(errors, f"Migrations directory not found: {migrations_dir}")
        return {}
    local = {}
    for f in sorted(os.listdir(migrations_dir)):
        if not f.endswith(".sql"):
            continue
        m = VERSION_RE.match(f)
        if not m:
            fail(errors, f"Unparseable local migration filename (cannot extract version): {f}")
            continue
        version = m.group(1)
        local.setdefault(version, []).append(f)
    return local


def validate_pending_entries(entries, local_on_disk, live_versions_from_snapshot, errors):
    """TBL-003: validate every PENDING_DEPLOYMENT entry against its required
    fields and eligibility rules. Only entries classified PENDING_DEPLOYMENT
    are inspected here — every other classification (including
    STALE_REPO_ONLY) is left entirely untouched by this function, so pending
    and stale handling stay distinct.
    """
    for e in entries:
        if e.get("classification") != "PENDING_DEPLOYMENT":
            continue

        v = e.get("version", "<missing>")

        # Required non-empty fields, checked individually for a precise message.
        for field in PENDING_REQUIRED_NONEMPTY_FIELDS:
            value = e.get(field)
            if not value or not str(value).strip():
                fail(
                    errors,
                    f"PENDING_DEPLOYMENT version {v} is missing required field '{field}'.",
                )

        # approval_status, if present, must be one of the allowed values.
        approval_status = e.get("approval_status")
        if approval_status and approval_status not in ALLOWED_APPROVAL_STATUSES:
            fail(
                errors,
                f"PENDING_DEPLOYMENT version {v} has invalid approval_status "
                f"{approval_status!r} (must be one of {sorted(ALLOWED_APPROVAL_STATUSES)}).",
            )

        # The version must exist as exactly one local migration file.
        local_files = local_on_disk.get(v, [])
        if len(local_files) == 0:
            fail(
                errors,
                f"PENDING_DEPLOYMENT version {v} does not correspond to any "
                f"local migration file on disk.",
            )
        elif len(local_files) > 1:
            fail(
                errors,
                f"PENDING_DEPLOYMENT version {v} corresponds to more than one "
                f"local migration file (duplicate version): {local_files}.",
            )
        else:
            actual_file = local_files[0]
            local_file_field = e.get("local_file")
            if local_file_field and local_file_field != actual_file:
                fail(
                    errors,
                    f"PENDING_DEPLOYMENT version {v} local_file "
                    f"({local_file_field!r}) does not match the actual file on "
                    f"disk ({actual_file!r}).",
                )

        # The version must be absent from the live ledger snapshot — a
        # version already live cannot be "not yet deployed".
        if v in live_versions_from_snapshot:
            fail(
                errors,
                f"PENDING_DEPLOYMENT version {v} is already present in the "
                f"live ledger snapshot; it cannot be pending deployment.",
            )


def run_validation(classification_path, migrations_dir, required_ids_expected=None):
    """Runs every check and returns (errors, stats). Never exits or prints —
    callers (main() and the self-test suite) decide what to do with the
    result.
    """
    if required_ids_expected is None:
        required_ids_expected = DEFAULT_REQUIRED_IDS_EXPECTED

    errors = []

    if not os.path.isfile(classification_path):
        return [f"Classification file not found: {classification_path}"], {}

    with open(classification_path) as f:
        data = json.load(f)

    entries = data.get("entries", [])
    required_known_entries = data.get("required_known_entries", [])
    live_snapshot = data.get("live_ledger_snapshot", [])

    # --- Real local filesystem scan (ground truth, not trusted from JSON) ---
    local_on_disk = scan_local_migrations(errors, migrations_dir)

    # duplicate local filenames sharing one version key
    duplicate_local_versions = {v: files for v, files in local_on_disk.items() if len(files) > 1}
    for v, files in duplicate_local_versions.items():
        fail(errors, f"Duplicate local version {v}: files {files} share the same version key.")

    local_versions_on_disk = set(local_on_disk.keys())
    live_versions_from_snapshot = {e["version"] for e in live_snapshot}

    # --- Build lookup of entries by version, detect multiple-classification cases ---
    entries_by_version = {}
    for e in entries:
        v = e.get("version")
        if v is None:
            fail(errors, f"Entry missing 'version' field: {e}")
            continue
        entries_by_version.setdefault(v, []).append(e)

    for v, es in entries_by_version.items():
        classes = {e.get("classification") for e in es}
        if len(es) > 1 and len(classes) > 1:
            fail(errors, f"Version {v} has multiple conflicting classifications: {sorted(classes)}")
        elif len(es) > 1:
            fail(errors, f"Version {v} has {len(es)} duplicate classification entries (should be exactly one).")

    # --- Validate classification values ---
    for e in entries:
        v = e.get("version", "<missing>")
        c = e.get("classification")
        if c not in ALLOWED_CLASSIFICATIONS:
            fail(errors, f"Version {v} has invalid classification value: {c!r}")

    # --- Every entry that isn't PARITY_APPLIED must carry an explicit follow_up ---
    for e in entries:
        v = e.get("version", "<missing>")
        c = e.get("classification")
        follow_up = e.get("follow_up")
        if c != "PARITY_APPLIED":
            if not follow_up or not str(follow_up).strip():
                fail(errors, f"Version {v} (classification={c}) is a mismatch but has no explicit follow_up.")

    # --- TBL-003: PENDING_DEPLOYMENT-specific field and eligibility checks ---
    validate_pending_entries(entries, local_on_disk, live_versions_from_snapshot, errors)

    # --- Every local-on-disk version must have exactly one classification entry ---
    classified_versions = set(entries_by_version.keys())
    unclassified_local = local_versions_on_disk - classified_versions
    for v in sorted(unclassified_local):
        fail(errors, f"Local migration version {v} ({local_on_disk[v]}) is unclassified.")

    # --- Every live-ledger-snapshot version must have exactly one classification entry ---
    unclassified_live = live_versions_from_snapshot - classified_versions
    for v in sorted(unclassified_live):
        fail(errors, f"Live migration version {v} is unclassified.")

    # --- Required known entries must be present, with satisfied_by versions that exist ---
    for rke in required_known_entries:
        rid = rke.get("id", "<missing id>")
        satisfied_by = rke.get("satisfied_by", [])
        if not satisfied_by:
            fail(errors, f"Required known entry '{rid}' has no satisfied_by versions listed.")
            continue
        for v in satisfied_by:
            if v not in classified_versions:
                fail(errors, f"Required known entry '{rid}' references version {v}, which has no classification entry.")

    # required_known_entries themselves must cover the fixed set of known entries
    present_ids = {rke.get("id") for rke in required_known_entries}
    missing_ids = required_ids_expected - present_ids
    for rid in sorted(missing_ids):
        fail(errors, f"Required known entry '{rid}' is absent from required_known_entries.")

    # --- Cross-check: local_ledger recorded in JSON matches disk (integrity, not trust) ---
    json_local_versions = {e["version"] for e in data.get("local_ledger", [])}
    if json_local_versions != local_versions_on_disk:
        only_disk = local_versions_on_disk - json_local_versions
        only_json = json_local_versions - local_versions_on_disk
        if only_disk:
            fail(errors, f"Versions on disk but missing from JSON local_ledger: {sorted(only_disk)}")
        if only_json:
            fail(errors, f"Versions in JSON local_ledger but not found on disk: {sorted(only_json)}")

    stats = {
        "local_versions_on_disk": len(local_versions_on_disk),
        "live_versions_from_snapshot": len(live_versions_from_snapshot),
        "entries": len(entries),
        "required_known_entries": len(required_known_entries),
    }
    return errors, stats


def main():
    if not os.path.isfile(CLASSIFICATION_PATH):
        print(f"FAIL: classification file not found: {CLASSIFICATION_PATH}")
        sys.exit(1)

    errors, stats = run_validation(CLASSIFICATION_PATH, MIGRATIONS_DIR)

    if errors:
        print(f"VALIDATION FAILED — {len(errors)} error(s):\n")
        for i, msg in enumerate(errors, 1):
            print(f"  {i}. {msg}")
        sys.exit(1)

    print("VALIDATION PASSED")
    print(f"  Local migrations on disk:        {stats['local_versions_on_disk']}")
    print(f"  Live ledger snapshot versions:    {stats['live_versions_from_snapshot']}")
    print(f"  Classification entries:          {stats['entries']}")
    print(f"  Required known entries verified: {stats['required_known_entries']}")
    sys.exit(0)


if __name__ == "__main__":
    main()
