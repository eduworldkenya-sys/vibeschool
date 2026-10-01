import assert from 'node:assert/strict'
import fs from 'node:fs'

const cache = fs.readFileSync('lib/pulse/cache.ts', 'utf8')
const pulse = fs.readFileSync('app/teacher/pulse/page.tsx', 'utf8')

assert.match(cache, /readSnapCache\(userId: string, schoolId: string\)/)
assert.match(cache, /wrapped\.userId !== userId/)
assert.match(cache, /wrapped\.schoolId !== schoolId/)
assert.match(cache, /wrapped\.data\.userId !== userId/)
assert.match(cache, /wrapped\.data\.schoolId !== schoolId/)
assert.match(cache, /SNAP_CACHE_PREFIX.*userId.*schoolId/s)
assert.match(cache, /removeItem\(LEGACY_SNAP_CACHE_KEY\)/)
assert.doesNotMatch(pulse, /readSnapCache\(\)/)
assert.match(pulse, /readSnapCache\(user\.id, schoolId\)/)

const authPosition = pulse.indexOf('supabase.auth.getUser()')
const contextPosition = pulse.indexOf('get_my_teacher_school_context')
const cachePosition = pulse.indexOf('readSnapCache(user.id, schoolId)')
assert.ok(authPosition >= 0 && contextPosition > authPosition && cachePosition > contextPosition,
  'Pulse must authenticate and resolve school authority before reading offline teaching data')

console.log('Pulse cross-account cache isolation contract passed')
