import assert from 'node:assert/strict'

// Destructive only to its own newly created test session. Never run against production.
const { LIVE_TEST_URL, LIVE_TEST_ANON_KEY, LIVE_TEST_TEACHER_TOKEN,
  LIVE_TEST_LEARNER_TOKEN, LIVE_TEST_OUTSIDER_TOKEN, LIVE_TEST_CLASS_ID,
  LIVE_TEST_DISPOSABLE } = process.env
if (LIVE_TEST_DISPOSABLE !== 'YES' || !LIVE_TEST_URL || !LIVE_TEST_ANON_KEY ||
    !LIVE_TEST_TEACHER_TOKEN || !LIVE_TEST_LEARNER_TOKEN || !LIVE_TEST_OUTSIDER_TOKEN || !LIVE_TEST_CLASS_ID) {
  throw new Error('Dedicated staging fixtures and explicit LIVE_TEST_DISPOSABLE=YES required.')
}
if (LIVE_TEST_URL.includes('yauqsxggtuxuykcbrtzf')) throw new Error('Production project forbidden')
const T = LIVE_TEST_TEACHER_TOKEN, L = LIVE_TEST_LEARNER_TOKEN, O = LIVE_TEST_OUTSIDER_TOKEN
async function command(token, action, id=null, version=null, payload={}) {
  const response = await fetch(`${LIVE_TEST_URL.replace(/\/$/,'')}/rest/v1/rpc/vibe_live_command`, {
    method:'POST', headers: { apikey: LIVE_TEST_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type':'application/json' },
    body:JSON.stringify({p_action:action,p_class_id:LIVE_TEST_CLASS_ID,p_session_id:id,p_version:version,p_payload:{...payload,host:token===T}})
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.message??'RPC failed'),{code:result.code,status:response.status})
  return result
}
let room
try {
  const existing=await command(T,'list')
  assert.ok(!existing.some(r=>r.own),'Dedicated teacher must have no active room')
  room=await command(T,'start',null,null,{title:`History test ${Date.now()}`,mode:'school'})
  const id=room.id
  const joined=await command(L,'join',id)
  assert.deepEqual(joined.history,[])
  await assert.rejects(command(O,'get',id),e=>e.code==='42501')
  await assert.rejects(command(O,'join',id),e=>e.code==='42501')
  const first={kind:'teach',body:'Opening explanation',answerKey:null,requestId:crypto.randomUUID()}
  const oldVersion=room.version
  room=await command(T,'publish',id,oldVersion,first)
  assert.equal(room.history.length,1)
  assert.equal(room.history[0].position,1)
  const again=await command(T,'publish',id,oldVersion,first)
  assert.equal(again.history.length,1)
  assert.equal(again.version,room.version)
  await assert.rejects(command(T,'publish',id,room.version,{...first,body:'Different'}))
  await assert.rejects(command(T,'publish',id,oldVersion,{...first,requestId:crypto.randomUUID()}))
  await assert.rejects(command(L,'publish',id,room.version,{...first,requestId:crypto.randomUUID()}),e=>e.code==='42501')
  const nextItems=[{kind:'board',body:'10,10;20,20;',answerKey:null},{kind:'teach',body:'Slide 1\n\nExample',answerKey:null},{kind:'quiz',body:'1+1?',answerKey:'2'}]
  for(const item of nextItems){room=await command(T,'publish',id,room.version,{...item,requestId:crypto.randomUUID()})}
  const learner=await command(L,'get',id)
  assert.deepEqual(learner.history.map(p=>p.position),[1,2,3,4])
  assert.deepEqual(learner.history.map(p=>p.body),[first.body,...nextItems.map(i=>i.body)])
  assert.equal(learner.history.at(-1).answerKey,null)
  assert.equal(learner.prompt.answerKey,null)
  assert.equal(room.history.at(-1).answerKey,'2')
  assert.equal(learner.participants,undefined)
  room=await command(T,'reveal',id,room.version)
  assert.equal((await command(L,'get',id)).history.at(-1).answerKey,'2')
  room=await command(T,'publish',id,room.version,{kind:'teach',body:'Closing notes',answerKey:null,requestId:crypto.randomUUID()})
  assert.equal((await command(L,'get',id)).history.length,5)

  const raised=await command(L,'help',id);assert.equal(raised.needsHelp,true);
  assert.equal((await command(L,'lower',id)).needsHelp,false);
  await command(L,'help',id);
  const host=await command(T,'get',id);
  const hand=host.participants.find(p=>p.needsHelp);assert.ok(hand);
  await command(T,'ack',id,host.version,{studentId:hand.studentId});
  const ack=await command(L,'get',id);assert.equal(ack.needsHelp,false);assert.ok(ack.handAckAt);
  const note='private fixture note';assert.equal((await command(L,'note',id,null,{body:note})).ownNote,note);
  assert.equal((await command(T,'get',id)).ownNote,undefined);
  const ask={body:'Private fixture question',requestId:crypto.randomUUID()};
  const asked=await command(L,'ask',id,null,ask);assert.equal(asked.questions.length,1);
  assert.equal((await command(L,'ask',id,null,ask)).questions.length,1);
  const question=asked.questions[0];
  await assert.rejects(command(L,'reply',id,null,{questionId:question.id,body:'denied'}),e=>e.code==='42501');
  await assert.rejects(command(O,'ask',id,null,ask),e=>e.code==='42501');
  await command(T,'reply',id,null,{questionId:question.id,body:'Teacher reply'});
  assert.equal((await command(L,'get',id)).questions[0].reply,'Teacher reply');

  room=await command(T,'end',id,room.version)
  const archive=await command(L,'get',id)
  assert.equal(archive.status,'ended')
  assert.equal(archive.history.length,5)
  await assert.rejects(command(L,'answer',id,archive.version,{promptId:archive.prompt.id,body:'2'}))
  await assert.rejects(command(O,'get',id),e=>e.code==='42501')
  console.log('PASS: history order, reload/get, retry idempotency, redaction, role isolation, read-only ended session')
} finally {
  if(room && room.status!=='ended') {
    try { const current=await command(T,'get',room.id); if(current.status!=='ended') await command(T,'end',room.id,current.version) } catch(error) { console.error('Fixture cleanup failed:',error.message) }
  }
}