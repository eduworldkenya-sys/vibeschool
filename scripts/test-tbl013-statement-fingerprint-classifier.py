#!/usr/bin/env python3
"""Regression tests for the TBL-013 statement fingerprint classifier."""

from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("tbl013-statement-fingerprint-classifier.py")
spec = importlib.util.spec_from_file_location("tbl013_fingerprint", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        migrations = root / "migrations"
        migrations.mkdir()

        # Exact text match under a different version, allowing transport-only
        # BOM/CRLF/outer-whitespace normalization.
        write(migrations / "20260101000000_exact.sql", "select 1;\n")
        # Same SQL meaning but textually different: deliberately not matched.
        write(migrations / "20260101000001_semantic_only.sql", "SELECT 2;\n")
        # Exact text appears twice remotely: must remain ambiguous.
        write(migrations / "20260101000002_ambiguous.sql", "select 3;\n")
        # Exact-version parity row should not enter local-only classification.
        write(migrations / "20260101000003_parity.sql", "select 4;\n")

        production = [
            {
                "version": "20260202000000",
                "name": "historical_exact",
                "statements": ["\ufeff\r\nselect 1;\r\n"],
            },
            {
                "version": "20260202000001",
                "name": "semantic_but_not_textual",
                "statements": ["select 2;"],
            },
            {
                "version": "20260202000002",
                "name": "ambiguous_a",
                "statements": ["select 3;"],
            },
            {
                "version": "20260202000003",
                "name": "ambiguous_b",
                "statements": ["select 3;"],
            },
            {
                "version": "20260202000004",
                "name": "multi_statement_array",
                "statements": ["select 5;", "select 6;"],
            },
            {
                "version": "20260101000003",
                "name": "parity",
                "statements": ["select 4;"],
            },
        ]
        ledger = root / "production.json"
        ledger.write_text(json.dumps(production), encoding="utf-8")

        report = module.build_report(
            module.load_local(migrations), module.load_production(ledger)
        )

        candidates = report["exact_statement_text_candidates"]
        assert len(candidates) == 1, candidates
        assert candidates[0]["repository_version"] == "20260101000000"
        assert candidates[0]["production_version"] == "20260202000000"
        assert candidates[0]["repair_status"] == "NOT_AUTHORIZED"

        ambiguous = report["ambiguous_local_only"]
        assert len(ambiguous) == 1, ambiguous
        assert ambiguous[0]["repository_version"] == "20260101000002"
        assert ambiguous[0]["production_versions"] == [
            "20260202000002",
            "20260202000003",
        ]

        unmatched = report["unmatched_local_only"]
        assert [row["repository_version"] for row in unmatched] == ["20260101000001"]

        ineligible = report["ineligible_production_only"]
        assert any(row["production_version"] == "20260202000004" for row in report["unmatched_production_only"])
        assert any(row["version"] == "20260202000004" for row in ineligible)

        assert report["authorized_repairs"] == []
        assert report["repair_inference_from_fingerprint"] is False
        assert report["semantic_sql_normalization"] is False

        # Duplicate production versions must fail closed.
        duplicate = root / "duplicate.json"
        duplicate.write_text(
            json.dumps(
                [
                    {"version": "20260202000000", "statements": ["select 1;"]},
                    {"version": "20260202000000", "statements": ["select 1;"]},
                ]
            ),
            encoding="utf-8",
        )
        try:
            module.load_production(duplicate)
        except module.ClassificationFailure:
            pass
        else:
            raise AssertionError("duplicate production versions must fail")

    print("TBL-013 statement fingerprint classifier tests PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
