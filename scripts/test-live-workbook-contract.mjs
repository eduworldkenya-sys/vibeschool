import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLiveFixture} from './live-classroom-test-fixture.mjs'
const f=await createLiveFixture()
const {db,rpc,teacher,a,b,outsider,otherTeacher,cls,id}=f
try{
 await db.exec(readFileSync(new URL('../supabase/migrations/20261127152007_20261124150000_live_workbook.sql',import.meta.url),'utf8'))
 let room=await rpc(teacher,'start',null,null,{title:'Workbook test'},cls)
 const sid=room.id
 await assert.rejects(rpc(a,'workbook_list',sid,null,{promptId:id(888)}),/live_join_required/)
 await rpc(a,'join',sid);await rpc(b,'join',sid)
 room=await rpc(teacher,'get',sid)
 room=await rpc(teacher,'publish',sid,room.version,{kind:'exercise',body:'Show your working',answerKey:'18'})
 const promptId=room.prompt.id
 const list=who=>rpc(who,'workbook_list',sid,null,{promptId})
 const write=(who,action,payload)=>rpc(who,action,sid,null,{promptId,...payload})
 const saved=await write(a,'workbook_save',{revision:0,body:'24 / 4 = 6',drawing:''})
 assert.equal(saved.revision,1);assert.equal(saved.status,'draft')
 assert.equal((await list(a)).entries[0].body,'24 / 4 = 6')
 assert.deepEqual((await list(teacher)).entries,[])
 assert.deepEqual((await list(b)).entries,[])
 await assert.rejects(list(outsider),/live_not_authorized/)
 await assert.rejects(list(otherTeacher),/live_not_authorized/)
 await assert.rejects(write(a,'workbook_save',{revision:0,body:'stale'}),/live_workbook_conflict/)
 await assert.rejects(write(a,'workbook_save',{revision:1,body:'x',drawing:'<script>'}),/live_invalid_workbook_content/)
 const submitted=await write(a,'workbook_submit',{revision:1,body:'24 / 4 = 6',drawing:''})
 assert.equal(submitted.status,'submitted')
 const studentId=submitted.studentId
 assert.equal((await list(teacher)).entries[0].studentId,studentId)
 assert.deepEqual((await list(b)).entries,[])
 await assert.rejects(write(b,'workbook_accept',{studentId,revision:2,feedback:'fake'}),/live_not_authorized/)
 await assert.rejects(write(a,'workbook_save',{revision:2,body:'replace submitted'}),/live_workbook_not_editable/)
 const returned=await write(teacher,'workbook_return',{studentId,revision:2,feedback:'Multiply by 3.'})
 assert.equal(returned.status,'returned')
 assert.equal((await list(a)).entries[0].feedback,'Multiply by 3.')
 assert.deepEqual((await list(b)).entries,[])
 const corrected=await write(a,'workbook_submit',{revision:3,body:'24 / 4 x 3 = 18',drawing:''})
 assert.equal(corrected.status,'submitted')
 room=await rpc(teacher,'get',sid);await rpc(teacher,'end',sid,room.version)
 await assert.rejects(write(teacher,'workbook_return',{studentId,revision:4,feedback:'again'}),/live_workbook_not_open/)
 const reviewed=await write(teacher,'workbook_accept',{studentId,revision:4,feedback:'Correct.'})
 assert.equal(reviewed.status,'accepted')
 assert.equal((await list(a)).entries[0].feedback,'Correct.')
 await assert.rejects(write(a,'workbook_submit',{revision:5,body:'after end'}),/live_session_closed/)
 await db.exec('set role authenticated')
 try{await assert.rejects(db.query('select * from vibe_live.workbook_entries'),/permission denied/)}finally{await db.exec('reset role')}
 console.log('PASS: workbook persistence, isolation, revisions, submission, corrections, after-class feedback and direct table denial')
}finally{await db.close()}
