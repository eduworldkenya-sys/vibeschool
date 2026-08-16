from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sql = (ROOT / 'supabase/migrations/20260816164000_school_identity_coverage_runtime_fix.sql').read_text()
low = sql.lower()

assert 'hq_school_identity_coverage_by_county' in low
assert 'owner_authorization_required' in low
assert 'county_key' in low
assert 'using (county)' not in low, 'coverage runtime must never use ambiguous USING(county) in PL/pgSQL'
assert 'select county from' not in low, 'unqualified county projection can bind to RETURNS TABLE output variable'
assert 'ck.county_key::text as county' in low
assert 'd.county_key = ck.county_key' in low
assert 'k.county_key = ck.county_key' in low
assert 'a.county_key = ck.county_key' in low
assert "raw_record->>'region'" not in low, 'region must not substitute for missing county'
assert "'unknown'" in low, 'missing county must remain UNKNOWN'
assert 'security definer' in low and 'set search_path = public, extensions, pg_temp' in low
assert 'insert into' not in low and 'update public.' not in low and 'delete from' not in low, 'coverage projection must remain read-only'

print('school coverage runtime contract: PASS')
