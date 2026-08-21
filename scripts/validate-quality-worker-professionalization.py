#!/usr/bin/env python3
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
std=json.loads((root/'quality-worker/quality-worker-professional-standard-v1.json').read_text())
assert std['worker_key']=='quality-worker-01'
assert std['role']=='independent_workforce_examiner'
assert len(std['required_defective_fixture_categories']) >= 24
for forbidden in ['self_certification','grant_authority','widen_permissions','activate_worker','commission_worker','repair_current_exam_target']:
    assert forbidden in std['forbidden']

sql=(root/'supabase/migrations/20260821152000_quality_worker_professionalization.sql').read_text()
for token in ['hq_workforce_quality_examinations','hq_workforce_quality_findings','hq_workforce_quality_fixture_results','defective_worker_laboratory','no_self_certification','no_authority_grants','no_permission_widening','verify_repairs','recommend_certification_state','quality-adversarial-v1','professional_baseline']:
    assert token in sql, token
for table in ['hq_workforce_quality_examinations','hq_workforce_quality_findings','hq_workforce_quality_fixture_results']:
    assert f'access: service-only public.{table}' in sql
    assert f'authorization-test: public.{table}' in sql

observed=(root/'supabase/migrations/20260821153000_quality_worker_observed_assurance_capability.sql').read_text()
for token in [
    'workforce.quality.assess_fixture',
    'worker_quality_fixture',
    'quality_case_id_required',
    'quality_fixture_contract_incomplete',
    'mutation_denied',
    'independence_boundary',
    'evidence_missing',
    'not_reproducible',
    'severity_invalid',
    'quality_contract_satisfied',
    'hq_workforce_quality_detect_fixture',
    'hq_workforce_quality_execute_lab_fixture',
    'quality_fixture_evaluator_v1',
    "evidence->>'execution_method'='quality_fixture_evaluator_v1'",
    "qe.suite_version='professional-server-shadow-v1'",
    "'side_effects_applied',false",
    "'authority_changed',false",
    "select public.hq_workforce_professional_baseline('quality-worker-01')",
]:
    assert token in observed, token

for category in std['required_defective_fixture_categories']:
    assert category in observed, f'missing detector for {category}'

combined=sql+'\n'+observed
for forbidden in [
    'factory_enabled=true','heartbeat_enabled=true',"autonomy_level=",
    'insert into public.hq_workforce_capability_grants',
    'insert into public.hq_workforce_capability_authority_grants',
    "runtime_execution_enabled=true",
    "shadow_global_stop=false",
]:
    assert forbidden not in combined, forbidden

print('Quality Worker professionalization + execution-derived observed assurance regression: PASS')
