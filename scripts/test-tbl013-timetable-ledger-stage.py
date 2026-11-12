#!/usr/bin/env python3
"""Read-only regression contract for VibeSchool timetable production preflight."""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

SOURCE = Path(__file__).with_name("tbl013-build-timetable-ledger-stage.py")
spec = importlib.util.spec_from_file_location("timetable_stage", SOURCE)
assert spec and spec.loader
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)

UNRELATED_VERSION = "20261112091500"
PARITY_VERSION = "20260520000000"
REMOTE_ONLY_VERSION = "20260720200607"


def fixture(root: Path) -> tuple[Path, Path]:
    directory = root / "supabase" / "migrations"
    directory.mkdir(parents=True)
    config = root / "supabase" / "config.toml"
    config.write_text('project_id = "fixture"\n', encoding="utf-8")
    for name in stage.TIMETABLE_MIGRATIONS.values():
        (directory / name).write_text(f"-- fixture: {name}\n", encoding="utf-8")
    (directory / f"{PARITY_VERSION}_parity.sql").write_text("-- parity\n", encoding="utf-8")
    (directory / f"{UNRELATED_VERSION}_unrelated.sql").write_text("-- excluded\n", encoding="utf-8")
    return directory, config


def report(pending: set[str]) -> dict:
    approved = set(stage.APPROVED_TIMETABLE_VERSIONS)
    return {
        "read_only_audit": True,
        "authorized_repairs": [],
        "counts": {"duplicate_local_versions": 0, "duplicate_remote_versions": 0},
        "parity_versions": [PARITY_VERSION, *sorted(approved - pending)],
        "local_only": [{"version": v} for v in sorted(pending | {UNRELATED_VERSION})],
        "remote_only": [{"version": REMOTE_ONLY_VERSION}],
    }


def rejected(source: dict, migrations: Path, config: Path, root: Path, message: str) -> None:
    try:
        stage.module.build_stage(source, migrations, config, root / "stage")
    except stage.module.StageFailure as error:
        assert message in str(error), (message, str(error))
    else:
        raise AssertionError(f"expected stage rejection: {message}")


def run() -> None:
    approved = set(stage.APPROVED_TIMETABLE_VERSIONS)
    assert len(approved) == 5
    assert sorted(approved) == [
        "20261112101500", "20261112101600", "20261112101700",
        "20261112101800", "20261112154500",
    ]

    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        migrations, config = fixture(root)
        stage.configure_timetable_scope(migrations)
        assert stage.module.APPROVED_WORKER_ENGINE_VERSIONS == approved
        assert stage.module.VERSION_PLACEHOLDER_OVERRIDES == {}

        # Every approved change is pending. Other repository-only migrations
        # must not be smuggled into the exact Supabase dry-run plan.
        manifest = stage.module.build_stage(report(approved), migrations, config, root / "stage")
        staged = {p.name.split("_", 1)[0] for p in (root / "stage/supabase/migrations").glob("*.sql")}
        assert staged == approved | {PARITY_VERSION, REMOTE_ONLY_VERSION}
        assert manifest["expected_worker_engine_versions"] == sorted(approved)
        assert manifest["excluded_unrelated_repository_only"] == [UNRELATED_VERSION]
        assert manifest["authorized_repairs"] == []
        assert manifest["production_mutation"] is False

        placeholder = root / "stage/supabase/migrations" / f"{REMOTE_ONLY_VERSION}_production_history_placeholder.sql"
        assert "Never executed" in placeholder.read_text(encoding="utf-8")

        # If two of the five versions are in live history, only three may
        # appear in the dry-run plan; all five must remain in stage provenance.
        pending = set(sorted(approved)[2:])
        partial = stage.module.build_stage(report(pending), migrations, config, root / "stage")
        assert set(partial["expected_worker_engine_versions"]) == pending
        assert set(partial["approved_worker_engine_versions"]) == approved

        # A missing approved version or an allegedly repaired ledger is not a
        # reason to infer a migration ran.
        missing = report(approved)
        missing["local_only"] = [x for x in missing["local_only"] if x["version"] != min(approved)]
        rejected(missing, migrations, config, root, "absent from ledger classification")
        unverified = report(approved)
        unverified["counts"]["duplicate_remote_versions"] = 1
        try:
            stage.module.load_report_for_test  # never exists; use the public loader below
        except AttributeError:
            pass
        import json
        file = root / "bad-report.json"
        file.write_text(json.dumps(unverified), encoding="utf-8")
        try:
            stage.module.load_report(file)
        except stage.module.StageFailure as error:
            assert "duplicate production migration versions" in str(error)
        else:
            raise AssertionError("duplicate production versions must block")

        # Missing source or duplicate timestamp prevents staging.
        missing_file = migrations / stage.TIMETABLE_MIGRATIONS[min(approved)]
        missing_file.unlink()
        try:
            stage.configure_timetable_scope(migrations)
        except stage.module.StageFailure as error:
            assert "missing or renamed" in str(error)
        else:
            raise AssertionError("missing approved SQL must block")

    print("TBL-013 timetable ledger preflight: read-only contract PASSED")


if __name__ == "__main__":
    run()
