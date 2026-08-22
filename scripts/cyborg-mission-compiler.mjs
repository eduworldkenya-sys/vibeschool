import fs from 'node:fs'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'

const root=process.env.CYBORG_ROOT||'.cyborg'
const templates=JSON.parse(fs.readFileSync('docs/ai-governance/CYBORG_MISSION_TEMPLATES.json','utf8'))
const kernel=JSON.parse(fs.readFileSync('docs/ai-governance/CYBORG_AGENT_KERNEL.json','utf8'))
const intent=process.argv[2]||process.env.CYBORG_MISSION
const requestedType=process.argv[3]
if(!intent)throw new Error('Mission intent required')
const r=spawnSync(process.execPath,['scripts/cyborg-supervisor.mjs','compile',intent,...(requestedType?[requestedType]:[])],{encoding:'utf8',env:process.env})
if(r.status!==0)throw new Error(r.stderr||r.stdout)
const mission=JSON.parse(r.stdout)
const ids=templates.templates?.[mission.missionType]
if(!Array.isArray(ids)||!ids.length)throw new Error(`No executable mission template for ${mission.missionType}`)
const grade=x=>x.includes('production')||x.includes('runtime')||x.includes('deployment')?'E7':x.includes('independent')?'E6':x.includes('exact_head_ci')||x.includes('required_checks')?'E5':x.includes('security')||x.includes('authorization')||x.includes('tenant')||x.includes('negative')||x.includes('threat')?'E4':x.includes('integration')||x.includes('journey')?'E3':'E1'
mission.requirements=ids.map((x,i)=>({id:`R${String(i+1).padStart(2,'0')}-${x}`,description:x.replaceAll('_',' '),mandatory:true,state:'UNKNOWN',minimumEvidenceGrade:grade(x),evidenceIds:[],dependencies:(templates.dependencyRules?.[x]||[]).map(dep=>ids.includes(dep)?`R${String(ids.indexOf(dep)+1).padStart(2,'0')}-${dep}`:dep),negativePaths:[]}))
mission.templateVersion=templates.version
mission.templateId=mission.missionType
mission.updatedAt=new Date().toISOString()
const missionPath=`${root}/missions/${mission.missionId}.json`
fs.writeFileSync(missionPath,JSON.stringify(mission,null,2)+'\n')
const journalPath=`${root}/journal/${mission.missionId}.ndjson`
let prevHash='GENESIS'
if(fs.existsSync(journalPath)){const lines=fs.readFileSync(journalPath,'utf8').trim().split('\n').filter(Boolean);if(lines.length)prevHash=JSON.parse(lines.at(-1)).eventHash}
const core={timestamp:new Date().toISOString(),missionId:mission.missionId,runId:mission.runId,state:mission.state,actor:process.env.CYBORG_ACTOR||'cyborg-mission-compiler',action:'MISSION_TEMPLATE_APPLIED',result:'PASS',headSha:mission.headSha,prevHash,templateId:mission.templateId,templateVersion:mission.templateVersion,requirementCount:mission.requirements.length}
const eventHash=crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')
fs.appendFileSync(journalPath,JSON.stringify({...core,eventHash})+'\n')
mission.lastJournalHash=eventHash
fs.writeFileSync(missionPath,JSON.stringify(mission,null,2)+'\n')
console.log(JSON.stringify(mission,null,2))
