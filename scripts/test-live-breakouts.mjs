import {createLiveFixture} from './live-classroom-test-fixture.mjs'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const f=await createLiveFixture()
try{
 await f.db.exec(readFileSync(new URL('../supabase/migrations/20261125000200_live_breakout_discussions.sql',import.meta.url),'utf8'))
 for(const [profile,student,name] of [[9,35,'Learner C'],[11,36,'Learner D']]){
  await f.db.query('insert into public.profiles(id,account_status) values ($1,$2)',[f.id(profile),'active'])
  await f.db.query('insert into public.students(id,profile_id,name) values ($1,$2,$3)',[f.id(student),f.id(profile),name])
  await f.db.query('insert into public.student_classes values ($1,$2,$3,true)',[f.id(student),f.cls,f.school])
 }
 const c=f.id(9),d=f.id(11)
 const room=await f.rpc(f.teacher,'start',null,null,{title:'Group work'})
 const sid=room.id
 for(const who of [f.a,f.b,c,d])await f.rpc(who,'join',sid)
 const call=(who,action,payload={})=>f.rpc(who,action,sid,null,payload)
 const one={title:'Group A',members:[f.id(30),f.id(31)],requestId:f.id(100)}
 const two={title:'Group B',members:[f.id(35),f.id(36)],requestId:f.id(101)}
 assert.equal((await call(f.teacher,'breakout_list')).roster.length,4)
 await assert.rejects(call(f.a,'breakout_create',one),/live_teacher_required/)
 await assert.rejects(call(f.teacher,'breakout_create',{...one,members:[f.id(30),f.id(32)]}),/live_invalid_breakout_members/)
 await assert.rejects(call(f.teacher,'breakout_create',{...one,members:[f.id(30),f.id(30)]}),/live_invalid_breakout_members/)
 const g1=(await call(f.teacher,'breakout_create',one)).id
 assert.equal((await call(f.teacher,'breakout_create',one)).id,g1)
 await assert.rejects(call(f.teacher,'breakout_create',{...one,requestId:f.id(102)}),/live_breakout_member_busy/)
 const g2=(await call(f.teacher,'breakout_create',two)).id
 assert.deepEqual((await call(f.a,'breakout_list')).groups.map(g=>g.id),[g1])
 assert.deepEqual((await call(c,'breakout_list')).groups.map(g=>g.id),[g2])
 assert.deepEqual((await call(f.a,'breakout_list')).roster,[])
 assert.deepEqual((await call(f.a,'breakout_list')).groups[0].members,[])
 for(const who of [c,d,f.outsider,f.otherTeacher])await assert.rejects(call(who,'breakout_read',{groupId:g1}),/live_not_authorized/)
 const send={groupId:g1,body:'Our group solution',requestId:f.id(103)}
 await call(f.a,'breakout_send',send)
 await call(f.a,'breakout_send',send)
 await assert.rejects(call(f.a,'breakout_send',{...send,body:'Different'}),/live_request_id_reused/)
 await assert.rejects(call(f.a,'breakout_send',{...send,requestId:f.id(104)}),/live_chat_rate_limit/)
 const thread=await call(f.b,'breakout_read',{groupId:g1})
 assert.equal(thread.messages.length,1)
 assert.equal(thread.messages[0].body,send.body)
 const mid=thread.messages[0].id
 assert.equal((await call(c,'breakout_read',{groupId:g2})).messages.length,0)
 await assert.rejects(call(c,'breakout_report',{groupId:g2,messageId:mid}),/live_not_authorized/)
 await assert.rejects(call(f.a,'breakout_report',{groupId:g1,messageId:mid}),/live_not_authorized/)
 await call(f.b,'breakout_report',{groupId:g1,messageId:mid})
 assert.equal((await call(f.teacher,'breakout_read',{groupId:g1})).messages[0].reported,true)
 await assert.rejects(call(f.b,'breakout_hide',{groupId:g1,messageId:mid}),/live_teacher_required/)
 await call(f.teacher,'breakout_hide',{groupId:g1,messageId:mid})
 assert.equal((await call(f.b,'breakout_read',{groupId:g1})).messages.length,0)
 assert.equal((await call(f.teacher,'breakout_read',{groupId:g1})).messages[0].hidden,true)
 await f.db.query('delete from public.student_classes where student_id=$1',[f.id(30)])
 await assert.rejects(call(f.a,'breakout_read',{groupId:g1}),/live_not_authorized/)
 await call(f.teacher,'breakout_close',{groupId:g1})
 assert.equal((await call(f.b,'breakout_list')).groups.length,0)
 await assert.rejects(call(f.b,'breakout_send',{...send,requestId:f.id(105)}),/live_not_authorized/)
 const beforeEnd=await call(f.teacher,'get')
 await f.rpc(f.teacher,'end',sid,beforeEnd.version)
 await assert.rejects(call(c,'breakout_list'),/live_session_closed/)
 for(const role of ['authenticated','anon','service_role']){
  await f.db.exec('set role '+role)
  try{for(const table of ['breakout_groups','breakout_messages'])await assert.rejects(f.db.query('select * from vibe_live.'+table),/permission denied/)}
  finally{await f.db.exec('reset role')}
 }
 console.log('PASS: breakout assignment, idempotence, cross-group isolation, teacher moderation, entitlement revocation, close/end and direct-table denial')
}finally{await f.db.close()}
