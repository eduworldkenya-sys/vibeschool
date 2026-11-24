import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLiveFixture} from './live-classroom-test-fixture.mjs'
const f=await createLiveFixture()
const {db,rpc,teacher,a,b,outsider,otherTeacher,cls,id}=f
try{
 for(const name of ['20261124150000_live_workbook.sql','20261124151000_live_classroom_phase.sql','20261124152000_live_stage_ink.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
 let room=await rpc(teacher,'start',null,null,{title:'Annotate together'},cls)
 const sid=room.id
 await rpc(a,'join',sid);await rpc(b,'join',sid)
 room=await rpc(teacher,'get',sid)
 room=await rpc(teacher,'publish',sid,room.version,{kind:'teach',body:'Circle the denominator'})
 const promptId=room.prompt.id
 const read=who=>rpc(who,'ink_get',sid,null,{promptId})
 const write=(who,action,payload)=>rpc(who,action,sid,null,{promptId,...payload})
 const teacherInk=[{color:'#1865c0',width:4,points:[[100,100],[300,300]]}]
 const learnerInk=[...teacherInk,{color:'#bf3038',width:2,points:[[500,600],[650,600]]}]
 assert.deepEqual((await read(a)).ink,[])
 await assert.rejects(read(outsider),/live_not_authorized/)
 await assert.rejects(read(otherTeacher),/live_not_authorized/)
 await assert.rejects(write(a,'ink_save',{revision:0,ink:teacherInk}),/live_not_authorized/)
 await assert.rejects(write(teacher,'ink_save',{revision:0,ink:[{color:'url(javascript:x)',width:4,points:[[100,100]]}]}),/live_invalid_ink/)
 await assert.rejects(write(teacher,'ink_save',{revision:0,ink:[{color:'#1865c0',width:4,points:[[100,1001]]}]}),/live_invalid_ink/)
 let s=await write(teacher,'ink_save',{revision:0,ink:teacherInk})
 assert.equal(s.revision,1);assert.deepEqual((await read(a)).ink,teacherInk)
 await assert.rejects(write(teacher,'ink_save',{revision:0,ink:[]}),/live_ink_conflict/)
 await assert.rejects(write(teacher,'ink_grant',{revision:1,studentId:id(32)}),/live_not_authorized/)
 await write(teacher,'ink_grant',{revision:1,studentId:id(30)})
 assert.equal((await read(a)).canContribute,true)
 assert.equal((await read(b)).canContribute,false)
 assert.equal((await read(b)).grantee,null)
 await assert.rejects(write(b,'ink_offer',{revision:2,ink:learnerInk}),/live_not_authorized/)
 await write(a,'ink_offer',{revision:2,ink:learnerInk})
 assert.deepEqual((await read(b)).ink,teacherInk)
 assert.equal((await read(b)).proposal,null)
 assert.equal((await read(a)).pending,true)
 assert.deepEqual((await read(teacher)).proposal,learnerInk)
 await assert.rejects(write(a,'ink_publish',{revision:3}),/live_not_authorized/)
 await write(teacher,'ink_publish',{revision:3})
 assert.deepEqual((await read(b)).ink,learnerInk)
 assert.equal((await read(a)).canContribute,false)
 room=await rpc(teacher,'get',sid)
 room=await rpc(teacher,'publish',sid,room.version,{kind:'teach',body:'Another page'})
 await assert.rejects(write(teacher,'ink_save',{revision:4,ink:[]}),/live_ink_not_open/)
 assert.deepEqual((await read(a)).ink,learnerInk)
 await rpc(teacher,'end',sid,room.version)
 assert.deepEqual((await read(b)).ink,learnerInk)
 await assert.rejects(write(teacher,'ink_grant',{revision:4,studentId:id(30)}),/live_session_closed/)
 for(const role of ['anon','authenticated','service_role']){
  await db.exec('set role '+role)
  try{await assert.rejects(db.query('select * from vibe_live.stage_ink'),/permission denied/)}finally{await db.exec('reset role')}
 }
 assert.ok((await db.query('select payload from realtime.messages')).rows.every(row=>JSON.stringify(row.payload)==='{"invalidate":true}'))
 console.log('PASS: private proposal, host moderation, scoped drawing permissions, input validation, revision conflicts and after-class annotations')
}finally{await db.close()}
