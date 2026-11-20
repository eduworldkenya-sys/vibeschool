// Install the pinned test-only engine outside the repo: npm install --prefix /tmp/live-test --no-audit --no-fund @electric-sql/pglite@0.3.14
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(process.env.LIVE_TEST_ENGINE || '/tmp/live-test/node_modules/@electric-sql/pglite/dist/index.js').href)
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {encodeSlide,decodeSlide,validSlide,SLIDE_DIAGRAMS} from '../components/live-classroom/LiveSlideProtocol.ts'
import {emptyBoard,encodeBoard,decodeBoard,boardFromLegacy,BOARD_DIAGRAMS} from '../components/live-classroom/LiveBoardProtocol.ts'
const shape={id:'fixture-rect',kind:'rectangle',x:20,y:25,w:90,h:60,angle:15,color:'#1865c0',stroke:3,locked:true}
const drawnBoard={...emptyBoard(2,3),background:'grid',objects:[shape,{...shape,id:'fixture-note',kind:'text',text:'2 + 3 = 5'},{...shape,id:'fixture-diagram',kind:'diagram',diagram:'fraction-bars'},{...shape,id:'fixture-arrow',kind:'arrow',points:[0,0,1000,1000]}]}
const objectBoard=encodeBoard(drawnBoard)
assert.ok(objectBoard)
assert.deepEqual(decodeBoard(objectBoard),drawnBoard)
assert.equal(encodeBoard({...drawnBoard,objects:[shape,shape]}),'')
assert.equal(encodeBoard({...drawnBoard,objects:[{...shape,angle:360}]}),'')
assert.equal(encodeBoard({...drawnBoard,objects:[{...shape,color:'url(javascript:alert(1))'}]}),'')
assert.equal(decodeBoard('VBOARD1:{invalid'),null)
assert.equal(boardFromLegacy('0,0;100,100;').objects.length,1)
assert.deepEqual(BOARD_DIAGRAMS,SLIDE_DIAGRAMS.filter(d=>d!=='none'))
console.log('PASS: native board object round trip, page metadata, object bounds, legacy conversion and malformed payloads')
const privateSlide={title:'Fractions',body:'Two quarters make one half.',diagram:'fraction-circle',theme:'forest',layout:'wide',font:'large',notes:'Private answer and presenter reminder'}
const encodedSlide=encodeSlide(privateSlide,2,5)
assert.ok(encodedSlide)
assert.ok(!encodedSlide.includes(privateSlide.notes))
assert.deepEqual(decodeSlide(encodedSlide),{title:privateSlide.title,body:privateSlide.body,diagram:'fraction-circle',theme:'forest',layout:'wide',font:'large',number:2,total:5})
assert.equal(decodeSlide('ordinary lesson text'),null)
assert.equal(decodeSlide('VSLIDE1:{bad json'),null)
assert.equal(decodeSlide('VSLIDE1:'+JSON.stringify({...privateSlide,number:1,total:1})),null)
assert.equal(encodeSlide({...privateSlide,body:'x'.repeat(4000)},1,1),'')
assert.equal(encodeSlide({...privateSlide,diagram:'unsafe'},1,1),'')
assert.equal(encodeSlide(privateSlide,0,1),'')
assert.equal(encodeSlide(privateSlide,1,31),'')
assert.equal(validSlide({title:'a',body:'b',theme:'unsafe'}),false)
for(const diagram of SLIDE_DIAGRAMS)assert.equal(decodeSlide(encodeSlide({...privateSlide,diagram},1,1)).diagram,diagram)
console.log('PASS: bounded slide protocol, native diagram identifiers, privacy and malformed input rejection')
// Dashboard shortcut must use existing scoped host routes and remain hidden until enabled.
const teacherToday=readFileSync(new URL('../app/teacher/pulse/page.tsx',import.meta.url),'utf8')
assert.ok(teacherToday.includes('process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED === "true"'))
assert.ok(teacherToday.includes('>Go Live</button>'))
assert.ok(teacherToday.includes('/teacher/classhub/${encodeURIComponent(audience)}/live'))
assert.ok(teacherToday.includes('safeMyClasses.some(item => item.class_id === audience)'))
assert.ok(teacherToday.includes('<select aria-label="Choose live audience"'))
assert.ok(teacherToday.includes('<option value="tuition">Private tuition</option>'))
assert.ok(teacherToday.includes('Choose live audience'))
assert.ok(teacherToday.includes('/teacher/tutoring/live?mode='))
assert.ok(teacherToday.includes('<option value="open">Open class</option>'))
assert.ok(teacherToday.includes('audience === "tuition" || audience === "open"'))
const liveUi=readFileSync(new URL('../components/live-classroom/LiveClassroom.tsx',import.meta.url),'utf8')
assert.ok(liveUi.includes("act('join',sharedId)"))
assert.ok(liveUi.includes('Find live lessons'))
assert.ok(liveUi.includes('Share lesson'))
assert.ok(liveUi.includes('switchBoardPage'))
assert.ok(liveUi.includes('Previous board page'))
assert.ok(liveUi.includes('Next board page'))
const boardUi=readFileSync(new URL('../components/live-classroom/LiveObjectBoard.tsx',import.meta.url),'utf8')
assert.ok(boardUi.includes("exportCurrent('svg')"))
assert.ok(boardUi.includes("exportCurrent('png')"))
assert.ok(liveUi.includes('<ObjectBoard'))
assert.ok(liveUi.includes("if(payload.kind!=='board')setEditingBoard(false)"))
const liveCss=readFileSync(new URL('../components/live-classroom/LiveClassroom.module.css',import.meta.url),'utf8')
// Static contract checks complement the scoped RPC tests below; not browser proof.
assert.ok(liveUi.includes('createPortal(stage,document.body)'))
assert.ok(liveUi.includes('requestFullscreen()'))
assert.ok(liveUi.includes('aria-label="Move teacher preview"'))
assert.ok(liveUi.includes('aria-label="Resize preview"'))
assert.ok(liveUi.includes("audio:false"))
assert.ok(liveUi.includes('getTracks().forEach(track=>track.stop())'))
assert.ok(liveUi.includes('Learner preview'))
assert.ok(liveUi.includes("act('publish',null,{kind:'board'"))
assert.ok(liveUi.includes("act('ack',null,{studentId:p.studentId})"))
assert.ok(liveUi.includes('Confirm end'))
assert.ok(liveUi.includes('Present slide'))
assert.ok(liveUi.includes('aria-label="Slide thumbnails"'))
assert.ok(liveUi.includes('hidden={!showSticker||!!panel||(focusMode&&!focusDock)}'))
assert.ok(liveUi.includes('const [mini,setMini]=useState(true)'))
assert.match(liveCss,/\.immersive\{font-family:system-ui/)
assert.match(liveCss,/\.stageContent \.content\{margin:0;/)
assert.ok(liveUi.includes("kind:'teach',body:slideText,answerKey:null"))
assert.ok(liveUi.includes('encodeSlide(item,index+1,slides.length)'))
assert.ok(liveUi.includes('styles.slideWorkspace'))
assert.ok(liveUi.includes('Presenter notes (private)'))
assert.ok(liveUi.includes('undoSlideDelete'))
assert.ok(liveUi.includes('undoBoards'))
assert.ok(liveUi.includes('boardUndoByPage.current'))
assert.ok(liveUi.includes('Show classroom controls'))
assert.ok(boardUi.includes("tool==='erase'"))
assert.ok(boardUi.includes("tool==='select'"))
assert.ok(boardUi.includes("o.kind==='highlighter'"))
assert.ok(boardUi.includes("selectedObject.locked"))
assert.ok(boardUi.includes("touches.current.size>=2"))
assert.ok(boardUi.includes("pinch.current.zoom*Math.hypot"))
assert.ok(boardUi.includes("gesture.current=null;latest.current=null;setPreview(null)"))
assert.ok(boardUi.includes("window.confirm('Clear this draft page?"))
assert.ok(boardUi.includes('Insert diagram'))

assert.match(liveCss,/\.immersive\{position:fixed;inset:0;/)
assert.match(liveCss,/\.stageContent\{[^}]*overflow:auto/)
assert.match(liveCss,/\.toolRow\{display:grid;/)

assert.ok(teacherToday.includes('/teacher/tutoring/live'))
const db=new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
create table profiles(id uuid primary key,account_status text,role text default 'student',is_anonymized boolean default false);
create table classes(id uuid primary key,school_id uuid,name text);
create table students(id uuid primary key,profile_id uuid,deleted_at timestamptz,name text);
create table student_classes(student_id uuid,class_id uuid,school_id uuid,is_current boolean);
create table teacher_classes(teacher_id uuid,class_id uuid,school_id uuid);
create table school_members(school_id uuid,profile_id uuid,role text);
create table independent_learner_identities(user_id uuid,account_state text,learner_email_verified_at timestamptz,grade_label text);
create table parent_student_links(parent_id uuid,student_id uuid);
create table vibetutor_tutors(profile_id uuid,status text,display_name text);
create table vibetutor_student_invitations(id uuid,tutor_id uuid,student_id uuid,status text);
create table vibetutor_private_groups(id uuid primary key,tutor_id uuid,title text);
create table vibetutor_private_group_members(group_id uuid,invitation_id uuid);
create function public.teacher_can_access_class(uuid,uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.teacher_classes where class_id=$1 and teacher_id=auth.uid()) $$;
create function public.teacher_get_operating_context(uuid) returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('school_id',school_id) from public.teacher_classes where teacher_id=auth.uid() limit 1 $$;
`)
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const parent=id(6), solo=id(7), cpa=id(8), teacher=id(1), a=id(2), b=id(3), outsider=id(4), otherTeacher=id(5), cls=id(10), otherCls=id(11), school=id(20), otherSchool=id(21)
await db.exec(`
insert into profiles(id,account_status) values ${[teacher,a,b,outsider,otherTeacher,parent,solo,cpa].map(x=>`('${x}','active')`).join(',')};
insert into classes values ('${cls}','${school}','Grade 4'),('${otherCls}','${otherSchool}','Grade 5');
update profiles set role='teacher' where id in ('${teacher}','${otherTeacher}');
update profiles set role='parent' where id='${parent}';
insert into school_members values ('${school}','${teacher}','teacher'),('${otherSchool}','${otherTeacher}','teacher');
insert into teacher_classes values ('${teacher}','${cls}','${school}'),('${otherTeacher}','${otherCls}','${otherSchool}');
insert into students values ('${id(30)}','${a}',null,'Learner A'),('${id(31)}','${b}',null,'Learner B'),('${id(32)}','${outsider}',null,'Outsider'),('${id(33)}','${solo}',null,'Homeschool learner'),('${id(34)}','${cpa}',null,'Muted learner');
insert into independent_learner_identities values ('${solo}','restricted',now(),'Grade 4'),('${cpa}','restricted',now(),'Professional Studies');
insert into parent_student_links values ('${parent}','${id(33)}');
insert into vibetutor_tutors values ('${teacher}','published','Verified tutor'),('${otherTeacher}','paused','Other tutor');
insert into vibetutor_student_invitations values ('${id(40)}','${teacher}','${id(30)}','accepted'),('${id(41)}','${teacher}','${id(33)}','accepted'),('${id(42)}','${teacher}','${id(31)}','pending_guardian'),('${id(43)}','${teacher}','${id(34)}','accepted');
insert into vibetutor_private_groups values ('${id(50)}','${teacher}','Math group'),('${id(51)}','${otherTeacher}','Private group');
insert into vibetutor_private_group_members values ('${id(50)}','${id(40)}'),('${id(50)}','${id(41)}');
insert into student_classes values ('${id(30)}','${cls}','${school}',true),('${id(31)}','${cls}','${school}',true),('${id(32)}','${otherCls}','${otherSchool}',true);
`)
await db.exec(readFileSync(new URL('../supabase/migrations/20261118075221_live_classroom_pilot.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261120104500_live_lesson_history_candidate.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261120104501_live_learner_tools_candidate.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261120104502_live_teacher_workspace.sql',import.meta.url),'utf8'))
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
assert.deepEqual(await rpc(outsider,'list'),[])
await assert.rejects(rpc(otherTeacher,'get',sid),/live_not_authorized/)
await assert.rejects(rpc(a,'get',sid),/live_join_required/)
await assert.rejects(rpc(a,'start',null,null,{title:'Fake'}),/live_teacher_required/)
await assert.rejects(rpc(null,'list',null,null,{},cls,'anon'),/permission denied/)
assert.equal((await rpc(a,'join',sid)).teacher,false)
await rpc(a,'join',sid); await rpc(b,'join',sid)
const draftFixture={board:objectBoard,boardPages:['',objectBoard,''],boardPage:1,slides:[privateSlide],slideIndex:0,mode:'teach',body:'private draft',key:'',clock:'10:30',composers:{}}
assert.deepEqual(await rpc(teacher,'workspace_get',sid),{revision:0,draft:null})
assert.equal((await rpc(teacher,'workspace_save',sid,null,{revision:0,draft:draftFixture})).revision,1)
assert.deepEqual((await rpc(teacher,'workspace_get',sid)).draft,draftFixture)
await assert.rejects(rpc(teacher,'workspace_save',sid,null,{revision:0,draft:draftFixture}),/live_workspace_conflict/)
await assert.rejects(rpc(teacher,'workspace_save',sid,null,{revision:1,draft:{...draftFixture,key:'secret answer'}}),/live_invalid_workspace/)
await assert.rejects(rpc(a,'workspace_get',sid),/live_teacher_required/)
await assert.rejects(rpc(b,'workspace_save',sid,null,{revision:1,draft:draftFixture}),/live_teacher_required/)
await assert.rejects(rpc(otherTeacher,'workspace_get',sid),/live_not_authorized/)
assert.equal((await rpc(teacher,'workspace_save',sid,null,{revision:1,draft:{...draftFixture,body:'new draft'}})).revision,2)
assert.equal((await rpc(a,'get',sid)).draft,undefined)
assert.ok(!JSON.stringify(await rpc(a,'get',sid)).includes(privateSlide.notes))
const material=id(350)
assert.deepEqual((await rpc(teacher,'materials_list')).materials,[])
const savedMaterial=await rpc(teacher,'materials_save',null,null,{id:material,title:'Prepared fractions',revision:0,slides:[privateSlide]})
assert.equal(savedMaterial.revision,1)
assert.deepEqual((await rpc(teacher,'materials_get',null,null,{id:material})).slides,[privateSlide])
assert.equal((await rpc(teacher,'materials_list')).materials[0].slideCount,1)
assert.deepEqual((await rpc(otherTeacher,'materials_list')).materials,[])
await assert.rejects(rpc(otherTeacher,'materials_get',null,null,{id:material}),/live_not_authorized/)
await assert.rejects(rpc(otherTeacher,'materials_save',null,null,{id:material,title:'Hijack',revision:1,slides:[privateSlide]}),/live_not_authorized/)
await assert.rejects(rpc(otherTeacher,'materials_delete',null,null,{id:material,revision:1}),/live_not_authorized/)
await assert.rejects(rpc(a,'materials_list'),/live_not_authorized/)
await assert.rejects(rpc(teacher,'materials_save',null,null,{id:material,title:'Stale',revision:0,slides:[privateSlide]}),/live_material_conflict/)
assert.equal((await rpc(teacher,'materials_save',null,null,{id:material,title:'Prepared fractions v2',revision:1,slides:[privateSlide]})).revision,2)
assert.equal((await rpc(teacher,'materials_get',null,null,{id:material})).title,'Prepared fractions v2')
assert.equal((await rpc(teacher,'materials_delete',null,null,{id:material,revision:2})).deleted,true)
assert.deepEqual((await rpc(teacher,'materials_list')).materials,[])
for(const role of ['authenticated','anon','service_role']){
 await db.exec(`set role ${role}`)
 try {for(const table of ['teacher_workspace','teacher_materials']){await assert.rejects(db.query(`select * from vibe_live.${table}`),/permission denied/);await assert.rejects(db.query(`delete from vibe_live.${table}`),/permission denied/)}}
 finally {await db.exec('reset role')}
}
console.log('PASS: server draft recovery, revision conflict, private presenter notes, library ownership, CRUD and direct access denial')

assert.deepEqual((await rpc(a,'get',sid)).history,[])
const noteA='Learner A private note',noteB='Learner B private note'
assert.equal((await rpc(a,'note',sid,null,{body:noteA})).ownNote,noteA)
assert.equal((await rpc(b,'get',sid)).ownNote,'')
assert.equal((await rpc(b,'note',sid,null,{body:noteB})).ownNote,noteB)
assert.equal((await rpc(a,'get',sid)).ownNote,noteA)
assert.equal((await rpc(teacher,'get',sid)).ownNote,undefined)
await assert.rejects(rpc(outsider,'note',sid,null,{body:'unauthorized'}),/live_not_authorized/)
await assert.rejects(rpc(teacher,'note',sid,null,{body:'not a learner'}),/live_learner_required/)
const qa={body:'Question A',requestId:id(200)},qb={body:'Question B',requestId:id(201)}
const questionA=(await rpc(a,'ask',sid,null,qa)).questions[0]
assert.ok(questionA.id)
assert.equal((await rpc(a,'ask',sid,null,qa)).questions.length,1)
await assert.rejects(rpc(a,'ask',sid,null,{...qa,body:'changed request'}),/live_request_id_reused/)
assert.deepEqual((await rpc(b,'get',sid)).questions,[])
const questionB=(await rpc(b,'ask',sid,null,qb)).questions[0]
assert.notEqual(questionA.id,questionB.id)
assert.deepEqual((await rpc(a,'get',sid)).questions.map(q=>q.id),[questionA.id])
assert.deepEqual((await rpc(b,'get',sid)).questions.map(q=>q.id),[questionB.id])
assert.equal((await rpc(teacher,'get',sid)).questions.length,2)
await assert.rejects(rpc(a,'reply',sid,null,{questionId:questionB.id,body:'unauthorized'}),/live_teacher_required/)
await assert.rejects(rpc(otherTeacher,'reply',sid,null,{questionId:questionA.id,body:'unauthorized'}),/live_not_authorized/)
await assert.rejects(rpc(outsider,'ask',sid,null,{body:'unauthorized',requestId:id(202)}),/live_not_authorized/)
await rpc(teacher,'reply',sid,null,{questionId:questionA.id,body:'Teacher reply A'})
assert.equal((await rpc(a,'get',sid)).questions[0].reply,'Teacher reply A')
assert.equal((await rpc(b,'get',sid)).questions[0].reply,null)
for(const role of ['authenticated','anon','service_role']){
 await db.exec(`set role ${role}`)
 try {
  for(const table of ['learner_notes','learner_questions']){
   await assert.rejects(db.query(`select * from vibe_live.${table}`),/permission denied/)
   await assert.rejects(db.query(`delete from vibe_live.${table}`),/permission denied/)
  }
 } finally {await db.exec('reset role')}
}
console.log('PASS: owner-only learner notes/questions, direct role denial, two-learner isolation, scoped teacher reply and retry')

room=await rpc(teacher,'publish',sid,room.version,{kind:'quiz',body:'How many minutes in one hour?',answerKey:'60'})
// Slide deck uses the already authorized text publication contract.
const slideRoom=await rpc(teacher,'publish',sid,room.version,{kind:'teach',body:encodedSlide})
const learnerSlide=(await rpc(a,'get',sid)).prompt.body
assert.equal(learnerSlide,encodedSlide)
assert.equal(decodeSlide(learnerSlide).title,'Fractions')
assert.equal((await rpc(b,'get',sid)).prompt.body,encodedSlide)
assert.ok(!JSON.stringify(await rpc(a,'get',sid)).includes(privateSlide.notes))
await assert.rejects(rpc(outsider,'get',sid),/live_not_authorized/)
await assert.rejects(rpc(teacher,'publish',sid,slideRoom.version,{kind:'teach',body:'x'.repeat(4001)}),/live_invalid_prompt/)
const geometryBoard='10,20;80,20;80,70;10,70;10,20;|100,30;160,90;40,90;100,30;'
const geometryRoom=await rpc(teacher,'publish',sid,slideRoom.version,{kind:'board',body:geometryBoard})
assert.equal((await rpc(a,'get',sid)).prompt.body,geometryBoard)
assert.equal((await rpc(b,'get',sid)).prompt.body,geometryBoard)
await assert.rejects(rpc(outsider,'get',sid),/live_not_authorized/)
await assert.rejects(rpc(a,'publish',sid,geometryRoom.version,{kind:'board',body:geometryBoard}),/live_teacher_required/)
await assert.rejects(rpc(teacher,'publish',sid,geometryRoom.version,{kind:'board',body:'1,1;'.repeat(876)}),/live_invalid_board/)
const objectRoom=await rpc(teacher,'publish',sid,geometryRoom.version,{kind:'board',body:objectBoard})
assert.deepEqual(decodeBoard((await rpc(a,'get',sid)).prompt.body),drawnBoard)
assert.equal((await rpc(b,'get',sid)).prompt.body,objectBoard)
await assert.rejects(rpc(outsider,'get',sid),/live_not_authorized/)
await assert.rejects(rpc(a,'publish',sid,objectRoom.version,{kind:'board',body:objectBoard}),/live_teacher_required/)
for(const payload of ['VBOARD1:{broken','VBOARD1:'+JSON.stringify({...drawnBoard,objects:[{...shape,color:'red;url(x)'}]}),'VBOARD1:'+JSON.stringify({...drawnBoard,objects:[shape,shape]}),'VBOARD1:'+JSON.stringify({...drawnBoard,objects:[{...shape,x:99999}]}),'VBOARD1:'+JSON.stringify({...drawnBoard,objects:[{...shape,html:'<script>'}]})]){
 await assert.rejects(rpc(teacher,'publish',sid,objectRoom.version,{kind:'board',body:payload}),/live_invalid_board/)
}
room=await rpc(teacher,'publish',sid,objectRoom.version,{kind:'quiz',body:'How many minutes in one hour?',answerKey:'60'})
assert.deepEqual((await rpc(a,'get',sid)).history.map(p=>p.position),[1,2,3,4,5])
assert.equal((await rpc(a,'get',sid)).history[0].answerKey,null)
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
// Universal classroom access: shared engine with canonical relationships.
const unscoped=(who,action,room=null,version=null,payload={})=>rpc(who,action,room,version,payload,null)
const groups=await unscoped(teacher,'groups')
assert.deepEqual(groups.map(g=>g.id),[id(50)])
await assert.rejects(unscoped(teacher,'start',null,null,{mode:'tuition',groupId:id(51),title:'Other group'}),/teacher_required/)
let tuition=await unscoped(teacher,'start',null,null,{mode:'tuition',groupId:id(50),title:'Group maths'})
assert.equal(tuition.mode,'tuition')
assert.equal((await unscoped(solo,'list')).find(x=>x.id===tuition.id).canJoin,true)
await unscoped(a,'join',tuition.id)
await unscoped(solo,'join',tuition.id)
await assert.rejects(unscoped(b,'join',tuition.id),/not_authorized/)
await assert.rejects(unscoped(cpa,'join',tuition.id),/not_authorized/)
tuition=await unscoped(teacher,'publish',tuition.id,tuition.version,{kind:'clock',body:'10:30'})
assert.equal((await unscoped(solo,'get',tuition.id)).prompt.body,'10:30')
await assert.rejects(unscoped(solo,'answer',tuition.id,tuition.version,{body:'10',promptId:tuition.prompt.id}),/answer_not_open/)
await db.exec(`update vibetutor_student_invitations set status='revoked' where id='${id(40)}'`)
await assert.rejects(unscoped(a,'get',tuition.id),/not_authorized/)
await unscoped(teacher,'end',tuition.id,tuition.version)
await db.exec(`update vibe_live.sessions set created_at=now()-interval '1 minute' where id='${tuition.id}'`)
let home=await unscoped(parent,'start',null,null,{mode:'homeschool',title:'Family lesson'})
await unscoped(solo,'join',home.id)
await assert.rejects(unscoped(a,'join',home.id),/not_authorized/)
await assert.rejects(unscoped(parent,'start',null,null,{mode:'open',title:'Unsafe'}),/teacher_required/)
await unscoped(parent,'end',home.id,home.version)
let open=await unscoped(teacher,'start',null,null,{mode:'open',title:'Open revision'})
assert.equal((await unscoped(outsider,'list')).find(x=>x.id===open.id).canJoin,false)
await assert.rejects(unscoped(outsider,'join',open.id),/not_authorized/)
await unscoped(solo,'join',open.id)
await assert.rejects(unscoped(otherTeacher,'start',null,null,{mode:'open',title:'Unlisted tutor'}),/teacher_required/)
await db.exec(`update vibetutor_tutors set status='paused' where profile_id='${teacher}'`)
await assert.rejects(unscoped(solo,'get',open.id),/not_authorized/)
console.log('PASS: tuition group isolation, guardian approval, homeschooling, open discovery, muted learner denial, revocation and shared clock')
await db.exec(`update student_classes set is_current=false where student_id='${id(31)}'`)
await assert.rejects(rpc(b,'get',sid),/live_not_authorized/)
room=await rpc(teacher,'get',sid);assert.equal(room.participants.length,1)
assert.deepEqual(room.questions.map(q=>q.id),[questionA.id])
await assert.rejects(rpc(b,'note',sid,null,{body:'revoked learner'}),/live_not_authorized/)
await assert.rejects(rpc(teacher,'reply',sid,null,{questionId:questionB.id,body:'revoked learner'}),/live_not_authorized/)
room=await rpc(teacher,'end',sid,room.version)
assert.equal((await rpc(a,'get',sid)).status,'ended')
assert.equal((await rpc(a,'get',sid)).ownNote,noteA)
await assert.rejects(rpc(teacher,'workspace_save',sid,null,{revision:2,draft:draftFixture}),/live_session_closed/)
assert.equal((await rpc(a,'get',sid)).history.length,5)
await assert.rejects(rpc(a,'note',sid,null,{body:'ended session mutation'}),/live_session_closed/)
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
