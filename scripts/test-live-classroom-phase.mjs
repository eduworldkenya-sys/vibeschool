import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLiveFixture} from './live-classroom-test-fixture.mjs'
const f=await createLiveFixture()
const {db,rpc,teacher,a,b,outsider,cls}=f
try{
 await db.exec(readFileSync(new URL('../supabase/migrations/20261124151000_live_classroom_phase.sql',import.meta.url),'utf8'))
 let room=await rpc(teacher,'start',null,null,{title:'Teaching flow'},cls)
 const sid=room.id
 assert.equal(room.teachingPhase,'teaching')
 await rpc(a,'join',sid);await rpc(b,'join',sid)
 room=await rpc(teacher,'get',sid)
 await assert.rejects(rpc(a,'phase_set',sid,room.version,{phase:'discussion'}),/live_teacher_required/)
 await assert.rejects(rpc(outsider,'phase_set',sid,room.version,{phase:'discussion'}),/live_not_authorized/)
 await assert.rejects(rpc(teacher,'phase_set',sid,room.version,{phase:'invalid'}),/live_invalid_phase/)
 room=await rpc(teacher,'phase_set',sid,room.version,{phase:'discussion'})
 assert.equal(room.teachingPhase,'discussion');assert.equal(room.chatEnabled,true)
 assert.equal((await rpc(a,'get',sid)).teachingPhase,'discussion')
 assert.equal((await rpc(b,'get',sid)).chatEnabled,true)
 await assert.rejects(rpc(teacher,'phase_set',sid,room.version-1,{phase:'activity'}),/live_stale_or_paused/)
 room=await rpc(teacher,'publish',sid,room.version,{kind:'exercise',body:'Find the total',answerKey:'18'})
 assert.equal(room.teachingPhase,'activity');assert.equal(room.chatEnabled,false)
 const question=room.prompt.id
 room=await rpc(teacher,'phase_set',sid,room.version,{phase:'teaching'})
 assert.equal(room.prompt.id,question);assert.equal(room.prompt.revealed,false)
 assert.equal((await rpc(a,'get',sid)).prompt.answerKey,null)
 room=await rpc(teacher,'publish',sid,room.version,{kind:'teach',body:'Review the steps'})
 assert.equal(room.teachingPhase,'teaching')
 room=await rpc(teacher,'pause',sid,room.version)
 await assert.rejects(rpc(teacher,'phase_set',sid,room.version,{phase:'discussion'}),/live_stale_or_paused/)
 room=await rpc(teacher,'resume',sid,room.version)
 room=await rpc(teacher,'end',sid,room.version)
 assert.equal((await rpc(a,'get',sid)).status,'ended')
 await assert.rejects(rpc(teacher,'phase_set',sid,room.version,{phase:'discussion'}),/live_session_closed/)
 console.log('PASS: canonical teaching phases, learner synchronization, authorization, chat closure, stale versions and preserved questions')
}finally{await db.close()}
