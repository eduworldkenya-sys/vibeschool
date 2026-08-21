from pathlib import Path

root = Path(__file__).resolve().parents[1]
sql = (root / 'supabase/migrations/20260821172000_publishing_platform_r2_qualification.sql').read_text()

required = [
    'publishing.release_readiness.readonly',
    'platform.reliability.readonly',
    'publishing.release_readiness',
    'platform.reliability',
    'autonomy_ceiling',
    'consequential_mutations integer not null default 0 check(consequential_mutations=0)',
    'authority_changed boolean not null default false check(authority_changed=false)',
    'hq_workforce_run_r2_specialist_canary',
    'hq_workforce_verify_r2_specialist_baseline',
    'publication_authority',
    'deployment_authority',
]
for token in required:
    assert token in sql, f'missing R2 specialist invariant: {token}'

lower = sql.lower()
for forbidden in [
    'insert into public.hq_workforce_runtime_capability_allowlist',
    'update public.hq_workforce_runtime_capability_allowlist',
    'insert into public.hq_workforce_runtime_policies',
    'update public.hq_workforce_runtime_policies',
    'insert into public.hq_workforce_capability_authority_grants',
    'update public.hq_workforce_capability_authority_grants',
    'runtime_execution_enabled=true',
    'shadow_global_stop=false',
]:
    assert forbidden not in lower, f'forbidden authority change: {forbidden}'

assert sql.count("2,0,'certified'") >= 2
print('Publishing + Platform R2 certification contract: PASS')
