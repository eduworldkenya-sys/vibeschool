from pathlib import Path

root = Path(__file__).resolve().parents[1]
handler = (root / 'supabase/migrations/20260821165900_finance_shadow_handler_contract.sql').read_text()
main = (root / 'supabase/migrations/20260821170000_finance_worker_r3_certification.sql').read_text()
combined = handler + main

required = [
    "finance.reconciliation.readonly",
    "autonomy_ceiling",
    "human_financial_authority_required",
    "financial_mutations integer not null default 0 check(financial_mutations=0)",
    "authority_changed boolean not null default false check(authority_changed=false)",
    "hq_workforce_run_finance_r3_canary",
    "hq_workforce_verify_finance_human_authority_boundary",
    "mpesa_runtime_control",
    "'finance_aggregate_snapshot','read_only','approved'",
]
for token in required:
    assert token in combined, f'missing Finance R3 invariant: {token}'

lower = main.lower()
for forbidden in [
    "insert into public.hq_workforce_runtime_capability_allowlist",
    "update public.hq_workforce_runtime_capability_allowlist",
    "insert into public.hq_workforce_runtime_policies",
    "update public.hq_workforce_runtime_policies",
    "initiation_enabled=true",
]:
    assert forbidden not in lower, f'forbidden authority change: {forbidden}'

assert "'finance.reconciliation.readonly'::text" in handler
assert "3,0,'certified'" in main.replace(' ', '').replace('\n', '')
print('Finance Worker R3 certification contract: PASS')
