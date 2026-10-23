from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sql = (ROOT / 'supabase/migrations/20260816163000_school_search_helper_privilege_hardening.sql').read_text()
low = sql.lower()

for table in ('school_levels','school_aliases','school_directory_sources'):
    assert f'revoke all on table public.{table} from anon, authenticated' in low, f'{table} client privileges must be revoked'

assert 'create or replace function public.search_school_directory' in low
assert 'security definer' in low, 'bounded search must own helper reads server-side'
assert 'set search_path = public, extensions, pg_temp' in low, 'definer search path must be pinned'
assert 'left join public.school_levels' in low, 'canonical level search must remain intact'
assert 'public.search_verified_school_aliases' in low, 'verified alias matching must remain intact'
assert 'from public.schools_directory' in low, 'teacher onboarding discovery universe must remain available through RPC'
assert "s.status='active'" in low, 'canonical results must remain active-only'
assert "c.status in ('matched','new')" in low, 'directory candidates already resolved must remain suppressed'
assert 'revoke all on function public.search_school_directory' in low and 'from public, anon' in low
assert 'grant execute on function public.search_school_directory' in low and 'to authenticated' in low
assert 'insert into public.schools' not in low, 'search RPC must remain read-only'
assert 'update public.schools' not in low, 'search RPC must remain read-only'

typo_sql = (ROOT / 'supabase/migrations/20261023090000_school_search_typo_tolerance.sql').read_text().lower()
assert 'public.search_school_directory' in typo_sql
assert 'public.success_wishes_school_search_public_v1' in typo_sql
assert 'create extension if not exists fuzzystrmatch with schema extensions' in typo_sql
assert 'set pg_trgm.' not in typo_sql, 'search RPCs must not set unavailable extension GUCs'
assert 'not exact_search.has_exact' in typo_sql, 'shared fuzzy matches must be fallback-only'
assert 'not exists(select 1 from exact_matches)' in typo_sql, 'public fuzzy matches must be fallback-only'
assert 'operator(extensions.<%)' not in typo_sql, 'do not depend on privileged pg_trgm thresholds'
assert 'regexp_split_to_table' in typo_sql, 'validate close spelling per meaningful school-name token'
assert 'levenshtein_less_equal' in typo_sql, 'confirm close spellings with a one-edit word check'
assert 'length(q.raw)<=80' in typo_sql, 'bound edit-distance work'
assert 'security definer' in typo_sql and 'security invoker' in typo_sql, 'preserve each RPC security model'
assert 'from public, anon' in typo_sql and 'to authenticated' in typo_sql, 'preserve authenticated-only shared search'
assert 'to anon, authenticated' in typo_sql, 'preserve the safe public Success Wishes RPC'
assert 'insert into public.schools' not in typo_sql and 'update public.schools' not in typo_sql

print('school search helper privilege and typo-tolerance contract: PASS')
