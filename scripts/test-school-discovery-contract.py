from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "app/teacher/onboarding/school/page.tsx").read_text()

migrations = sorted((ROOT / "supabase/migrations").glob("20260813*_school_*.sql"))
combined = "\n".join(p.read_text() for p in migrations)

required_page_markers = [
    'search_school_directory',
    'submit_teacher_school_claim',
    'submit_school_discovery_request',
    'My school is new or missing',
    'There are schools with the same name.',
]
for marker in required_page_markers:
    assert marker in page, f"missing onboarding contract marker: {marker}"

required_db_markers = [
    'search_school_directory',
    'connect_teacher_to_directory_school',
    'hq_list_school_identity_queue',
    'hq_review_school_identity_candidate',
    'hq_resolve_school_discovery_request',
    'school_identity_candidates_one_active_directory_idx',
    "p_level is null or p_level=any(s.levels)",
    'school_identity_review_required',
    'canonical_school_ambiguous',
]
for marker in required_db_markers:
    assert marker in combined, f"missing database contract marker: {marker}"

assert 'SECURITY INVOKER' in combined.upper() or 'security invoker' in combined.lower(), 'school search must remain SECURITY INVOKER'
assert 'grant execute on function public.search_school_directory' in combined.lower(), 'school search grant must be explicit'
assert 'from public,anon' in combined.lower(), 'public/anon execute must be revoked from sensitive functions'

print('school discovery contract: PASS')
