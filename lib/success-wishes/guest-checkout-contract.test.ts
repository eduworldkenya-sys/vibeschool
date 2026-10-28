import test from 'node:test'
import assert from 'node:assert/strict'
import { guestTextWishQuote, sameGuestTextWishQuote, TEXT_WISH_AMOUNT_KES } from './guest-checkout-contract'
import { WishError } from './contracts'

const payload = {
  version: 'text',
  theme: 'heritage',
  candidate: 'Mary Wanjiku',
  sender: 'Mother',
  message: 'You have worked hard. We are proud of you.',
  examYear: '2026',
  school: 'Sample Secondary',
  payerPhone: '0712345678',
  deliveryPhone: '0733000111',
  idempotencyKey: 'a'.repeat(64),
}

test('server creates a single KSh 50 frozen quote that reproduces sender preview', () => {
  const quote = guestTextWishQuote(payload)
  assert.equal(quote.amountKes, TEXT_WISH_AMOUNT_KES)
  assert.equal(quote.amountKes, 50)
  assert.equal(quote.currency, 'KES')
  assert.equal(quote.payerPhone, '254712345678')
  assert.notEqual(quote.card.deliveryPhone,'+254712345678','Payment phone is not the recipient address')
  assert.deepEqual(quote.card, {
    kind: 'success_wish_text',
    theme: 'heritage',
    candidate: 'Mary Wanjiku',
    sender: 'Mother',
    message: 'You have worked hard. We are proud of you.',
    examYear: '2026',
    school: 'Sample Secondary',
    deliveryPhone: '+254733000111',
  })
  assert.match(quote.cardDigest, /^[a-f0-9]{64}$/)
  assert.equal(Object.isFrozen(quote), true)
  assert.equal(Object.isFrozen(quote.card), true)
  assert.equal(sameGuestTextWishQuote(quote,guestTextWishQuote({...payload,payerPhone:'+254712345678'})),true)
})

test('changed message, design, year, recipient, school or payer cannot reuse quote', () => {
  const original = guestTextWishQuote(payload)
  const edits = [
    {message:'A different wish'}, {theme:'botanical'}, {examYear:'2027'},
    {candidate:'Another Student'}, {sender:'Another Sender'},
    {school:'Another School'}, {payerPhone:'0712345679'}, {deliveryPhone:'0733000112'}, {idempotencyKey:'b'.repeat(64)},
  ]
  for (const edit of edits) {
    const change = guestTextWishQuote({...payload,...edit})
    assert.equal(sameGuestTextWishQuote(original, change), false)
  }
})

test('customer-provided prices, payment receipts and fake paid claims are forbidden', () => {
  for (const fieldName of [
    'price', 'amountKes', 'currency', 'paid', 'paymentStatus',
    'providerReceipt', 'checkoutRequestId', 'merchantRequestId','paymentAttemptId',
  ]) {
    assert.throws(() => guestTextWishQuote({...payload,[fieldName]:fieldName==='paid'?true:1}),WishError)
  }
})

test('only four text cards and valid input lengths are eligible for a locked order', () => {
  const edits: Record<string, unknown>[] = [
    {version:'voice'}, {version:'video'}, {theme:'unapproved'},
    {candidate:''},{candidate:'x'.repeat(49)}, {sender:''},{sender:'x'.repeat(49)},
    {message:''},{message:'x'.repeat(221)}, {examYear:'26'}, {examYear:'203'},
    {school:'x'.repeat(81)}, {payerPhone:'254800000000'}, {deliveryPhone:'254800000000'}, {deliveryPhone:''},
    {idempotencyKey:'123'}, {idempotencyKey:'A'.repeat(64)},
    {message:'Hidden\u0001character'},
  ]
  for (const edit of edits) {
    assert.throws(()=>guestTextWishQuote({...payload,...edit}),WishError,JSON.stringify(edit))
  }
})

test('optional school is not a sponsored-pilot dependency', () => {
  const q=guestTextWishQuote({...payload,school:''})
  assert.equal(q.card.school,'')
  assert.equal(q.amountKes,50)
  assert.ok(!('schoolId' in q.card))
})
