#!/usr/bin/env python3
from pathlib import Path
R=Path(__file__).resolve().parents[1]
F={'p':'supabase/migrations/20260820000030_task6_parent_core_journey_privacy_closure.sql','c':'supabase/migrations/20260820000040_task6_parent_communication_revocation_closure.sql','a':'supabase/migrations/20260820000070_task6_parent_claim_least_authority.sql','n':'supabase/migrations/20260820000060_task6_parent_notification_navigation_closure.sql','l':'app/parent/learn/page.tsx','s':'app/parent/assessments/page.tsx','h':'app/parent/child/[id]/homework/page.tsx','x':'app/parent/child/[id]/page.tsx'}
T={k:(R/v).read_text() for k,v in F.items()}
def q(k,n): assert n in T[k],f'{k}: {n}'
for k,n in [('p','is_parent_of_student'),('p',"coalesce(psl.access_level, 'full') <> 'none'"),('p','assessment_gradebook_entries.released_at is not null'),('p','drop policy if exists finance_fee_payments_parent_insert'),('c','private.vc_child_scope_authorized'),('c','active parent relationship required'),('a',"v_role is distinct from 'parent'"),('a',"role in ('parent', 'shared')"),('a','v_code_row.parent_claimed_at is not null'),('n','private.parent_event_normalize_action_href'),('l','const requestVersion = useRef(0)'),('l','setState(EMPTY)'),('l','version !== requestVersion.current'),('s','setStudentId(null)'),('s',".from('students')"),('x','`/parent/child/${child.id}/homework`'),('h','const requestVersion = useRef(0)'),('h','No cached data from another learner has been shown')]: q(k,n)
print('Parent Core Journey Contract: PASS')
