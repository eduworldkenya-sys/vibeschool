import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260819133000_hq_founder_os_control_plane.sql','utf8')
const operations=fs.readFileSync('app/hq/operations/page.tsx','utf8')
const workforce=fs.readFileSync('app/hq/workforce/page.tsx','utf8')

const requiredMigration=[
 'hq_founder_os_snapshot','hq_assert_owner','security definer','revoke all','grant execute',
 "'INCIDENT'","'DEGRADED'","'ATTENTION'","'LIVE'",
 'hq_workforce_execution_intents','hq_workforce_execution_verifications','hq_workforce_task_verifications',
 'hq_workforce_heartbeat_runs','hq_workforce_scheduler_events','hq_workforce_execution_breakers',
 'Historical runs exist without a complete intent-to-verification trail'
]
for(const token of requiredMigration) if(!migration.includes(token)) throw new Error(`Founder OS migration missing ${token}`)
if(/insert\s+into|update\s+public\.|delete\s+from|runtime_execution_enabled\s*=|runtime_autonomy_level\s*=/i.test(migration)) throw new Error('Founder OS snapshot must remain read-only')

for(const token of ['hq_founder_os_snapshot','Company state','Attention Required','Execution integrity','Global Stop','verification deficit','Recent execution lineage']){
 if(!operations.toLowerCase().includes(token.toLowerCase())) throw new Error(`Operations UI missing ${token}`)
}
if(!workforce.includes('shadow_global_stop')) throw new Error('Worker Engine must retain canonical Global Stop display')

console.log('HQ Founder OS control-plane contract: PASS')
