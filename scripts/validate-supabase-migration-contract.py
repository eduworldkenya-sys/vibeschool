#!/usr/bin/env python3
"""Fail closed when a new public-table migration omits its access contract."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
BASELINE = "20260810071000"

CREATE_TABLE = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)


def normalized(sql: str) -> str:
    return re.sub(r"\s+", " ", sql.lower())


def validate(path: Path) -> list[str]:
    raw = path.read_text(encoding="utf-8")
    sql = normalized(raw)
    errors: list[str] = []

    if re.search(r"grant\s+all(?:\s+privileges)?\b.*?\bto\s+(?:anon|authenticated)\b", sql):
        errors.append("blanket GRANT ALL to anon/authenticated is forbidden")

    if re.search(r"grant\s+[^;]*\btruncate\b[^;]*\bto\s+(?:anon|authenticated)\b", sql):
        errors.append("TRUNCATE may not be granted to anon/authenticated")

    for table in sorted(set(CREATE_TABLE.findall(raw))):
        qualified = rf"(?:public\.)?{re.escape(table)}"
        has_rls = re.search(
            rf"alter\s+table\s+{qualified}\s+enable\s+row\s+level\s+security",
            sql,
        )
        has_privilege_contract = re.search(
            rf"(?:grant|revoke)\s+[^;]*\bon\s+(?:table\s+)?[^;]*\b{qualified}\b",
            sql,
        )
        service_only = re.search(
            rf"--\s*access:\s*service-only\s+{qualified}\b",
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
            errors.append(f"{table}: missing ENABLE ROW LEVEL SECURITY")
        if not has_privilege_contract:
            errors.append(f"{table}: missing explicit GRANT/REVOKE contract")
        if not (has_policy or service_only):
            errors.append(f"{table}: missing policy or service-only declaration")
        if not auth_test:
            errors.append(f"{table}: missing authorization-test declaration")

    return errors


def main() -> int:
    failures: list[str] = []
    for path in sorted(MIGRATIONS.glob("*.sql")):
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

    print("Supabase migration contract passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
