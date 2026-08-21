from pathlib import Path

root = Path(__file__).resolve().parents[1]
handler = (root / 'supabase/migrations/20260821165900_finance_shadow_handler_contract.sql').read_text()
main = (root / 'supabase/migrations/20260821170000_finance_worker_r3_certification.sql').read_text()

required = [
    "finance.reconciliation.readonly",
    "autonomy_ceiling",
    "human_financial_authority_required",
    "financial_mutations integer not null default 0 check(financial_mutations=0)",
    "authority_changed boolean not null default false check(authority_changed=false)",
    "hq_workforce_run_finance_r3_canary",
    "hq_workforce_verify_finance_human_authority_boundary",
    "mpesa_runtime_control",
]
for token in required:
    assert token in (handler + main), f'missing Finance R3 invariant: {token}'

for forbidden in [
    "insert into public.hq_workforce_runtime_capability_allowlist",
    "update public.hq_workforce_runtime_capability_allowlist",
    "insert into public.hq_workforce_runtime_policies",
    "update public.hq_workforce_runtime_policies",
    "initiation_enabled=true",
    "autonomy_ceiling,1",
]:
    assert forbidden not in main.lower(), f'forbidden authority change: {forbidden}'

assert "side_effect_class,'read_only'" in main.replace(' ', '').replace('\n','')
assert "'finance.reconciliation.readonly'::text" in handler
print('Finance Worker R3 certification contract: PASS')
