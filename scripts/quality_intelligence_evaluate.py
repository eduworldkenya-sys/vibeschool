#!/usr/bin/env python3
"""Independent deterministic Quality Intelligence evaluator and evidence verifier."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RUBRIC = ROOT / 'quality-intelligence/rubrics/teacher-guide-v1.json'
GOLD = ROOT / 'quality-intelligence/fixtures/teacher-guide-gold-v1.json'
BASELINE = ROOT / 'quality-intelligence/baselines/pre-priority1-production-authoring-20260821.json'
LEDGER = ROOT / 'quality-intelligence/evidence/evaluation-runs.jsonl'


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def text_sha(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def validate_rubric(rubric: dict[str, Any]) -> None:
    dimensions = rubric.get('dimensions', [])
    keys = [d['key'] for d in dimensions]
    if not dimensions or len(keys) != len(set(keys)):
        raise ValueError('invalid dimensions')
    if sum(int(d['weight']) for d in dimensions) != 100:
        raise ValueError('weights must sum to 100')
    independence = rubric.get('independence', {})
    if independence.get('content_worker_may_modify') is not False:
        raise ValueError('content worker may not modify evaluator rubric')
    if independence.get('content_worker_self_score_is_authoritative') is not False:
        raise ValueError('worker self-score may not be authoritative')
    if independence.get('certification_requires_independent_evaluation') is not True:
        raise ValueError('independent evaluation must be required')


def evaluate(scores: dict[str, Any], blockers: list[str], rubric: dict[str, Any]) -> dict[str, Any]:
    validate_rubric(rubric)
    hard = set(rubric['hard_blockers'])
    unknown_blockers = sorted(set(blockers) - hard)
    if unknown_blockers:
        raise ValueError('unknown blockers: ' + ','.join(unknown_blockers))
    total = 0.0
    minima: list[str] = []
    normalized: dict[str, int] = {}
    for dimension in rubric['dimensions']:
        key = dimension['key']
        if key not in scores:
            raise ValueError('missing score: ' + key)
        value = int(scores[key])
        if not 0 <= value <= 5:
            raise ValueError('score out of range: ' + key)
        normalized[key] = value
        total += (value / 5) * int(dimension['weight'])
        if value < int(dimension['minimum_certified_score']):
            minima.append(key)
    extra = sorted(set(scores) - set(normalized))
    if extra:
        raise ValueError('unknown scores: ' + ','.join(extra))
    overall = round(total, 2)
    threshold = float(rubric['score_scale']['certification_threshold'])
    disposition = 'block' if blockers else ('reject' if minima or overall < threshold else 'certify')
    return {
        'disposition': disposition,
        'overall_score': overall,
        'failed_dimension_minima': minima,
        'hard_blockers': blockers,
        'dimension_scores': normalized,
        'rubric_key': rubric['rubric_key'],
        'rubric_version': rubric['version'],
        'rubric_sha256': canonical_sha(rubric),
    }


def calibrate(rubric: dict[str, Any], suite: dict[str, Any]) -> dict[str, Any]:
    cases = suite.get('cases', [])
    if not cases:
        raise ValueError('no gold cases')
    rows: list[dict[str, Any]] = []
    false_positive = false_negative = positive = negative = 0
    for case in cases:
        result = evaluate(case['scores'], case.get('blockers', []), rubric)
        expected = case['expected_disposition']
        actual = result['disposition']
        passed = actual == expected
        if expected == 'certify':
            positive += 1
            false_negative += int(actual != 'certify')
        else:
            negative += 1
            false_positive += int(actual == 'certify')
        rows.append({'case_key': case['case_key'], 'expected': expected, 'actual': actual, 'passed': passed, 'score': result['overall_score']})
    passed_count = sum(int(row['passed']) for row in rows)
    return {
        'suite_key': suite['suite_key'],
        'suite_version': suite['version'],
        'suite_sha256': canonical_sha(suite),
        'rubric_sha256': canonical_sha(rubric),
        'cases': len(rows),
        'passed': passed_count,
        'failed': len(rows) - passed_count,
        'accuracy': round(passed_count / len(rows), 4),
        'false_positive_rate': round(false_positive / max(negative, 1), 4),
        'false_negative_rate': round(false_negative / max(positive, 1), 4),
        'results': rows,
    }


def compare(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    if before.get('rubric_sha256') != after.get('rubric_sha256'):
        raise ValueError('rubric mismatch')
    if before.get('evidence_packet_sha256') and after.get('evidence_packet_sha256') and before['evidence_packet_sha256'] != after['evidence_packet_sha256']:
        raise ValueError('evidence packet mismatch')
    deltas = {key: after['dimension_scores'][key] - value for key, value in before['dimension_scores'].items()}
    regressions = sorted(key for key, value in deltas.items() if value < 0)
    return {
        'overall_delta': round(float(after['overall_score']) - float(before['overall_score']), 2),
        'dimension_deltas': deltas,
        'regressed_dimensions': regressions,
        'regression_free': not regressions,
    }


def verify_baseline(path: Path) -> dict[str, Any]:
    baseline = load(path)
    artifacts = baseline.get('artifacts', [])
    if not artifacts:
        raise ValueError('baseline has no artifacts')
    ids: set[str] = set()
    verified = 0
    for artifact in artifacts:
        artifact_id = artifact['id']
        if artifact_id in ids:
            raise ValueError('duplicate baseline artifact id: ' + artifact_id)
        ids.add(artifact_id)
        if text_sha(artifact['draft_content']) != artifact['captured_content_sha256']:
            raise ValueError('baseline content hash mismatch: ' + artifact_id)
        for key in ('task_id', 'proposal_id', 'evidence_packet_sha256', 'structured_output_sha256', 'current_content_sha256'):
            if not artifact.get(key):
                raise ValueError(f'baseline lineage missing {key}: {artifact_id}')
        verified += 1
    return {'baseline_key': baseline['baseline_key'], 'version': baseline['version'], 'artifacts': len(artifacts), 'verified': verified, 'baseline_sha256': canonical_sha(baseline)}


def verify_ledger(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ValueError('evaluation ledger missing')
    seen: set[str] = set()
    previous_chain = 'GENESIS'
    count = 0
    for line_number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        run_id = row.get('run_id')
        if not run_id or run_id in seen:
            raise ValueError(f'invalid or duplicate run_id at line {line_number}')
        if row.get('previous_chain_sha256') != previous_chain:
            raise ValueError(f'ledger chain mismatch at line {line_number}')
        payload = dict(row)
        claimed = payload.pop('chain_sha256', None)
        calculated = canonical_sha(payload)
        if claimed != calculated:
            raise ValueError(f'ledger entry hash mismatch at line {line_number}')
        previous_chain = claimed
        seen.add(run_id)
        count += 1
    if count == 0:
        raise ValueError('evaluation ledger empty')
    return {'entries': count, 'tail_chain_sha256': previous_chain}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--rubric', type=Path, default=RUBRIC)
    parser.add_argument('--gold', type=Path, default=GOLD)
    parser.add_argument('--calibrate', action='store_true')
    parser.add_argument('--input', type=Path)
    parser.add_argument('--compare-before', type=Path)
    parser.add_argument('--compare-after', type=Path)
    parser.add_argument('--verify-baseline', type=Path, nargs='?', const=BASELINE)
    parser.add_argument('--verify-ledger', type=Path, nargs='?', const=LEDGER)
    args = parser.parse_args()
    rubric = load(args.rubric)
    if args.calibrate:
        report = calibrate(rubric, load(args.gold))
        exit_code = 1 if report['failed'] else 0
    elif args.input:
        payload = load(args.input)
        report = evaluate(payload['scores'], payload.get('blockers', []), rubric)
        exit_code = 0
    elif args.compare_before and args.compare_after:
        report = compare(load(args.compare_before), load(args.compare_after))
        exit_code = 1 if not report['regression_free'] else 0
    elif args.verify_baseline:
        report = verify_baseline(args.verify_baseline)
        exit_code = 0
    elif args.verify_ledger:
        report = verify_ledger(args.verify_ledger)
        exit_code = 0
    else:
        parser.error('choose --calibrate, --input, --compare-before/--compare-after, --verify-baseline or --verify-ledger')
    print(json.dumps(report, indent=2, sort_keys=True))
    return exit_code


if __name__ == '__main__':
    raise SystemExit(main())
