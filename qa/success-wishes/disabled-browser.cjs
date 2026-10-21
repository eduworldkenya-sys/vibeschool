'use strict'

// Browser-level release guard for the disabled Success Wishes service.
// Uses no learner data, production secrets or real payment infrastructure.
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PORT = 3092
const ROOT = `http://localhost:${PORT}`
const logFile = path.join(os.tmpdir(), 'success-wishes-disabled-browser.log')
const serverLog = fs.openSync(logFile, 'w')
const screenshots = path.join(process.cwd(), 'qa', 'success-wishes', 'artifacts')
fs.mkdirSync(screenshots, { recursive: true })
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(PORT)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key',
    SUCCESS_WISHES_ENABLED: 'false',
    SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'false',
  },
  stdio: ['ignore', serverLog, serverLog],
})
let browser

async function ready() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error('Browser test server stopped before readiness')
    try {
      const response = await fetch(`${ROOT}/api/success-wishes/config`)
      if (response.ok) return
    } catch { /* The dev server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('Success Wishes dev server did not become ready')
}

async function checkViewport(width) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'networkidle', timeout: 90000 })
    assert.equal(response.status(), 200)
    await page.getByRole('heading', { name: 'Let them know you believe.', exact: true }).waitFor()
    await page.screenshot({ path: path.join(screenshots, `disabled-${width}.png`), fullPage: true })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, `Unexpected horizontal overflow of ${overflow}px at ${width}px`)
    assert.deepEqual(errors, [], `Client JavaScript errors at ${width}px`)
    const config = await page.request.get(`${ROOT}/api/success-wishes/config`)
    assert.equal(config.status(), 200)
    assert.match(config.headers()['cache-control'], /no-store/i)
    assert.deepEqual(await config.json(), {
      enabled: false, mediaEnabled: false, paymentsEnabled: false,
      maxSeconds: 60, maxBytes: 26214400,
    })
    const schools = await page.request.get(`${ROOT}/api/success-wishes/schools?q=Test`)
    assert.deepEqual(await schools.json(), { schools: [], available: false })
    const access = await page.request.post(`${ROOT}/api/success-wishes/access`, {
      headers: { origin: ROOT },
      data: { schoolId: '00000000-0000-4000-8000-000000000001', studentId: '00000000-0000-4000-8000-000000000002' },
    })
    assert.equal(access.status(), 503)
    // Submit through the actual browser origin, not Playwright's API client:
    // NextRequest's Origin/Host comparison must see a real same-origin POST.
    const submitStatus = await page.evaluate(async () => {
      const response = await fetch('/api/success-wishes/messages', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: '00000000-0000-4000-8000-000000000001',
          admissionNumber: 'dummy', candidateName: 'Test Candidate', senderName: 'Test Sender',
          relationship: 'Guardian', kind: 'text', text: 'Good luck',
          idempotencyKey: 'a'.repeat(64), consent: true,
        }),
      })
      return response.status
    })
    assert.equal(submitStatus, 503)
    return { width, pageStatus: 200, appErrors: 0, overflow: false, sendingDisabled: true }
  } finally {
    await context.close()
  }
}

;(async () => {
  await ready()
  browser = await chromium.launch({ headless: true })
  const viewports = []
  for (const width of [360, 390, 768, 1440]) viewports.push(await checkViewport(width))
  console.log(JSON.stringify({ suite: 'success-wishes-disabled-browser', viewports }, null, 2))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  if (browser) await browser.close()
  server.kill('SIGTERM')
  fs.closeSync(serverLog)
})
