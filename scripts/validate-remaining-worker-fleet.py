#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sql = (root / "supabase/migrations/20260821204500_remaining_worker_fleet_qualification.sql").read_text()

workers = ["ops-worker-01", "support-worker-01", "curriculum-worker-01", "growth-worker-01", "hr-worker-01", "school-success-worker-01"]
handlers = ["operations.queue.readonly", "support.case_health.readonly", "curriculum.coverage.readonly", "growth.metrics.readonly", "workforce.capability_gaps.readonly", "school.success.readonly"]
for item in workers + handlers + [
    "hq_workforce_assess_remaining_specialist",
    "hq_workforce_verify_remaining_baseline",
    "hq_workforce_run_operations_r2_canary",
    "consequential_mutations integer not null default 0 check(consequential_mutations=0)",
    "authority_changed boolean not null default false check(authority_changed=false)",
    "side_effects_applied',false",
    "independent_verifier_required",
    "remaining-fleet-reverification-v1",
]:
    assert item in sql, item

for forbidden in [
    "insert into public.hq_workforce_capability_grants",
    "insert into public.hq_workforce_runtime_capability_allowlist",
    "insert into public.hq_workforce_runtime_policies",
    "runtime_execution_enabled=true",
    "shadow_global_stop=false",
    "max_autonomy_level=",
    "status='active'",
]:
    assert forbidden not in sql, forbidden

assert "revoke all on table public.hq_workforce_operations_r2_canary_runs from public,anon,authenticated,service_role" in sql
assert "grant select,insert on table public.hq_workforce_operations_r2_canary_runs to service_role" in sql
print("Remaining worker fleet qualification contract: PASS")
