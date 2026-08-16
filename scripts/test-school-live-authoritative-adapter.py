from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sql = (ROOT / 'supabase/migrations/20260816162000_school_live_authoritative_observation_adapter.sql').read_text()

required = [
    'hq_ingest_live_authoritative_school_observation',
    'owner_authorization_required',
    'authority_tier = 0',
    'canonical_use = true',
    "verification_mode = 'authoritative'",
    'real_time_verification = true',
    'live_observation_too_stale',
    'tier0_source_record_id_required',
    'hq_stage_school_directory_batch',
    'hq_seal_authoritative_school_snapshot',
    'hq_reconcile_authoritative_school_snapshot',
    "'mode','live_authoritative_observation'",
]
for marker in required:
    assert marker in sql, f'missing live-authority contract marker: {marker}'

assert 'hq_promote_authoritative_school_record' not in sql, 'live adapter must not auto-promote canonical school identity'
assert 'insert into public.schools' not in sql.lower(), 'live adapter must not become a parallel canonical mutation gateway'
assert 'insert into public.school_directory_source_observations' not in sql.lower(), 'live adapter must delegate observation writes to canonical staging gateway'
assert "interval '30 days'" in sql, 'real-time evidence must be freshness bounded'
assert 'digest(' in sql and "'sha256'" in sql, 'live observation snapshot must be content hashed'
assert 'official_observed_at' in sql and 'official_source_url' in sql, 'raw evidence must retain source URL and observation time'
assert 'revoke all on function public.hq_ingest_live_authoritative_school_observation' in sql.lower(), 'public/anon invocation must be revoked'

print('school live authoritative observation adapter: PASS')
