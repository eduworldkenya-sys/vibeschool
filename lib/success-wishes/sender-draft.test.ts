import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeSenderDraft, encodeSenderDraft, SENDER_DRAFT_TTL_MS, type SenderDraft } from './sender-draft'
import { wrapCardText } from './card-text'

const draft: SenderDraft = { theme: 'nightfall', candidate: 'Candidate name', sender: 'Sender name',
  message: 'First line\nSecond line', school: 'School name', examYear: '2026' }
const now = Date.UTC(2026, 9, 26)

test('restores the exact text draft, design and line breaks before expiry', () => {
  assert.deepEqual(decodeSenderDraft(encodeSenderDraft(draft, now), now + 500), draft)
})
test('delivery phone can restore in the same tab without retaining arbitrary payment data',()=>{
  const saved={...draft,deliveryPhone:'0733000111'}
  assert.deepEqual(decodeSenderDraft(encodeSenderDraft(saved,now),now+500),saved)
  assert.equal(decodeSenderDraft(encodeSenderDraft({...saved,deliveryPhone:'123'},now),now),null)
})

test('rejects expired, future, malformed, oversized and invalid drafts', () => {
  for (const raw of [null, '{', 'x'.repeat(8001), encodeSenderDraft(draft, now - SENDER_DRAFT_TTL_MS),
    encodeSenderDraft(draft, now + 120000), encodeSenderDraft({ ...draft, message: 'x'.repeat(221) }, now),
    JSON.stringify({ version: 2, savedAt: now, draft }),
    JSON.stringify({ version: 1, savedAt: now, draft: { ...draft, theme: 'unknown' } })]) {
    assert.equal(decodeSenderDraft(raw, now), null)
  }
})
test('does not restore payment tokens, phone numbers or arbitrary saved properties', () => {
  const restored = decodeSenderDraft(JSON.stringify({ version: 1, savedAt: now,
    draft: { ...draft, phone: 'private', invitationToken: 'private', paid: true } }), now)
  assert.deepEqual(restored, draft)
})
test('preserves every character in maximum-length unbroken sender and school names', () => {
  for (const [text, width] of [['With love, ' + 'A'.repeat(48), 42], ['S'.repeat(80), 56]] as const) {
    assert.equal(wrapCardText(text, width).join('').replace(/\s/g, ''), text.replace(/\s/g, ''))
  }
})
test('does not truncate an allowed wish requiring more than five lines', () => {
  const message = Array(7).fill('a'.repeat(30)).join(' ')
  const lines = wrapCardText(message, 53)
  assert.equal(message.length, 216)
  assert.equal(lines.length, 7)
  assert.equal(lines.join(' '), message)
})
test('wraps emoji without splitting surrogate pairs', () => {
  assert.deepEqual(wrapCardText('🌟'.repeat(8), 3), ['🌟🌟🌟', '🌟🌟🌟', '🌟🌟'])
})
