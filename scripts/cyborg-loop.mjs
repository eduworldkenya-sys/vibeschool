import {spawnSync} from 'node:child_process'

const missionId=process.argv[2]
const adapter=process.env.CYBORG_AGENT_ADAPTER
const maxIterations=Number(process.env.CYBORG_MAX_ITERATIONS||100)
if(!missionId)throw new Error('Mission id required')
if(!adapter)throw new Error('CYBORG_AGENT_ADAPTER is required; the model/tool host must provide a governed adapter')
function supervisor(args,ok=true){const r=spawnSync(process.execPath,['scripts/cyborg-supervisor.mjs',...args],{encoding:'utf8',env:process.env});if(ok&&r.status!==0)throw new Error(r.stderr||r.stdout);return r}
function parse(r){return JSON.parse(r.stdout)}
let previousFingerprint=null,repeats=0
for(let iteration=1;iteration<=maxIterations;iteration++){
  const state=parse(supervisor(['status',missionId]))
  if(state.state==='COMPLETE'){console.log(JSON.stringify({missionId,state:'COMPLETE',iterations:iteration-1},null,2));process.exit(0)}
  if(String(state.state).startsWith('BLOCKED_')){console.log(JSON.stringify({missionId,state:state.state,blocker:state.blocker,iterations:iteration-1},null,2));process.exit(2)}
  const directive=parse(supervisor(['next',missionId]))
  const fingerprint=JSON.stringify(directive.next)
  repeats=fingerprint===previousFingerprint?repeats+1:0
  previousFingerprint=fingerprint
  if(repeats>=3)supervisor(['attempt',missionId,`loop:${Buffer.from(fingerprint).toString('base64url').slice(0,80)}`])
  const env={...process.env,CYBORG_MISSION_ID:missionId,CYBORG_ITERATION:String(iteration),CYBORG_DIRECTIVE_JSON:JSON.stringify(directive.next),CYBORG_STATE_JSON:JSON.stringify(state)}
  const runner=spawnSync(adapter,[],{encoding:'utf8',env,shell:true})
  if(runner.status!==0){supervisor(['attempt',missionId,`adapter:${runner.status}:${(runner.stderr||runner.stdout||'failure').slice(0,120)}`]);if(iteration===maxIterations)throw new Error('Cyborg adapter failed until iteration budget exhausted');continue}
  const after=parse(supervisor(['status',missionId]))
  if(after.updatedAt===state.updatedAt&&after.state===state.state){supervisor(['attempt',missionId,`no-progress:${fingerprint}`])}
}
throw new Error(`CYBORG_LOOP_STAGNATION: mission ${missionId} exceeded ${maxIterations} iterations without terminal state`)
