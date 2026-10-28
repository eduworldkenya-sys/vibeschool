import test from 'node:test'
import assert from 'node:assert/strict'
import {newCheckoutKey,recipientRequestToken,checkoutMessage,pendingCheckout,canPay,maskedPayerPhone} from './checkout-client'
test('only strong private recipient request links can bind a checkout',()=>{
 const key='a'.repeat(64)
 assert.equal(recipientRequestToken(key),key)
 assert.equal(recipientRequestToken('https://vibeschool.co.ke/success-wishes/invite#token='+key),key)
 for(const value of ['bad','https://evil.example/#token='+key,'https://vibeschool.co.ke.evil.example/#token='+key,'http://vibeschool.co.ke/#token='+key])assert.equal(recipientRequestToken(value),'')
})
test('unresolved payment states cannot masquerade as paid or offer another STK',()=>{
 const a=newCheckoutKey();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(newCheckoutKey(),a)
 for(const s of ['submitting','awaiting_customer','reconciliation_required'] as const){assert.equal(pendingCheckout(s),true);assert.doesNotMatch(checkoutMessage(s),/Payment confirmed/)}
 assert.match(checkoutMessage('reconciliation_required'),/Do not pay again/);assert.equal(pendingCheckout('settled'),false)
})

test('pay is hidden while status is uncertain and payer is masked consistently',()=>{
 assert.equal(canPay('created',false),true)
 for(const state of ['created','submitting','awaiting_customer','reconciliation_required','settled','failed','refunded'] as const){
  assert.equal(canPay(state,true),false)
  if(state!=='created')assert.equal(canPay(state,false),false)
 }
 assert.equal(maskedPayerPhone('+254728232157'),'0728 ••• 157')
 assert.equal(maskedPayerPhone('0728232157'),'0728 ••• 157')
 assert.equal(maskedPayerPhone('invalid'),'Your M-Pesa number')
})
