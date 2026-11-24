import assert from 'node:assert/strict'
import {liveHomeworkDraft,liveHomeworkLink} from '../lib/live/homeworkHandoff.ts'
const id='00000000-0000-4000-8000-000000000001',cls='00000000-0000-4000-8000-000000000002'
const room={id,teacher:true,mode:'school',status:'ended',title:'Grade 4 Maths',history:[
 {kind:'teach',body:'private? not an exercise'},
 {kind:'quiz',body:'What is one half?',answerKey:'SECRET KEY'},
 {kind:'poll',body:'Favourite colour?'},
 {kind:'exercise',body:'Find 3/4 of 24.',answerKey:'18'},
 {kind:'quiz',body:'What is one half?',answerKey:'SECRET KEY'}
]}
const draft=liveHomeworkDraft(room,id)
assert.equal(draft.title,'Grade 4 Maths · Homework')
assert.equal(draft.instructions,'1. What is one half?\n\n2. Find 3/4 of 24.')
assert.ok(!JSON.stringify(draft).includes('SECRET KEY'))
assert.throws(()=>liveHomeworkDraft({...room,teacher:false},id))
assert.throws(()=>liveHomeworkDraft({...room,mode:'tuition'},id))
assert.throws(()=>liveHomeworkDraft({...room,status:'active'},id))
assert.throws(()=>liveHomeworkDraft(room,cls))
assert.equal(liveHomeworkLink(cls,id,null,null),'/teacher/classhub/'+cls+'/homework?liveRoomId='+id)
assert.equal(liveHomeworkLink('../other',id,null,null),null)
console.log('PASS: authorized homework source projection, question deduplication, answer-key exclusion and safe navigation')
