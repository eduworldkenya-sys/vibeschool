from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
prereq_path = ROOT / 'supabase/migrations/20260816162500_restore_verified_school_alias_search_prerequisite.sql'
search_path = ROOT / 'supabase/migrations/20260816163000_school_search_helper_privilege_hardening.sql'
prereq = prereq_path.read_text()
search = search_path.read_text()
low = prereq.lower()

assert prereq_path.name < search_path.name, 'verified-alias prerequisite must execute before hardened school search'
for column in ('source_type text', 'confidence numeric', 'verified_at timestamptz'):
    assert column in low, f'missing production alias evidence column prerequisite: {column}'
assert 'create or replace function public.search_verified_school_aliases' in low
assert 'security definer' in low
assert 'set search_path = public, extensions, pg_temp' in low
assert "a.verified or coalesce(a.confidence,0) >= .8" in prereq
assert 'group by a.school_id' in low
assert 'revoke all on function public.search_verified_school_aliases(text) from public, anon' in low
assert 'grant execute on function public.search_verified_school_aliases(text) to authenticated' in low
assert 'select * from public.search_verified_school_aliases(p_query)' in search.lower(), 'school search must retain verified alias matching'
assert 'grant select on table public.school_aliases' not in low, 'helper restoration must not expose raw aliases'

print('verified school alias prerequisite contract: PASS')
