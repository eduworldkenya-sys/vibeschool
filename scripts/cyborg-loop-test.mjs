import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'cyborg-loop-'))
const env={...process.env,CYBORG_ROOT:root,CYBORG_BASE_SHA:'base-loop',CYBORG_HEAD_SHA:'head-loop',CYBORG_AGENT_ADAPTER:`${process.execPath} scripts/cyborg-loop-test-adapter.mjs`,CYBORG_MAX_ITERATIONS:'100'}
function run(script,args){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env});if(r.status!==0)throw new Error(`${script} failed\n${r.stderr}\n${r.stdout}`);return r}
const mission=JSON.parse(run('scripts/cyborg-mission-compiler.mjs',['Is signup ready?','READINESS']).stdout)
const loop=JSON.parse(run('scripts/cyborg-loop.mjs',[mission.missionId]).stdout)
if(loop.state!=='COMPLETE')throw new Error('Autonomous loop did not complete')
const state=JSON.parse(run('scripts/cyborg-supervisor.mjs',['status',mission.missionId]).stdout)
if(state.state!=='COMPLETE'||state.requirements.some(r=>r.mandatory&&!['PASS','NOT_APPLICABLE'].includes(r.state))||state.selectedSkills.some(s=>s.required&&s.result!=='PASS')||!state.learningClosure)throw new Error('Completed mission violates completion contract')
const journal=JSON.parse(run('scripts/cyborg-supervisor.mjs',['journal-verify',mission.missionId]).stdout)
if(!journal.valid)throw new Error('Loop mission journal invalid')
console.log('Cyborg autonomous loop tests PASSED')
console.log(JSON.stringify({missionId:mission.missionId,iterations:loop.iterations,journalEvents:journal.events,state:state.state},null,2))
