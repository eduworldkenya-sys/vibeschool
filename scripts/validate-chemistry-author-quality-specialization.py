#!/usr/bin/env python3
from pathlib import Path

MIGRATION = Path('supabase/migrations/20260823194500_content_worker_professionalization_chemistry_author_quality_specialization.sql')
STAGE_GATE = Path('supabase/migrations/20260823193500_chemistry_specialization_admission_enforcement.sql')

migration = MIGRATION.read_text()
stage_gate = STAGE_GATE.read_text()

required = [
    "perform public.hq_assert_owner();",
    "content-factory-r2-canary-01",
    "quality-worker-01",
    "a.certification_state<>'CERTIFIED'",
    "a.qualification_state<>'CERTIFIED'",
    "a.expires_at<=clock_timestamp()",
    "a.worker_version is distinct from w.version",
    "CHEMISTRY_AUTHOR_QUALITY_PERMISSION_BOUNDARY_INVALID",
    "CHEMISTRY_QUALIFICATION_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON",
    "specialization_key='chemistry.grade10'",
    "s.qualification_state='revoked'",
    "r.required_capabilities <@ s.capabilities",
    "hq_workforce_record_qualification_evidence",
    "'independent'",
    "'adversarial'",
    "'global_stop'",
    "'authority_separation'",
    "qualification_state='qualified'",
    "qualified_until=v_until",
    "perform public.hq_workforce_assert_worker_specialization(",
    "provider_call_executed',false",
    "authority_changed',false",
    "runtime_execution_enabled,false",
    "heartbeat_enabled,false",
    "factory_enabled,false",
    "runtime_autonomy_level,0)<>0",
    "runtime_max_risk,0)<>0",
    "shadow_enabled,false",
    "shadow_scheduler_enabled,false",
    "shadow_global_stop,true",
]

missing = [needle for needle in required if needle not in migration]
if missing:
    raise SystemExit(f'Chemistry Author/Quality qualification contract missing: {missing}')

for forbidden in [
    "content-critic-chemistry-v1",
    "content-repair-chemistry-v1",
    "update public.hq_workforce_worker_assurance",
    "update public.hq_workforce_workers",
    "runtime_execution_enabled=true",
    "heartbeat_enabled=true",
    "factory_enabled=true",
    "shadow_enabled=true",
    "shadow_scheduler_enabled=true",
    "shadow_global_stop=false",
]:
    if forbidden in migration:
        raise SystemExit(f'Forbidden qualification expansion detected: {forbidden}')

for needle in [
    "hq_workforce_assert_worker_specialization",
    "chemistry_claim_stage",
    "chemistry.grade10",
    "WORKER_SPECIALIZATION_NOT_QUALIFIED",
]:
    if needle not in stage_gate:
        raise SystemExit(f'Chemistry admission gate invariant missing: {needle}')

evidence_pos = migration.find('hq_workforce_record_qualification_evidence')
qualify_pos = migration.find("set qualification_state='qualified'")
assert_pos = migration.rfind('perform public.hq_workforce_assert_worker_specialization(')
if min(evidence_pos, qualify_pos, assert_pos) < 0 or not evidence_pos < qualify_pos < assert_pos:
    raise SystemExit('Required ordering is evidence -> qualify specialization -> canonical fail-closed assertion')

print('Chemistry Author/Quality specialization qualification contract: PASS')
