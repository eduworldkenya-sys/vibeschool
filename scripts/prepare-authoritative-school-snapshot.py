#!/usr/bin/env python3
"""Prepare a deterministic Tier-0 school snapshot for VibeSchool ingestion.

This tool is offline-only. It never connects to Supabase or promotes canonical
schools. It normalizes a locally acquired authoritative artifact into the
raw_record contract consumed by the School Engine.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

PARSER_VERSION = "p0.10-tier0-preparer-v2"

ALIASES = {
    "name": ("name", "school_name", "school", "institution_name", "official_name", "institution"),
    "knec_code": ("knec_code", "knec", "knec_school_code", "exam_code"),
    "nemis_uic": ("nemis_uic", "nemis_code", "nemis", "uic", "uic_code"),
    "moe_registration_no": (
        "moe_registration_no", "moe_registration_number", "moe_code",
        "ministry_registration_no", "ministry_registration_number", "registration_no",
    ),
    "tsc_code": ("tsc_code", "tsc", "tsc_school_code"),
    "region": ("region",),
    "county": ("county",),
    "sub_county": ("sub_county", "subcounty", "sub_county_name"),
    "school_type": ("school_type", "institution_type"),
    "ownership_type": ("ownership_type", "ownership"),
    "accommodation_type": ("accommodation_type", "accommodation", "boarding_status"),
    "gender_type": ("gender_type", "gender", "sex", "school_gender"),
    "cluster": ("cluster",),
    "latitude": ("latitude", "lat"),
    "longitude": ("longitude", "lon", "lng"),
}

STRONG_ID_FIELDS = (
    ("nemis", "nemis_uic"),
    ("knec", "knec_code"),
    ("moe", "moe_registration_no"),
    ("tsc", "tsc_code"),
)

PUBLIC_PRIVATE = {"public", "private"}
ACCOMMODATION = {"day", "boarding", "day & boarding", "day and boarding", "mixed day and boarding"}
GENDER = {"boys", "girls", "mixed", "boy", "girl", "co-ed", "coed"}


def die(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def clean(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "nan"}:
        return None
    return text


def canonical_key(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalized_mapping(row: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in row.items():
        k = canonical_key(str(key))
        if k not in result or clean(result[k]) is None:
            result[k] = value
    return result


def pick(row: dict[str, Any], field: str) -> str | None:
    for alias in ALIASES[field]:
        value = clean(row.get(alias))
        if value is not None:
            return value
    return None


def infer_legacy_type(row: dict[str, Any], normalized: dict[str, str | None]) -> None:
    """Map a generic legacy `Type` header only when its vocabulary is unambiguous."""
    generic = clean(row.get("type"))
    if generic is None:
        return
    lowered = generic.casefold()
    if normalized["ownership_type"] is None and lowered in PUBLIC_PRIVATE:
        normalized["ownership_type"] = generic
    elif normalized["accommodation_type"] is None and lowered in ACCOMMODATION:
        normalized["accommodation_type"] = generic
    elif normalized["gender_type"] is None and lowered in GENDER:
        normalized["gender_type"] = generic
    elif normalized["school_type"] is None:
        normalized["school_type"] = generic


def load_rows(path: Path) -> list[dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                die("CSV has no header")
            return [dict(row) for row in reader]

    if suffix in {".jsonl", ".ndjson"}:
        rows: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8-sig") as handle:
            for line_no, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    value = json.loads(line)
                except json.JSONDecodeError as exc:
                    die(f"invalid JSONL at line {line_no}: {exc}")
                if not isinstance(value, dict):
                    die(f"JSONL line {line_no} is not an object")
                rows.append(value)
        return rows

    if suffix == ".json":
        with path.open("r", encoding="utf-8-sig") as handle:
            value = json.load(handle)
        if isinstance(value, dict) and isinstance(value.get("records"), list):
            value = value["records"]
        if not isinstance(value, list):
            die("JSON input must be an array or an object containing a records array")
        if any(not isinstance(item, dict) for item in value):
            die("every JSON record must be an object")
        return list(value)

    die("records input must be .csv, .json, .jsonl, or .ndjson")


def normalize_record(source_row: dict[str, Any], row_number: int) -> tuple[dict[str, Any], dict[str, Any]]:
    row = normalized_mapping(source_row)
    normalized: dict[str, str | None] = {field: pick(row, field) for field in ALIASES}
    infer_legacy_type(row, normalized)

    name = normalized["name"]
    strong = [(prefix, field, normalized[field]) for prefix, field in STRONG_ID_FIELDS if normalized[field]]

    if strong:
        prefix, _, value = strong[0]
        source_record_id = f"{prefix}:{value}"
    else:
        basis = canonical_json({"row": row, "row_number": row_number})
        source_record_id = f"missing-strong-id:{sha256_bytes(basis.encode('utf-8'))}"

    emitted: dict[str, Any] = {
        "source_record_id": source_record_id,
        "name": name,
        "knec_code": normalized["knec_code"],
        "nemis_uic": normalized["nemis_uic"],
        "moe_registration_no": normalized["moe_registration_no"],
        "tsc_code": normalized["tsc_code"],
        "region": normalized["region"],
        "county": normalized["county"],
        "sub_county": normalized["sub_county"],
        "school_type": normalized["school_type"],
        "ownership_type": normalized["ownership_type"],
        "accommodation_type": normalized["accommodation_type"],
        "gender_type": normalized["gender_type"],
        "cluster": normalized["cluster"],
        "latitude": normalized["latitude"],
        "longitude": normalized["longitude"],
    }
    emitted = {key: value for key, value in emitted.items() if value is not None}

    record_hash = sha256_bytes(canonical_json(emitted).encode("utf-8"))
    diagnostic = {
        "row_number": row_number,
        "source_record_id": source_record_id,
        "record_sha256": record_hash,
        "has_name": bool(name),
        "strong_identifiers": [field for _, field, _ in strong],
        "certifiable": bool(name and strong),
        "issues": [],
    }
    if not name:
        diagnostic["issues"].append("missing_name")
    if not strong:
        diagnostic["issues"].append("missing_strong_identifier")
    if clean(row.get("type")) and not any(
        normalized[field] == clean(row.get("type"))
        for field in ("school_type", "ownership_type", "accommodation_type", "gender_type")
    ):
        diagnostic["issues"].append("unclassified_legacy_type")

    return emitted, diagnostic


def duplicate_groups(records: Iterable[dict[str, Any]], field: str) -> dict[str, list[int]]:
    groups: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(records, 1):
        value = clean(record.get(field))
        if value is not None:
            groups[value].append(index)
    return {value: rows for value, rows in sorted(groups.items()) if len(rows) > 1}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", required=True, type=Path)
    parser.add_argument("--records", required=True, type=Path)
    parser.add_argument("--source-name", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--source-version", required=True)
    parser.add_argument("--retrieved-at")
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    if not args.artifact.is_file():
        die(f"artifact not found: {args.artifact}")
    if not args.records.is_file():
        die(f"records file not found: {args.records}")
    if not args.source_url.lower().startswith("https://"):
        die("Tier-0 source URL must use https://")

    rows = load_rows(args.records)
    if not rows:
        die("authoritative snapshot extraction is empty")

    prepared, diagnostics = [], []
    for row_number, source_row in enumerate(rows, 1):
        emitted, diagnostic = normalize_record(source_row, row_number)
        prepared.append(emitted)
        diagnostics.append(diagnostic)

    duplicate_report = {
        field: duplicate_groups(prepared, field)
        for field in ("source_record_id", "knec_code", "nemis_uic", "moe_registration_no", "tsc_code")
    }

    issue_counts = Counter(issue for item in diagnostics for issue in item["issues"])
    if duplicate_report["source_record_id"]:
        issue_counts["duplicate_source_record_id"] += len(duplicate_report["source_record_id"])

    retrieved_at = args.retrieved_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    artifact_sha256 = sha256_file(args.artifact)
    package_material = {
        "parser_version": PARSER_VERSION,
        "source_name": args.source_name,
        "source_url": args.source_url,
        "source_version": args.source_version,
        "artifact_sha256": artifact_sha256,
        "records": prepared,
    }
    package_sha256 = sha256_bytes(canonical_json(package_material).encode("utf-8"))

    tier0_safe = (
        not any(not item["certifiable"] for item in diagnostics)
        and not any(duplicate_report[field] for field in duplicate_report)
        and not any("unclassified_legacy_type" in item["issues"] for item in diagnostics)
    )

    manifest = {
        "contract": "vibeschool.p0.authoritative_school_snapshot.v2",
        "parser_version": PARSER_VERSION,
        "source_name": args.source_name,
        "source_url": args.source_url,
        "source_version": args.source_version,
        "retrieved_at": retrieved_at,
        "artifact": {"filename": args.artifact.name, "sha256": artifact_sha256, "bytes": args.artifact.stat().st_size},
        "records": {
            "count": len(prepared),
            "certifiable_count": sum(1 for item in diagnostics if item["certifiable"]),
            "non_certifiable_count": sum(1 for item in diagnostics if not item["certifiable"]),
            "issue_counts": dict(sorted(issue_counts.items())),
            "duplicate_groups": duplicate_report,
        },
        "package_sha256": package_sha256,
        "safety": {
            "offline_only": True,
            "database_credentials_used": False,
            "canonical_promotion_performed": False,
            "tier0_staging_safe": tier0_safe,
        },
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "records.json").write_text(json.dumps(prepared, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (args.output_dir / "diagnostics.json").write_text(json.dumps(diagnostics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "artifact_sha256": artifact_sha256,
        "package_sha256": package_sha256,
        "record_count": len(prepared),
        "certifiable_count": manifest["records"]["certifiable_count"],
        "tier0_staging_safe": tier0_safe,
        "output_dir": str(args.output_dir),
    }, sort_keys=True))
    return 0 if tier0_safe else 2


if __name__ == "__main__":
    sys.exit(main())
