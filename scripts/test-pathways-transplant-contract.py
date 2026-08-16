from pathlib import Path

root = Path(__file__).resolve().parents[1]

def text(path: str) -> str:
    return (root / path).read_text(encoding='utf-8')

migration = text('supabase/migrations/20260816150000_pathways_truth_and_acquisition.sql')
continuation = text('lib/auth/continuation.ts')
callback = text('app/auth/callback/route.ts')
login = text('app/login/[role]/page.tsx')
quick = text('app/pathways/check/page.tsx')
continue_page = text('app/pathways/continue/page.tsx')
schools = text('app/pathways/schools/page.tsx')

checks = {
    'pathways never creates canonical schools': 'create table if not exists public.schools' not in migration.lower(),
    'pathways never creates canonical subjects': 'create table if not exists public.subjects' not in migration.lower(),
    'school offerings reference canonical school ids': 'school_id uuid not null references public.schools(id)' in migration,
    'subject claims resolve into existing subject identity': 'resolved_subject_id uuid references public.subjects(id)' in migration,
    'truth has provenance observations': 'public.pathway_source_observations' in migration,
    'truth distinguishes verified uncertainty states': "('verified','unverified','disputed','stale','retired')" in migration,
    'anonymous school API is bounded': 'limit greatest(1,least(coalesce(p_limit,30),50))' in migration,
    'public school API revokes default PUBLIC execute': 'revoke all on function public.pathways_search_public_schools' in migration,
    'save RPC denies anon': 'revoke all on function public.pathways_save_my_quick_check' in migration and 'from public, anon' in migration,
    'save RPC accepts learner roles only': "caller_role not in ('student','global_user')" in migration,
    'continuation has a public allowlist': "PUBLIC_CONTINUATION_PREFIXES = ['/pathways']" in continuation,
    'continuation is role bounded': 'continuationForRole' in callback and 'continuationForRole' in login,
    'oauth resolves actual database role': "supabase.rpc('get_my_role')" in callback,
    'quick check is free before auth': 'No login required' in quick,
    'quick check can continue explicitly': 'href="/pathways/continue"' in quick,
    'parent teacher admin cannot silently save learner decision': "role !== 'student' && role !== 'global_user'" in continue_page,
    'school UI states absent verification as uncertainty': 'not yet verified' in schools and 'not “the school definitely does not offer it”' in schools,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ' - ' + name)

if failed:
    raise SystemExit('Pathways contract failed: ' + '; '.join(failed))
