import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSafaricomPhone,reconcileWishPayment,type Attempt,type ProviderCallback} from './payment-contract'
const attempt:Attempt={
 state:'awaiting_customer',checkoutRequestId:'ws_12345',
 merchantRequestId:'merchant_123',expectedAmountKes:100,
 phone:'254712345678',
}
const success:ProviderCallback={
 checkoutRequestId:'ws_12345',merchantRequestId:'merchant_123',
 resultCode:0,amountKes:100,phone:'0712345678',receipt:'THJ7ABCD23',
}
test('payment phone normalization is Kenya-specific and strict',()=>{
 assert.equal(normalizeSafaricomPhone('+254 712 345 678'),'254712345678')
 assert.equal(normalizeSafaricomPhone('0712345678'),'254712345678')
 for(const x of ['+255712345678','999999','00123456789','254812345678','254712345678;DROP']){
  assert.throws(()=>normalizeSafaricomPhone(x))
 }
})
test('settlement requires matching provider reference amount receipt and phone',()=>{
 assert.deepEqual(reconcileWishPayment(attempt,success),{decision:'settle',receipt:'THJ7ABCD23'})
 for(const modified of [
  {...success,checkoutRequestId:'foreign'},
  {...success,merchantRequestId:'other'},
  {...success,amountKes:90},
  {...success,phone:'0712345679'},
  {...success,receipt:''},
  {...success,receipt:'??invalid'},
 ]) assert.equal(reconcileWishPayment(attempt,modified).decision,'reconciliation_required')
})
test('duplicate callbacks are idempotent; conflicting and late callbacks do not release goods',()=>{
 assert.deepEqual(reconcileWishPayment({...attempt,state:'settled',providerReceipt:success.receipt},success),{decision:'duplicate'})
 assert.equal(reconcileWishPayment({...attempt,state:'settled',providerReceipt:success.receipt},{...success,receipt:'OTHER'}).decision,'reconciliation_required')
 assert.equal(reconcileWishPayment({...attempt,state:'refund_pending'},success).decision,'reconciliation_required')
 assert.equal(reconcileWishPayment({...attempt,state:'refunded'},success).decision,'reconciliation_required')
 assert.equal(reconcileWishPayment({...attempt,state:'failed'},success).decision,'reconciliation_required')
})
test('failed and uncertain callbacks never masquerade as completed payment',()=>{
 assert.equal(reconcileWishPayment(attempt,{...success,resultCode:1032,receipt:null,amountKes:null}).decision,'fail')
 assert.equal(reconcileWishPayment({...attempt,state:'reconciliation_required'},{...success,resultCode:1032}).decision,'reconciliation_required')
 assert.equal(reconcileWishPayment(attempt,{...success,resultCode:NaN}).decision,'reconciliation_required')
})
