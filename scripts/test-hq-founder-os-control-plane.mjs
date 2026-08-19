import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260819133000_hq_founder_os_control_plane.sql','utf8')
const readiness=fs.readFileSync('supabase/migrations/20260819135000_hq_worker_runtime_readiness_schema_fix.sql','utf8')
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

for(const token of ['hq_workforce_runtime_readiness','hq_assert_owner','activated_at','expires_at','revoked_at','can_request_activation','blocked_reasons','revoke all','service_role','grant execute']){
 if(!readiness.includes(token)) throw new Error(`Runtime readiness migration missing ${token}`)
}
if(/insert\s+into|update\s+public\.|delete\s+from/i.test(readiness)) throw new Error('Runtime readiness must remain non-mutating')

for(const token of ['hq_founder_os_snapshot','hq_workforce_runtime_readiness','Company state','Attention Required','Execution integrity','Global Stop','verification deficit','Recent execution lineage','Activation readiness','ACTIVATION BLOCKED']){
 if(!operations.toLowerCase().includes(token.toLowerCase())) throw new Error(`Operations UI missing ${token}`)
}
if(!workforce.includes('shadow_global_stop')) throw new Error('Worker Engine must retain canonical Global Stop display')

console.log('HQ Founder OS control-plane contract: PASS')
