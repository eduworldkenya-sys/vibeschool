'use strict'

// Browser-level acceptance test for the unified Success Wishes journey.
// Uses synthetic candidates and the development-only local test APIs.
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PORT = 3092
const ROOT = `http://localhost:${PORT}`
const logFile = path.join(os.tmpdir(), 'success-wishes-ecommerce-browser.log')
const serverLog = fs.openSync(logFile, 'w')
const screenshots = path.join(process.cwd(), 'qa', 'success-wishes', 'artifacts')
const testStore = path.join(process.cwd(), '.success-wishes-test-data.json')
const hadTestStore = fs.existsSync(testStore)
fs.mkdirSync(screenshots, { recursive: true })
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(PORT)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key',
    SUCCESS_WISHES_ENABLED: 'false',
    SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'false',
    VIBESCHOOL_SUCCESS_WISHES_TEST_MODE: '1',
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

async function makeWish(context, { message, theme }) {
  const page = await context.newPage()
  const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'networkidle', timeout: 90000 })
  assert.equal(response.status(), 200)
  await page.getByRole('heading', { name: /A little encouragement/ }).waitFor()
  await page.getByRole('button', { name: new RegExp(`Preview ${theme}; versions and prices`, 'i') }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(screenshots, `design-preview-${theme.replace(/\s+/g, '-')}.png`) })
  await dialog.getByRole('heading', { name: theme, exact: true }).waitFor()
  const cardCover = dialog.locator('button[class*="modalCardCover"]')
  await cardCover.waitFor({ state: 'visible' })
  assert.equal(await cardCover.getAttribute('aria-label'), `Open ${theme} card`, 'Card cover retains its accessible open label')
  assert.equal(await cardCover.isDisabled(), false)
  await cardCover.click()
  assert.equal(await cardCover.isDisabled(), true, 'The cover swings away after one tap')
  assert.equal(await dialog.getByRole('button', { name: 'Sound on' }).getAttribute('aria-pressed'), 'true')
  await dialog.getByRole('button', { name: /Choose Text Wish/ }).click()

  await page.getByRole('textbox', { name: 'Candidate name' }).fill('John Mwangi')
  await page.getByRole('textbox', { name: 'Exam year' }).fill('2026')
  await page.locator('summary').filter({ hasText: 'School (optional)' }).click()
  await page.getByRole('textbox', { name: 'School' }).fill('Gilgil Township')
  await page.getByRole('textbox', { name: 'Your name' }).fill('Synthetic sender')
  await page.getByRole('textbox', { name: 'Your wish' }).fill(message)
  await page.getByRole('button', { name: /Preview exact wish/ }).click()
  const card = page.locator('svg[aria-label*="Success Wishes card"]').last()
  await card.waitFor()
  const accessibleCard = await card.getAttribute('aria-label')
  assert.match(accessibleCard, /John Mwangi/)
  assert.match(accessibleCard, /exam year 2026/)
  assert.match(accessibleCard, /Gilgil Township/)
  assert.ok(accessibleCard.includes(message), 'Preview must show the exact original wish')
  assert.equal(await page.getByRole('button', { name: /Complete test order · KES 50/ }).isDisabled(), false)
  await page.getByRole('button', { name: /Complete test order · KES 50/ }).click()
  await page.getByRole('heading', { name: 'Test wish saved' }).waitFor()
  const invitation = await page.getByLabel('Private invitation').inputValue()
  assert.equal(new URL(invitation).origin, ROOT)
  assert.match(await page.locator('main').innerText(), /No payment was taken/)
  return { invitation, page }
}

async function openCandidate(invitation, message, width, muteFirst = false) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const claim = page.waitForResponse(response => response.url().includes('/api/success-wishes/test-access') && response.request().method() === 'POST')
  await page.goto(invitation, { waitUntil: 'networkidle', timeout: 90000 })
  assert.equal((await claim).status(), 200, 'Candidate claims the private invitation successfully')
  const cover = page.getByRole('button', { name: /Open the private success wish for John Mwangi/ })
  await cover.waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: 'Your private invitation' }).waitFor()
  assert.equal(await page.getByText(message, { exact: true }).count(), 0, 'Wish text stays behind the closed card')
  const sound = page.getByRole('button', { name: 'Sound on' })
  assert.equal(await sound.getAttribute('aria-pressed'), 'true', 'Signature sound starts on, but waits for a card tap')
  if (muteFirst) {
    await sound.click()
    assert.equal(await page.getByRole('button', { name: 'Sound off' }).getAttribute('aria-pressed'), 'false', 'One-touch mute is available')
  }
  await cover.click()
  await page.getByRole('heading', { name: 'A wish for John Mwangi' }).waitFor()
  assert.equal(await page.getByText(message, { exact: true }).count(), 1)
  assert.equal(await page.getByText('Gilgil Township', { exact: true }).count(), 1)
  await page.screenshot({ path: path.join(screenshots, `candidate-open-${width}.png`), fullPage: true })
  const revisit = page.waitForResponse(response => response.url().includes('/api/success-wishes/test-access') && response.request().method() === 'GET')
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal((await revisit).status(), 200, 'Active private session returns to the saved wish')
  await page.getByRole('button', { name: /Open the private success wish for John Mwangi/ }).waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: 'Your private invitation' }).waitFor()
  assert.equal(await page.getByText(message, { exact: true }).count(), 0, 'Refresh returns to the closed-card reveal')
  await page.getByRole('button', { name: /Open the private success wish for John Mwangi/ }).click()
  await page.getByRole('heading', { name: 'A wish for John Mwangi' }).waitFor()
  assert.equal(await page.getByText(message, { exact: true }).count(), 1, 'Candidate can return after refresh')
  return { context, page, width }
}

;(async () => {
  assert.equal(hadTestStore, false, 'Refusing to overwrite existing local test wishes')
  await ready()
  browser = await chromium.launch({ headless: true })
  const widths = []
  for (const width of [360, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    assert.equal(response.status(), 200)
    await page.getByRole('heading', { name: /A little encouragement/ }).waitFor()
    for (const design of ['Golden Hour', 'New Beginnings', 'Bright Star', 'Above & Beyond']) {
      assert.equal(await page.getByRole('button', { name: new RegExp(`Preview ${design}; versions and prices`, 'i') }).count(), 1)
    }
    assert.equal(await page.getByRole('heading', { name: 'Text Wish' }).count(), 1)
    assert.equal(await page.getByRole('heading', { name: 'Voice Wish' }).count(), 1)
    assert.equal(await page.getByRole('heading', { name: 'Video Wish' }).count(), 1)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, `Unexpected horizontal overflow at ${width}px: ${overflow}`)
    const config = await page.request.get(`${ROOT}/api/success-wishes/config`)
    assert.deepEqual(await config.json(), { enabled: false, mediaEnabled: false, paymentsEnabled: false, maxSeconds: 60, maxBytes: 26214400 })
    assert.deepEqual(errors, [], `Browser errors at ${width}px`)
    await page.screenshot({ path: path.join(screenshots, `ecommerce-${width}.png`), fullPage: true })
    widths.push({ width, page: 'single unified journey', overflow: false, productionSending: false })
    await context.close()
  }

  const messageA = 'John, we are proud of your hard work. Go forward with courage.'
  const messageB = 'John, may your next chapter bring you joy and opportunity.'
  const senderA = await makeWish(await browser.newContext({ viewport: { width: 1440, height: 850 } }), { message: messageA, theme: 'New Beginnings' })
  const senderB = await makeWish(await browser.newContext({ viewport: { width: 390, height: 850 } }), { message: messageB, theme: 'Golden Hour' })
  assert.notEqual(senderA.invitation, senderB.invitation, 'Same-name, same-school and same-year candidates need unique invitations')

  const candidateA = await openCandidate(senderA.invitation, messageA, 1440)
  const candidateB = await openCandidate(senderB.invitation, messageB, 390, true)
  assert.equal(await candidateA.page.getByText(messageB, { exact: true }).count(), 0)
  assert.equal(await candidateB.page.getByText(messageA, { exact: true }).count(), 0)
  await candidateA.page.getByRole('button', { name: 'Sign out on this device' }).click()
  await candidateA.page.getByText('You are signed out.', { exact: false }).waitFor()
  assert.equal(await candidateB.page.getByText(messageB, { exact: true }).count(), 1, 'Signing out one candidate context leaves the other separate wish intact')

  const wrongContext = await browser.newContext()
  const wrongPage = await wrongContext.newPage()
  await wrongPage.goto(`${ROOT}/success-wishes/invitation#token=invalid-token-that-does-not-match-a-wish-00000`, { waitUntil: 'domcontentloaded' })
  await wrongPage.getByRole('heading', { name: 'Invitation unavailable' }).waitFor()
  await wrongContext.close()

  const privateRoute = await fetch(`${ROOT}/success-wishes/private`, { redirect: 'manual' })
  assert.equal(privateRoute.status, 307)
  assert.equal(privateRoute.headers.get('location'), '/success-wishes')
  const oldPilot = await fetch(`${ROOT}/success-wishes/pilot`, { redirect: 'manual' })
  assert.equal(oldPilot.status, 307)
  assert.equal(oldPilot.headers.get('location'), '/success-wishes')
  console.log(JSON.stringify({ suite: 'success-wishes-unified-ecommerce-browser', senderWidths: widths, candidateWidths: [candidateA.width, candidateB.width], signatureSoundTapGated: true, muteVerified: true, duplicateNameCandidates: true, separatePrivateInvitations: true, exactMessageAndRefresh: true, wrongInvitationRejected: true, signOutVerified: true, productionPaymentAndSending: false }, null, 2))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  if (browser) await browser.close()
  server.kill('SIGTERM')
  await new Promise(resolve => server.once('exit', resolve))
  fs.closeSync(serverLog)
  if (!hadTestStore && fs.existsSync(testStore)) fs.unlinkSync(testStore)
})
