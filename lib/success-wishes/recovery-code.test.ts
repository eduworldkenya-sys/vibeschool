import test from 'node:test'
import assert from 'node:assert/strict'
import { formatRecoveryCode, newRecoveryCodeFromBytes, newSixCharacterRecoveryCode, normalizeRecoveryCode } from './recovery-code'

test('new six-character backups include letters, digits and symbols and normalize safely', () => {
  for (let i=0;i<80;i++) {
    const code = newSixCharacterRecoveryCode()
    assert.match(code, /^(?=.*[A-HJ-NP-Z])(?=.*[0-9])(?=.*[@!#])[A-HJ-NP-Z0-9@!#]{6}$/)
    assert.equal(normalizeRecoveryCode(code.toLowerCase()),code)
    assert.equal(formatRecoveryCode(code),code)
  }
  assert.equal(normalizeRecoveryCode('123456'),null)
  assert.equal(normalizeRecoveryCode('AAAAAA'),null)
})

test('saved recovery codes encode exactly 80 bits and group for mobile entry', () => {
  assert.equal(newRecoveryCodeFromBytes(new Uint8Array(10)), '0000000000000000')
  assert.equal(newRecoveryCodeFromBytes(new Uint8Array(10).fill(255)), 'ZZZZZZZZZZZZZZZZ')
  const raw = newRecoveryCodeFromBytes(new Uint8Array([0,1,2,3,4,5,6,7,8,9]))
  assert.match(raw,/^[0-9A-HJKMNP-TV-Z]{16}$/)
  assert.equal(normalizeRecoveryCode(formatRecoveryCode(raw)), raw)
  assert.equal(normalizeRecoveryCode(formatRecoveryCode(raw).toLowerCase()),raw)
  assert.equal(normalizeRecoveryCode(raw),raw)
})

test('old 32-character recovery codes remain valid without rotating them', () => {
  assert.equal(normalizeRecoveryCode('A'.repeat(32)),'A'.repeat(32))
  assert.equal(normalizeRecoveryCode('a'.repeat(32)),'A'.repeat(32))
  assert.equal(formatRecoveryCode('A'.repeat(32)),'A'.repeat(32))
})

test('short, malformed and ambiguous codes are rejected without leaking receiver existence', () => {
  for (const invalid of ['5tt','', 'a'.repeat(15), 'a'.repeat(17), 'O'.repeat(16),
    'I'.repeat(16), 'L'.repeat(16), 'U'.repeat(16), 'A'.repeat(31),
    'A'.repeat(33), '💛'.repeat(16), 'aaaa-aaaa-aaaa-aaaa-aaaa', null, 1234])
    assert.equal(normalizeRecoveryCode(invalid), null)
})
