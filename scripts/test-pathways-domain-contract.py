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
    'app/student/pathways/page.tsx',
    'app/parent/pathways/page.tsx',
    'app/teacher/pathways/page.tsx',
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

canonical = read_single_migration('pathways_canonical_learner_authority')
for fragment in [
    'create table if not exists public.student_pathway_decisions',
    'references public.students(id)',
    "if caller_role<>'student' then raise exception 'canonical_student_role_required'",
    'canonical_student_identity_not_found',
    'create table if not exists public.parent_pathway_drafts',
    'Adult-owned planning draft; not a learner Pathway Passport.',
    'where l.parent_id=auth.uid()',
    'where tc.teacher_id=auth.uid()',
    'from public.school_directory_public d',
    'revoke all on function public.pathways_save_my_quick_check',
]:
    if fragment not in canonical:
        errors.append(f'Canonical learner-authority migration missing: {fragment}')

continuation = (ROOT / 'app/pathways/continue/page.tsx').read_text(encoding='utf-8')
for fragment in [
    "role === 'student'",
    "role === 'parent'",
    '/login/student?redirect=/pathways/continue',
    '/signup/parent?redirect=/pathways/continue',
    'Pathways does not manufacture a child identity',
]:
    if fragment not in continuation:
        errors.append(f'Pathways continuation missing: {fragment}')
for forbidden in [
    "role === 'global_user' &&",
    'href="/global/signup"',
]:
    if forbidden in continuation:
        errors.append(f'Pathways continuation contains forbidden authority path: {forbidden}')

parent_ui = (ROOT / 'app/parent/pathways/page.tsx').read_text(encoding='utf-8')
teacher_ui = (ROOT / 'app/teacher/pathways/page.tsx').read_text(encoding='utf-8')
if 'pathways_save_my_quick_check' in parent_ui or 'pathways_save_my_quick_check' in teacher_ui:
    errors.append('parent/teacher support must not mutate learner Passport')

if errors:
    print('PATHWAYS DOMAIN CONTRACT: FAIL')
    for error in errors:
        print(f' - {error}')
    sys.exit(1)

print('PATHWAYS DOMAIN CONTRACT: PASS')
