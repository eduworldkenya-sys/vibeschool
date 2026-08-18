#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("worker-engine-build-r1-4-ledger-aligned-stage.py")
spec = importlib.util.spec_from_file_location("r1_4_stage", SCRIPT)
assert spec and spec.loader
r1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r1)

EXPECTED = {
    "20260818111900", "20260818112000", "20260818112100", "20260818112200",
    "20260818112300", "20260818112400", "20260818112500", "20260818112600",
    "20260818112700", "20260818112800", "20260818112900", "20260818113000",
}


def main() -> None:
    assert r1.R1_4_PRODUCTION_VERSIONS == EXPECTED
    assert not (r1.R1_4_PRODUCTION_VERSIONS & r1.SUPERSEDED_R1_3X_REPOSITORY_ONLY)
    assert "20260815091000" in r1.SUPERSEDED_R1_3X_REPOSITORY_ONLY
    assert "20260815133000" in r1.SUPERSEDED_R1_3X_REPOSITORY_ONLY

    r1.configure_r1_4_scope()
    assert r1.module.APPROVED_WORKER_ENGINE_VERSIONS == EXPECTED

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations = root / "supabase" / "migrations"
        migrations.mkdir(parents=True)
        config = root / "supabase" / "config.toml"
        config.write_text('project_id = "fixture"\n', encoding="utf-8")

        parity = "20260818050400"
        remote_only = "20260817132001"
        for version in [parity, *sorted(EXPECTED), *sorted(r1.SUPERSEDED_R1_3X_REPOSITORY_ONLY)]:
            (migrations / f"{version}_fixture.sql").write_text(f"-- {version}\n", encoding="utf-8")

        report = {
            "read_only_audit": True,
            "authorized_repairs": [],
            "counts": {"duplicate_local_versions": 0, "duplicate_remote_versions": 0},
            "parity_versions": [parity],
            "local_only": [
                *[{"version": v} for v in sorted(EXPECTED)],
                *[{"version": v} for v in sorted(r1.SUPERSEDED_R1_3X_REPOSITORY_ONLY)],
            ],
            "remote_only": [{"version": remote_only}],
        }

        manifest = r1.module.build_stage(report, migrations, config, root / "stage")
        assert set(manifest["expected_worker_engine_versions"]) == EXPECTED
        assert r1.SUPERSEDED_R1_3X_REPOSITORY_ONLY <= set(manifest["excluded_unrelated_repository_only"])
        staged = {p.name.split("_", 1)[0] for p in (root / "stage" / "supabase" / "migrations").glob("*.sql")}
        assert not (staged & r1.SUPERSEDED_R1_3X_REPOSITORY_ONLY)
        assert EXPECTED <= staged
        assert remote_only in staged

    print("Worker Engine R1.4 production staging regression suite PASSED")


if __name__ == "__main__":
    main()
