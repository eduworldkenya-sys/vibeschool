#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def read(path: str) -> str:
    p = ROOT / path
    return p.read_text(encoding='utf-8') if p.exists() else ''

# Canonical auth may know nothing about Pathways. A future convenience change must
# not turn Pathways back into callback/session/role authority.
auth_files = [
    'app/auth/callback/route.ts',
    'app/login/[role]/page.tsx',
    'app/global/signup/page.tsx',
    'app/signup/student/page.tsx',
    'app/signup/parent/page.tsx',
]
for path in auth_files:
    text = read(path).lower()
    if 'pathways' in text or 'lib/pathways' in text:
        errors.append(f'{path}: canonical auth must not import or special-case Pathways')

# Pathways UI can consume session/access state, but it cannot create identity,
# claim roles, exchange OAuth codes, or resolve onboarding authority itself.
for p in (ROOT / 'app/pathways').rglob('*') if (ROOT / 'app/pathways').exists() else []:
    if not p.is_file() or p.suffix not in {'.ts', '.tsx'}:
        continue
    text = p.read_text(encoding='utf-8')
    forbidden = {
        'exchangeCodeForSession': 'OAuth callback authority',
        'signInWithOAuth': 'OAuth initiation authority',
        'signUp(': 'account creation authority',
        "claim_my_initial_role": 'role assignment authority',
        "get_my_onboarding_state": 'onboarding routing authority',
        ".from('profiles').update": 'profile authority mutation',
        '.from("profiles").update': 'profile authority mutation',
    }
    for needle, reason in forbidden.items():
        if needle in text:
            errors.append(f'{p.relative_to(ROOT)}: forbidden {reason} ({needle})')

# Pathways migrations may create Pathways-owned objects only; they cannot replace
# auth/identity/onboarding functions or mutate authoritative profile role columns.
for p in (ROOT / 'supabase/migrations').glob('*pathways*.sql'):
    text = p.read_text(encoding='utf-8').lower()
    forbidden_sql = [
        'create or replace function public.get_my_auth_access_state',
        'create or replace function public.get_my_onboarding_state',
        'create or replace function public.claim_my_initial_role',
        'alter table public.profiles',
        'update public.profiles set role',
        'insert into public.profiles',
    ]
    for needle in forbidden_sql:
        if needle in text:
            errors.append(f'{p.relative_to(ROOT)}: Pathways migration crosses auth/identity authority ({needle})')

quick = read('lib/pathways/quickCheck.ts')
for required in ["status: 'uncertain'", "reason: 'no_evidence'", "reason: 'tie'", 'QUICK_CHECK_MIN_MARGIN']:
    if required not in quick:
        errors.append(f'lib/pathways/quickCheck.ts: missing explicit uncertainty contract: {required}')

hardening = read('supabase/migrations/20260816152000_pathways_quick_check_contract_hardening.sql')
for required in ['idempotency_key_reused_for_different_decision', 'quick_check_uncertain', 'selected_score-runner_score<2']:
    if required not in hardening:
        errors.append(f'Pathways hardening migration missing invariant: {required}')

if errors:
    print('PATHWAYS AUTH BOUNDARY: FAIL')
    for error in errors:
        print(f' - {error}')
    sys.exit(1)

print('PATHWAYS AUTH BOUNDARY: PASS')
print('Pathways consumes canonical auth; it does not own callback, identity, roles, or onboarding.')
