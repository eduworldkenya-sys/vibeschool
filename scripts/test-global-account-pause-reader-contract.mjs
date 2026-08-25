import assert from 'node:assert/strict'
import fs from 'node:fs'

const access = fs.readFileSync('lib/global-access.ts', 'utf8')
const routing = fs.readFileSync('lib/auth-routing.ts', 'utf8')
const middleware = fs.readFileSync('middleware.ts', 'utf8')
const shell = fs.readFileSync('components/global/layout/GlobalShellProvider.tsx', 'utf8')
const paused = fs.readFileSync('app/global/paused/page.tsx', 'utf8')
const publicationReader = fs.readFileSync('app/global/read/publication/[id]/page.tsx', 'utf8')

assert.match(access, /process\.env\.GLOBAL_ACCOUNT_PAUSED !== 'false'/)
assert.match(access, /normalized === '\/global\/read'/)
assert.match(access, /normalized === '\/global\/paused'/)
assert.match(access, /normalized === '\/login\/global'/)
assert.match(routing, /normalized === '\/global\/read'.*return null/s)
assert.match(middleware, /isGlobalAccountPaused\(\) && isPausedGlobalAccountPath\(pathname\)/)
assert.match(middleware, /pausedUrl\.pathname = '\/global\/paused'/)
assert.match(shell, /'\/global\/read'/)
assert.match(shell, /'\/global\/paused'/)
assert.match(paused, /Open Reader/)
assert.match(paused, /href="\/global\/read"/)
assert.match(publicationReader, /ReadPublicationPage/)
assert.match(publicationReader, /\.eq\('status', 'published'\)/)

console.log('Global account pause / Reader continuity contract: PASS')
