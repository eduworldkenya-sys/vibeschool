import fs from 'node:fs'

const root=process.env.CYBORG_ROOT||'.cyborg'
const policies=JSON.parse(fs.readFileSync('docs/ai-governance/CYBORG_ACTION_POLICIES.json','utf8'))
const action=JSON.parse(process.argv[2]||'{}')
if(!action.missionId||!action.type)throw new Error('Action needs missionId and type')
const policy=policies.actions[action.type]
if(!policy)throw new Error(`Unknown governed action ${action.type}`)
const missionPath=`${root}/missions/${action.missionId}.json`
if(!fs.existsSync(missionPath))throw new Error('Mission state missing')
const mission=JSON.parse(fs.readFileSync(missionPath,'utf8'))
if(!mission.capabilities?.includes(policy.capability))throw new Error(`CAPABILITY_DENIED: ${policy.capability}`)
const supplied=new Set(action.evidence||[])
const missing=(policy.requiredEvidence||[]).filter(x=>!supplied.has(x))
if(missing.length)throw new Error(`ACTION_GATE_DENIED: missing evidence ${missing.join(',')}`)
if(policy.ownerAuthorizationRequired&&process.env.CYBORG_OWNER_AUTHORIZED!=='true')throw new Error('BLOCKED_OWNER: explicit owner authorization required')
if(policy.plaintextSecretInModelContextForbidden&&action.plaintextSecret===true)throw new Error('ACTION_GATE_DENIED: plaintext secret exposure forbidden')
if(action.mutates===true){const leasesPath=`${root}/leases.json`;const leases=fs.existsSync(leasesPath)?JSON.parse(fs.readFileSync(leasesPath,'utf8')):[];if(!leases.some(x=>x.missionId===mission.missionId&&!x.releasedAt))throw new Error('ACTION_GATE_DENIED: mutation scope lease missing')}
console.log(JSON.stringify({allowed:true,missionId:mission.missionId,type:action.type,capability:policy.capability,evidence:[...supplied]},null,2))
