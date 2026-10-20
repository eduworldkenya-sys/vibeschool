// Static regression contract: verify VibeSchool's Next.js header configuration.
// This is not a substitute for scanning a deployed HTTPS response.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const config = require('../next.config.js')
assert.equal(typeof config.headers, 'function', 'Next.js must provide header rules')
const rules = await config.headers()
const globals = rules.find(rule => rule.source === '/:path*')
assert.ok(globals, 'Missing global security headers')
const security = Object.fromEntries(globals.headers.map(h => [h.key.toLowerCase(), h.value]))

assert.equal(security['x-content-type-options'], 'nosniff')
assert.equal(security['x-frame-options'], 'DENY')
assert.match(security['strict-transport-security'], /^max-age=\d+$/)
assert.ok(Number(security['strict-transport-security'].split('=')[1]) >= 31536000)
assert.equal(security['referrer-policy'], 'strict-origin-when-cross-origin')
assert.match(security['content-security-policy'], /frame-ancestors 'none'/)
assert.match(security['content-security-policy'], /object-src 'none'/)
assert.ok(!security['content-security-policy'].includes('default-src'), 'Audit dependencies before enforcing a full CSP')

for (const area of ['teacher', 'student', 'parent', 'admin', 'hq', 'school', 'auth']) {
  const rule = rules.find(item => item.source === `/${area}/:path*`)
  assert.ok(rule, `Missing private caching policy for ${area}`)
  const headers = Object.fromEntries(rule.headers.map(h => [h.key.toLowerCase(), h.value]))
  assert.match(headers['cache-control'], /private/)
  assert.match(headers['cache-control'], /no-store/)
}
const login = rules.find(item => item.source === '/login')
assert.ok(login?.headers?.some(h => h.key.toLowerCase() === 'cache-control' && h.value.includes('no-store')))
assert.ok(!rules.some(item => item.source.startsWith('/for-teachers') && item.headers.some(h => h.key === 'Cache-Control')), 'Marketing pages should remain publicly cacheable')

console.log('SECURITY RESPONSE HEADER CONFIG: PASS (static only; live TLS and headers not tested)')
