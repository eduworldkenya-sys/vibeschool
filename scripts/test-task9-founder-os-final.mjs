import fs from 'node:fs'

const files = {
  founder: fs.readFileSync('supabase/migrations/20260819133000_hq_founder_os_control_plane.sql','utf8'),
  readiness: fs.readFileSync('supabase/migrations/20260819135000_hq_worker_runtime_readiness_schema_fix.sql','utf8'),
  stop: fs.readFileSync('supabase/migrations/20260819142000_hq_worker_emergency_stop.sql','utf8'),
  business: fs.readFileSync('supabase/migrations/20260819144500_hq_founder_os_business_health.sql','utf8'),
  page: fs.readFileSync('app/hq/operations/page.tsx','utf8')
}

const must=(text,token,msg)=>{if(!text.includes(token)) throw new Error(`TASK9: ${msg}`)}
for (const t of ['hq_assert_owner','security definer',"'INCIDENT'", "'DEGRADED'", "'ATTENTION'", "'LIVE'",'Historical runs exist without a complete intent-to-verification trail']) must(files.founder,t,`Founder snapshot missing ${t}`)
for (const t of ['hq_workforce_runtime_readiness','can_request_activation','blocked_reasons','revoke all','grant execute']) must(files.readiness,t,`Readiness contract missing ${t}`)
for (const t of ['hq_workforce_owner_emergency_stop','runtime_execution_enabled=false','runtime_autonomy_level=0','runtime_max_risk=0','shadow_global_stop=true','hq_assert_owner']) must(files.stop,t,`Emergency stop contract missing ${t}`)
for (const forbidden of ['runtime_execution_enabled=true','runtime_autonomy_level=1','shadow_global_stop=false']) if(files.stop.includes(forbidden)) throw new Error(`TASK9: unsafe emergency-stop token ${forbidden}`)
for (const t of ['payment_exceptions','content_health_critical','r13x_certification_available','company_state']) must(files.business,t,`Business-health contract missing ${t}`)
for (const t of ['hq_founder_os_snapshot','Attention Required','Execution integrity','Global Stop','ACTIVATION BLOCKED','Recent execution lineage']) must(files.page,t,`Founder Operations UI missing ${t}`)
console.log('Task 9 Founder OS final contract: PASS')
