#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sql = (root / "supabase/migrations/20260822003000_chemistry_stage_executor.sql").read_text()

required = [
    "chemistry_worker_stage_attempts", "chemistry_worker_stage_events",
    "chemistry_claim_stage", "chemistry_complete_stage", "idempotency_key",
    "lease_expires_at", "TIMED_OUT", "CHEMISTRY_STAGE_RETRY_LIMIT",
    "STALE_CHEMISTRY_SOURCE", "CHEMISTRY_P2_BLOCKER_PRESERVED",
    "CHEMISTRY_SHADOW_SIDE_EFFECT_FORBIDDEN", "CHEMISTRY_PUBLICATION_FORBIDDEN",
    "runtime_execution_enabled", "shadow_scheduler_enabled", "shadow_global_stop",
    "FRESH_P2_REVIEW", "FRESH_P3_REVIEW", "WAITING_HUMAN_REVIEW",
    "hq_workforce_reject_evidence_mutation", "content_convergence_assert_certified_worker",
]
for token in required:
    if token not in sql:
        raise SystemExit(f"missing Chemistry stage-executor contract: {token}")

compact = "".join(sql.lower().split())
for forbidden in [
    "runtime_execution_enabled=true", "shadow_enabled=true",
    "shadow_scheduler_enabled=true", "shadow_global_stop=false",
    "updatepublic.vibe_chapters", "status='published'",
]:
    if "".join(forbidden.split()) in compact:
        raise SystemExit(f"forbidden consequential behavior: {forbidden}")

if sql.count("security definer") < 2:
    raise SystemExit("stage executor must enforce service-owned claim and completion boundaries")
if "grant execute" not in sql or "to service_role" not in sql:
    raise SystemExit("service-only executor grants missing")

print("Chemistry governed stage executor: PASS")
