#!/usr/bin/env python3
"""Conservative TBL-013 migration provenance classifier.

This tool compares repository migration files with a read-only export of
`supabase_migrations.schema_migrations` and emits exact statement-text hash
matches between repository-only and production-only versions.

Safety rules:
- no database connection or mutation;
- no migration repair command generation;
- no semantic SQL normalization;
- only migrations stored as exactly one production `statements[]` element are
  eligible for whole-file matching;
- matching evidence remains a provenance candidate, never repair authority.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

MIGRATION_FILE_RE = re.compile(r"^(?P<version>\d{8,14})_(?P<name>.+)\.sql$")


class ClassificationFailure(Exception):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--migrations-dir", default="supabase/migrations")
    parser.add_argument("--production-ledger-json", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args()


def normalize_exact_text(text: str) -> str:
    """Normalize transport-only differences, not SQL semantics."""
    if text.startswith("\ufeff"):
        text = text[1:]
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.strip()


def sha256_text(text: str) -> str:
    return hashlib.sha256(normalize_exact_text(text).encode("utf-8")).hexdigest()


def load_local(migrations_dir: Path) -> dict[str, dict[str, Any]]:
    if not migrations_dir.is_dir():
        raise ClassificationFailure(f"migration directory missing: {migrations_dir}")

    by_version: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for path in sorted(migrations_dir.glob("*.sql")):
        match = MIGRATION_FILE_RE.fullmatch(path.name)
        if match is None:
            raise ClassificationFailure(f"invalid migration filename: {path.name}")
        text = path.read_text(encoding="utf-8-sig")
        by_version[match.group("version")].append(
            {
                "version": match.group("version"),
                "name": match.group("name"),
                "file": path.name,
                "sha256": sha256_text(text),
            }
        )

    duplicates = [version for version, rows in by_version.items() if len(rows) != 1]
    if duplicates:
        raise ClassificationFailure(f"duplicate local migration versions: {sorted(duplicates)}")
    if not by_version:
        raise ClassificationFailure("no local migrations found")
    return {version: rows[0] for version, rows in by_version.items()}


def load_production(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        raise ClassificationFailure(f"production ledger export missing: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list) or not raw:
        raise ClassificationFailure("production ledger export must be a non-empty JSON array")

    by_version: dict[str, dict[str, Any]] = {}
    for row in raw:
        if not isinstance(row, dict):
            raise ClassificationFailure("production ledger row must be an object")
        version = str(row.get("version", ""))
        if not re.fullmatch(r"\d{8,14}", version):
            raise ClassificationFailure(f"invalid production migration version: {version!r}")
        if version in by_version:
            raise ClassificationFailure(f"duplicate production migration version: {version}")
        statements = row.get("statements")
        if statements is None:
            statements = []
        if not isinstance(statements, list) or not all(isinstance(v, str) for v in statements):
            raise ClassificationFailure(f"invalid statements array for production version {version}")
        entry: dict[str, Any] = {
            "version": version,
            "name": row.get("name"),
            "statement_count": len(statements),
            "whole_migration_sha256": None,
        }
        if len(statements) == 1:
            entry["whole_migration_sha256"] = sha256_text(statements[0])
        by_version[version] = entry
    return by_version


def build_report(
    local: dict[str, dict[str, Any]], production: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    local_versions = set(local)
    production_versions = set(production)
    local_only = sorted(local_versions - production_versions)
    production_only = sorted(production_versions - local_versions)

    production_hash_index: dict[str, list[str]] = defaultdict(list)
    ineligible_production_only: list[dict[str, Any]] = []
    for version in production_only:
        entry = production[version]
        fingerprint = entry["whole_migration_sha256"]
        if fingerprint:
            production_hash_index[fingerprint].append(version)
        else:
            ineligible_production_only.append(
                {
                    "version": version,
                    "name": entry["name"],
                    "reason": "PRODUCTION_STATEMENT_COUNT_NOT_ONE",
                    "statement_count": entry["statement_count"],
                }
            )

    exact_candidates: list[dict[str, Any]] = []
    unmatched_local_only: list[dict[str, Any]] = []
    ambiguous_local_only: list[dict[str, Any]] = []

    for version in local_only:
        entry = local[version]
        matches = sorted(production_hash_index.get(entry["sha256"], []))
        if len(matches) == 1:
            remote_version = matches[0]
            exact_candidates.append(
                {
                    "repository_version": version,
                    "repository_file": entry["file"],
                    "production_version": remote_version,
                    "production_name": production[remote_version]["name"],
                    "sha256": entry["sha256"],
                    "classification": "EXACT_STATEMENT_TEXT_MATCH_CANDIDATE",
                    "repair_status": "NOT_AUTHORIZED",
                }
            )
        elif len(matches) > 1:
            ambiguous_local_only.append(
                {
                    "repository_version": version,
                    "repository_file": entry["file"],
                    "sha256": entry["sha256"],
                    "production_versions": matches,
                    "classification": "AMBIGUOUS_EXACT_TEXT_MATCH",
                    "repair_status": "NOT_AUTHORIZED",
                }
            )
        else:
            unmatched_local_only.append(
                {
                    "repository_version": version,
                    "repository_file": entry["file"],
                    "sha256": entry["sha256"],
                    "classification": "NO_EXACT_STATEMENT_TEXT_MATCH",
                    "repair_status": "NOT_AUTHORIZED",
                }
            )

    matched_production = {row["production_version"] for row in exact_candidates}
    unmatched_production_only = [
        {
            "production_version": version,
            "production_name": production[version]["name"],
            "statement_count": production[version]["statement_count"],
            "classification": "NO_UNIQUE_EXACT_LOCAL_TEXT_MATCH",
            "repair_status": "NOT_AUTHORIZED",
        }
        for version in production_only
        if version not in matched_production
    ]

    return {
        "schema_version": 1,
        "fix_id": "TBL-013",
        "read_only_classifier": True,
        "normalization": "UTF8_BOM_CRLF_AND_OUTER_WHITESPACE_ONLY",
        "semantic_sql_normalization": False,
        "repair_inference_from_fingerprint": False,
        "authorized_repairs": [],
        "counts": {
            "local_versions": len(local_versions),
            "production_versions": len(production_versions),
            "local_only_versions": len(local_only),
            "production_only_versions": len(production_only),
            "exact_statement_text_candidates": len(exact_candidates),
            "ambiguous_local_only": len(ambiguous_local_only),
            "unmatched_local_only": len(unmatched_local_only),
            "ineligible_production_only": len(ineligible_production_only),
        },
        "exact_statement_text_candidates": exact_candidates,
        "ambiguous_local_only": ambiguous_local_only,
        "unmatched_local_only": unmatched_local_only,
        "unmatched_production_only": unmatched_production_only,
        "ineligible_production_only": ineligible_production_only,
        "safety_rule": (
            "An exact statement-text hash match is provenance evidence only. It does not "
            "authorize migration repair, applied/reverted marking, or production mutation."
        ),
    }


def main() -> int:
    args = parse_args()
    try:
        report = build_report(
            load_local(Path(args.migrations_dir)),
            load_production(Path(args.production_ledger_json)),
        )
        output = Path(args.report)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print("TBL-013 STATEMENT FINGERPRINT CLASSIFICATION COMPLETE")
        for key, value in report["counts"].items():
            print(f"{key}: {value}")
        print("authorized_repairs: 0")
        print("report:", output)
        return 0
    except (ClassificationFailure, json.JSONDecodeError) as exc:
        print("TBL-013 STATEMENT FINGERPRINT CLASSIFICATION FAILED")
        print(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
