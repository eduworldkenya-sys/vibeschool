import test from 'node:test'
import assert from 'node:assert/strict'
import {groupWishQuote} from './group-checkout'
const key='a'.repeat(64)
const student=(candidate='Mary')=>({candidate,message:'You can do this.',theme:'heritage',examYear:'2026',school:'',deliveryPhone:'0733000111'})
const input=(count:number)=>({sender:'Mum',payerPhone:'0712345678',students:Array.from({length:count},(_,i)=>student('Learner '+i))})
test('two, three and four personal cards always cost KSh 100; snapshots preserve individual designs',()=>{
 for(const count of [2,3,4]){const quote=groupWishQuote(input(count),key);assert.equal(quote.amountKes,100);assert.equal(quote.cards.length,count);assert.equal(quote.payerPhone,'254712345678');assert.equal(quote.cards[0].sender,'Mum')}
 const b=input(2);b.students[1].theme='nightfall';b.students[1].message='A different message'
 const q=groupWishQuote(b,key);assert.equal(q.cards[1].theme,'nightfall');assert.notEqual(q.cards[0].message,q.cards[1].message)
 assert.notEqual(q.digest,groupWishQuote(input(2),key).digest)
})
test('count, price manipulation, receipt injection and malformed cards fail closed',()=>{
 for(const count of [0,1,5])assert.throws(()=>groupWishQuote(input(count),key))
 for(const field of ['amountKes','price','paid','currency','paymentStatus','providerReceipt','checkoutRequestId','merchantRequestId','paymentAttemptId'])assert.throws(()=>groupWishQuote({...input(2),[field]:100},key))
 for(const change of [{theme:'fake'},{candidate:''},{message:''},{deliveryPhone:'bad'}]){const b=input(2);Object.assign(b.students[1],change);assert.throws(()=>groupWishQuote(b,key))}
})
test('shared family phone and duplicate names are valid, while snapshot changes alter the replay digest',()=>{
 const b={...input(2),students:[student(),student()]};const q=groupWishQuote(b,key);assert.equal(q.cards.length,2)
 b.students[1].deliveryPhone='0733000222';assert.notEqual(groupWishQuote(b,key).digest,q.digest)
})
