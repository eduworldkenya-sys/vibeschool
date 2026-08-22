import {spawnSync} from 'node:child_process'

const missionId=process.env.CYBORG_MISSION_ID
const directive=JSON.parse(process.env.CYBORG_DIRECTIVE_JSON||'null')
if(!missionId||!directive)throw new Error('Loop adapter context missing')
function run(args){const r=spawnSync(process.execPath,['scripts/cyborg-supervisor.mjs',...args],{encoding:'utf8',env:process.env});if(r.status!==0)throw new Error(r.stderr||r.stdout);return r}
if(directive.type==='INVESTIGATE_REQUIREMENT'||directive.type==='REPAIR'){
  const r=directive.requirement
  run(['evidence',missionId,JSON.stringify({requirementId:r.id,kind:r.id,result:'PASS',grade:r.minimumEvidenceGrade,source:'cyborg-loop-test-adapter',producer:'independent-test-adapter',provenance:{test:'cyborg-loop-test'}})])
}else if(directive.type==='RUN_REQUIRED_SKILL'||directive.type==='REPAIR_SKILL'){
  run(['skill',missionId,directive.skill.id,'PASS','loop adapter executable proof'])
}else if(directive.type==='LEARNING_CLOSURE'){
  run(['learning-close',missionId])
}else if(directive.type==='COMPLETION_GATE'){
  run(['complete',missionId])
}else if(directive.type==='RESOLVE_CONTRADICTION'){
  run(['resolve-contradiction',missionId,directive.id,JSON.stringify({authoritativeSource:'loop-test-fresh-proof',reason:'test adapter resolved contradiction with current proof'})])
}else{
  throw new Error(`Unsupported loop directive ${directive.type}`)
}
console.log(JSON.stringify({handled:directive.type}))
