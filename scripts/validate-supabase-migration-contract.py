#!/usr/bin/env python3
"""Fail closed when a new table migration omits its access contract."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
BASELINE = "20260810071000"

# Capture both optional schema and relation. Security validation must understand
# the full SQL identifier rather than treating a non-public schema as a table name.
CREATE_TABLE = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?"
    r"(?:(?P<schema>[a-z_][a-z0-9_]*)\.)?"
    r"(?P<table>[a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)


def normalized(sql: str) -> str:
    return re.sub(r"\s+", " ", sql.lower())


def sql_code_only(raw: str) -> str:
    """Remove SQL comments before structural statement discovery."""
    without_block_comments = re.sub(r"/\*.*?\*/", " ", raw, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", " ", without_block_comments)


def validate(path: Path) -> list[str]:
    raw = path.read_text(encoding="utf-8")
    code = sql_code_only(raw)
    sql = normalized(code)
    errors: list[str] = []

    if re.search(
        r"grant\s+all(?:\s+privileges)?\b[^;]*\bto\s+(?:anon|authenticated)\b",
        sql,
    ):
        errors.append("blanket GRANT ALL to anon/authenticated is forbidden")

    if re.search(r"grant\s+[^;]*\btruncate\b[^;]*\bto\s+(?:anon|authenticated)\b", sql):
        errors.append("TRUNCATE may not be granted to anon/authenticated")

    relations: set[tuple[str | None, str]] = {
        (m.group("schema").lower() if m.group("schema") else None, m.group("table").lower())
        for m in CREATE_TABLE.finditer(code)
    }

    for schema, table in sorted(relations, key=lambda x: ((x[0] or ""), x[1])):
        if schema:
            display = f"{schema}.{table}"
            qualified = rf"{re.escape(schema)}\.{re.escape(table)}"
        else:
            display = table
            qualified = rf"(?:public\.)?{re.escape(table)}"

        has_rls = re.search(
            rf"alter\s+table\s+{qualified}\s+enable\s+row\s+level\s+security",
            sql,
        )
        has_privilege_contract = re.search(
            rf"(?:grant|revoke)\s+[^;]*\bon\s+(?:table\s+)?[^;]*\b{qualified}\b",
            sql,
        )
        restricted_access = re.search(
            rf"--\s*access:\s*(?:service-only|owner-only)\s+{qualified}\b",
            raw,
            re.IGNORECASE,
        )
        has_policy = re.search(
            rf"create\s+policy\s+[^;]*\bon\s+(?:table\s+)?{qualified}\b",
            sql,
        )
        auth_test = re.search(
            rf"--\s*authorization-test:\s*{qualified}\b",
            raw,
            re.IGNORECASE,
        )

        if not has_rls:
            errors.append(f"{display}: missing ENABLE ROW LEVEL SECURITY")
        if not has_privilege_contract:
            errors.append(f"{display}: missing explicit GRANT/REVOKE contract")
        if not (has_policy or restricted_access):
            errors.append(f"{display}: missing policy or restricted-access declaration")
        if not auth_test:
            errors.append(f"{display}: missing authorization-test declaration")

    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--changed-from",
        default=None,
        help="Validate only migration files changed by this branch since the supplied git ref.",
    )
    return parser.parse_args()


def migration_paths(changed_from: str | None) -> list[Path]:
    if not changed_from:
        return sorted(MIGRATIONS.glob("*.sql"))

    result = subprocess.run(
        [
            "git",
            "diff",
            "--name-only",
            "--diff-filter=ACMR",
            f"{changed_from}...HEAD",
            "--",
            "supabase/migrations/*.sql",
        ],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    paths: list[Path] = []
    for line in result.stdout.splitlines():
        candidate = ROOT / line.strip()
        if candidate.is_file() and candidate.parent == MIGRATIONS:
            paths.append(candidate)
    return sorted(set(paths))


def main() -> int:
    args = parse_args()
    failures: list[str] = []
    paths = migration_paths(args.changed_from)
    for path in paths:
        version = path.name.split("_", 1)[0]
        if version < BASELINE:
            continue
        for error in validate(path):
            failures.append(f"{path.relative_to(ROOT)}: {error}")

    if failures:
        print("Supabase migration contract FAILED:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    scope = f"branch changes since {args.changed_from}" if args.changed_from else "all post-baseline migrations"
    print(f"Supabase migration contract passed ({scope}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
