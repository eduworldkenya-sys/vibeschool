#!/usr/bin/env python3
"""Regression tests for prepare-authoritative-school-snapshot.py."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("prepare-authoritative-school-snapshot.py")


def run_case(root: Path, csv_text: str, output_name: str = "out") -> subprocess.CompletedProcess[str]:
    artifact = root / "official.pdf"
    records = root / "records.csv"
    output = root / output_name
    artifact.write_bytes(b"official-tier0-artifact\n")
    records.write_text(csv_text, encoding="utf-8")
    return subprocess.run(
        [
            sys.executable, str(SCRIPT),
            "--artifact", str(artifact),
            "--records", str(records),
            "--source-name", "kenya_ministry_grade10_selection",
            "--source-url", "https://selection.education.go.ke/files/senior-schools-in-kenya.pdf",
            "--source-version", "test-v2",
            "--retrieved-at", "2026-08-16T00:00:00+00:00",
            "--output-dir", str(output),
        ],
        text=True, capture_output=True, check=False,
    )


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        good_csv = (
            "School Name,UIC,KNEC Code,County,Sub County,Type,Accommodation,Gender,Institution Type\n"
            "Alliance High School,001234,11200001,Kiambu,Kikuyu,Public,Boarding,Boys,National\n"
            "Alliance Girls High School,001235,11200002,Kiambu,Kikuyu,Public,Boarding,Girls,National\n"
        )
        first = run_case(root, good_csv, "first")
        assert first.returncode == 0, first.stderr or first.stdout
        records = load_json(root / "first" / "records.json")
        manifest = load_json(root / "first" / "manifest.json")
        assert records[0]["nemis_uic"] == "001234", "leading zero in UIC was lost"
        assert records[0]["knec_code"] == "11200001"
        assert records[0]["source_record_id"] == "nemis:001234"
        assert records[0]["ownership_type"] == "Public", "generic Type=Public must map to ownership_type"
        assert records[0]["accommodation_type"] == "Boarding"
        assert records[0]["gender_type"] == "Boys"
        assert records[0]["school_type"] == "National"
        assert "type" not in records[0]
        assert "accommodation" not in records[0]
        assert "gender" not in records[0]
        assert manifest["contract"].endswith(".v2")
        assert manifest["records"]["count"] == 2
        assert manifest["records"]["certifiable_count"] == 2
        assert manifest["safety"]["tier0_staging_safe"] is True

        second = run_case(root, good_csv, "second")
        assert second.returncode == 0
        manifest2 = load_json(root / "second" / "manifest.json")
        assert manifest["artifact"]["sha256"] == manifest2["artifact"]["sha256"]
        assert manifest["package_sha256"] == manifest2["package_sha256"], "same input must package identically"
        assert load_json(root / "first" / "records.json") == load_json(root / "second" / "records.json")

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        alias_csv = (
            "name,knec_code,ownership,boarding_status,sex,school_type\n"
            "Alias School,12345670,Private,Day,Mixed,Senior School\n"
        )
        result = run_case(root, alias_csv)
        assert result.returncode == 0, result.stderr or result.stdout
        record = load_json(root / "out" / "records.json")[0]
        assert record["ownership_type"] == "Private"
        assert record["accommodation_type"] == "Day"
        assert record["gender_type"] == "Mixed"
        assert record["school_type"] == "Senior School"

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        ambiguous_csv = "name,knec_code,type\nAmbiguous School,12345671,Unknown Composite Category\n"
        result = run_case(root, ambiguous_csv)
        assert result.returncode == 0, result.stderr or result.stdout
        record = load_json(root / "out" / "records.json")[0]
        assert record["school_type"] == "Unknown Composite Category"
        assert "ownership_type" not in record

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        duplicate_csv = (
            "name,knec_code,county\n"
            "School One,12345678,Nairobi\n"
            "School Two,12345678,Nairobi\n"
        )
        result = run_case(root, duplicate_csv)
        assert result.returncode == 2, "duplicate strong identifier must fail closed"
        manifest = load_json(root / "out" / "manifest.json")
        assert "12345678" in manifest["records"]["duplicate_groups"]["knec_code"]
        assert manifest["safety"]["tier0_staging_safe"] is False

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        missing_id_csv = "name,county\nUnidentified School,Nairobi\n"
        result = run_case(root, missing_id_csv)
        assert result.returncode == 2, "Tier-0 row without a strong ID must fail closed"
        records = load_json(root / "out" / "records.json")
        diagnostics = load_json(root / "out" / "diagnostics.json")
        assert records[0]["source_record_id"].startswith("missing-strong-id:")
        assert "missing_strong_identifier" in diagnostics[0]["issues"]

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        missing_name_csv = "name,knec_code\n,11200001\n"
        result = run_case(root, missing_name_csv)
        assert result.returncode == 2, "Tier-0 row without an official name must fail closed"
        diagnostics = load_json(root / "out" / "diagnostics.json")
        assert "missing_name" in diagnostics[0]["issues"]

    print("PASS: authoritative school snapshot preparer")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
