import fs from 'node:fs'
const sql=fs.readFileSync('supabase/tests/task9_founder_os_reconciliation.sql','utf8')
for(const token of ['hq_founder_os_snapshot','hq_workforce_runtime_readiness','runtime_execution_enabled','runtime_autonomy_level = 0','runtime_max_risk = 0']) if(!sql.includes(token)) throw new Error(`Task 9 SQL contract missing ${token}`)
console.log('Task 9 SQL contract: PASS')
