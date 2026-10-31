import test from 'node:test'
import assert from 'node:assert/strict'
import {hashSecret} from './security'
import {matchingRecoveryCandidates,type RecoveryReceiver,type RecoveryReview} from './hq-recovery-match'
const id1='a1111111-1111-4111-8111-111111111111',id2='b2222222-2222-4222-8222-222222222222'
const receiver=(overrides:Partial<RecoveryReceiver>={}):RecoveryReceiver=>({
 id:id1,display_name:'Helen Njeri',school_label:'Example Primary',phone_e164:'+254733000111',
 pin_exam_year:'2026',pin_hash:'synthetic-not-a-real-pin',consent_status:'active',...overrides
})
const review=(overrides:Partial<RecoveryReview>={}):RecoveryReview=>({
 id:'c3333333-3333-4333-8333-333333333333',exam_year:'2026',status:'pending',
 name_digest:hashSecret('success-wishes:recovery-review:name:helen njeri'),
 phone_digest:hashSecret('success-wishes:recovery-review:phone:+254733000111'),...overrides
})
test('HQ sees only the exact name, phone and year matching PIN inbox without raw phone',()=>{
 const matches=matchingRecoveryCandidates(review(),[
  receiver(),receiver({id:id2,display_name:'Different learner'}),
  receiver({id:id2,phone_e164:'+254712345678'}),
  receiver({id:id2,pin_exam_year:'2025'})
 ])
 assert.equal(matches.length,1)
 assert.deepEqual(matches[0],{id:id1,name:'Helen Njeri',school:'Example Primary',examYear:'2026',maskedPhone:'•••• 0111'})
 assert.equal(JSON.stringify(matches).includes('+254733000111'),false)
 assert.equal(JSON.stringify(matches).includes('pin_hash'),false)
})
test('shared phone does not grant a sibling access; duplicate exact identities remain separate choices',()=>{
 const sibling=receiver({id:id2,display_name:'Joseph Njeri'})
 assert.equal(matchingRecoveryCandidates(review(),[receiver(),sibling]).length,1)
 const duplicate=receiver({id:id2,school_label:'Different School'})
 const matched=matchingRecoveryCandidates(review(),[receiver(),duplicate])
 assert.equal(matched.length,2)
 assert.deepEqual(matched.map(x=>x.id),[id1,id2])
 assert.deepEqual(matched.map(x=>x.school),['Example Primary','Different School'])
})
test('invalid, revoked, guest-only, wrong-year and closed reviews cannot be suggested',()=>{
 assert.deepEqual(matchingRecoveryCandidates(review(),[
  receiver({pin_hash:null}),receiver({consent_status:'revoked'}),
  receiver({pin_exam_year:'2025'})
 ]),[])
 assert.deepEqual(matchingRecoveryCandidates(review({status:'completed'}),[receiver()]),[])
 assert.deepEqual(matchingRecoveryCandidates(review({status:'rejected'}),[receiver()]),[])
 assert.deepEqual(matchingRecoveryCandidates(review({name_digest:'f'.repeat(64)}),[receiver()]),[])
 assert.deepEqual(matchingRecoveryCandidates(review({phone_digest:'f'.repeat(64)}),[receiver()]),[])
})
test('normalization matches the exact account name without broad fuzzy or phone-only discovery',()=>{
 assert.equal(matchingRecoveryCandidates(review(),[receiver({display_name:'  HELEN   NJERI  '})]).length,1)
 assert.equal(matchingRecoveryCandidates(review(),[receiver({display_name:'Helena Njeri'})]).length,0)
})
