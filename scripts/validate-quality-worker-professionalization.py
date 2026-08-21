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
for forbidden in ['factory_enabled=true','heartbeat_enabled=true',"autonomy_level=",'insert into public.hq_workforce_capability_grants','insert into public.hq_workforce_capability_authority_grants']:
    assert forbidden not in sql, forbidden
print('Quality Worker professionalization regression: PASS')
