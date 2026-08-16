#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

required_files = [
    'app/pathways/page.tsx',
    'app/pathways/check/page.tsx',
    'app/pathways/continue/page.tsx',
    'app/pathways/schools/page.tsx',
    'lib/pathways/quickCheck.ts',
    'supabase/migrations/20260816150500_pathways_truth_and_acquisition.sql',
    'supabase/migrations/20260816151000_pathways_authoritative_ingestion.sql',
    'supabase/migrations/20260816152000_pathways_quick_check_contract_hardening.sql',
]
for rel in required_files:
    if not (ROOT / rel).exists(): errors.append(f'missing {rel}')

truth = (ROOT / 'supabase/migrations/20260816150500_pathways_truth_and_acquisition.sql').read_text(encoding='utf-8')
for fragment in [
    'references public.schools(id)',
    "verification_state='verified'",
    'pathways_search_public_schools',
    'pathway_profile_decisions',
    'pathway_profile_passports',
]:
    if fragment not in truth: errors.append(f'Pathways truth migration missing: {fragment}')

ingestion = (ROOT / 'supabase/migrations/20260816151000_pathways_authoritative_ingestion.sql').read_text(encoding='utf-8')
for fragment in [
    'hq_stage_pathway_observation',
    'hq_verify_pathway_school_offering',
    'canonical_school_required',
    'verified_pathway_required',
]:
    if fragment not in ingestion: errors.append(f'Pathways ingestion migration missing: {fragment}')

if errors:
    print('PATHWAYS DOMAIN CONTRACT: FAIL')
    for error in errors: print(f' - {error}')
    sys.exit(1)
print('PATHWAYS DOMAIN CONTRACT: PASS')
