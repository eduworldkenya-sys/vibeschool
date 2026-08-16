#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / 'supabase' / 'migrations'
errors: list[str] = []


def read_single_migration(suffix: str) -> str:
    matches = sorted(MIGRATIONS.glob(f'*_{suffix}.sql'))
    if len(matches) != 1:
        errors.append(f'expected exactly one migration matching *_{suffix}.sql, found {len(matches)}')
        return ''
    return matches[0].read_text(encoding='utf-8')

required_files = [
    'app/pathways/page.tsx',
    'app/pathways/check/page.tsx',
    'app/pathways/continue/page.tsx',
    'app/pathways/schools/page.tsx',
    'lib/pathways/quickCheck.ts',
]
for rel in required_files:
    if not (ROOT / rel).exists():
        errors.append(f'missing {rel}')

truth = read_single_migration('pathways_truth_and_acquisition')
for fragment in [
    'references public.schools(id)',
    "verification_state='verified'",
    'pathways_search_public_schools',
    'pathway_profile_decisions',
    'pathway_profile_passports',
]:
    if fragment not in truth:
        errors.append(f'Pathways truth migration missing: {fragment}')

ingestion = read_single_migration('pathways_authoritative_ingestion')
for fragment in [
    'hq_stage_pathway_observation',
    'hq_verify_pathway_school_offering',
    'canonical_school_required',
    'verified_pathway_required',
]:
    if fragment not in ingestion:
        errors.append(f'Pathways ingestion migration missing: {fragment}')

hardening = read_single_migration('pathways_quick_check_contract_hardening')
for fragment in [
    'idempotency_key_reused_for_different_decision',
    'quick_check_uncertain',
    'selected_score-runner_score<2',
]:
    if fragment not in hardening:
        errors.append(f'Pathways hardening migration missing: {fragment}')

evidence_api = read_single_migration('pathways_public_school_evidence_v2')
for fragment in [
    'pathways_search_public_schools_v2',
    'source_authority text',
    'source_reference text',
    "src.is_public = true",
    "src.status = 'active'",
    'and src.id is not null',
    'revoke all on function public.pathways_search_public_schools_v2',
]:
    if fragment not in evidence_api:
        errors.append(f'Pathways evidence API migration missing: {fragment}')

if errors:
    print('PATHWAYS DOMAIN CONTRACT: FAIL')
    for error in errors:
        print(f' - {error}')
    sys.exit(1)

print('PATHWAYS DOMAIN CONTRACT: PASS')
