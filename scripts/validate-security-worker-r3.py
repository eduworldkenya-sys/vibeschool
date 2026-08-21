from pathlib import Path

root = Path(__file__).resolve().parents[1]
handler = (root / 'supabase/migrations/20260821171050_security_shadow_handler_contract.sql').read_text()
main = (root / 'supabase/migrations/20260821171100_security_worker_r3_certification.sql').read_text()
repair = (root / 'supabase/migrations/20260821171200_security_worker_r3_permission_semantics.sql').read_text()
combined = handler + main + repair

required = [
    'security.assurance.readonly',
    'autonomy_ceiling',
    'human_security_authority_required',
    'security_mutations integer not null default 0 check(security_mutations=0)',
    'authority_changed boolean not null default false check(authority_changed=false)',
    'hq_workforce_run_security_r3_canary',
    'hq_workforce_verify_security_human_authority_boundary',
    'block_release_recommendation',
    "permission not in ('read_security_metadata','record_finding','block_release_recommendation','request_approval')",
    'release_recommendation_is_advisory',
]
for token in required:
    assert token in combined, f'missing Security R3 invariant: {token}'

lower = combined.lower()
for forbidden in [
    'insert into public.hq_workforce_runtime_capability_allowlist',
    'update public.hq_workforce_runtime_capability_allowlist',
    'insert into public.hq_workforce_runtime_policies',
    'update public.hq_workforce_runtime_policies',
    'insert into public.hq_workforce_capability_authority_grants',
    'update public.hq_workforce_capability_authority_grants',
    'shadow_global_stop=false',
    'runtime_execution_enabled=true',
]:
    assert forbidden not in lower, f'forbidden Security authority change: {forbidden}'

assert "'security_metadata_snapshot','read_only','approved'" in main
assert "3,0,'certified'" in main.replace(' ', '').replace('\n', '')
print('Security Worker R3 certification contract: PASS')
