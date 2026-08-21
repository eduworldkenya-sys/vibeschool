#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
standard = json.loads((root / 'worker-creator/professional-worker-standard-v1.json').read_text())
assert standard['principle'] == 'competence_does_not_imply_authority'
assert standard['assurance_invariants']['creator_may_self_certify'] is False
assert standard['assurance_invariants']['creation_grants_production_authority'] is False
assert standard['assurance_invariants']['independent_evaluation_required'] is True
assert standard['assurance_invariants']['global_stop_must_be_respected'] is True
required = {'competency_profile','certified_skills','context_contract','tool_contracts','risk_class','guardrails','independent_assurance','adversarial_evidence','recertification'}
assert required.issubset(set(standard['required_dimensions']))
assert {'finance','security_sensitive','repair','author','critic'}.issubset(set(standard['archetypes']))
assert set(standard['risk_classes']) == {'R0','R1','R2','R3'}

migration = (root / 'supabase/migrations/20260821130000_worker_creator_professionalization.sql').read_text()
for token in [
    'hq_workforce_professional_standards', 'hq_workforce_worker_assurance', 'hq_workforce_creator_assess_worker',
    'independent_assurance_required', 'creation_does_not_grant_authority', 'global_stop_required',
    'legacy_recertification_required', 'risk_class'
]:
    assert token in migration, token
for forbidden in ['factory_enabled=true', 'heartbeat_enabled=true', "status='active'", "status = 'active'"]:
    assert forbidden not in migration, forbidden
print('Worker Creator professionalization contract: PASS')
