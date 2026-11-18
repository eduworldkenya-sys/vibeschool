import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'cyborg-prompt-entry-'))
const baseEnv={...process.env,CYBORG_ROOT:root,CYBORG_BASE_SHA:'base-prompt',CYBORG_HEAD_SHA:'head-prompt',CYBORG_RUN_LOOP:'false'}
function run(prompt,extra={},ok=true){
  const r=spawnSync(process.execPath,['scripts/cyborg-prompt-entry.mjs',prompt],{encoding:'utf8',env:{...baseEnv,...extra}})
  if(ok&&r.status!==0)throw new Error(r.stderr||r.stdout)
  if(!ok&&r.status===0)throw new Error(`Expected failure for ${prompt}`)
  return r
}
function json(r){return JSON.parse(r.stdout)}

let out=json(run('Is signup ready?'))
if(out.action!=='CYBORG_MISSION_STARTED')throw new Error('Signup readiness prompt was not promoted into Cyborg')
if(out.missionType!=='READINESS')throw new Error(`Expected READINESS, got ${out.missionType}`)
if(!out.missionId)throw new Error('Mission id missing')

out=json(run('Fix the worker engine CI failure'))
if(out.action!=='CYBORG_MISSION_STARTED')throw new Error('Engineering repair prompt was not promoted')
if(!['WORKER_ENGINE','IMPLEMENTATION'].includes(out.missionType))throw new Error(`Unexpected mission type ${out.missionType}`)

out=json(run('What is the weather in Nairobi?'))
if(out.action!=='PASS_THROUGH')throw new Error('Clearly unrelated prompt should pass through')

out=json(run('Explain this architecture to me',{CYBORG_PROMPT_MODE:'repo'}))
if(out.action!=='CYBORG_MISSION_STARTED')throw new Error('Repo mode must fail toward mission compilation')

out=json(run('Is signup ready?',{CYBORG_PROMPT_MODE:'passthrough'}))
if(out.action!=='PASS_THROUGH')throw new Error('Explicit passthrough mode ignored')

// Without a locally configured adapter, a connector host continues the same
// durable mission through the existing supervisor. It cannot self-certify.
out=json(run('Build a VibeSchool classroom',{CYBORG_RUN_LOOP:'true',CYBORG_AGENT_ADAPTER:''}))
if(out.action!=='CYBORG_MISSION_READY'||out.executionMode!=='host-supervisor'||!out.requiresHostContinuation||out.loopStarted)throw new Error('Missing adapter must select host-supervisor continuation')
if(out.supervisor.missionId!==out.missionId||out.supervisor.nextArgs.join(' ')!=='next '+out.missionId||!out.next)throw new Error('Host continuation must retain canonical mission and next directive')
const host=(args)=>spawnSync(process.execPath,['scripts/cyborg-supervisor.mjs',...args],{encoding:'utf8',env:baseEnv})
const next=host(out.supervisor.nextArgs)
if(next.status!==0||JSON.parse(next.stdout).next.type!==out.next.type)throw new Error('Host cannot resume the same mission')
const premature=host(['complete',out.missionId])
if(premature.status===0)throw new Error('Host-supervisor mode must not bypass completion gates')
const missions=fs.readdirSync(path.join(root,'missions')).filter(x=>x.endsWith('.json'))
if(missions.length<3)throw new Error('Expected durable missions to be written')
fs.rmSync(root,{recursive:true,force:true})
console.log('Cyborg prompt-entry tests PASSED')
