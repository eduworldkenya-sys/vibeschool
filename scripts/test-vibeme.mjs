import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codeFromAvatar, defaultVibeMe, renderVibeMe, parseVibeMe, vibeMeCode, vibeMePath, VIBEME_OPTIONS } from '../lib/vibeme.ts'
test('VibeMe validates bounds and round-trips all settings', () => {
  assert.equal(VIBEME_OPTIONS.reduce((n,o)=>n*o.values.length,1),46656)
  for(const code of ['v1-0000000','v1-5522355','v1-2000000']) {
    const parsed=parseVibeMe(code); assert.ok(parsed)
    assert.equal(vibeMeCode(parsed),code)
    assert.equal(codeFromAvatar(vibeMePath(code)),code)
    assert.match(renderVibeMe(code),/^<svg /)
  }
  for(const code of ['v1-9999999','v1-00000000','<script>','v2-0000000']) {
    assert.equal(parseVibeMe(code),null); assert.equal(renderVibeMe(code),null)
  }
  assert.equal(codeFromAvatar('https://evil.example/api/vibeme/v1-0000000.svg'),null)
  assert.equal(defaultVibeMe('account-a'),defaultVibeMe('account-a'))
  assert.ok(parseVibeMe(defaultVibeMe('account-b')))
})
