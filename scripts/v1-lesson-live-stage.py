#!/usr/bin/env python3
"""Stage the two verified V1 migrations using the existing ledger alignment code."""
import argparse
import hashlib
import importlib.util
from pathlib import Path


def load_helper(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


TARGETS = {
    "20261121141000_live_moderated_chat_waiting_typing.sql":
        "0c7e02f0c3860cc98aa2122984af06e91ee3b2c97884e5b601fea94d922a5515",
    "20261121180000_restore_dated_lesson_outcome_attachment.sql":
        "df249018205de56003b9d1c663a601748e0385150b74b4968e2e1acbcd342d5e",
}
VERSIONS = {filename.split("_", 1)[0] for filename in TARGETS}
MIGRATIONS = Path("supabase/migrations")
EVIDENCE = Path(".v1-lesson-live")


def check():
    for filename, digest in TARGETS.items():
        path = MIGRATIONS / filename
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
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
    manifest = stage.build_stage(report, MIGRATIONS, Path("supabase/config.toml"), Path(".v1-lesson-live-stage"))
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
    print("Verified exact V1 production migration versions")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["check", "prepare", "verify"])
    action = parser.parse_args().action
    check()
    if action == "prepare":
        prepare()
    elif action == "verify":
        verify()
