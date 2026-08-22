import fs from 'node:fs'
import {spawnSync} from 'node:child_process'

const policy=JSON.parse(fs.readFileSync('docs/ai-governance/CYBORG_PROMPT_ENTRY.json','utf8'))
const prompt=process.argv.slice(2).join(' ').trim()||process.env.CYBORG_USER_PROMPT||''
const mode=(process.env.CYBORG_PROMPT_MODE||policy.defaultMode||'auto').toLowerCase()
const runLoop=process.env.CYBORG_RUN_LOOP!=='false'
if(!prompt)throw new Error('Prompt required')
if(!['auto','repo','passthrough'].includes(mode))throw new Error(`Unsupported CYBORG_PROMPT_MODE ${mode}`)

function norm(v){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
function hasAny(text,items){return items.some(x=>text.includes(norm(x)))}
function classify(){
  const text=norm(prompt)
  if(mode==='passthrough')return {repositoryTask:false,reason:'explicit passthrough mode'}
  if(mode==='repo')return {repositoryTask:true,reason:'explicit repo mode'}
  const repoSignal=hasAny(text,policy.repositorySignals||[])
  const actionSignal=hasAny(text,(policy.explicitRepositoryActions||[]).map(x=>`${x} `))||
    (policy.explicitRepositoryActions||[]).some(x=>text===norm(x))
  const passSignal=hasAny(text,policy.passThroughSignals||[])
  if(repoSignal&&(actionSignal||/\b(is|are|why|what|how|can|does|ready|status)\b/.test(text)))return {repositoryTask:true,reason:'repository signal + work/question signal'}
  if(repoSignal&&!passSignal)return {repositoryTask:true,reason:'repository signal'}
  return {repositoryTask:false,reason:passSignal?'clear non-repository signal':'no repository signal'}
}
function run(script,args,env=process.env){
  const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env})
  if(r.status!==0)throw new Error(r.stderr||r.stdout||`${script} failed`)
  return JSON.parse(r.stdout)
}

const decision=classify()
if(!decision.repositoryTask){
  console.log(JSON.stringify({action:'PASS_THROUGH',prompt,mode,reason:decision.reason},null,2))
  process.exit(0)
}

const mission=run('scripts/cyborg-supervisor.mjs',['compile',prompt])
const result={action:'CYBORG_MISSION_STARTED',prompt,mode,reason:decision.reason,missionId:mission.missionId,missionType:mission.missionType,state:mission.state,loopStarted:false}
if(runLoop){
  if(!process.env.CYBORG_AGENT_ADAPTER){
    result.action='CYBORG_MISSION_READY'
    result.next=run('scripts/cyborg-supervisor.mjs',['next',mission.missionId]).next
    result.reason+='; governed adapter required to execute terminal loop'
  }else{
    const loop=spawnSync(process.execPath,['scripts/cyborg-loop.mjs',mission.missionId],{encoding:'utf8',env:process.env})
    result.loopStarted=true
    result.loopExitCode=loop.status
    try{result.terminal=JSON.parse(loop.stdout)}catch{result.terminal={stdout:loop.stdout,stderr:loop.stderr}}
    if(![0,2].includes(loop.status))throw new Error(loop.stderr||loop.stdout||'Cyborg terminal loop failed')
    result.action=loop.status===0?'CYBORG_COMPLETE':'CYBORG_BLOCKED'
  }
}
console.log(JSON.stringify(result,null,2))
