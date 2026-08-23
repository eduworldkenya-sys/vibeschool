import {spawnSync} from 'node:child_process'

const missionId=process.argv[2]
const adapter=process.env.CYBORG_AGENT_ADAPTER
const stagnationCode='CYBORG_LOOP_STAGNATION'
const maxIterations=boundedNumber('CYBORG_MAX_ITERATIONS',30,1,100)
const maxSameDirectiveRepeats=boundedNumber('CYBORG_MAX_SAME_DIRECTIVE_REPEATS',3,1,20)
const maxAdapterFailures=boundedNumber('CYBORG_MAX_ADAPTER_FAILURES',5,1,50)
const maxNoProgress=boundedNumber('CYBORG_MAX_NO_PROGRESS',5,1,50)
const maxWallClockMs=boundedNumber('CYBORG_MAX_WALL_CLOCK_MS',15*60*1000,1000,60*60*1000)
if(!missionId)throw new Error('Mission id required')
if(!adapter)throw new Error('CYBORG_AGENT_ADAPTER is required; the model/tool host must provide a governed adapter')
function boundedNumber(name,fallback,min,max){const raw=Number(process.env[name]??fallback);if(!Number.isFinite(raw))throw new Error(`${name} must be numeric`);return Math.max(min,Math.min(max,Math.trunc(raw)))}
function supervisor(args,ok=true){const r=spawnSync(process.execPath,['scripts/cyborg-supervisor.mjs',...args],{encoding:'utf8',env:process.env});if(ok&&r.status!==0)throw new Error(r.stderr||r.stdout);return r}
function parse(r){return JSON.parse(r.stdout)}
function blockSafety(reason,iterations){supervisor(['block',missionId,'BLOCKED_SAFETY',reason]);console.log(JSON.stringify({missionId,state:'BLOCKED_SAFETY',blocker:reason,iterations},null,2));process.exit(2)}
const startedAt=Date.now()
let previousFingerprint=null,repeats=0,adapterFailures=0,noProgress=0
for(let iteration=1;iteration<=maxIterations;iteration++){
  if(Date.now()-startedAt>=maxWallClockMs)blockSafety(`Cyborg wall-clock budget exhausted after ${maxWallClockMs}ms`,iteration-1)
  const state=parse(supervisor(['status',missionId]))
  if(state.state==='COMPLETE'){console.log(JSON.stringify({missionId,state:'COMPLETE',iterations:iteration-1},null,2));process.exit(0)}
  if(String(state.state).startsWith('BLOCKED_')){console.log(JSON.stringify({missionId,state:state.state,blocker:state.blocker,iterations:iteration-1},null,2));process.exit(2)}
  const directive=parse(supervisor(['next',missionId]))
  const fingerprint=JSON.stringify(directive.next)
  repeats=fingerprint===previousFingerprint?repeats+1:0
  previousFingerprint=fingerprint
  if(repeats>=maxSameDirectiveRepeats){
    supervisor(['attempt',missionId,`loop:${Buffer.from(fingerprint).toString('base64url').slice(0,80)}`])
    blockSafety(`${stagnationCode}: identical directive repeated ${repeats+1} times`,iteration-1)
  }
  const env={...process.env,CYBORG_MISSION_ID:missionId,CYBORG_ITERATION:String(iteration),CYBORG_DIRECTIVE_JSON:JSON.stringify(directive.next),CYBORG_STATE_JSON:JSON.stringify(state)}
  const runner=spawnSync(adapter,[],{encoding:'utf8',env,shell:true})
  if(runner.status!==0){
    adapterFailures++
    supervisor(['attempt',missionId,`adapter:${runner.status}:${(runner.stderr||runner.stdout||'failure').slice(0,120)}`])
    if(adapterFailures>=maxAdapterFailures)blockSafety(`Cyborg adapter failure budget exhausted after ${adapterFailures} failures`,iteration)
    continue
  }
  const after=parse(supervisor(['status',missionId]))
  if(after.updatedAt===state.updatedAt&&after.state===state.state){
    noProgress++
    supervisor(['attempt',missionId,`no-progress:${fingerprint}`])
    if(noProgress>=maxNoProgress)blockSafety(`${stagnationCode}: no-progress budget exhausted after ${noProgress} successful adapter runs without state change`,iteration)
  }else{
    noProgress=0
  }
}
blockSafety(`${stagnationCode}: mission ${missionId} exhausted iteration budget after ${maxIterations} iterations`,maxIterations)
