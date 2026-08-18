#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("worker-engine-build-ledger-aligned-stage.py")
spec = importlib.util.spec_from_file_location("stage_builder", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

APPROVED = module.APPROVED_WORKER_ENGINE_VERSIONS
StageFailure = module.StageFailure


def make_fixture(root: Path) -> tuple[Path, Path]:
    migrations = root / "supabase" / "migrations"
    migrations.mkdir(parents=True)
    config = root / "supabase" / "config.toml"
    config.write_text('project_id = "fixture"\n', encoding="utf-8")
    for version in sorted(APPROVED):
        (migrations / f"{version}_worker_engine_fixture.sql").write_text(f"-- approved {version}\n", encoding="utf-8")
    (migrations / "20260801000000_parity_fixture.sql").write_text("-- parity\n", encoding="utf-8")
    (migrations / "20260802000000_unrelated_repository_only.sql").write_text("-- unrelated\n", encoding="utf-8")
    return migrations, config


def good_report() -> dict:
    return {
        "read_only_audit": True,
        "authorized_repairs": [],
        "counts": {"duplicate_local_versions": 0, "duplicate_remote_versions": 0},
        "parity_versions": ["20260801000000"],
        "local_only": [
            *[{"version": version} for version in sorted(APPROVED)],
            {"version": "20260802000000"},
        ],
        "remote_only": [{"version": "20260731000000"}],
    }


def expect_failure(report: dict, migrations: Path, config: Path, root: Path, text: str) -> None:
    try:
        module.build_stage(report, migrations, config, root / "stage")
    except StageFailure as exc:
        assert text in str(exc), (text, str(exc))
    else:
        raise AssertionError(f"expected StageFailure containing {text!r}")


def test_success() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        stage = root / "stage"
        manifest = module.build_stage(good_report(), migrations, config, stage)
        versions = {p.name.split("_", 1)[0] for p in (stage / "supabase" / "migrations").glob("*.sql")}
        expected = APPROVED | {"20260801000000", "20260731000000"}
        assert versions == expected
        assert "20260802000000" not in versions
        assert set(manifest["expected_worker_engine_versions"]) == APPROVED
        assert manifest["authorized_repairs"] == []
        assert manifest["production_mutation"] is False
        assert manifest["production_only_placeholders"] == ["20260731000000"]
        assert manifest["identity_collision_placeholders"] == []
        placeholder = stage / "supabase" / "migrations" / "20260731000000_production_history_placeholder.sql"
        assert placeholder.is_file()
        assert "Never executed" in placeholder.read_text(encoding="utf-8")


def test_shared_version_identity_override_uses_placeholder() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        pending = sorted(APPROVED)[-1]
        collision = "20260801000000"
        report = good_report()
        report["local_only"] = [{"version": v} for v in sorted(APPROVED)] + [{"version": "20260802000000"}]
        old = module.VERSION_PLACEHOLDER_OVERRIDES
        module.VERSION_PLACEHOLDER_OVERRIDES = {collision: "remote identity differs; forward repair=fixture"}
        try:
            stage = root / "stage"
            manifest = module.build_stage(report, migrations, config, stage)
        finally:
            module.VERSION_PLACEHOLDER_OVERRIDES = old
        original = stage / "supabase" / "migrations" / f"{collision}_parity_fixture.sql"
        placeholder = stage / "supabase" / "migrations" / f"{collision}_production_history_placeholder.sql"
        assert not original.exists()
        assert placeholder.is_file()
        assert "remote identity differs" in placeholder.read_text(encoding="utf-8")
        assert manifest["identity_collision_placeholders"] == [{"version": collision, "reason": "remote identity differs; forward repair=fixture"}]
        assert pending in manifest["expected_worker_engine_versions"]


def test_incremental_promotion_only_stages_pending_approved() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        pending = "20260814094000"
        report = good_report()
        report["local_only"] = [{"version": pending}, {"version": "20260802000000"}]
        report["parity_versions"] = ["20260801000000", *sorted(APPROVED - {pending})]
        manifest = module.build_stage(report, migrations, config, root / "stage")
        assert manifest["expected_worker_engine_versions"] == [pending]
        assert set(manifest["approved_worker_engine_versions"]) == APPROVED
        assert "20260802000000" in manifest["excluded_unrelated_repository_only"]


def test_missing_approved_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        report = good_report()
        missing = sorted(APPROVED)[0]
        report["local_only"] = [r for r in report["local_only"] if r["version"] != missing]
        expect_failure(report, migrations, config, root, "absent from ledger classification")


def test_no_pending_approved_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        report = good_report()
        report["local_only"] = [{"version": "20260802000000"}]
        report["parity_versions"] = ["20260801000000", *sorted(APPROVED)]
        expect_failure(report, migrations, config, root, "no approved Worker Engine migrations are pending")


def test_overlap_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        report = good_report()
        report["remote_only"].append({"version": "20260801000000"})
        expect_failure(report, migrations, config, root, "version classes overlap")


def test_identity_override_must_exist_remotely() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        old = module.VERSION_PLACEHOLDER_OVERRIDES
        module.VERSION_PLACEHOLDER_OVERRIDES = {"20260802000000": "invalid because repository-only"}
        try:
            expect_failure(good_report(), migrations, config, root, "identity placeholder is not present in production ledger")
        finally:
            module.VERSION_PLACEHOLDER_OVERRIDES = old


def test_repair_authority_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations, config = make_fixture(root)
        report = good_report()
        report["authorized_repairs"] = [{"version": "20260801000000"}]
        try:
            path = root / "report.json"
            path.write_text(json.dumps(report), encoding="utf-8")
            module.load_report(path)
        except StageFailure as exc:
            assert "authorized repairs" in str(exc)
        else:
            raise AssertionError("authorized repairs must block staging")


def test_duplicate_count_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        report = good_report()
        report["counts"]["duplicate_remote_versions"] = 1
        path = root / "report.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        try:
            module.load_report(path)
        except StageFailure as exc:
            assert "duplicate production" in str(exc)
        else:
            raise AssertionError("duplicate production versions must block staging")


def main() -> None:
    test_success()
    test_shared_version_identity_override_uses_placeholder()
    test_incremental_promotion_only_stages_pending_approved()
    test_missing_approved_blocks()
    test_no_pending_approved_blocks()
    test_overlap_blocks()
    test_identity_override_must_exist_remotely()
    test_repair_authority_blocks()
    test_duplicate_count_blocks()
    print("Worker Engine ledger-aligned staging regression suite PASSED")


if __name__ == "__main__":
    main()
