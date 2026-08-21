#!/usr/bin/env python3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
sql=(root/'supabase/migrations/20260821170000_worker_engine_continuous_improvement.sql').read_text()
test=(root/'supabase/tests/worker_engine_continuous_improvement.sql').read_text()

for token in [
    'hq_workforce_improvement_incidents','hq_workforce_regression_cases',
    'hq_workforce_improvement_candidates','hq_workforce_health_events',
    'worker_engine_evidence_is_append_only','independent_evaluator_required',
    'candidate_hash_mismatch','protected_regression_suite_required',
    'invalid_improvement_transition','incident_evidence_required',
    'hq_workforce_propose_improvement_candidate','candidate_must_change_target',
    'hq_workforce_record_health_event','health_evidence_required',
]: assert token in sql, token

for role in ['public','anon','authenticated']:
    assert role in sql

for forbidden in [
    'runtime_execution_enabled=true','factory_enabled=true','heartbeat_enabled=true',
    'shadow_enabled=true','shadow_global_stop=false',
    'insert into public.hq_workforce_capability_authority_grants',
]: assert forbidden not in sql.lower(), forbidden

for token in ['incident idempotency failed','self evaluation accepted','append-only mutation accepted','continuous improvement changed fail-closed runtime posture']:
    assert token in test, token

print('Worker Engine continuous-improvement contract: PASS')
