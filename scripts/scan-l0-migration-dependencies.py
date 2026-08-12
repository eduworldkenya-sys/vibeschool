#!/usr/bin/env python3
"""High-confidence static dependency preflight for the L0 migration chain.

This scanner is intentionally conservative. It reports only dependencies that can
be established from migration order without executing PostgreSQL. TBL-011 remains
the final runtime oracle.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MIGRATIONS = ROOT / "supabase" / "migrations"

SYSTEM_SCHEMAS = {"pg_catalog", "information_schema", "auth", "storage", "extensions", "realtime", "supabase_migrations"}


@dataclass(frozen=True)
class Finding:
    kind: str
    migration: str
    object: str
    detail: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--migrations", default=str(DEFAULT_MIGRATIONS))
    parser.add_argument("--report", default=None)
    parser.add_argument("--allow-findings", action="store_true")
    return parser.parse_args()


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def norm_ident(value: str) -> str:
    value = value.strip().strip('"')
    if "." not in value:
        return f"public.{value.lower()}"
    schema, name = value.split(".", 1)
    return f"{schema.strip(chr(34)).lower()}.{name.strip(chr(34)).lower()}"


def is_external_relation(rel: str) -> bool:
    return rel.split(".", 1)[0] in SYSTEM_SCHEMAS


def migration_version(name: str) -> str:
    return name.split("_", 1)[0]


def split_top_level_commas(text: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    quote: str | None = None
    i = 0
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == quote:
                if i + 1 < len(text) and text[i + 1] == quote:
                    i += 1
                else:
                    quote = None
        elif ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch == "," and depth == 0:
            parts.append(text[start:i].strip())
            start = i + 1
        i += 1
    parts.append(text[start:].strip())
    return [p for p in parts if p]


def function_key(name: str, args: str) -> tuple[str, int]:
    normalized = norm_ident(name)
    args = args.strip()
    if not args:
        return normalized, 0
    return normalized, len(split_top_level_commas(args))


def add_once(findings: list[Finding], seen: set[tuple[str, str, str]], finding: Finding) -> None:
    key = (finding.kind, finding.migration, finding.object)
    if key not in seen:
        findings.append(finding)
        seen.add(key)


def iter_sql_files(directory: Path) -> Iterable[Path]:
    yield from sorted(p for p in directory.iterdir() if p.is_file() and p.suffix == ".sql")


def main() -> int:
    args = parse_args()
    migration_dir = Path(args.migrations)
    if not migration_dir.is_dir():
        raise SystemExit(f"migration directory missing: {migration_dir}")

    files = list(iter_sql_files(migration_dir))
    findings: list[Finding] = []
    finding_seen: set[tuple[str, str, str]] = set()

    versions: dict[str, list[str]] = {}
    for path in files:
        versions.setdefault(migration_version(path.name), []).append(path.name)
    for version, names in sorted(versions.items()):
        if len(names) > 1:
            for name in names:
                add_once(findings, finding_seen, Finding(
                    "DUPLICATE_MIGRATION_VERSION", name, version,
                    "same migration ledger version is used by: " + ", ".join(names),
                ))

    relations: set[str] = set()
    columns: dict[str, set[str]] = {}
    functions: set[tuple[str, int]] = set()

    create_table_re = re.compile(
        r"\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w\".]+)\s*\((.*?)\)\s*;",
        re.I | re.S,
    )
    alter_table_re = re.compile(r"\balter\s+table\s+(?:if\s+exists\s+)?([\w\".]+)", re.I)
    references_re = re.compile(r"\breferences\s+([\w\".]+)\s*\(", re.I)
    create_index_re = re.compile(r"\bcreate\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?[\w\"]+\s+on\s+([\w\".]+)\s*\((.*?)\)", re.I | re.S)
    create_policy_re = re.compile(r"\bcreate\s+policy\s+[\w\"]+\s+on\s+([\w\".]+)", re.I)
    drop_policy_re = re.compile(r"\bdrop\s+policy\s+(?:if\s+exists\s+)?[\w\"]+\s+on\s+([\w\".]+)", re.I)
    create_trigger_re = re.compile(r"\bcreate\s+trigger\s+[\w\"]+.*?\bon\s+([\w\".]+)", re.I | re.S)
    create_function_re = re.compile(
        r"\bcreate\s+(?:or\s+replace\s+)?function\s+([\w\".]+)\s*\((.*?)\)\s*returns\b",
        re.I | re.S,
    )
    privilege_function_re = re.compile(
        r"\b(?:grant\s+execute\s+on|revoke\s+(?:all|execute)\s+on)\s+function\s+([\w\".]+)\s*\((.*?)\)",
        re.I | re.S,
    )
    alter_add_column_re = re.compile(
        r"\balter\s+table\s+([\w\".]+).*?\badd\s+column\s+(?:if\s+not\s+exists\s+)?([\w\"]+)",
        re.I | re.S,
    )
    alter_column_re = re.compile(
        r"\balter\s+table\s+([\w\".]+).*?\balter\s+column\s+([\w\"]+)",
        re.I | re.S,
    )

    for path in files:
        sql = strip_comments(path.read_text(encoding="utf-8"))

        # CREATE TABLE statements establish relations and their base columns before
        # later statements in the same migration are checked.
        for match in create_table_re.finditer(sql):
            rel = norm_ident(match.group(1))
            relations.add(rel)
            rel_cols = columns.setdefault(rel, set())
            body = match.group(2)
            for item in split_top_level_commas(body):
                token = item.lstrip().split(None, 1)[0].strip('"').lower() if item.strip() else ""
                if token and token not in {"constraint", "primary", "foreign", "unique", "check", "exclude"}:
                    rel_cols.add(token)

        for match in create_function_re.finditer(sql):
            functions.add(function_key(match.group(1), match.group(2)))

        # Relations consumed by DDL.
        relation_uses: list[tuple[str, str]] = []
        relation_uses += [("ALTER_TABLE_BEFORE_CREATE", m.group(1)) for m in alter_table_re.finditer(sql)]
        relation_uses += [("FOREIGN_KEY_TARGET_BEFORE_CREATE", m.group(1)) for m in references_re.finditer(sql)]
        relation_uses += [("INDEX_TABLE_BEFORE_CREATE", m.group(1)) for m in create_index_re.finditer(sql)]
        relation_uses += [("POLICY_TABLE_BEFORE_CREATE", m.group(1)) for m in create_policy_re.finditer(sql)]
        relation_uses += [("POLICY_TABLE_BEFORE_CREATE", m.group(1)) for m in drop_policy_re.finditer(sql)]
        relation_uses += [("TRIGGER_TABLE_BEFORE_CREATE", m.group(1)) for m in create_trigger_re.finditer(sql)]

        for kind, raw_rel in relation_uses:
            rel = norm_ident(raw_rel)
            if not is_external_relation(rel) and rel not in relations:
                add_once(findings, finding_seen, Finding(
                    kind, path.name, rel,
                    "relation is referenced before any earlier CREATE TABLE in the migration chain",
                ))

        # Exact function privilege hardening is a strong signal: PostgreSQL requires
        # the target signature to exist at that point.
        for match in privilege_function_re.finditer(sql):
            key = function_key(match.group(1), match.group(2))
            if key not in functions:
                add_once(findings, finding_seen, Finding(
                    "FUNCTION_PRIVILEGE_BEFORE_CREATE", path.name,
                    f"{key[0]}/{key[1]}",
                    "GRANT/REVOKE targets a function signature not created earlier in the chain",
                ))

        # High-confidence ALTER COLUMN existence checks where the base table shape is known.
        for match in alter_column_re.finditer(sql):
            rel = norm_ident(match.group(1))
            col = match.group(2).strip('"').lower()
            if rel in columns and col not in columns[rel]:
                add_once(findings, finding_seen, Finding(
                    "ALTER_COLUMN_BEFORE_CREATE", path.name, f"{rel}.{col}",
                    "ALTER COLUMN targets a column absent from the statically known table shape",
                ))

        # Apply ADD COLUMN mutations after checking the current migration's dependencies.
        for match in alter_add_column_re.finditer(sql):
            rel = norm_ident(match.group(1))
            col = match.group(2).strip('"').lower()
            if rel in relations:
                columns.setdefault(rel, set()).add(col)

    report = {
        "scanner_version": 1,
        "migration_count": len(files),
        "finding_count": len(findings),
        "findings": [asdict(f) for f in findings],
        "limitations": [
            "Static high-confidence scan only; PL/pgSQL runtime/data-dependent failures remain for TBL-011.",
            "Function matching uses normalized name plus argument count, not full PostgreSQL type identity.",
            "Dynamic SQL and dependencies hidden inside procedural bodies are intentionally not guessed.",
        ],
    }

    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.report:
        output = Path(args.report)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf-8")

    print(f"L0 dependency preflight scanned {len(files)} migrations")
    if findings:
        print(f"L0 dependency preflight found {len(findings)} high-confidence blocker(s):")
        for item in findings:
            print(f"  - {item.kind}: {item.migration}: {item.object} — {item.detail}")
        return 0 if args.allow_findings else 1

    print("L0 dependency preflight PASSED: no high-confidence blockers found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
