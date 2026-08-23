#!/usr/bin/env python3
from pathlib import Path

BASE = Path('supabase/migrations/20260823194500_content_worker_professionalization_chemistry_author_quality_specialization.sql')
HOTFIX = Path('supabase/migrations/20260823195500_content_worker_professionalization_chemistry_author_quality_runtime_fix.sql')
STAGE_GATE = Path('supabase/migrations/20260823193500_chemistry_specialization_admission_enforcement.sql')

base = BASE.read_text()
hotfix = HOTFIX.read_text()
stage_gate = STAGE_GATE.read_text()

for needle in [
    "perform public.hq_assert_owner();",
    "content-factory-r2-canary-01",
    "quality-worker-01",
    "a.certification_state<>'CERTIFIED'",
    "a.qualification_state<>'CERTIFIED'",
    "a.expires_at<=clock_timestamp()",
    "nullif(trim(a.worker_version),'') is null",
    "w.status in ('suspended','retired')",
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
]:
    if needle not in hotfix:
        raise SystemExit(f'Chemistry Author/Quality runtime contract missing: {needle}')

# This specifically guards the production bug found after PR #498: the generic worker
# table has no version column and draft/probation are lifecycle states, not professional
# certification failures. Professional version/eligibility come from assurance.
for forbidden in [
    'w.version',
    "w.status not in ('restricted','active')",
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
    if forbidden in hotfix:
        raise SystemExit(f'Forbidden qualification/runtime assumption detected: {forbidden}')

# Preserve the historical base migration for reconstruction while ensuring the latest
# function definition supersedes its runtime-only assumptions.
if 'create or replace function public.hq_workforce_qualify_chemistry_author_quality' not in base:
    raise SystemExit('Base Chemistry qualification migration missing')
if hotfix.find('create or replace function public.hq_workforce_qualify_chemistry_author_quality') < 0:
    raise SystemExit('Runtime repair must replace the qualification function')

for needle in [
    "s:=public.hq_workforce_assert_worker_specialization(",
    "v_spec:=public.hq_workforce_assert_worker_specialization(",
    "v_ready:=false;",
    "chemistry_claim_stage",
    "'chemistry.grade10'",
    "'worker_specialization',v_spec",
]:
    if needle not in stage_gate:
        raise SystemExit(f'Chemistry admission gate invariant missing: {needle}')

evidence_pos = hotfix.find('hq_workforce_record_qualification_evidence')
qualify_pos = hotfix.find("set qualification_state='qualified'")
assert_pos = hotfix.rfind('perform public.hq_workforce_assert_worker_specialization(')
if min(evidence_pos, qualify_pos, assert_pos) < 0 or not evidence_pos < qualify_pos < assert_pos:
    raise SystemExit('Required ordering is evidence -> qualify specialization -> canonical fail-closed assertion')

print('Chemistry Author/Quality specialization qualification runtime contract: PASS')
