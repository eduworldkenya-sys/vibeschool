import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'cyborg-supervisor-'))
const env={...process.env,CYBORG_ROOT:root,CYBORG_BASE_SHA:'base123',CYBORG_HEAD_SHA:'head123',CYBORG_ACTOR:'test-agent'}
function run(args,ok=true,extraEnv={}){const r=spawnSync(process.execPath,['scripts/cyborg-supervisor.mjs',...args],{encoding:'utf8',env:{...env,...extraEnv}});if(ok&&r.status!==0)throw new Error(`Expected success: ${args.join(' ')}\n${r.stderr}`);if(!ok&&r.status===0)throw new Error(`Expected failure: ${args.join(' ')}`);return r}
function json(r){return JSON.parse(r.stdout)}
function passRequiredSkills(mission){const s=json(run(['status',mission]));for(const skill of s.selectedSkills.filter(x=>x.required))run(['skill',mission,skill.id,'PASS','adversarial test proof'])}

const m=json(run(['compile','Is signup ready?','READINESS']))
if(m.state!=='MISSION'||m.missionType!=='READINESS')throw new Error('Mission compiler failed')
if(!m.selectedSkills.some(s=>s.id==='mission-decomposition'))throw new Error('Higher-order skills not selected')
if(!m.selectedSkills.some(s=>s.id==='journey-integrity'))throw new Error('Domain routing failed')
if(m.activation.runtime||m.activation.payments)throw new Error('Unsafe activation default')
if(m.capabilities.includes('ACTIVATE_PAYMENTS'))throw new Error('Consequential capability granted by default')
run(['capability',m.missionId,'ACTIVATE_PAYMENTS','grant'],false)
run(['complete',m.missionId],false)
const first=m.requirements[0]
run(['evidence',m.missionId,JSON.stringify({requirementId:first.id,kind:'truth',result:'PASS',grade:'E0',source:'claim'})],false)

let current=json(run(['status',m.missionId]))
for(const r of current.requirements){run(['evidence',m.missionId,JSON.stringify({requirementId:r.id,kind:r.id,result:'PASS',grade:r.minimumEvidenceGrade,source:`proof:${r.id}`,provenance:{sha:'head123'}})])}
passRequiredSkills(m.missionId)
run(['contradiction',m.missionId,JSON.stringify({claimA:'signup ready',claimB:'runtime failed'})])
run(['learning-close',m.missionId])
run(['complete',m.missionId],false)
current=json(run(['status',m.missionId]))
const cid=current.contradictions[0].id
run(['resolve-contradiction',m.missionId,cid,JSON.stringify({authoritativeSource:'fresh integration proof',reason:'fresh exact-head evidence resolves stale observation'})])
const done=json(run(['complete',m.missionId]))
if(done.state!=='COMPLETE')throw new Error('Completion gate failed')
const journal=json(run(['journal-verify',m.missionId]))
if(!journal.valid||journal.events<current.requirements.length)throw new Error('Journal integrity failed')

const a=json(run(['compile','Implement auth fix','IMPLEMENTATION']))
const b=json(run(['compile','Implement profile fix','IMPLEMENTATION']))
run(['lease',a.missionId,JSON.stringify(['lib/auth'])])
run(['lease',b.missionId,JSON.stringify(['lib/auth/callback'])],false)
run(['release',a.missionId])
run(['lease',b.missionId,JSON.stringify(['lib/auth/callback'])])

const fingerprint='same-ci-failure'
json(run(['attempt',b.missionId,fingerprint]))
json(run(['attempt',b.missionId,fingerprint]))
const stagnant=json(run(['attempt',b.missionId,fingerprint]))
if(stagnant.count!==3||stagnant.strategy!=='dependency_root_cause')throw new Error('Stagnation escalation failed')

const replay=json(run(['replay',m.missionId]))
if(replay.replayOf!==m.missionId||replay.requirements.some(r=>r.state!=='UNKNOWN')||replay.selectedSkills.filter(s=>s.required).some(s=>s.result!=='PENDING'))throw new Error('Mission replay failed')

console.log('Cyborg supervisor adversarial tests PASSED')
console.log(JSON.stringify({mission:m.missionId,journalEvents:journal.events,authorityDefaultDeny:true,leaseCollisionProtected:true,stagnationEscalated:true,replay:true},null,2))
