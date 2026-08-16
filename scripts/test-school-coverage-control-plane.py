from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sql = (ROOT / 'supabase/migrations/20260816161000_school_identity_coverage_control_plane.sql').read_text()

required = [
    'hq_school_identity_coverage_by_county',
    'owner_authorization_required',
    'public.schools_directory',
    'public.school_directory_source_observations',
    'public.school_authoritative_reconciliation',
    'sr.authority_tier = 0',
    'sr.canonical_use',
    "r.classification = 'matched'",
    "r.classification = 'new_candidate'",
    "r.classification = 'review'",
    'canonical_to_discovery_ratio',
    'authoritative_resolution_ratio',
]
for marker in required:
    assert marker in sql, f'missing coverage contract marker: {marker}'

assert 'security definer' in sql.lower(), 'coverage projection must own a bounded server-side read boundary'
assert 'revoke all on function public.hq_school_identity_coverage_by_county() from public, anon' in sql.lower(), 'public/anon execution must remain revoked'
assert 'grant execute on function public.hq_school_identity_coverage_by_county() to authenticated' in sql.lower(), 'authenticated surface must still self-authorize owner-only'
assert 'Directory ratios are diagnostics only' in sql, 'coverage semantics must explicitly reject directory-as-authority'
assert 'authoritative' in sql.lower(), 'Tier-0 evidence must be a first-class coverage dimension'
assert "raw_record->>'region'" not in sql, 'region must never be silently substituted for county'
assert "coalesce(upper(nullif(trim(o.raw_record->>'county'),'')), 'UNKNOWN')" in sql, 'missing authoritative county must fail closed to UNKNOWN'
assert 'Missing county stays UNKNOWN' in sql, 'operator-facing semantics must document administrative fail-closed behavior'

print('school identity coverage control plane: PASS')
