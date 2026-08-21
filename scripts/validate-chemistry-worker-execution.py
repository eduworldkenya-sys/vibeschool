#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sql = (root / "supabase/migrations/20260821235000_chemistry_worker_execution_mission.sql").read_text()

required = [
    "content-critic-chemistry-v1",
    "content-repair-chemistry-v1",
    "chemistry_worker_missions",
    "chemistry_worker_mission_items",
    "hq_start_chemistry_worker_mission",
    "hq_get_chemistry_worker_mission",
    "hq_list_chemistry_worker_missions",
    "content_convergence_assert_certified_worker",
    "AUTHOR_QUEUED",
    "FRESH_P2_QUEUED",
    "FRESH_P3_QUEUED",
    "HUMAN_REVIEW",
    "negative_control_hash",
    "runtime_execution_enabled",
    "shadow_global_stop",
    "no_self_verification",
    "no_publication",
]
for token in required:
    if token not in sql:
        raise SystemExit(f"missing Chemistry worker execution contract: {token}")

for forbidden in [
    "runtime_execution_enabled=true",
    "shadow_enabled=true",
    "shadow_scheduler_enabled=true",
    "shadow_global_stop=false",
    "status='published'",
]:
    if forbidden.replace(" ", "") in sql.replace(" ", "").lower():
        raise SystemExit(f"consequential activation found: {forbidden}")

release_gate = (root / "supabase/migrations/20260821224500_content_convergence_release_identity_gate.sql").read_text()
if "P2 quality and P3 critic identities must be distinct" not in release_gate:
    raise SystemExit("distinct Quality/Critic release identity gate missing")

print("Chemistry worker full-execution contract: PASS")
