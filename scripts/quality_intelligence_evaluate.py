#!/usr/bin/env python3
"""Deterministic Quality Intelligence evaluator.

This module is deliberately separate from Content Worker runtime code. It scores
sealed observations against a versioned rubric and can calibrate itself against
known gold cases. It does not publish, repair, approve, or invoke a worker.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RUBRIC = ROOT / "quality-intelligence/rubrics/teacher-guide-v1.json"
DEFAULT_GOLD = ROOT / "quality-intelligence/fixtures/teacher-guide-gold-v1.json"


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def canonical_sha256(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def validate_rubric(rubric: dict[str, Any]) -> None:
    dimensions = rubric.get("dimensions", [])
    if not dimensions:
        raise ValueError("rubric has no dimensions")
    keys = [d["key"] for d in dimensions]
    if len(keys) != len(set(keys)):
        raise ValueError("rubric contains duplicate dimension keys")
    if sum(int(d["weight"]) for d in dimensions) != 100:
        raise ValueError("rubric dimension weights must sum to 100")
    if rubric.get("independence", {}).get("content_worker_self_score_is_authoritative") is not False:
        raise ValueError("independence contract must reject worker self-score authority")


def evaluate(scores: dict[str, Any], blockers: list[str], rubric: dict[str, Any]) -> dict[str, Any]:
    validate_rubric(rubric)
    dimensions = rubric["dimensions"]
    hard_blockers = set(rubric["hard_blockers"])
    unknown_blockers = sorted(set(blockers) - hard_blockers)
    if unknown_blockers:
        raise ValueError(f"unknown blocker(s): {', '.join(unknown_blockers)}")

    normalized: dict[str, int] = {}
    failed_minima: list[str] = []
    weighted = 0.0
    for dimension in dimensions:
        key = dimension["key"]
        if key not in scores:
            raise ValueError(f"missing dimension score: {key}")
        score = int(scores[key])
        if score < 0 or score > 5:
            raise ValueError(f"dimension score out of range 0..5: {key}={score}")
        normalized[key] = score
        weighted += (score / 5.0) * int(dimension["weight"])
        if score < int(dimension["minimum_certified_score"]):
            failed_minima.append(key)

    unexpected_scores = sorted(set(scores) - set(normalized))
    if unexpected_scores:
        raise ValueError(f"unknown dimension score(s): {', '.join(unexpected_scores)}")

    overall_score = round(weighted, 2)
    threshold = float(rubric["score_scale"]["certification_threshold"])
    if blockers:
        disposition = "block"
    elif failed_minima or overall_score < threshold:
        disposition = "reject"
    else:
        disposition = "certify"

    return {
        "disposition": disposition,
        "overall_score": overall_score,
        "failed_dimension_minima": failed_minima,
        "hard_blockers": blockers,
        "dimension_scores": normalized,
        "rubric_key": rubric["rubric_key"],
        "rubric_version": rubric["version"],
        "rubric_sha256": canonical_sha256(rubric),
    }


def calibrate(rubric: dict[str, Any], suite: dict[str, Any]) -> dict[str, Any]:
    cases = suite.get("cases", [])
    if not cases:
        raise ValueError("gold suite has no cases")
    results = []
    confusion = {"expected_positive": 0, "expected_negative": 0, "false_positive": 0, "false_negative": 0}
    for case in cases:
        result = evaluate(case["scores"], case.get("blockers", []), rubric)
        expected = case["expected_disposition"]
        passed = result["disposition"] == expected
        expected_positive = expected == "certify"
        actual_positive = result["disposition"] == "certify"
        confusion["expected_positive" if expected_positive else "expected_negative"] += 1
        if actual_positive and not expected_positive:
            confusion["false_positive"] += 1
        if expected_positive and not actual_positive:
            confusion["false_negative"] += 1
        results.append({"case_key": case["case_key"], "expected": expected, "actual": result["disposition"], "passed": passed, "score": result["overall_score"]})

    passed_count = sum(1 for r in results if r["passed"])
    return {
        "suite_key": suite["suite_key"],
        "suite_version": suite["version"],
        "suite_sha256": canonical_sha256(suite),
        "rubric_sha256": canonical_sha256(rubric),
        "cases": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count,
        "accuracy": round(passed_count / len(results), 4),
        "false_positive_rate": round(confusion["false_positive"] / max(confusion["expected_negative"], 1), 4),
        "false_negative_rate": round(confusion["false_negative"] / max(confusion["expected_positive"], 1), 4),
        "results": results,
    }


def compare(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    if before.get("rubric_sha256") != after.get("rubric_sha256"):
        raise ValueError("cannot compare evaluations produced by different rubric versions")
    before_scores = before["dimension_scores"]
    after_scores = after["dimension_scores"]
    deltas = {key: after_scores[key] - before_scores[key] for key in before_scores}
    regressions = sorted(key for key, delta in deltas.items() if delta < 0)
    return {
        "overall_delta": round(float(after["overall_score"]) - float(before["overall_score"]), 2),
        "dimension_deltas": deltas,
        "regressed_dimensions": regressions,
        "regression_free": not regressions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rubric", type=Path, default=DEFAULT_RUBRIC)
    parser.add_argument("--calibrate", action="store_true")
    parser.add_argument("--gold", type=Path, default=DEFAULT_GOLD)
    parser.add_argument("--input", type=Path, help="JSON object containing scores and blockers")
    args = parser.parse_args()

    rubric = load_json(args.rubric)
    if args.calibrate:
        report = calibrate(rubric, load_json(args.gold))
    elif args.input:
        payload = load_json(args.input)
        report = evaluate(payload["scores"], payload.get("blockers", []), rubric)
    else:
        parser.error("use --calibrate or --input")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report.get("failed", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
