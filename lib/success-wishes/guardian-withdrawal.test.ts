import test from 'node:test'
import assert from 'node:assert/strict'
import { requireGuardianWithdrawalAuthority } from './guardian-withdrawal'

const guardian='11111111-1111-4111-8111-111111111111'
const school='22222222-2222-4222-8222-222222222222'
const student='33333333-3333-4333-8333-333333333333'
const receiver='44444444-4444-4444-8444-444444444444'
const phone='+254712345678'
const audit={ receiver_id:receiver, student_id:student, school_id:school, guardian_link_id:'55555555-5555-4555-8555-555555555555' }
const link={ id:audit.guardian_link_id, parent_id:guardian, student_id:student, school_id:school, is_primary:true, receives_alerts:true, relationship:'mother' }
const person={ id:receiver, student_id:student, guardian_phone_e164:phone, consent_route:'guardian', consent_status:'verified' }
const check=(g=guardian,ph=phone,r=receiver,a:typeof audit|null=audit,l:typeof link|null=link,p:typeof person|null=person)=>
  requireGuardianWithdrawalAuthority(g,ph,r,a,l,p)
test('verified guardian can request independent withdrawal without any student inbox session',()=>{
  assert.deepEqual(check(),{receiverId:receiver,phone})
})
test('cross-student/cross-school/wrong-person claims cannot withdraw',()=>{
  assert.throws(()=>check(guardian,phone,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))
  assert.throws(()=>check(guardian,phone,receiver,{...audit,school_id:'other'}))
  assert.throws(()=>check(guardian,phone,receiver,{...audit,student_id:'other'}))
  assert.throws(()=>check(guardian,phone,receiver,{...audit,guardian_link_id:'other'}))
  assert.throws(()=>check('other',phone))
  assert.throws(()=>check(guardian,phone,receiver,audit,{...link,parent_id:'other'}))
})
test('revoked, pending, switched authority and unconfirmed destination cannot be used',()=>{
  assert.throws(()=>check(guardian,phone,receiver,audit,link,{...person,consent_status:'pending'}))
  assert.throws(()=>check(guardian,phone,receiver,audit,link,{...person,consent_status:'revoked'}))
  assert.throws(()=>check(guardian,phone,receiver,audit,link,{...person,consent_route:'adult'}))
  assert.throws(()=>check(guardian,'+254733333333'))
  assert.throws(()=>check(guardian,phone,receiver,audit,{...link,is_primary:false}))
  assert.throws(()=>check(guardian,phone,receiver,audit,{...link,receives_alerts:false}))
  assert.throws(()=>check(guardian,phone,receiver,audit,{...link,relationship:'other'}))
  assert.throws(()=>check(guardian,phone,receiver,null,link,person))
})
