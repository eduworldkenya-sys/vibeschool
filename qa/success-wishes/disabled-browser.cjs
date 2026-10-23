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
    SUCCESS_WISHES_LOCAL_PILOT_TEST: 'true',
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
    const mutations = []
    const schoolSearchRequests = []
    await page.route('**/rest/v1/rpc/schools_search_public_v2', async route => {
      schoolSearchRequests.push(route.request().postDataJSON())
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        school_id: '7f0a82a0-9a41-4f27-ae5a-bf0dd8811b15',
        school_name: 'Embakasi VibeSchool Test School',
        county: 'Nairobi',
        sub_county: 'Embakasi East',
        ward: null,
        school_category: 'secondary',
        ownership_type: 'public',
        gender_type: null,
        accommodation_type: null,
        cluster: null,
        knec_code: null,
      }]) })
    })
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (request.url().includes('/api/success-wishes/') && request.method() !== 'GET') mutations.push(request.url())
    })
    const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'networkidle', timeout: 90000 })
    assert.equal(response.status(), 200)
    await page.getByRole('heading', { name: /A little encouragement/ }).waitFor()
    await page.getByRole('button', { name: /New Beginnings/ }).click()
    const schoolField = page.getByRole('combobox', { name: 'School (optional)' })
    await schoolField.fill('Embakasi')
    const schoolResult = page.getByRole('option', { name: /Embakasi VibeSchool Test School/ })
    await schoolResult.waitFor()
    await schoolResult.click()
    assert.equal(await schoolField.inputValue(), 'Embakasi VibeSchool Test School')
    assert.equal(await page.getByText(/Selected from VibeSchool schools: Embakasi East · Nairobi/).count(), 1)
    assert(schoolSearchRequests.some(request => request.p_query === 'Embakasi' && request.p_limit === 12),
      'Success Wishes must call the public canonical school search with the typed query')
    await page.getByRole('textbox', { name: /Candidate.s name/ }).fill('Synthetic Candidate')
    await page.getByRole('textbox', { name: /Exam year/ }).fill('2026')
    await page.getByRole('textbox', { name: /Your name/ }).fill('Synthetic Sender')
    const wish = `Synthetic browser check at ${width}px: you can do this.`
    await page.getByRole('textbox', { name: /Your personal wish/ }).fill(wish)
    const cardDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: /Download card/ }).click()
    const image = await cardDownload
    assert.equal(image.suggestedFilename(), 'vibeschool-success-wishes.png')
    const imagePath = await image.path()
    const png = fs.readFileSync(imagePath)
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert(png.byteLength > 5000, 'Card download should contain rendered art, not a blank PNG header')
    assert.match(await page.locator('[class*="live"] svg[role="img"]').getAttribute('aria-label'), /Embakasi VibeSchool Test School/,
      'The selected canonical school must appear on the live card preview')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, `Unexpected horizontal overflow of ${overflow}px at ${width}px`)
    const config = await page.request.get(`${ROOT}/api/success-wishes/config`)
    assert.equal(config.status(), 200)
    assert.deepEqual(await config.json(), {
      enabled: false, mediaEnabled: false, paymentsEnabled: false,
      maxSeconds: 60, maxBytes: 26214400,
    })
    assert.deepEqual(mutations, [], 'Local synthetic review must not mutate the service')
    assert.deepEqual(errors, [], `Client JavaScript errors at ${width}px`)
    await page.screenshot({ path: path.join(screenshots, `unified-disabled-${width}.png`), fullPage: true })
    const oldPrivate = await fetch(`${ROOT}/success-wishes/private`, { redirect: 'manual' })
    assert.equal(oldPrivate.status, 307)
    assert.equal(oldPrivate.headers.get('location'), '/success-wishes')
    return { width, pageStatus: 200, syntheticPreview: true, inboxInSamePage: true, sendingDisabled: true, mutations: 0, overflow: false }
  } finally {
    await context.close()
  }
}

async function checkGilgilPilot(width) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    const errors = []
    const realSends = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (request.method() !== 'GET' && request.url().includes('/api/success-wishes/'))
        realSends.push(request.url())
    })
    const opened = await page.goto(ROOT + '/success-wishes/pilot', { waitUntil: 'networkidle', timeout: 90000 })
    assert.equal(opened.status(), 200)
    await page.getByRole('heading', { name: 'Give them a moment to remember.' }).waitFor()
    await page.getByRole('button', { name: /Candidate inbox.*0 unread/ }).waitFor()
    const senderField = page.getByRole('textbox', { name: /Your test sender name/ })
    await senderField.fill('')
    assert.equal(await page.getByRole('button', { name: /Send test card/ }).isDisabled(), true)
    await page.getByText(/To save a test card, add: sender name/).waitFor()
    await senderField.fill('Test Parent')
    await page.getByRole('button', { name: /Voice note/ }).click()
    assert.equal(await page.getByRole('button', { name: /Send test card/ }).isDisabled(), true)
    await page.getByText(/To save a test card, add: voice recording/).waitFor()
    await page.getByRole('button', { name: 'Message', exact: true }).click()
    await page.getByRole('button', { name: /New Beginnings/ }).click()
    const wish = 'Gilgil controlled pilot: this is a personalised test wish at width ' + width + '.'
    await page.locator('textarea').fill(wish)
    const previewMessage = page.locator('[class*="liveCard"] blockquote')
    await previewMessage.waitFor()
    assert.equal((await previewMessage.textContent()).trim(), wish)
    assert.equal(await page.getByText(/Premium design is generated/).count(), 0)
    await page.getByRole('button', { name: /Send test card/ }).click()
    await page.getByRole('heading', { name: 'Your test wish was saved.' }).waitFor()
    await page.getByRole('button', { name: /Candidate inbox.*1 unread/ }).waitFor()
    await page.getByRole('button', { name: /Open candidate inbox/ }).click()
    await page.getByPlaceholder('Enter code').fill('GILGIL-TEST')
    await page.getByRole('button', { name: /Open inbox/ }).click()
    await page.getByRole('button', { name: /Accept & open/ }).click()
    await page.getByRole('button', { name: /Candidate inbox.*0 unread/ }).waitFor()
    await page.getByText(wish, { exact: true }).waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    // Candidate session is intentionally not persisted on a shared device.
    await page.getByRole('heading', { name: 'Give them a moment to remember.' }).waitFor()
    await page.getByRole('button', { name: /Candidate inbox/ }).click()
    await page.getByPlaceholder('Enter code').fill('GILGIL-TEST')
    await page.getByRole('button', { name: /Open inbox/ }).click()
    await page.getByRole('button', { name: /Open again/ }).click()
    await page.getByText(wish, { exact: true }).waitFor()
    await page.getByRole('button', { name: /Report/ }).click()
    await page.getByRole('button', { name: /School controls/ }).click()
    await page.getByText('Unwanted message ·', { exact: false }).waitFor()
    await page.getByRole('button', { name: /Mark resolved/ }).click()
    await page.getByRole('button', { name: /Close sending/ }).click()
    await page.screenshot({ path: path.join(screenshots, 'gilgil-pilot-' + width + '.png'), fullPage: true })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, 'Gilgil pilot horizontal overflow at ' + width + ': ' + overflow)
    assert.deepEqual(errors, [], 'Gilgil pilot browser exceptions at ' + width)
    assert.deepEqual(realSends, [], 'Pilot must not call live Success Wishes mutation API')
    return { width, opened: true, saved: true, accepted: true, persistedAcrossRefresh: true, reported: true, sendingControlled: true }
  } finally { await context.close() }
}

;(async () => {
  await ready()
  browser = await chromium.launch({ headless: true })
  const viewports = []
  for (const width of [360, 390, 768, 1440]) viewports.push(await checkViewport(width))
  const gilgil = []
  for (const width of [390, 1440]) gilgil.push(await checkGilgilPilot(width))
  console.log(JSON.stringify({ suite: 'success-wishes-disabled-and-gilgil-pilot-browser', viewports, gilgil }, null, 2))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  if (browser) await browser.close()
  server.kill('SIGTERM')
  fs.closeSync(serverLog)
})
