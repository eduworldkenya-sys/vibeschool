#!/usr/bin/env python3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
sql=(root/'supabase/migrations/20260821170000_worker_engine_continuous_improvement.sql').read_text()
test=(root/'supabase/tests/worker_engine_continuous_improvement.sql').read_text()
dependency_sql=(root/'supabase/migrations/20260821214500_worker_engine_dependency_integrity.sql').read_text()
dependency_test=(root/'supabase/tests/worker_engine_dependency_integrity.sql').read_text()
operational_sql=(root/'supabase/migrations/20260821223000_dependency_integrity_operational_proof.sql').read_text()
operational_test=(root/'supabase/tests/dependency_integrity_operational_proof.sql').read_text()
release_identity_sql=(root/'supabase/migrations/20260821224500_content_convergence_release_identity_gate.sql').read_text()
assurance_sql=(root/'supabase/migrations/20260821225500_dependency_assurance_fail_closed.sql').read_text()
evidence_sql=(root/'supabase/migrations/20260821231000_dependency_evidence_and_hq_truth.sql').read_text()
p3_parity_sql=(root/'supabase/migrations/20260821231100_content_release_p3_author_parity.sql').read_text()
assessor_sql=(root/'supabase/migrations/20260821232500_dependency_assessor_authority_and_control_binding.sql').read_text()
assessor_revocation_sql=(root/'supabase/migrations/20260821233500_dependency_assessor_revocation_events.sql').read_text()

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

for token in [
    'hq_workforce_mission_checkpoints','hq_workforce_dependency_findings',
    'hq_workforce_dependency_impacts','hq_workforce_dependency_revalidations','blocking_dependency','certification_at_risk',
    'security_or_data_integrity','non_blocking_debt','not_a_defect',
    'blocking_dependency_requires_resume_conditions','dependency_cycle_detected','dependency_controls_required',
    'dependency_impacts_not_revalidated','hq_workforce_record_dependency_interruption',
    'hq_workforce_record_dependency_revalidation','hq_workforce_record_dependency_resolution',
]: assert token in dependency_sql, token

for forbidden in [
    'runtime_execution_enabled=true','factory_enabled=true','heartbeat_enabled=true',
    'shadow_enabled=true','shadow_global_stop=false',
    'insert into public.hq_workforce_capability_authority_grants',
]: assert forbidden not in dependency_sql.lower(), forbidden

for token in ['at-risk impact accepted without revalidation','checkpoint mutation accepted','dependency integrity changed fail-closed runtime posture']:
    assert token in dependency_test, token

for token in [
    'hq_workforce_mission_checkpoint_events','hq_workforce_resume_dependency_mission',
    'stale_dependency_checkpoint','dependency_self_revalidation_forbidden',
    'contradictory_dependency_revalidation','content_convergence_assert_certified_worker',
    'CONTENT_WORKER_IDENTITY_NOT_REGISTERED','CONTENT_ARTIFACT_LINEAGE_CONFLICT',
    'content_convergence_record_governed_evaluation','CONTENT_SELF_EVALUATION_FORBIDDEN',
    'hq_workforce_get_dependency_integrity_packet',
]: assert token in operational_sql, token

for forbidden in [
    'runtime_execution_enabled=true','factory_enabled=true','heartbeat_enabled=true',
    'shadow_enabled=true','shadow_global_stop=false',
    'insert into public.hq_workforce_capability_authority_grants',
]: assert forbidden not in operational_sql.lower(), forbidden

for token in [
    'premature resume accepted','contradictory revalidation accepted','self revalidation accepted',
    'stale checkpoint accepted','duplicate resume accepted','dependency cycle accepted',
    'unregistered content author accepted','certified author positive control failed',
    'affected decision was not automatically invalidated','non-blocking debt interrupted mission',
    'operational proof changed fail-closed runtime posture',
]: assert token in operational_test, token

for token in [
    'content_convergence_evaluation_identities','governed evaluator identity is required for P2 and P3',
    'P2 quality and P3 critic identities must be distinct','author or evaluator certification is stale',
    "v_p2i.evaluator_worker_key=v_p3i.evaluator_worker_key",
]: assert token in release_identity_sql, token

for token in [
    'hq_workforce_dependency_invalidations','classification_does_not_authorize_interruption',
    'structured_resume_conditions_required','dependency_depth_limit_exceeded',
    'dependency_evaluator_not_current_certified_machine','dependency_repair_candidate_revision_mismatch',
    'dependency_independent_revalidation_required','dependency_resume_conditions_missing',
]: assert token in assurance_sql, token

for token in [
    'hq_workforce_dependency_control_results','hq_workforce_dependency_gate_evidence',
    'authoritative_dependency_gate_evidence_missing','executed_dependency_controls_required',
    'hq_workforce_dependency_invalidation_state','RESTORED BY FRESH DECISION',
    'hq_workforce_effective_certification_state','CERTIFICATION AT RISK',
    'hq_workforce_get_live_readiness_map_pre_dependency',
]: assert token in evidence_sql, token
for token in ['content_convergence_release_identity_current','RELEASE_IDENTITY_PARITY_REQUIRED','content_convergence_release_identity_parity']:
    assert token in p3_parity_sql, token

for token in [
    'hq_workforce_dependency_assessor_authorizations','dependency_evaluator_not_authorized',
    'dependency_control_observed_result_mismatch','dependency_controls_not_bound_to_candidate',
    'cr.observed_result=r.expected_result','r.source_incident_id<>c.source_incident_id',
]: assert token in assessor_sql, token
for token in [
    'hq_workforce_dependency_assessor_revocations','hq_workforce_owner_revoke_dependency_assessor',
    'not exists(select 1 from public.hq_workforce_dependency_assessor_revocations',
]: assert token in assessor_revocation_sql, token
for token in [
    'contradictory control result accepted','unauthorized assessor accepted',
    'expired assessor authorization accepted','revoked assessor authorization accepted',
    'assessor authorization mutation accepted','unrelated candidate control accepted',
]: assert token in operational_test, token

print('Worker Engine continuous-improvement contract: PASS')
