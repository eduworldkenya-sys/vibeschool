import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('app/schools/page.tsx','utf8')
assert.match(page,/const KENYA_COUNTIES=\[/)
assert.match(page,/Nakuru/)
assert.match(page,/schools_search_public_v2/)
assert.match(page,/schools_search_public_v1/)
assert.match(page,/schools_search_community_pending_v2/)
assert.match(page,/schools_search_community_pending_v1/)
console.log('school directory resilience contract passed')
