import fs from 'node:fs'
const page=fs.readFileSync('app/hq/operations/page.tsx','utf8')
for(const token of ['hq_autopilot_founder_brief','hq_get_seven_day_owner_report','LIVE','ATTENTION','DEGRADED','INCIDENT','Global Stop','Execution integrity','Independently verified','/hq/workforce','/hq/intelligence']) if(!page.includes(token)) throw new Error(`Task 9 operations missing ${token}`)
for(const forbidden of ['hq_workforce_owner_set_runtime','hq_workforce_owner_release_global_stop','hq_workforce_owner_start','publish_publication']) if(page.includes(forbidden)) throw new Error(`Task 9 operations contains forbidden mutation path: ${forbidden}`)
const founder=fs.readFileSync('supabase/migrations/20260819162500_autopilot_canonical_founder_read_model.sql','utf8')
for(const token of ['hq_autopilot_founder_brief','hq_autopilot_constitution_snapshot','hq_assert_owner','worker_names_are_authority','truth_note']) if(!founder.includes(token)) throw new Error(`Canonical founder read model missing ${token}`)
console.log('Task 9 current-main Founder Operations contract: PASS')
