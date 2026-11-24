import {exportDeck,importDeck,MAX_DECK_FILE_BYTES,defaultDemo,decodeDemo,encodeDemo,changeDemo,buildTextRevealSlides,DEMO_RANGES,encodeAssessment,decodeAssessment,assessmentPrompt,encodePhotoSlide,decodePhotoSlide,updatePhoto,prepareAssessment,preparedAssessment,presenterNotes,setPresenterNotes,encodeMultiDemo,decodeMultiDemo} from '../components/live-classroom/LiveSlideProtocol.ts'
// Install the pinned test-only engine outside the repo: npm install --prefix /tmp/live-test --no-audit --no-fund @electric-sql/pglite@0.3.14
import {createLiveFixture} from './live-classroom-test-fixture.mjs'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {liveSyncDelay} from '../components/live-classroom/LiveSyncPolicy.ts'
assert.equal(liveSyncDelay('active',0),1250)
assert.equal(liveSyncDelay(null,0),4000)
assert.equal(liveSyncDelay('paused',0),4000)
assert.equal(liveSyncDelay('ended',0),15000)
assert.deepEqual([1,2,3,4,100].map(n=>liveSyncDelay('active',n)),[5000,10000,20000,30000,30000])
import {encodeSlide,decodeSlide,validSlide,SLIDE_DIAGRAMS,adjacentSlide,visualSlideBody,visualSlidePayload} from '../components/live-classroom/LiveSlideProtocol.ts'
import {emptyBoard,encodeBoard,decodeBoard,boardFromLegacy,BOARD_DIAGRAMS,revealBoard,boardRevealCount} from '../components/live-classroom/LiveBoardProtocol.ts'
const shape={id:'fixture-rect',kind:'rectangle',x:20,y:25,w:90,h:60,angle:15,color:'#1865c0',stroke:3,locked:true}
const drawnBoard={...emptyBoard(2,3),background:'grid',objects:[shape,{...shape,id:'fixture-note',kind:'text',text:'2 + 3 = 5'},{...shape,id:'fixture-diagram',kind:'diagram',diagram:'fraction-bars'},{...shape,id:'fixture-arrow',kind:'arrow',points:[0,0,1000,1000]}]}
const objectBoard=encodeBoard(drawnBoard)
assert.ok(objectBoard)
assert.deepEqual(decodeBoard(objectBoard),drawnBoard)
const firstObject=revealBoard(objectBoard,1)
assert.equal(decodeBoard(firstObject).objects.length,1)
assert.ok(!firstObject.includes('fixture-note'))
assert.equal(boardRevealCount(objectBoard,firstObject),1)
assert.equal(boardRevealCount(objectBoard,revealBoard(objectBoard,0)),0)
assert.equal(revealBoard(objectBoard,5),'')
assert.equal(boardRevealCount(objectBoard,encodeBoard({...drawnBoard,objects:[drawnBoard.objects[1]]})),null)
assert.equal(encodeBoard({...drawnBoard,objects:[shape,shape]}),'')
assert.equal(encodeBoard({...drawnBoard,objects:[{...shape,angle:360}]}),'')
assert.equal(encodeBoard({...drawnBoard,objects:[{...shape,color:'url(javascript:alert(1))'}]}),'')
assert.equal(decodeBoard('VBOARD1:{invalid'),null)
assert.equal(boardFromLegacy('0,0;100,100;').objects.length,1)
assert.deepEqual(BOARD_DIAGRAMS,SLIDE_DIAGRAMS.filter(d=>d!=='none'))
console.log('PASS: native board object round trip, page metadata, object bounds, legacy conversion and malformed payloads')
const privateSlide={title:'Fractions',body:'Two quarters make one half.',diagram:'fraction-circle',theme:'forest',layout:'wide',font:'large',notes:'Private answer and presenter reminder'}
const visual={...privateSlide,body:visualSlideBody(objectBoard)}
const visualEncoded=encodeSlide(visual,1,2)
assert.ok(visualEncoded)
assert.equal(visualSlidePayload('ordinary text'),null)
assert.equal(visualSlidePayload(decodeSlide(visualEncoded).body),objectBoard)
assert.deepEqual(decodeBoard(visualSlidePayload(decodeSlide(visualEncoded).body)),drawnBoard)
assert.ok(!visualEncoded.includes(privateSlide.notes))
assert.equal(adjacentSlide([visual,privateSlide],decodeSlide(visualEncoded),1),1)
assert.equal(importDeck(exportDeck('Visual example',[visual])).slides[0].body,visual.body)
for(const kind of Object.keys(DEMO_RANGES)){
 const d=defaultDemo(kind),body=encodeDemo(d)
 assert.deepEqual(decodeDemo(body),d)
 assert.equal(decodeSlide(encodeSlide({title:'Demo',body},1,1)).body,body)
 assert.equal(importDeck(exportDeck('Demo',[{title:'Demo',body}])).slides[0].body,body)
}
assert.equal(encodeDemo({kind:'clock',a:13,b:0}),'')
assert.equal(encodeDemo({kind:'fraction-circle',a:5,b:4}),'')
assert.deepEqual(changeDemo({kind:'fraction-circle',a:3,b:4},'b',2),{kind:'fraction-circle',a:2,b:2})
const reveals=buildTextRevealSlides({title:'Steps',body:'First\nSecond\nThird',notes:'Private'},3)
assert.deepEqual(reveals.map(s=>s.body),['First','First\nSecond','First\nSecond\nThird'])
assert.equal(buildTextRevealSlides({title:'Steps',body:'First\nSecond'},1).length,0)
assert.ok(!encodeSlide(reveals[0],1,3).includes('Private'))
const activity={kind:'quiz',question:'What is one half?',options:['1/2','1/3']}
const activityBody=encodeAssessment(activity)
assert.deepEqual(decodeAssessment(activityBody),activity)
assert.equal(assessmentPrompt(activity),'What is one half?\nA. 1/2\nB. 1/3')
assert.equal(encodeAssessment({...activity,answerKey:'1/2'}),'')
assert.equal(encodeAssessment({...activity,options:['One','one']}),'')
assert.equal(decodeSlide(encodeSlide({title:'Quiz',body:activityBody,notes:'Private'},1,1)).body,activityBody)
assert.equal(buildTextRevealSlides({title:'Quiz',body:activityBody},3).length,0)
const photo={id:'11111111-1111-1111-1111-111111111111',x:0,y:0,w:60,h:60,fit:'contain'}
const photoDoc={roomId:'22222222-2222-2222-2222-222222222222',photos:[photo]}
const photoBody=encodePhotoSlide(photoDoc)
assert.deepEqual(decodePhotoSlide(photoBody),photoDoc)
assert.equal(encodePhotoSlide({...photoDoc,photos:[{...photo,x:80}]}),'')
assert.equal(encodePhotoSlide({...photoDoc,photos:[photo,photo]}),'')
assert.equal(encodePhotoSlide({...photoDoc,photos:[{...photo,url:'https://example.com'}]}),'')
assert.deepEqual(updatePhoto(photo,{x:90}),{...photo,x:40})
assert.equal(decodeSlide(encodeSlide({title:'Photo',body:photoBody},1,1)).body,photoBody)
assert.throws(()=>exportDeck('Photo',[{title:'Photo',body:photoBody}]),/Room-specific photos/)
const quizDraft={title:'Private key',body:activityBody,notes:'Private notes'}
const notesWithKey=prepareAssessment(quizDraft,0,'Because two equal parts make a whole.')
assert.ok(notesWithKey)
const preparedQuiz={...quizDraft,notes:notesWithKey}
assert.equal(presenterNotes(notesWithKey),'Private notes')
assert.equal(preparedAssessment(preparedQuiz).option,0)
assert.ok(preparedAssessment(preparedQuiz).answer.includes('Because two'))
assert.equal(preparedAssessment({...preparedQuiz,body:encodeAssessment({...activity,question:'Different question?'})}),null)
assert.equal(preparedAssessment({...preparedQuiz,notes:setPresenterNotes(notesWithKey,'New notes')}).option,0)
assert.ok(!encodeSlide(preparedQuiz,1,1).includes('Because two'))
assert.ok(!exportDeck('Quiz',[preparedQuiz]).includes('Because two'))
assert.equal(prepareAssessment(quizDraft,99,''),null)
const demos=[{id:'a',demo:defaultDemo('clock')},{id:'b',demo:defaultDemo('ruler')}]
const multiBody=encodeMultiDemo(demos)
assert.deepEqual(decodeMultiDemo(multiBody),demos)
assert.equal(encodeMultiDemo([demos[0],demos[0]]),'')
assert.equal(decodeSlide(encodeSlide({title:'Compare',body:multiBody},1,1)).body,multiBody)
assert.equal(buildTextRevealSlides({title:'Compare',body:multiBody},3).length,0)
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
const exported=exportDeck('Fractions',[privateSlide])
assert.ok(!exported.includes(privateSlide.notes))
assert.equal(importDeck(exported).slides[0].notes,undefined)
assert.deepEqual(importDeck(exportDeck('Fractions',[privateSlide],true)).slides,[privateSlide])
assert.throws(()=>importDeck('not json'),/Invalid/)
assert.throws(()=>importDeck(JSON.stringify({format:'vibeschool-slides',version:2,title:'X',slides:[privateSlide]})),/Unsupported/)
assert.throws(()=>importDeck(JSON.stringify({format:'vibeschool-slides',version:1,title:'X',slides:[{...privateSlide,extra:true}]})),/Invalid slide/)
assert.throws(()=>exportDeck('X',Array(31).fill(privateSlide)),/1–30/)
assert.throws(()=>importDeck('x'.repeat(MAX_DECK_FILE_BYTES+1)),/too large/)
assert.throws(()=>exportDeck('X',[{title:'x',body:'"'.repeat(3878)}]),/too large/)
assert.equal(importDeck(exportDeck('Blank',[{title:'',body:''}])).slides.length,1)
console.log('PASS: portable presentation round trip, privacy, validation and size limits')
// Dashboard shortcut must use existing scoped host routes and remain hidden until enabled.
const teacherToday=readFileSync(new URL('../app/teacher/pulse/page.tsx',import.meta.url),'utf8')
assert.ok(teacherToday.includes('process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED === "true"'))
assert.ok(teacherToday.includes('>Go Live</button>'))
assert.ok(teacherToday.includes('/teacher/classhub/${encodeURIComponent(audience)}/live'))
assert.ok(teacherToday.includes('safeMyClasses.some(item => item.class_id === audience)'))
assert.ok(teacherToday.includes('<select aria-label="Choose live audience"'))
assert.ok(teacherToday.includes('<option value="tuition">Invited</option>'))
assert.ok(teacherToday.includes('Choose live audience'))
assert.ok(teacherToday.includes('/teacher/tutoring/live?mode='))
assert.ok(teacherToday.includes('<option value="open">Public</option>'))
assert.ok(teacherToday.includes('audience === "tuition" || audience === "open"'))
const liveUi=readFileSync(new URL('../components/live-classroom/LiveClassroom.tsx',import.meta.url),'utf8')
assert.ok(liveUi.includes("act('join',sharedId)"))
assert.ok(liveUi.includes('Find live lessons'))
assert.ok(liveUi.includes('aria-label="Start teaching"'),'Teacher must have a first action instead of an empty stage')
assert.ok(liveUi.includes("linkedPlan?'Open lesson plan':'Open resources'"),'Opening a prepared plan remains one action')
assert.ok(liveUi.includes('aria-label="Resources"'),'Short mobile label retains full accessible name')
assert.ok(liveUi.includes('className={styles.srOnly} role="status"') && liveUi.includes('workspaceRevision===null||!!conflictDraft'),'Routine draft saves must not consume layout space; synchronization problems must remain visible')
assert.ok(!liveUi.includes('setInterval(()=>void refresh(),4000)'))
assert.ok(liveUi.includes('liveSyncDelay(active.current?.status??null,failures)'))
assert.ok(liveUi.includes('stamp!==sequence'))
assert.ok(liveUi.includes('Edit as new question'))
assert.ok(liveUi.includes('You → Teacher'))
assert.ok(liveUi.includes('Teacher → You'))
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
assert.ok(liveUi.includes("supabase.channel('vibe-live:'+roomId,{config:{private:true}})"))
assert.ok(liveUi.includes(".on('broadcast',{event:'refresh'},schedule)"))
assert.ok(liveUi.includes('if(channel)void supabase.removeChannel(channel)'))
assert.match(liveCss,/\.immersive\{font-family:system-ui/)
assert.match(liveCss,/\.stageContent \.content\{margin:0;/)
assert.ok(liveUi.includes("kind:'teach',body:slideText,answerKey:null"))
assert.ok(liveUi.includes('encodeSlide(item,index+1,slides.length)'))
assert.ok(liveUi.includes('styles.slideWorkspace'))
const privateFields=readFileSync(new URL('../components/live-classroom/LivePreparedAssessment.tsx',import.meta.url),'utf8')
assert.ok(liveUi.includes('<PrivateSlideFields'))
assert.ok(privateFields.includes('Presenter notes (private)'))
assert.ok(privateFields.includes('Correct answer (private)'))
assert.ok(privateFields.includes('prepareAssessment(slide'))
const privatePlanAdapter=readFileSync(new URL('../lib/live/lessonPlanPresentation.ts',import.meta.url),'utf8')
const planModal=readFileSync(new URL('../components/teacher/LessonPlanModal.tsx',import.meta.url),'utf8')
assert.ok(planModal.includes('Teach this plan in Live'))
assert.ok(planModal.includes('lessonPlanId='))
assert.ok(privatePlanAdapter.includes('projectLessonDelivery(sections)'))
assert.ok(!privatePlanAdapter.includes('encodeSlide('),'Plan teacher notes cannot become learner slides by default')
assert.ok(liveUi.includes("eq('teacher_id',user.id).eq('class_id',classId)"),'Teacher may only load a plan from their original class')
assert.ok(liveUi.includes('teacherLivePlan(String(result.data.body'))
assert.ok(liveUi.includes("panel==='plan'"))
assert.ok(liveUi.includes('Private teaching guidance. Nothing on this panel is shared with learners.'))
assert.ok(liveUi.includes('Present approved Resources'))
const moderatedUi=readFileSync(new URL('../components/live-classroom/LiveClassChat.tsx',import.meta.url),'utf8')
const privateUi=readFileSync(new URL('../components/live-classroom/LivePrivateChat.tsx',import.meta.url),'utf8')
assert.ok(liveUi.includes("requestAdmission(item.id)"))
assert.ok(liveUi.includes("decideAdmission(w.studentId,true)"))
assert.ok(liveUi.includes("decideAdmission(w.studentId,false)"))
assert.ok(liveUi.includes('LiveClassChat'))
assert.ok(moderatedUi.includes("command('chat_send'"))
assert.ok(moderatedUi.includes("command('chat_hide'"))
assert.ok(moderatedUi.includes("command('chat_report'"))
assert.ok(moderatedUi.includes("command('chat_toggle'"))
assert.ok(privateUi.includes("command('dm_typing'"))
assert.ok(privateUi.includes("peerTyping"))


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
const {db,rpc,id,parent,solo,cpa,teacher,a,b,outsider,otherTeacher,cls,otherCls,school,otherSchool}=await createLiveFixture()
let room=await rpc(teacher,'start',null,null,{title:'Maths · Time'})
assert.equal(room.teacher,true);assert.equal(room.status,'active')
const sid=room.id
assert.equal((await rpc(teacher,'start',null,null,{title:'Duplicate'})).id,sid)
const liveTopic='vibe-live:'+sid
async function canReceive(who,topic=liveTopic,role='authenticated'){
 await db.exec('set role '+role)
 await db.query('select set_config($1,$2,false)', ['request.jwt.claim.sub',who??''])
 try {
  return (await db.query('select vibe_live.can_receive_invalidation($1) as allowed',[topic])).rows[0].allowed
 } finally {await db.exec('reset role')}
}
assert.equal(await canReceive(teacher),true,'current host can subscribe to own session invalidations')
assert.equal(await canReceive(a),false,'an eligible but unjoined learner cannot subscribe')
assert.equal(await canReceive(b),false,'unjoined second learner cannot subscribe')
assert.equal(await canReceive(outsider),false,'outsider cannot subscribe')
assert.equal(await canReceive(otherTeacher),false,'unrelated teacher cannot subscribe')
assert.equal(await canReceive(teacher,'vibe-live:'+id(888)),false,'room IDs do not permit arbitrary subscriptions')
assert.equal(await canReceive(teacher,'vibe-live:'+sid+'-other'),false,'malformed topics denied')
await assert.rejects(canReceive(null,liveTopic,'anon'),/permission denied/);
const liveSignals=(await db.query('select payload from realtime.messages')).rows
assert.ok(liveSignals.length>=1,'session creation emits a compact invalidation')
assert.ok(liveSignals.every(x=>JSON.stringify(x.payload)==='{"invalidate":true}'),
  'signals cannot leak lesson text, student IDs, answer keys or private content')

assert.equal((await rpc(a,'list'))[0].id,sid)
assert.deepEqual(await rpc(outsider,'list'),[])
await assert.rejects(rpc(otherTeacher,'get',sid),/live_not_authorized/)
await assert.rejects(rpc(a,'get',sid),/live_join_required/)
await assert.rejects(rpc(a,'start',null,null,{title:'Fake'}),/live_teacher_required/)
await assert.rejects(rpc(null,'list',null,null,{},cls,'anon'),/permission denied/)
assert.equal((await rpc(a,'join',sid)).teacher,false)
await rpc(a,'join',sid); await rpc(b,'join',sid)
assert.equal(await canReceive(a),true,'joined learner can now receive room invalidations')
assert.equal(await canReceive(b),true,'joined second learner can now receive room invalidations')
await db.exec('set role authenticated')
try {
 await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',a])
 await db.query('select set_config($1,$2,false)',['realtime.topic',liveTopic])
 const allowedRows=(await db.query('select payload from realtime.messages')).rows
 assert.ok(allowedRows.length>0,'actual Realtime RLS SELECT accepts an admitted learner')
 await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',outsider])
 assert.deepEqual((await db.query('select payload from realtime.messages')).rows,[],
  'actual Realtime RLS SELECT rejects an outsider, even if the topic is known')
} finally {await db.exec('reset role')}

const preRevokeCount=(await db.query('select count(*)::int as n from realtime.messages')).rows[0].n
assert.ok(preRevokeCount>liveSignals.length,'join broadcasts a second content-free invalidation')

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

// Teacher can initiate a direct text thread only with a learner who joined
// this exact active session and still qualifies for admission.
const learnerA=id(30),learnerB=id(31),outsiderLearner=id(32);
const teacherText={studentId:learnerA,body:'Hello Learner A, do you need help?',requestId:id(203)};
const sent=(await rpc(teacher,'dm_send',sid,null,teacherText)).messages;
assert.equal(sent.length,1);
assert.equal(sent[0].sender,'teacher');
assert.equal(sent[0].deliveredAt,null);
assert.equal((await rpc(a,'get',sid)).dmUnread,1);
assert.equal((await rpc(b,'get',sid)).dmUnread,0);
assert.equal((await rpc(teacher,'get',sid)).participants.find(p=>p.studentId===learnerA).unreadDm,0);
assert.deepEqual((await rpc(b,'dm_list',sid)).messages,[],'B never sees A private messages');
const received=(await rpc(a,'dm_list',sid)).messages;
assert.equal(received[0].body,teacherText.body);
assert.ok(received[0].deliveredAt,'Delivered is recorded after recipient fetch');
assert.equal(received[0].readAt,null,'Delivered must not be claimed as read');
assert.ok((await rpc(teacher,'dm_list',sid,null,{studentId:learnerA})).messages[0].deliveredAt);
await rpc(a,'dm_read',sid);
assert.ok((await rpc(teacher,'dm_list',sid,null,{studentId:learnerA})).messages[0].readAt,'Read status requires recipient read command');
assert.equal((await rpc(a,'get',sid)).dmUnread,0);
const learnerText={body:'Yes, please show me another example.',requestId:id(204)};
const replied=(await rpc(a,'dm_send',sid,null,learnerText)).messages;
assert.equal(replied.length,2);
assert.equal(replied[1].sender,'learner');
assert.equal((await rpc(teacher,'get',sid)).participants.find(p=>p.studentId===learnerA).unreadDm,1);
await rpc(teacher,'dm_list',sid,null,{studentId:learnerA});
await rpc(teacher,'dm_read',sid,null,{studentId:learnerA});
assert.equal((await rpc(teacher,'get',sid)).participants.find(p=>p.studentId===learnerA).unreadDm,0);
assert.ok((await rpc(a,'dm_list',sid)).messages[1].readAt);
assert.equal((await rpc(teacher,'dm_send',sid,null,teacherText)).messages.length,2,'Retry does not duplicate');
await assert.rejects(rpc(teacher,'dm_send',sid,null,{...teacherText,body:'Changed request'}),/live_request_id_reused/);
await assert.rejects(rpc(a,'dm_list',sid,null,{studentId:learnerB}),/live_not_authorized/);
await assert.rejects(rpc(a,'dm_send',sid,null,{...learnerText,studentId:learnerB}),/live_not_authorized/);
await assert.rejects(rpc(teacher,'dm_send',sid,null,{...teacherText,requestId:id(205),studentId:outsiderLearner}),/live_not_authorized/);
await assert.rejects(rpc(otherTeacher,'dm_list',sid,null,{studentId:learnerA}),/live_not_authorized/);
await assert.rejects(rpc(outsider,'dm_list',sid),/live_not_authorized/);
await assert.rejects(rpc(a,'dm_list',sid,null,{studentId:'invalid'}),/live_not_authorized/);
await assert.rejects(rpc(teacher,'dm_send',sid,null,{...teacherText,requestId:id(206),body:''}),/live_invalid_message/);
await assert.rejects(rpc(teacher,'reply',sid,null,{questionId:questionA.id,body:'Overwrite old answer'}),/live_not_authorized/);
assert.equal((await rpc(a,'get',sid)).questions[0].reply,'Teacher reply A','Old answer cannot be overwritten');
// The teacher can separately start a conversation with B without cross-thread leakage.
await rpc(teacher,'dm_send',sid,null,{studentId:learnerB,body:'Hello Learner B',requestId:id(207)});
assert.deepEqual((await rpc(a,'dm_list',sid)).messages.map(m=>m.body),[teacherText.body,learnerText.body]);
assert.deepEqual((await rpc(b,'dm_list',sid)).messages.map(m=>m.body),['Hello Learner B']);
for(const role of ['authenticated','anon','service_role']){
  await db.exec('set role '+role);
  try{
    await assert.rejects(db.query('select * from vibe_live.private_messages'),/permission denied/);
    await assert.rejects(db.query('delete from vibe_live.private_messages'),/permission denied/);
  }finally{await db.exec('reset role')}
}
console.log('PASS: teacher-initiated private messages, authentic delivery/read receipts, strict two-learner isolation, retry, immutable question replies and private table denial');

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
assert.equal((await unscoped(outsider,'list')).find(x=>x.id===open.id).canJoin,true)
await assert.rejects(unscoped(outsider,'join',open.id),/live_waiting_approval_required/)
await assert.rejects(unscoped(solo,'join',open.id),/live_waiting_approval_required/)
assert.deepEqual((await unscoped(teacher,'wait_list',open.id,null,{host:true})).requests,[])
assert.equal((await unscoped(solo,'wait_request',open.id)).status,'pending')
assert.equal((await unscoped(solo,'wait_status',open.id)).status,'pending')
assert.equal((await unscoped(solo,'list')).find(x=>x.id===open.id).waitingStatus,'pending')
assert.equal((await unscoped(teacher,'wait_list',open.id,null,{host:true})).requests.length,1)
assert.equal((await unscoped(outsider,'wait_request',open.id)).status,'pending')
await assert.rejects(unscoped(outsider,'get',open.id),/live_join_required/)
assert.equal((await unscoped(teacher,'wait_list',open.id,null,{host:true})).requests.length,2)
await assert.rejects(unscoped(solo,'wait_decide',open.id,null,{studentId:id(33),admit:true}),/live_teacher_required/)
await unscoped(teacher,'wait_decide',open.id,null,{host:true,studentId:id(33),admit:true})
assert.equal((await unscoped(solo,'wait_status',open.id)).status,'admitted')
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


// A teacher may present an earlier lesson page and a scroll position without
// publishing a duplicate prompt; only authorized joined learners can observe it.
{
 const f=await createLiveFixture()
 let r=await f.rpc(f.teacher,'start',null,null,{title:'Guided reading'})
 await f.rpc(f.a,'join',r.id)
 await f.rpc(f.b,'join',r.id)
 r=await f.rpc(f.teacher,'publish',r.id,r.version,{kind:'teach',body:'Reading page one'})
 const first=r.prompt.id
 assert.equal(r.presentedPromptId,first)
 assert.equal(Number(r.presentedScrollRatio),0)
 assert.equal(r.presentedSeq,1)
 const beforeVersion=r.version
 const updated=await f.rpc(f.teacher,'present',r.id,null,{
   currentPromptId:first,promptId:first,ratio:'0.625000'
 })
 assert.equal(updated.presentedPromptId,first)
 assert.equal(Number(updated.presentedScrollRatio),0.625)
 assert.equal((await f.rpc(f.teacher,'get',r.id)).version,beforeVersion,'Scroll does not disturb publishing locks')
 let follower=await f.rpc(f.a,'get',r.id)
 assert.equal(follower.presentedPromptId,first)
 assert.equal(Number(follower.presentedScrollRatio),0.625)
 assert.equal(follower.presentedSeq,2)
 assert.equal('participants' in follower,false)
 await assert.rejects(f.rpc(f.a,'present',r.id,null,{host:true,currentPromptId:first,promptId:first,ratio:'0.2'}),/live_teacher_required/)
 await assert.rejects(f.rpc(f.otherTeacher,'present',r.id,null,{currentPromptId:first,promptId:first,ratio:'0.2'}),/not_authorized/)
 await assert.rejects(f.rpc(f.outsider,'get',r.id),/not_authorized/)
 for(const ratio of ['-0.1','1.1','Infinity','0.0000001','2','abc']){
   await assert.rejects(f.rpc(f.teacher,'present',r.id,null,{currentPromptId:first,promptId:first,ratio}),/live_invalid_presentation/)
 }
 await assert.rejects(f.rpc(f.teacher,'present',r.id,null,{
   currentPromptId:first,promptId:f.id(99),ratio:'0.5'
 }),/live_invalid_presentation/)
 r=await f.rpc(f.teacher,'publish',r.id,beforeVersion,{kind:'teach',body:'Reading page two'})
 const second=r.prompt.id
 assert.equal(r.presentedPromptId,second)
 assert.equal(Number(r.presentedScrollRatio),0)
 const stale=await f.rpc(f.teacher,'present',r.id,null,{
   currentPromptId:first,promptId:first,ratio:'0.9'
 })
 assert.equal(stale.ignored,true,'Delayed old scroll cannot pull learners backward')
 assert.equal((await f.rpc(f.a,'get',r.id)).presentedPromptId,second)
 await f.rpc(f.teacher,'present',r.id,null,{currentPromptId:second,promptId:first,ratio:'0.4'})
 follower=await f.rpc(f.a,'get',r.id)
 assert.equal(follower.presentedPromptId,first,'Teacher may revisit an earlier lesson page')
 assert.equal(Number(follower.presentedScrollRatio),0.4)
 r=await f.rpc(f.teacher,'pause',r.id,r.version)
 await assert.rejects(f.rpc(f.teacher,'present',r.id,null,{
   currentPromptId:second,promptId:first,ratio:'0.8'
 }),/live_paused/)
 await f.db.exec(`update public.student_classes set is_current=false where student_id='${f.id(30)}'`)
 await assert.rejects(f.rpc(f.a,'get',r.id),/not_authorized/,'Revoked learner loses presenter state with room access')
 await assert.rejects(f.rpc(f.a,'present',r.id,null,{
   currentPromptId:second,promptId:first,ratio:'0.8'
 }),/not_authorized/)
 await f.rpc(f.teacher,'end',r.id,r.version)
 await assert.rejects(f.rpc(f.teacher,'present',r.id,null,{
   currentPromptId:second,promptId:second,ratio:'0.8'
 }),/session_closed/)
 await f.db.close()
 console.log('PASS: teacher-only per-page scroll, joined follower, past page, stale and malformed denial, pause/end and enrollment revocation')
}

// Past Classes are an authorized read-only inventory of sessions that ended.
// Never let class eligibility alone grant access to sessions not attended.
{
 const f=await createLiveFixture()
 let lesson=await f.rpc(f.teacher,'start',null,null,{title:'Archived Grade 4 lesson'})
 await f.rpc(f.a,'join',lesson.id)
 lesson=await f.rpc(f.teacher,'publish',lesson.id,lesson.version,{kind:'quiz',body:'Past class question',answerKey:'Never reveal prematurely'})
 await f.rpc(f.teacher,'end',lesson.id,lesson.version)
 const attendeePast=await f.rpc(f.a,'past_list')
 assert.equal(attendeePast.length,1)
 assert.equal(attendeePast[0].id,lesson.id)
 assert.equal(attendeePast[0].status,'ended')
 assert.equal(attendeePast[0].title,'Archived Grade 4 lesson')
 assert.ok(Number.isFinite(Date.parse(attendeePast[0].startedAt)))
 assert.deepEqual(await f.rpc(f.b,'past_list'),[],'Eligible but non-attending student must not see past lesson')
 assert.deepEqual(await f.rpc(f.outsider,'past_list'),[],'Different-school student must not see past lesson')
 await assert.rejects(f.rpc(f.cpa,'past_list'),/live_not_authorized/,'Muted professional student must not see school-level archive')
 assert.equal((await f.rpc(f.teacher,'past_list',null,null,{host:true}))[0].id,lesson.id)
 const review=await f.rpc(f.a,'get',lesson.id)
 assert.equal(review.status,'ended')
 assert.equal(review.history.length,1)
 assert.equal(review.history[0].answerKey,null,'Unrevealed quiz answer must remain private after class')
 await assert.rejects(f.rpc(f.b,'get',lesson.id),/live_join_required/)
 await assert.rejects(f.rpc(f.outsider,'get',lesson.id),/live_not_authorized/)
 await assert.rejects(f.rpc(null,'past_list',null,null,{},f.cls,'anon'),/permission denied/)
 await f.db.exec(`delete from public.student_classes where student_id='${f.id(30)}'`)
 await assert.rejects(f.rpc(f.a,'past_list'),/live_not_authorized/,'Revocation must remove access to the archive')
 await assert.rejects(f.rpc(f.a,'get',lesson.id),/live_not_authorized/)
 console.log('PASS: Past Classes are attended-only, read-only, scoped, revoked and do not leak hidden answers')
 await f.db.close()
}

// Separate, disposable lifecycle proof: only admitted peers communicate, pause
// blocks sending, ended classes retain read-only transcripts, revocation closes both.
{
 const f=await createLiveFixture()
 let lesson=await f.rpc(f.teacher,'start',null,null,{title:'Private chat lifecycle'})
 const sid=lesson.id
 const learnerId=f.id(30)
 await assert.rejects(f.rpc(f.teacher,'dm_send',sid,null,{studentId:learnerId,requestId:f.id(250),body:'Before join'}),/live_not_authorized/)
 await f.rpc(f.a,'join',sid)
 await f.rpc(f.teacher,'dm_send',sid,null,{studentId:learnerId,requestId:f.id(251),body:'Help with this lesson'})
 assert.equal((await f.rpc(f.a,'dm_list',sid)).messages.length,1)
 lesson=await f.rpc(f.teacher,'pause',sid,lesson.version)
 await assert.rejects(f.rpc(f.a,'dm_send',sid,null,{requestId:f.id(252),body:'Paused message'}),/live_message_closed/)
 lesson=await f.rpc(f.teacher,'end',sid,lesson.version)
 assert.equal((await f.rpc(f.teacher,'dm_list',sid,null,{studentId:learnerId})).messages.length,1)
 assert.equal((await f.rpc(f.a,'dm_list',sid)).messages.length,1)
 await assert.rejects(f.rpc(f.teacher,'dm_send',sid,null,{studentId:learnerId,requestId:f.id(253),body:'After session'}),/live_session_closed/)
 await assert.rejects(f.rpc(null,'dm_list',sid,null,{},f.cls,'anon'),/permission denied/)
 await f.db.exec("delete from public.student_classes where student_id='"+learnerId+"'")
 await assert.rejects(f.rpc(f.a,'dm_list',sid),/live_not_authorized/)
 await assert.rejects(f.rpc(f.teacher,'dm_list',sid,null,{studentId:learnerId}),/live_not_authorized/)
 console.log('PASS: private conversation join-only, pause stop, ended read-only and enrollment revocation')
 await f.db.close()
}

// Moderated room chat and ephemeral direct typing: actual SQL authorization,
// no anonymous/other learner access, no replay, no permanent "typing" state.
{
 const f=await createLiveFixture()
 let room=await f.rpc(f.teacher,'start',null,null,{title:'Moderated chat pilot'})
 const sid=room.id
 await f.rpc(f.a,'join',sid); await f.rpc(f.b,'join',sid)
 assert.equal((await f.rpc(f.a,'get',sid)).chatEnabled,false)
 await assert.rejects(f.rpc(f.a,'chat_send',sid,null,{requestId:f.id(300),body:'Cannot chat while closed'}),/live_chat_closed/)
 await assert.rejects(f.rpc(f.a,'chat_toggle',sid,null,{enabled:true}),/live_teacher_required/)
 assert.equal((await f.rpc(f.teacher,'chat_toggle',sid,null,{enabled:true})).enabled,true)
 assert.equal((await f.rpc(f.a,'get',sid)).chatEnabled,true)
 await assert.rejects(f.rpc(f.outsider,'chat_list',sid),/live_not_authorized/)
 await assert.rejects(f.rpc(f.otherTeacher,'chat_hide',sid,null,{messageId:f.id(301)}),/live_not_authorized/)
 assert.deepEqual((await f.rpc(f.a,'chat_list',sid)).messages,[])
 const learnerMessage={body:'May we try another fraction?',requestId:f.id(301)}
 assert.deepEqual(await f.rpc(f.a,'chat_send',sid,null,learnerMessage),{sent:true})
 assert.deepEqual(await f.rpc(f.a,'chat_send',sid,null,learnerMessage),{sent:true},'same requestId must be idempotent')
 await assert.rejects(f.rpc(f.a,'chat_send',sid,null,{...learnerMessage,body:'Changed text'}),/live_request_id_reused/)
 await assert.rejects(f.rpc(f.a,'chat_send',sid,null,{body:'Spam',requestId:f.id(302)}),/live_chat_rate_limit/)
 let visible=(await f.rpc(f.b,'chat_list',sid)).messages
 assert.equal(visible.length,1)
 assert.equal(visible[0].body,learnerMessage.body)
 assert.equal(visible[0].author,'Learner A')
 assert.equal(visible[0].hidden,false)
 const messageId=visible[0].id
 await f.rpc(f.b,'chat_report',sid,null,{messageId,reason:'Needs moderation'})
 assert.equal((await f.rpc(f.teacher,'chat_list',sid)).messages[0].reports,1)
 await assert.rejects(f.rpc(f.a,'chat_hide',sid,null,{messageId}),/live_teacher_required/)
 assert.deepEqual(await f.rpc(f.teacher,'chat_hide',sid,null,{messageId}),{hidden:true})
 assert.deepEqual((await f.rpc(f.b,'chat_list',sid)).messages,[],'hidden message no longer visible to learners')
 assert.equal((await f.rpc(f.teacher,'chat_list',sid)).messages[0].hidden,true,'teacher retains moderation audit')
 await assert.rejects(f.rpc(f.b,'chat_report',sid,null,{messageId,reason:'Hidden'}),/live_not_authorized/)
 await f.rpc(f.teacher,'chat_toggle',sid,null,{enabled:false})
 await assert.rejects(f.rpc(f.a,'chat_send',sid,null,{body:'Closed',requestId:f.id(303)}),/live_chat_closed/)
 await f.rpc(f.teacher,'dm_typing',sid,null,{studentId:f.id(30),typing:true})
 assert.equal((await f.rpc(f.a,'dm_list',sid)).peerTyping,true)
 assert.equal((await f.rpc(f.b,'dm_list',sid)).peerTyping,false,'different learner cannot see another DM typing')
 await assert.rejects(f.rpc(f.a,'dm_typing',sid,null,{studentId:f.id(31),typing:true}),/live_not_authorized/)
 await assert.rejects(f.rpc(f.outsider,'dm_typing',sid,null,{typing:true}),/live_not_authorized/)
 await f.rpc(f.a,'dm_typing',sid,null,{typing:true})
 assert.equal((await f.rpc(f.teacher,'dm_list',sid,null,{studentId:f.id(30)})).peerTyping,true)
 await f.db.exec("update vibe_live.dm_typing set touched_at=clock_timestamp()-interval '15 seconds'")
 assert.equal((await f.rpc(f.a,'dm_list',sid)).peerTyping,false,'typing expires without permanent status')
 assert.equal((await f.rpc(f.teacher,'dm_list',sid,null,{studentId:f.id(30)})).peerTyping,false)
 for(const role of ['authenticated','anon','service_role']){
  await f.db.exec('set role '+role)
  try{
   for(const table of ['class_messages','class_reports','waiting_requests','dm_typing']){
    await assert.rejects(f.db.query('select * from vibe_live.'+table),/permission denied/);
    await assert.rejects(f.db.query('delete from vibe_live.'+table),/permission denied/);
   }
  }finally{await f.db.exec('reset role')}
 }
 await f.db.exec("delete from public.student_classes where student_id='"+f.id(30)+"'")
 await assert.rejects(f.rpc(f.a,'chat_list',sid),/live_not_authorized/)
 await assert.rejects(f.rpc(f.a,'dm_typing',sid,null,{typing:true}),/live_not_authorized/)
 console.log('PASS: moderated classroom text chat, truthful reports/hiding, sender rate limits, two-learner isolation and expiring private typing')
 await f.db.close()
}

 // Live presentation navigation uses the public current slide as its anchor.
{
 const deck=[{title:'One',body:'First',notes:'Private'},{title:'',body:''},{title:'Three',body:'Third'}]
 const first=decodeSlide(encodeSlide(deck[0],1,3))
 const third=decodeSlide(encodeSlide(deck[2],3,3))
 assert.equal(adjacentSlide(deck,first,1),2)
 assert.equal(adjacentSlide(deck,first,-1),null)
 assert.equal(adjacentSlide(deck,third,-1),0)
 assert.equal(adjacentSlide(deck,third,1),null)
 assert.equal(adjacentSlide(deck.slice(0,2),first,1),null)
 assert.equal(adjacentSlide([{...deck[0],body:'Replaced'},...deck.slice(1)],first,1),null)
 assert.equal(adjacentSlide([{...deck[0],notes:'Changed private notes'},...deck.slice(1)],first,1),2)
 assert.equal(adjacentSlide([deck[0],deck[1],deck[1]],first,1),null)
}

await import('./test-live-workbook-contract.mjs')
await import('./test-live-classroom-phase.mjs')

await import('./test-live-stage-ink.mjs')
