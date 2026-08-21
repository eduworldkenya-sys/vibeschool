#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sql = (root / 'supabase/migrations/20260821152500_worker_fleet_professional_shadow_integrity.sql').read_text()

required = [
    'hq_workforce_professional_shadow_runs',
    'hq_workforce_run_professional_shadow',
    'professional_server_shadow_v1',
    'worker_not_competent_for_shadow_tool',
    'shadow_semantic_material_not_found',
    'side_effects_applied boolean not null default false',
    "p_verifier_key ilike '%creator%'",
    "'authority_changed',false",
    "evidence_kind='shadow'",
    "worker_version=a.worker_version",
]
for item in required:
    assert item in sql, item

for forbidden in [
    'insert into public.hq_workforce_capability_grants',
    'insert into public.hq_workforce_identities',
    'insert into public.hq_workforce_execution_budgets',
    'factory_enabled=true',
    'heartbeat_enabled=true',
    "runtime_execution_enabled=true",
    "runtime_autonomy_level=",
    "status='active'",
]:
    assert forbidden not in sql, forbidden

assert "grant select,insert on table public.hq_workforce_professional_shadow_runs to service_role" in sql
assert "revoke all on table public.hq_workforce_professional_shadow_runs from public,anon,authenticated,service_role" in sql
print('Mission 416 professional shadow integrity regression: PASS')
