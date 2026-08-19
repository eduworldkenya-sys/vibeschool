import fs from 'node:fs'

const migration=fs.readFileSync('supabase/migrations/20260819133000_hq_founder_os_control_plane.sql','utf8')
const readiness=fs.readFileSync('supabase/migrations/20260819135000_hq_worker_runtime_readiness_schema_fix.sql','utf8')
const r13x=fs.readFileSync('supabase/migrations/20260819140500_worker_engine_r13x_certification_fail_closed.sql','utf8')
const stop=fs.readFileSync('supabase/migrations/20260819142000_hq_worker_emergency_stop.sql','utf8')
const operations=fs.readFileSync('app/hq/operations/page.tsx','utf8')
const emergency=fs.readFileSync('app/hq/operations/emergency-stop/page.tsx','utf8')
const decisions=fs.readFileSync('app/hq/decisions/page.tsx','utf8')
const intelligence=fs.readFileSync('app/hq/intelligence/page.tsx','utf8')
const workforce=fs.readFileSync('app/hq/workforce/page.tsx','utf8')
const twin=fs.readFileSync('components/hq/TwinDrawer.tsx','utf8')

const requiredMigration=[
 'hq_founder_os_snapshot','hq_assert_owner','security definer','revoke all','grant execute',
 "'INCIDENT'","'DEGRADED'","'ATTENTION'","'LIVE'",
 'hq_workforce_execution_intents','hq_workforce_execution_verifications','hq_workforce_task_verifications',
 'hq_workforce_heartbeat_runs','hq_workforce_scheduler_events','hq_workforce_execution_breakers',
 'Historical runs exist without a complete intent-to-verification trail'
]
for(const token of requiredMigration) if(!migration.includes(token)) throw new Error(`Founder OS migration missing ${token}`)
if(/insert\s+into|update\s+public\.|delete\s+from|runtime_execution_enabled\s*=|runtime_autonomy_level\s*=/i.test(migration)) throw new Error('Founder OS snapshot must remain read-only')

for(const token of ['hq_workforce_runtime_readiness','hq_assert_owner','activated_at','expires_at','revoked_at','can_request_activation','blocked_reasons','revoke all','service_role','grant execute']) if(!readiness.includes(token)) throw new Error(`Runtime readiness migration missing ${token}`)
if(/insert\s+into|update\s+public\.|delete\s+from/i.test(readiness)) throw new Error('Runtime readiness must remain non-mutating')
for(const token of ['certified',"'available',false",'r13x_metrics_contract_missing','no evidence was inferred or fabricated','hq_assert_owner']) if(!r13x.includes(token)) throw new Error(`R1.3X fail-closed repair missing ${token}`)
for(const token of ['hq_workforce_owner_emergency_stop','hq_assert_owner','runtime_execution_enabled=false','runtime_autonomy_level=0','runtime_max_risk=0','shadow_global_stop=true','hq_workforce_owner_control_events','previous_state','resulting_state','revoke all','service_role']) if(!stop.includes(token)) throw new Error(`Emergency stop contract missing ${token}`)
if(/runtime_execution_enabled=true|runtime_autonomy_level=[1-9]|runtime_max_risk=[1-9]|shadow_global_stop=false/i.test(stop)) throw new Error('Emergency stop must never contain an activation path')

for(const token of ['hq_founder_os_snapshot','hq_workforce_runtime_readiness','Company state','Attention Required','Execution integrity','Global Stop','verification deficit','Recent execution lineage','Activation readiness','ACTIVATION BLOCKED']) if(!operations.toLowerCase().includes(token.toLowerCase())) throw new Error(`Operations UI missing ${token}`)
for(const token of ['hq_workforce_owner_emergency_stop','Type STOP to confirm','Activate Global Stop','one-way safety action']) if(!emergency.includes(token)) throw new Error(`Emergency stop UI missing ${token}`)
for(const token of ['Needs Me Now','Waiting','Recently Resolved','Observation / reason','Recommendation','Evidence & authority references','does not activate Worker Engine runtime']) if(!decisions.includes(token)) throw new Error(`Decision Inbox missing ${token}`)
for(const token of ['Business truth','Learning & product evidence','Intervention queue','Metric trust & provenance']) if(!intelligence.includes(token)) throw new Error(`Decision Intelligence missing ${token}`)
if(!workforce.includes('shadow_global_stop')) throw new Error('Worker Engine must retain canonical Global Stop display')

for(const token of ['hq_check_owner_access','resolveHQReply','router.push']) if(!twin.includes(token)) throw new Error(`HQ Twin boundary missing ${token}`)
for(const forbidden of ['hq_workforce_owner_set_runtime','hq_run_operating_cycle','learning_product','publish_publication']) if(twin.includes(forbidden)) throw new Error(`HQ Twin must not expose consequential mutation path: ${forbidden}`)

console.log('HQ Founder OS control-plane contract: PASS')
