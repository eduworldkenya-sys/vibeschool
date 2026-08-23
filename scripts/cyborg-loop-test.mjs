import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'cyborg-loop-'))
const env={...process.env,CYBORG_ROOT:root,CYBORG_BASE_SHA:'base-loop',CYBORG_HEAD_SHA:'head-loop',CYBORG_AGENT_ADAPTER:`${process.execPath} scripts/cyborg-loop-test-adapter.mjs`,CYBORG_MAX_ITERATIONS:'100'}
function run(script,args,customEnv=env,expectSuccess=true){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:customEnv});if(expectSuccess&&r.status!==0)throw new Error(`${script} failed\n${r.stderr}\n${r.stdout}`);return r}
const mission=JSON.parse(run('scripts/cyborg-mission-compiler.mjs',['Is signup ready?','READINESS']).stdout)
const loop=JSON.parse(run('scripts/cyborg-loop.mjs',[mission.missionId]).stdout)
if(loop.state!=='COMPLETE')throw new Error('Autonomous loop did not complete')
const state=JSON.parse(run('scripts/cyborg-supervisor.mjs',['status',mission.missionId]).stdout)
if(state.state!=='COMPLETE'||state.requirements.some(r=>r.mandatory&&!['PASS','NOT_APPLICABLE'].includes(r.state))||state.selectedSkills.some(s=>s.required&&s.result!=='PASS')||!state.learningClosure)throw new Error('Completed mission violates completion contract')
const journal=JSON.parse(run('scripts/cyborg-supervisor.mjs',['journal-verify',mission.missionId]).stdout)
if(!journal.valid)throw new Error('Loop mission journal invalid')

const failRoot=fs.mkdtempSync(path.join(os.tmpdir(),'cyborg-loop-fail-'))
const failEnv={...process.env,CYBORG_ROOT:failRoot,CYBORG_BASE_SHA:'base-loop-fail',CYBORG_HEAD_SHA:'head-loop-fail',CYBORG_AGENT_ADAPTER:`${process.execPath} scripts/cyborg-loop-failure-test-adapter.mjs`,CYBORG_MAX_ITERATIONS:'20',CYBORG_MAX_ADAPTER_FAILURES:'2',CYBORG_MAX_WALL_CLOCK_MS:'60000'}
const failingMission=JSON.parse(run('scripts/cyborg-mission-compiler.mjs',['Prove adapter failures stop safely','READINESS'],failEnv).stdout)
const blockedRun=run('scripts/cyborg-loop.mjs',[failingMission.missionId],failEnv,false)
if(blockedRun.status!==2)throw new Error(`Expected Cyborg loop to exit 2 on safety block, got ${blockedRun.status}\n${blockedRun.stderr}\n${blockedRun.stdout}`)
const blocked=JSON.parse(blockedRun.stdout)
if(blocked.state!=='BLOCKED_SAFETY'||!/adapter failure budget exhausted/.test(String(blocked.blocker)))throw new Error('Adapter failure budget did not transition to BLOCKED_SAFETY')
const blockedState=JSON.parse(run('scripts/cyborg-supervisor.mjs',['status',failingMission.missionId],failEnv).stdout)
if(blockedState.state!=='BLOCKED_SAFETY')throw new Error('Supervisor did not persist BLOCKED_SAFETY after loop budget exhaustion')
const blockedJournal=JSON.parse(run('scripts/cyborg-supervisor.mjs',['journal-verify',failingMission.missionId],failEnv).stdout)
if(!blockedJournal.valid)throw new Error('Blocked mission journal invalid')

console.log('Cyborg autonomous loop tests PASSED')
console.log(JSON.stringify({missionId:mission.missionId,iterations:loop.iterations,journalEvents:journal.events,state:state.state,blockedMissionId:failingMission.missionId,blockedState:blockedState.state},null,2))
