#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sql=(root/'supabase/migrations/20260821143500_worker_creator_full_qualification.sql').read_text()
sep=(root/'supabase/migrations/20260821143600_worker_creator_authority_separation.sql').read_text()
required=['hq_workforce_qualification_evidence','hq_workforce_professional_baseline','hq_workforce_record_qualification_evidence','hq_workforce_decide_professional_certification','independent_evaluator_required','creator_or_self_certification_forbidden','fresh_reverification','human_authority','global_stop','authority_separation','authority_changed',"'canary'","'shadow'"]
for x in required: assert x in sql,x
for forbidden in ['factory_enabled=true','heartbeat_enabled=true',"status='active'","insert into public.hq_workforce_capability_grants","insert into public.hq_workforce_identities"]: assert forbidden not in sql,forbidden
assert "p_decider ilike '%creator%'" in sql
assert "p_evaluator=p_worker_key" in sql
assert 'professional_certification_required' in sep
assert "'certification_pending'" in sep
for forbidden in ['hq_workforce_issue_certification','hq_workforce_capability_grants','hq_workforce_identities','hq_workforce_execution_budgets',"'active'"]:
    assert forbidden not in sep, forbidden
print('Worker Creator full qualification regression: PASS')
