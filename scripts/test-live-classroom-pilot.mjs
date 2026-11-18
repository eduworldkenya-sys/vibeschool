// Install the pinned test-only engine outside the repo: npm install --prefix /tmp/live-test --no-audit --no-fund @electric-sql/pglite@0.3.14
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.env.LIVE_TEST_ENGINE || '/tmp/live-test/node_modules/@electric-sql/pglite/dist/index.js').href)
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
create table profiles(id uuid primary key,account_status text,is_anonymized boolean default false);
create table classes(id uuid primary key,school_id uuid);
create table students(id uuid primary key,profile_id uuid,deleted_at timestamptz,name text);
create table student_classes(student_id uuid,class_id uuid,school_id uuid,is_current boolean);
create table teacher_classes(teacher_id uuid,class_id uuid,school_id uuid);
create function public.teacher_can_access_class(uuid,uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.teacher_classes where class_id=$1 and teacher_id=auth.uid()) $$;
create function public.teacher_get_operating_context(uuid) returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('school_id',school_id) from public.teacher_classes where teacher_id=auth.uid() limit 1 $$;
`)
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const teacher=id(1), a=id(2), b=id(3), outsider=id(4), otherTeacher=id(5), cls=id(10), otherCls=id(11), school=id(20), otherSchool=id(21)
await db.exec(`
insert into profiles(id,account_status) values ${[teacher,a,b,outsider,otherTeacher].map(x=>`('${x}','active')`).join(',')};
insert into classes values ('${cls}','${school}'),('${otherCls}','${otherSchool}');
insert into teacher_classes values ('${teacher}','${cls}','${school}'),('${otherTeacher}','${otherCls}','${otherSchool}');
insert into students values ('${id(30)}','${a}',null,'Learner A'),('${id(31)}','${b}',null,'Learner B'),('${id(32)}','${outsider}',null,'Outsider');
insert into student_classes values ('${id(30)}','${cls}','${school}',true),('${id(31)}','${cls}','${school}',true),('${id(32)}','${otherCls}','${otherSchool}',true);
`)
await db.exec(readFileSync(new URL('../supabase/migrations/20261118075221_live_classroom_pilot.sql',import.meta.url),'utf8'))
async function rpc(who,action,room=null,version=null,payload={},classId=cls,role='authenticated') {
 await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${who||''}',false)`)
 try {return (await db.query('select public.vibe_live_command($1,$2,$3,$4,$5::jsonb) as out',[action,classId,room,version,JSON.stringify(payload)])).rows[0].out}
 finally {await db.exec('reset role')}
}
let room=await rpc(teacher,'start',null,null,{title:'Maths · Time'})
assert.equal(room.teacher,true);assert.equal(room.status,'active')
const sid=room.id
assert.equal((await rpc(teacher,'start',null,null,{title:'Duplicate'})).id,sid)
assert.equal((await rpc(a,'list'))[0].id,sid)
await assert.rejects(rpc(outsider,'list'),/live_not_authorized/)
await assert.rejects(rpc(otherTeacher,'get',sid),/live_not_authorized/)
await assert.rejects(rpc(a,'get',sid),/live_join_required/)
await assert.rejects(rpc(a,'start',null,null,{title:'Fake'}),/live_teacher_required/)
await assert.rejects(rpc(null,'list',null,null,{},cls,'anon'),/permission denied/)
assert.equal((await rpc(a,'join',sid)).teacher,false)
await rpc(a,'join',sid); await rpc(b,'join',sid)
room=await rpc(teacher,'publish',sid,room.version,{kind:'quiz',body:'How many minutes in one hour?',answerKey:'60'})
const prompt=room.prompt.id
assert.equal(room.participants.length,2)
assert.equal((await rpc(a,'get',sid)).prompt.answerKey,null)
await assert.rejects(rpc(a,'publish',sid,room.version,{kind:'teach',body:'bad'}),/live_teacher_required/)
await assert.rejects(rpc(a,'answer',sid,room.version-1,{promptId:prompt,body:'60'}),/stale/)
await assert.rejects(rpc(a,'answer',sid,room.version,{promptId:id(100),body:'60'}),/answer_not_open/)
await rpc(a,'answer',sid,room.version,{promptId:prompt,body:'60'})
await rpc(a,'answer',sid,room.version,{promptId:prompt,body:'999'})
await rpc(b,'answer',sid,room.version,{promptId:prompt,body:'30'})
const own=await rpc(a,'get',sid)
assert.equal(own.ownAnswer,'60');assert.equal('participants' in own,false);assert.equal(own.prompt.answerKey,null)
await rpc(b,'help',sid)
room=await rpc(teacher,'get',sid)
assert.deepEqual(room.participants.map(p=>p.answer),['60','30']);assert.equal(room.participants.find(p=>p.name==='Learner B').needsHelp,true)
await rpc(teacher,'ack',sid,null,{studentId:id(31)})
assert.equal((await rpc(b,'get',sid)).needsHelp,false)
room=await rpc(teacher,'pause',sid,room.version)
await assert.rejects(rpc(b,'answer',sid,room.version,{promptId:prompt,body:'60'}),/stale_or_paused/)
room=await rpc(teacher,'resume',sid,room.version)
room=await rpc(teacher,'reveal',sid,room.version)
assert.equal((await rpc(a,'get',sid)).prompt.answerKey,'60')
await assert.rejects(rpc(b,'answer',sid,room.version,{promptId:prompt,body:'60'}),/answer_not_open/)
await db.exec(`update student_classes set is_current=false where student_id='${id(31)}'`)
await assert.rejects(rpc(b,'get',sid),/live_not_authorized/)
room=await rpc(teacher,'get',sid);assert.equal(room.participants.length,1)
room=await rpc(teacher,'end',sid,room.version)
assert.equal((await rpc(a,'get',sid)).status,'ended')
await assert.rejects(rpc(a,'join',sid),/session_closed/)
await db.exec('set role authenticated')
await assert.rejects(db.query('select * from vibe_live.prompts'),/permission denied/)
await db.exec('reset role')
// Add authorization probes for revoked teacher assignment, expired rooms and stale controls.
await db.exec(`update vibe_live.sessions set expires_at=now()-interval '1 hour' where id='${sid}'; update vibe_live.sessions set status='active' where id='${sid}'`)
assert.equal((await rpc(a,'get',sid)).status,'ended')
await assert.rejects(rpc(a,'join',sid),/session_closed/)
await db.exec(`update teacher_classes set teacher_id='${otherTeacher}' where teacher_id='${teacher}'`)
await assert.rejects(rpc(teacher,'get',sid),/live_not_authorized/)
console.log('PASS: private RPC, 2 learners, class scope, independent responses, retry, answer concealment, teacher actions, stale prompt, pause, enrollment revocation, end, anonymous and raw data denial')
await db.close()
