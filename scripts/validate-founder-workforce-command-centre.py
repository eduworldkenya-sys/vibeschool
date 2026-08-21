#!/usr/bin/env python3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
sql=(root/'supabase/migrations/20260821203000_hq_founder_workforce_command_centre.sql').read_text()
ui=(root/'app/hq/workforce/LiveWorkerEngineMap.tsx').read_text()
page=(root/'app/hq/workforce/page.tsx').read_text()
test=(root/'supabase/tests/hq_founder_workforce_command_centre.sql').read_text()

for token in ['professional','operational_state','authority','global_stop_applies','latest_failure','repair_action','health','expiring_soon']:
    assert token in sql.lower(), token
for token in ['PROFESSIONALLY READY','Operational','Authority','Current assignment','Why this state','Open Repair Plan','Commissioning Evidence']:
    assert token in ui, token
for token in ['setInterval','visibilitychange','15000']:
    assert token in page or token in ui, token
for forbidden in ['runtime_execution_enabled=true','runtime_autonomy_level=1','shadow_global_stop=false','setstatus=\'active\'']:
    assert forbidden not in sql.replace(' ', '').lower(), forbidden
for token in ['anonymous command-centre access','owner gate missing','authority truth missing','operational truth missing']:
    assert token in test, token
print('Founder Workforce Command Centre contract: PASS')
