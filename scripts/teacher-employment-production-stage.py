#!/usr/bin/env python3
"""Stage exactly the certified teacher-employment migration against remote history.

Never writes to production: the protected GitHub workflow runs the CLI push.
"""
from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

VERSION = "20261120065500"
MIGRATION_FILE = "20261120065500_teacher_employment_marketplace.sql"
ARTIFACTS = Path(".teacher-employment-activation")
STAGE = Path(".teacher-employment-activation-stage")
REMOTE_RE = re.compile(r"^\d{8,14}$")
LOCAL_RE = re.compile(r"^(\d{8,14})_.+\.sql$")


def remote_versions(path: Path) -> set[str]:
    if not path.is_file():
        raise RuntimeError(f"Missing remote ledger: {path}")
    versions: set[str] = set()
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        fields = [x.strip().strip(chr(96)) for x in line.split("|")]
        if len(fields) >= 3 and REMOTE_RE.fullmatch(fields[1]):
            versions.add(fields[1])
    if not versions:
        raise RuntimeError("Remote migration list is empty or unparseable; refusing to apply")
    return versions


def local_sources() -> dict[str, Path]:
    migration_dir = Path("supabase/migrations")
    sources: dict[str, Path] = {}
    for f in migration_dir.glob("*.sql"):
        match = LOCAL_RE.fullmatch(f.name)
        if not match:
            raise RuntimeError(f"Invalid local migration filename {f.name}")
        version = match.group(1)
        if version in sources:
            raise RuntimeError(f"Duplicate local migration version {version}")
        sources[version] = f
    expected = sources.get(VERSION)
    if expected is None or expected.name != MIGRATION_FILE:
        raise RuntimeError("Canonical source migration is missing or renamed")
    contents = expected.read_text(encoding="utf-8")
    required = (
        "create schema teacher_employment_private",
        "alter table public.teacher_employment_listings enable row level security",
        "alter table public.teacher_employment_requests enable row level security",
        "alter table public.teacher_employment_shortlists enable row level security",
        "create view public.teacher_employment_directory",
        "teacher-employment-cvs",
        "employment_cv_shared_school_read",
    )
    if any(item not in contents for item in required):
        raise RuntimeError("Canonical recruitment migration is incomplete")
    return sources


def prepare() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    before = remote_versions(ARTIFACTS / "ledger-before.txt")
    sources = local_sources()
    if VERSION in before:
        (ARTIFACTS / "status.txt").write_text("needs_apply=false\n", encoding="utf-8")
        print("Exact canonical migration already recorded; no change required")
        return

    if STAGE.exists():
        shutil.rmtree(STAGE)
    target = STAGE / "supabase" / "migrations"
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2("supabase/config.toml", STAGE / "supabase" / "config.toml")
    placeholders = 0
    for version in sorted(before):
        source = sources.get(version)
        if source:
            shutil.copy2(source, target / source.name)
        else:
            placeholder = target / f"{version}_already_applied_remote_placeholder.sql"
            placeholder.write_text(
                "-- Remote ledger-alignment placeholder; this migration is already applied.\n",
                encoding="utf-8",
            )
            placeholders += 1

    shutil.copy2(sources[VERSION], target / MIGRATION_FILE)
    staged = set(before) | {VERSION}
    on_disk = {LOCAL_RE.fullmatch(f.name).group(1) for f in target.glob("*.sql")}
    if staged != on_disk:
        raise RuntimeError("Staging drift: unexpected or missing migrations")

    (ARTIFACTS / "expected.txt").write_text(VERSION + "\n", encoding="utf-8")
    (ARTIFACTS / "status.txt").write_text("needs_apply=true\n", encoding="utf-8")
    (ARTIFACTS / "stage.txt").write_text(
        f"target={VERSION}\nremote_existing={len(before)}\n"
        f"remote_only_placeholders={placeholders}\nstaged={len(staged)}\n",
        encoding="utf-8",
    )
    print((ARTIFACTS / "stage.txt").read_text())


def verify() -> None:
    before = remote_versions(ARTIFACTS / "ledger-before.txt")
    after = remote_versions(ARTIFACTS / "ledger-after.txt")
    expected = before | {VERSION}
    if after != expected:
        raise RuntimeError(
            f"Unsafe migration ledger delta: missing={sorted(expected - after)} "
            f"extra={sorted(after - expected)}"
        )
    (ARTIFACTS / "verification.txt").write_text(
        f"status=PASSED\nversion={VERSION}\n"
        f"before={len(before)}\nafter={len(after)}\n",
        encoding="utf-8",
    )
    print((ARTIFACTS / "verification.txt").read_text())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "verify"])
    options = parser.parse_args()
    if options.action == "prepare":
        prepare()
    else:
        verify()
