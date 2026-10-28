import test from 'node:test'
import assert from 'node:assert/strict'
import { sixCardCodeFromOrderKey, SIX_CARD_CODE, LEGACY_CARD_CODE } from './card-code'

test('short card references are stable and alphanumeric, not payment secrets',()=>{
  const a='a'.repeat(64),b='b'.repeat(64)
  const one=sixCardCodeFromOrderKey(a),again=sixCardCodeFromOrderKey(a),other=sixCardCodeFromOrderKey(b)
  assert.equal(one,again)
  assert.match(one,SIX_CARD_CODE)
  assert.match(other,SIX_CARD_CODE)
  assert.notEqual(one,other)
  assert.notEqual(one,a.slice(0,6).toUpperCase())
  assert.equal(LEGACY_CARD_CODE.test('A'.repeat(32)),true)
  assert.equal(LEGACY_CARD_CODE.test(one),false)
  for(const invalid of ['a'.repeat(63), 'A'.repeat(64), '', 'not-a-key'])
    assert.throws(()=>sixCardCodeFromOrderKey(invalid))
})
