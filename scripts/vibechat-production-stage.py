#!/usr/bin/env python3
"""Stage only the certified VibeChat integrated text messaging migration set."""
import argparse
import subprocess
import importlib.util
from pathlib import Path


def load_helper(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


TARGETS = {
    "20261123090000_unified_identity_foundation.sql": "56992bcf3043b2b8ee2dbf40e06ff9dcb97bc9b9",
    "20261123110000_unified_identity_authority_hardening.sql": "6178e10bc86f627c3e510416a812f3a34f63c351",
    "20261124075100_vibechat_username_search.sql": "6a0ece2aaeefcf1158490033ec522904183d944c",
    "20261124235000_vibechat_discovery_identity_repair.sql": "db5b8b3dc349f083f7dea750adea04c4c57c7ec2",
    "20261124235100_vibechat_realtime_receipts.sql": "d9ea8a072b640024eb3a478ab82465598f654979",
    "20261124235200_vibechat_idempotent_send.sql": "76ea6b6f0818fd3c251a3beabd541f6d8202dc71",
    "20261124235300_vibechat_rich_messages.sql": "417b15b5360e2cce33c7418f67cb97f1f50994d7",
    "20261124235400_vibechat_conversation_tools.sql": "e0a6ae49991d8919b1edf558ccfe5d1fd07c2cae",
    "20261124235500_vibechat_web_push.sql": "adc9eacd8a58695efcb6e034917f6d29c5964326",
    "20261124235600_vibechat_groups.sql": "0443dbcce0e70b05a14b2b50002cd44fad1531f3"
}
VERSIONS = {filename.split("_", 1)[0] for filename in TARGETS}
MIGRATIONS = Path("supabase/migrations")
EVIDENCE = Path(".vibechat-production")


def check():
    for filename, digest in TARGETS.items():
        path = MIGRATIONS / filename
        if subprocess.check_output(["git", "hash-object", str(path)], text=True).strip() != digest:
            raise ValueError(f"Migration differs from the approved SQL: {path}")


def prepare():
    stage = load_helper("worker-engine-build-ledger-aligned-stage")
    report = stage.load_report(EVIDENCE / "audit.json")
    expected = EVIDENCE / "expected.txt"
    parity = set(report["parity_versions"])
    if VERSIONS <= parity:
        expected.write_text("", encoding="utf-8")
        return
    stage.APPROVED_WORKER_ENGINE_VERSIONS = VERSIONS
    manifest = stage.build_stage(report, MIGRATIONS, Path("supabase/config.toml"), Path(".vibechat-production-stage"))
    pending = manifest["expected_worker_engine_versions"]
    if set(pending) != VERSIONS - parity:
        raise ValueError("Staged migration set does not match the approved missing versions")
    expected.write_text("".join(f"{version}\n" for version in pending), encoding="utf-8")


def verify():
    ledger = load_helper("teacher-employment-production-stage")
    before = ledger.remote_versions(EVIDENCE / "before.txt")
    after = ledger.remote_versions(EVIDENCE / "after.txt")
    if after != before | VERSIONS:
        raise ValueError(f"Unexpected production ledger change, additions={sorted(after - before)}, removals={sorted(before - after)}")
    print("Verified exact VibeChat production migration versions")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["check", "prepare", "verify"])
    action = parser.parse_args().action
    check()
    if action == "prepare":
        prepare()
    elif action == "verify":
        verify()
