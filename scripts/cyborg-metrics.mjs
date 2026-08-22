import fs from 'node:fs'

const root=process.env.CYBORG_ROOT||'.cyborg'
const missionsDir=`${root}/missions`, journalDir=`${root}/journal`
const metrics={missionsStarted:0,missionsComplete:0,blocked:{},repairAttempts:0,stagnationEvents:0,evidenceInvalidations:0,scopeCollisionsPrevented:0,capabilityGrants:0,memoryUpdates:0,completionDenialsObserved:0,journalEvents:0}
if(fs.existsSync(missionsDir))for(const f of fs.readdirSync(missionsDir).filter(x=>x.endsWith('.json'))){const m=JSON.parse(fs.readFileSync(`${missionsDir}/${f}`,'utf8'));metrics.missionsStarted++;if(m.state==='COMPLETE')metrics.missionsComplete++;if(String(m.state).startsWith('BLOCKED_'))metrics.blocked[m.state]=(metrics.blocked[m.state]||0)+1}
if(fs.existsSync(journalDir))for(const f of fs.readdirSync(journalDir).filter(x=>x.endsWith('.ndjson'))){for(const line of fs.readFileSync(`${journalDir}/${f}`,'utf8').split('\n').filter(Boolean)){metrics.journalEvents++;const e=JSON.parse(line);if(e.action==='REPAIR_ATTEMPT')metrics.repairAttempts++;if(e.result==='STAGNATION_DETECTED')metrics.stagnationEvents++;if(e.action==='EVIDENCE_INVALIDATED')metrics.evidenceInvalidations++;if(e.action==='CAPABILITY_GRANTED')metrics.capabilityGrants++;if(e.action==='MEMORY_UPDATED')metrics.memoryUpdates++}}
console.log(JSON.stringify(metrics,null,2))
