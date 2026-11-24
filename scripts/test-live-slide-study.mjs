import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLiveFixture} from './live-classroom-test-fixture.mjs'
import {encodeAssessment,prepareAssessment} from '../components/live-classroom/LiveSlideProtocol.ts'
const {db,rpc,id,teacher,a,b,outsider,otherTeacher,cls,otherCls}=await createLiveFixture()
try{
 await db.exec(readFileSync(new URL('../supabase/migrations/20261125000100_live_slide_study.sql',import.meta.url),'utf8'))
 async function study(who,action,assignment=null,payload={},classId=cls,role='authenticated'){
  await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${who||''}',false)`)
  try{return (await db.query('select public.vibe_live_study_command($1,$2,$3,$4::jsonb) as out',[action,classId,assignment,JSON.stringify(payload)])).rows[0].out}
  finally{await db.exec('reset role')}
 }
 const body=encodeAssessment({kind:'quiz',question:'What is one half?',options:['1/2','1/3']})
 const q={title:'Check',body,notes:'teacher-private'}
 const quiz={...q,notes:prepareAssessment(q,0,'Two equal parts make a whole.')}
 const material=id(90),assignment=id(91)
 await rpc(teacher,'materials_save',null,null,{id:material,title:'Fractions',revision:0,slides:[{title:'Read',body:'A fraction',notes:'private presenter reminder'},quiz]})
 const create={materialId:material,revision:1,mode:'school'}
 await assert.rejects(study(otherTeacher,'create',assignment,create),/live_not_authorized/)
 await assert.rejects(study(a,'create',assignment,create),/live_not_authorized/)
 assert.equal((await study(teacher,'create',assignment,create)).recipientCount,2)
 assert.equal((await study(teacher,'create',assignment,create)).id,assignment)
 let room=await rpc(teacher,'start',null,null,{title:'Fractions Live'},cls)
 const fromRoom=id(92),roomPayload={materialId:material,revision:1,roomId:room.id,mode:'tuition',groupId:id(51)}
 await assert.rejects(study(teacher,'create_from_room',fromRoom,roomPayload),/live_not_authorized/)
 await rpc(teacher,'end',room.id,room.version)
 await assert.rejects(study(otherTeacher,'create_from_room',fromRoom,roomPayload),/live_not_authorized/)
 await assert.rejects(study(teacher,'create_from_room',fromRoom,roomPayload,otherCls),/live_not_authorized/)
 assert.equal((await study(teacher,'create_from_room',fromRoom,roomPayload)).recipientCount,2)
 assert.equal((await study(teacher,'create_from_room',fromRoom,roomPayload)).id,fromRoom)
 assert.equal((await db.query('select source_session_id,mode,class_id,group_id from vibe_live.study_assignments where id=$1',[fromRoom])).rows[0].source_session_id,room.id)
 assert.equal((await db.query('select mode from vibe_live.study_assignments where id=$1',[fromRoom])).rows[0].mode,'school')
 await study(teacher,'revoke',fromRoom)
 assert.deepEqual(await study(outsider,'list',null,{},null),[])
 await assert.rejects(study(outsider,'get',assignment,{},null),/live_not_authorized/)
 const first=await study(a,'get',assignment)
 assert.equal(first.page,0);assert.deepEqual(first.visited,[])
 assert.ok(first.slides.every(s=>!('notes' in s)))
 assert.ok(!JSON.stringify(first).includes('Two equal parts'))
 await assert.rejects(study(a,'advance',assignment,{page:1,complete:true}),/live_study_answer_required/)
 assert.deepEqual((await study(a,'advance',assignment,{page:0,complete:true})).visited,[0])
 assert.equal((await study(a,'get',assignment)).page,1)
 assert.deepEqual((await study(b,'get',assignment)).visited,[])
 await assert.rejects(study(a,'answer',assignment,{page:1,option:5}),/live_invalid_answer/)
 const answered=await study(a,'answer',assignment,{page:1,option:1})
 assert.equal(answered.answers['1'].correct,false)
 assert.equal(answered.answers['1'].correctOption,0)
 assert.equal(answered.answers['1'].explanation,'Two equal parts make a whole.')
 assert.deepEqual((await study(a,'answer',assignment,{page:1,option:0})).answers,answered.answers)
 assert.deepEqual((await study(b,'get',assignment)).answers,{})
 assert.deepEqual((await study(a,'advance',assignment,{page:1,complete:true})).visited,[0,1])
 assert.equal((await study(teacher,'list_owner')).find(x=>x.id===assignment).completedCount,1)
 await rpc(teacher,'materials_save',null,null,{id:material,title:'Changed',revision:1,slides:[{title:'New',body:'Changed'}]})
 assert.equal((await study(a,'get',assignment)).title,'Fractions')
 await db.exec(`update public.student_classes set is_current=false where student_id='${id(30)}'`)
 await assert.rejects(study(a,'get',assignment),/live_not_authorized/)
 await assert.rejects(study(otherTeacher,'revoke',assignment,{},null),/live_not_authorized/)
 await study(teacher,'revoke',assignment)
 await assert.rejects(study(b,'get',assignment),/live_not_authorized/)
 for(const role of ['authenticated','anon','service_role']){
  await db.exec('set role '+role)
  try{for(const table of ['study_assignments','study_recipients'])await assert.rejects(db.query('select * from vibe_live.'+table),/permission denied/)}finally{await db.exec('reset role')}
 }
 await assert.rejects(study(null,'list',null,{},null,'anon'),/permission denied/)
 console.log('PASS: independent assignment snapshots, current membership, durable progress, quiz feedback and negative access paths')
}finally{await db.close()}

await import('./test-live-homework-handoff.mjs')
