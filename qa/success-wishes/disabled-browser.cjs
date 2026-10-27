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
const screenshots = path.join(os.tmpdir(), 'success-wishes-artifacts')
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
  page.setDefaultTimeout(15000)
  await page.addInitScript(() => {
    window.__successWishChimeOscillators = 0
    const createOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function (...args) {
      window.__successWishChimeOscillators += 1
      return createOscillator.apply(this, args)
    }
  })
  const schoolSearchCalls = []
  await page.route('**/rest/v1/rpc/success_wishes_school_search_public_v1', async route => {
    const payload = route.request().postDataJSON()
    schoolSearchCalls.push(payload)
    const query = payload.p_query.toLowerCase()
    const results = query.includes('embakasi')
      ? [
          { directory_id: 'directory-embakasi-garrison', school_name: 'Embakasi Garrison', county: 'Nairobi', sub_county: 'Embakasi East' },
          { directory_id: 'directory-embakasi-girls', school_name: 'EMBAKASI GIRLS SECONDARY SCHOOL', county: 'Nairobi', sub_county: null },
        ]
      : [
          { directory_id: 'directory-gilgil-township', school_name: 'Gilgil Township', county: 'Nakuru', sub_county: 'Gilgil' },
          { directory_id: 'directory-gilgil-hills', school_name: 'Gilgil Hills Academy', county: 'Nakuru', sub_county: 'Gilgil' },
        ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(results) })
  })
  const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'networkidle', timeout: 90000 })
  assert.equal(response.status(), 200)
  await page.getByRole('heading', { name: /Wish students good luck.*success/i }).waitFor()
  const designButton = page.getByRole('button', { name: `Choose ${theme} card` })
  await designButton.click()
  assert.equal(await designButton.getAttribute('aria-pressed'), 'true', 'Choosing a design updates the selected card immediately')
  await page.waitForFunction(() => Math.abs(document.getElementById('wish-composer').getBoundingClientRect().top - 20) < 3)
  const mini = page.locator('[aria-label="Live card preview"]')
  assert.equal(await mini.isVisible(), page.viewportSize().width <= 850, 'Mini preview appears only on mobile/tablet layouts')
  await page.screenshot({ path: path.join(screenshots, `design-preview-${theme.replace(/\s+/g, '-')}.png`) })

  await page.getByRole('textbox', { name: 'Candidate name' }).fill('John Mwangi')
  assert.equal(await page.evaluate(() => window.__successWishChimeOscillators), 6, 'The three-note form-start chime plays when editing begins')
  const yearInput = page.getByRole('textbox', { name: 'Exam year' })
  await yearInput.focus()
  assert.equal(await page.evaluate(() => window.__successWishChimeOscillators), 6, 'The form-start chime plays only once')
  assert.equal(await yearInput.inputValue(), '2026', 'Exam year defaults to 2026')
  const schoolInput = page.getByRole('combobox', { name: 'School (optional)' })
  assert.equal(await schoolInput.isVisible(), true, 'The optional school search is visible without an extra tap')
  assert.equal(await schoolInput.getAttribute('required'), null, 'School remains optional')
  await schoolInput.fill('Embakasi')
  await page.getByRole('option', { name: /Embakasi Garrison/ }).waitFor()
  await page.getByRole('option', { name: /Embakasi Girls Secondary School/i }).waitFor()
  await page.getByRole('option', { name: /Embakasi Garrison/ }).click()
  assert.equal(await schoolInput.inputValue(), 'Embakasi Garrison', 'A directory school can be selected')
  await schoolInput.fill('Gilgil Township')
  await page.getByRole('option', { name: /^Gilgil Township/ }).click()
  await page.getByRole('status').filter({ hasText: 'Selected from VibeSchool' }).waitFor()
  assert.deepEqual(schoolSearchCalls, [
    { p_query: 'Embakasi', p_limit: 12 },
    { p_query: 'Gilgil Township', p_limit: 12 },
  ], 'Public Success Wishes search uses the safe full-directory projection and supports changing schools')
  await page.getByRole('textbox', { name: 'Your name' }).fill('Synthetic sender')
  const wishInput = page.getByRole('textbox', { name: 'Your wish' })
  const starterText = 'You have worked so hard to reach this moment. Walk in with courage; we believe in you.'
  await page.getByRole('button', { name: 'Use wish starter: Trust your work' }).click()
  assert.equal(await wishInput.inputValue(), starterText, 'A visible wish starter fills the editable message')
  assert.equal(await wishInput.evaluate(element => document.activeElement === element), true, 'Choosing a starter moves focus into the message')
  await wishInput.fill(message)
  const liveWish = page.getByTestId('success-card-message-preview')
  assert.equal(await liveWish.count(), 0, 'Typing never opens the gift automatically')
  await page.getByRole('button', { name: 'Open the envelope and reveal the success card' }).click()
  await liveWish.waitFor({ state: 'visible' })
  assert.equal(await liveWish.innerText(), message, 'Intentional sender preview contains the exact wish')
  const book = page.locator('[data-book-phase]')
  assert.equal(await book.getAttribute('data-book-phase'), 'opened')
  const expectedPalette = await book.evaluate(el => getComputedStyle(el).getPropertyValue('--book-top').trim())
  assert(expectedPalette, 'The selected canonical palette is applied')
  await page.getByRole('button', { name: 'Replay opening', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[data-book-phase]')?.dataset.bookPhase === 'closing' || document.querySelector('[data-book-phase]')?.dataset.bookPhase === 'sealed')
  await page.waitForFunction(() => document.querySelector('[data-book-phase]')?.dataset.bookPhase === 'opened')
  assert.equal(await liveWish.innerText(), message, 'Replay reopens with the same exact message')
  await page.getByRole('button', { name: 'Close the book card' }).click()
  await page.getByRole('button', { name: 'Open the book card' }).waitFor()
  assert.equal(await liveWish.count(), 0, 'Closing removes private text from the DOM')
  await page.getByRole('button', { name: 'Open the book card' }).click()
  await liveWish.waitFor({ state: 'visible' })
  if (page.viewportSize().width <= 850) {
    await wishInput.focus()
    await page.evaluate(() => window.scrollBy(0, 160))
    const miniBounds = await mini.boundingBox()
    assert(miniBounds.y >= -1 && miniBounds.y < 5, 'Mini preview stays at the top while editing')
    assert(miniBounds.height < 110, 'Mini preview leaves room for fields and keyboard')
    assert.equal(await mini.locator('strong').innerText(), 'John Mwangi')
    assert.equal(await mini.locator('p').innerText(), message)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Typing creates no horizontal overflow')
    await mini.getByRole('button', { name: 'View card' }).click()
    await page.waitForFunction(() => {
      const top = document.getElementById('wish-preview').getBoundingClientRect().top
      return top >= 0 && top < innerHeight - 150
    })
  }
  const checkoutRequests = []
  const trackCheckout = request => { if (request.url().includes('/api/success-wishes/')) checkoutRequests.push(request.url()) }
  page.on('request', trackCheckout)
  await page.getByRole('button', { name: 'Send this wish' }).click()
  const checkout = page.getByRole('dialog')
  await checkout.getByRole('heading', { name: 'Send a Success Wish' }).waitFor()
  await checkout.getByLabel('M-Pesa number', {exact:true}).fill('0712345678')
  await checkout.getByLabel('Recipient’s private wish request link').fill('a'.repeat(64))
  await checkout.getByRole('button', { name: 'Review order', exact:true }).click()
  await checkout.getByRole('heading', { name: 'Review before paying' }).waitFor()
  assert.deepEqual(checkoutRequests, [], 'Review alone never creates an order or starts payment')
  await checkout.getByRole('button', { name: 'Save order & continue' }).click()
  await checkout.getByRole('alert').filter({hasText:'No new payment was requested'}).waitFor()
  assert.equal(checkoutRequests.filter(url=>url.endsWith('/checkout')).length,1)
  assert.equal(await checkout.getByRole('button',{name:'Pay KSh 50 with M-Pesa'}).count(),0,'Disabled receiver never offers STK initiation')
  page.off('request', trackCheckout)
  await checkout.getByRole('button', { name: 'Close checkout' }).click()
  assert.equal(await page.getByRole('button', { name: /Complete test order · KES 50/ }).isDisabled(), false)
  await page.getByRole('button', { name: /Complete test order · KES 50/ }).click()
  await page.getByRole('heading', { name: 'Test wish saved' }).waitFor()
  const invitation = await page.getByLabel('Private invitation').inputValue()
  assert.equal(new URL(invitation).origin, ROOT)
  assert.match(await page.locator('main').innerText(), /No payment was taken/)
  return { invitation, page }
}

async function openCandidate(invitation, message, width, muteFirst = false, reducedMotion = false) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const claim = page.waitForResponse(response => response.url().includes('/api/success-wishes/test-access') && response.request().method() === 'POST')
  await page.goto(invitation, { waitUntil: 'networkidle', timeout: 90000 })
  const claimResponse = await claim
  assert.equal(claimResponse.status(), 200, 'Candidate claims the private invitation successfully')
  assert.ok((await context.cookies(`${ROOT}/api/success-wishes/test-access`)).some(cookie => cookie.name === 'vsw_test_claim'), 'Private session cookie is stored for this wish')
  const cover = page.getByRole('button', { name: 'Open the envelope and reveal the success card' })
  if (!(await cover.isVisible().catch(() => false))) {
    process.stdout.write(`Candidate page ${width}px: ${JSON.stringify({ main: await page.locator('main').innerText(), pageErrors })}\n`)
    await page.screenshot({ path: path.join(screenshots, `candidate-debug-${width}.png`), fullPage: true })
  }
  await cover.waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: 'A little joy, just for you.' }).waitFor()
  await page.screenshot({ path: path.join(screenshots, `candidate-closed-${width}.png`), fullPage: true })
  assert.equal(await cover.isVisible(), true, 'The recipient sees the sealed envelope first')
  const recipientWish = page.getByTestId('success-card-message-preview')
  assert.equal(await recipientWish.count(), 0, 'Private text is absent from the DOM while the envelope is sealed')
  const sound = page.getByRole('button', { name: 'Sound on' })
  assert.equal(await sound.getAttribute('aria-pressed'), 'true', 'Signature sound starts on, but waits for a card tap')
  if (muteFirst) {
    await sound.click()
    assert.equal(await page.getByRole('button', { name: 'Sound off' }).getAttribute('aria-pressed'), 'false', 'One-touch mute is available')
  }
  await cover.click()
  await page.getByRole('button', { name: 'Close the book card' }).waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: 'For John Mwangi', exact: true }).waitFor()
  await page.waitForTimeout(reducedMotion ? 50 : 1100)
  assert.equal(await recipientWish.innerText(), message)
  assert.equal(await page.getByText('Gilgil Township', { exact: true }).count(), 1, 'Optional school is printed inside the open book')
  assert.equal(await page.getByText('2026 exams', { exact: true }).count(), 1, 'Exam year is printed inside the open book')
  assert.equal(await page.getByText('Synthetic sender', { exact: true }).count(), 1, 'Sender is printed inside the open book')
  assert.equal(await page.getByRole('button', { name: 'Replay opening' }).count(), 0, 'The recipient opening has no replay control')
  await recipientWish.waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Close the book card' }).click()
  assert.equal(await recipientWish.count(), 0, 'Close removes the personal message from the DOM again')
  await page.getByRole('button', { name: 'Open the book card' }).click()
  await recipientWish.waitFor({ state: 'visible' })
  await page.screenshot({ path: path.join(screenshots, `candidate-open-${width}.png`), fullPage: true })
  const revisit = page.waitForResponse(response => response.url().includes('/api/success-wishes/test-access') && response.request().method() === 'GET')
  await page.reload({ waitUntil: 'networkidle' })
  const revisitResponse = await revisit
  assert.equal(revisitResponse.status(), 200, 'Active private session returns to the saved wish')
  await page.getByRole('button', { name: 'Open the envelope and reveal the success card' }).waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: 'A little joy, just for you.' }).waitFor()
  assert.equal(await recipientWish.count(), 0, 'Refresh returns to a sealed envelope with no private message in the DOM')
  await page.getByRole('button', { name: 'Open the envelope and reveal the success card' }).click()
  await page.getByRole('button', { name: 'Close the book card' }).waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: 'For John Mwangi', exact: true }).waitFor()
  assert.equal(await recipientWish.innerText(), message, 'Candidate can return after refresh')
  return { context, page, width }
}

;(async () => {
  assert.equal(hadTestStore, false, 'Refusing to overwrite existing local test wishes')
  await ready()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() })
  const widths = []
  for (const width of [320, 360, 390, 412, 560, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'networkidle', timeout: 90000 })
    assert.equal(response.status(), 200)
    await page.getByRole('heading', { name: /Wish students good luck.*success/i }).waitFor()
    for (const design of ['Golden Hour', 'New Beginnings', 'Bright Star', 'Above & Beyond']) {
      assert.equal(await page.getByRole('button', { name: `Choose ${design} card` }).count(), 1)
    }
    const gallery = page.locator('section[aria-labelledby="choose-card-title"]')
    assert.equal(await gallery.getByRole('heading', { name: 'Choose a success card design' }).count(), 1)
    assert.equal(await gallery.locator('svg text[textLength], svg text[lengthAdjust]').count(), 0, 'Card lettering must never be stretched to fit')
    assert.equal(await gallery.getByText('Tap a card to choose it').count(), 0, 'Design selection needs no extra instructions')
    assert.equal(await page.locator('section[aria-label="Wish versions and prices"]').locator('[class*="purchaseNote"]').count(), 0, 'Do not duplicate price totals in the selector')
    assert.equal(await page.getByRole('button', { name: /Text Wish · KES 50/ }).count(), 1)
    assert.equal(await page.getByRole('button', { name: /Voice Wish · Preview only/ }).isEnabled(), true)
    assert.equal(await page.getByRole('button', { name: /Video Wish · Preview only/ }).isEnabled(), true)
    await page.getByRole('button', { name: /Voice Wish · Preview only/ }).click()
    assert.equal(await page.getByRole('button', { name: 'Record voice' }).count(), 1, 'Sender can record an audio wish')
    assert.equal(await page.getByRole('button', { name: 'Choose audio file' }).count(), 1, 'Sender can choose an audio file')
    await page.locator('input[type="file"][accept^="audio"]').setInputFiles({
      name: 'private-voice.wav', mimeType: 'audio/wav', buffer: Buffer.from('RIFFsynthetic-preview-file'),
    })
    assert.equal(await page.locator('[aria-label="Add a voice wish"]').getByText('private-voice.wav').count(), 1, 'Sender file is locally selected')
    assert.equal(await page.getByRole('button', { name: 'Remove selected recording' }).count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Preview your wish' }).isDisabled(), true, 'Unfinished media wish cannot create a checkout')
    await page.getByRole('button', { name: /Video Wish · Preview only/ }).click()
    assert.equal(await page.getByRole('button', { name: 'Record video' }).count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Choose video file' }).count(), 1)
    await page.locator('input[type="file"][accept^="video"]').setInputFiles({
      name: 'private-video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('synthetic-video-preview-file'),
    })
    assert.equal(await page.locator('[aria-label="Add a video wish"]').getByText('private-video.mp4').count(), 1, 'Video file is locally selected')
    await page.getByRole('button', { name: /Text Wish · KES 50/ }).click()
    assert.equal(await page.getByRole('textbox', { name: 'Exam year' }).inputValue(), '2026', 'Year is prefilled for the sender')
    assert.equal(await page.getByRole('button', { name: 'Send this wish' }).isDisabled(), true, 'Send waits for the required card details')
    assert.equal(await page.getByRole('button', { name: /Preview my card/ }).count(), 0, 'The live preview needs no second preview button')
    // Sender draft and allowed-length text regressions; never initiate a real payment.
    const candidateInput = page.getByRole('textbox', { name: 'Candidate name', exact: true })
    const senderInput = page.getByRole('textbox', { name: 'Your name', exact: true })
    const wishInput = page.getByRole('textbox', { name: 'Your wish', exact: true })
    const yearInput = page.getByRole('textbox', { name: 'Exam year', exact: true })
    const schoolInput = page.getByRole('combobox', { name: 'School (optional)' })
    await page.route('**/rest/v1/rpc/success_wishes_school_search_public_v1', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    const longCandidate = 'C'.repeat(48), longSender = 'S'.repeat(48), longSchool = 'N'.repeat(80)
    const longWish = Array(7).fill('a'.repeat(30)).join(' ')
    await page.getByRole('button', { name: 'Choose Bright Star card' }).click()
    await candidateInput.fill(longCandidate)
    await senderInput.fill(longSender)
    await schoolInput.fill(longSchool)
    await wishInput.fill(longWish)
    await yearInput.fill('20')
    await wishInput.focus()
    assert.equal(await yearInput.getAttribute('aria-invalid'), 'true')
    await page.getByText('Enter a four-digit exam year, such as 2026.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Send this wish' }).isDisabled(), true)
    await yearInput.fill('2027')
    await wishInput.focus()
    assert.equal(await yearInput.getAttribute('aria-invalid'), 'false')
    assert.equal(await page.getByRole('button', { name: 'Send this wish' }).isEnabled(), true)
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('vibeschool:success-wishes:sender-draft:v1'))?.draft.examYear === '2027')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('status').filter({ hasText: 'Draft restored.' }).waitFor()
    assert.equal(await candidateInput.inputValue(), longCandidate, 'Refresh restores candidate')
    assert.equal(await senderInput.inputValue(), longSender, 'Refresh restores sender')
    assert.equal(await schoolInput.inputValue(), longSchool, 'Refresh restores school')
    assert.equal(await wishInput.inputValue(), longWish, 'Refresh restores the exact wish')
    assert.equal(await yearInput.inputValue(), '2027')
    assert.equal(await page.getByRole('button', { name: 'Choose Bright Star card' }).getAttribute('aria-pressed'), 'true')
    await wishInput.focus()
    assert.equal(await page.getByTestId('success-card-message-preview').count(), 0, 'Restoring a draft does not open the gift')
    await page.getByRole('button', { name: 'Open the envelope and reveal the success card' }).click()
    await page.getByTestId('success-card-message-preview').waitFor({ state: 'visible' })
    assert.equal(await page.getByTestId('success-card-message-preview').innerText(), longWish)
    const textFromArt = await page.locator('[aria-label="Live card preview"] svg text').allTextContents()
    const joinedArt = textFromArt.join('').replace(/\s/g, '')
    assert(joinedArt.includes(longSender), 'SVG includes complete sender name')
    assert(joinedArt.includes(longSchool), 'SVG includes complete school name')
    assert(joinedArt.includes(longWish.replace(/\s/g, '')), 'SVG includes all seven message lines')
    // Every design must preserve the same long text and remain horizontally bounded.
    for (const design of ['Golden Hour', 'New Beginnings', 'Bright Star', 'Above & Beyond']) {
      await page.getByRole('button', { name: `Choose ${design} card` }).click()
      assert.equal(await wishInput.inputValue(), longWish)
      const sealed = page.getByRole('button', { name: 'Open the envelope and reveal the success card' })
      if (await sealed.count()) await sealed.click()
      await page.getByTestId('success-card-message-preview').waitFor({ state: 'visible' })
      assert.equal(await page.getByTestId('success-card-message-preview').innerText(), longWish)
      const palette = { 'Golden Hour': '#fbf2d0', 'New Beginnings': '#f3f2e9', 'Bright Star': '#314a75', 'Above & Beyond': '#ffe9bc' }
      assert.equal(await page.locator('[data-book-phase]').evaluate(el => getComputedStyle(el).getPropertyValue('--book-top').trim()), palette[design])
      const bounds = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(-8).map(element => ({ tag: element.tagName, class: element.getAttribute('class'), right: element.getBoundingClientRect().right })) }))
      assert(bounds.scroll <= bounds.width + 1, `Long text overflows ${design} at ${width}px: ${JSON.stringify(bounds)}`)
    }
    await page.screenshot({ path: path.join(screenshots, `sender-long-text-${width}.png`), fullPage: true })
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: 'Clear draft' }).click()
    assert.equal(await candidateInput.inputValue(), longCandidate, 'Cancel clear preserves draft')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Clear draft' }).click()
    assert.equal(await candidateInput.inputValue(), '')
    await page.waitForFunction(() => sessionStorage.getItem('vibeschool:success-wishes:sender-draft:v1') === null)
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await candidateInput.inputValue(), '', 'Cleared draft stays cleared after refresh')
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
  // Exercise real browser recording controls against deterministic microphone permission/device fixtures.
  const recordContext = await browser.newContext({ viewport: { width: 1000, height: 850 } })
  const recordPage = await recordContext.newPage()
  await recordPage.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    } })
    window.MediaRecorder = class {
      constructor(_stream, options) { this.mimeType = options?.mimeType || 'audio/webm'; this.state = 'inactive' }
      static isTypeSupported() { return true }
      start() { this.state = 'recording' }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['synthetic-recorded-audio'], { type: this.mimeType }) })
        this.onstop?.()
      }
    }
  })
  await recordPage.goto(`${ROOT}/success-wishes`, { waitUntil: 'networkidle' })
  await recordPage.getByRole('button', { name: /Voice Wish · Preview only/ }).click()
  await recordPage.getByRole('button', { name: 'Record voice' }).click()
  await recordPage.getByRole('button', { name: /Stop recording/ }).waitFor()
  await recordPage.getByRole('button', { name: /Stop recording/ }).click()
  await recordPage.locator('[aria-label="Add a voice wish"]').getByText('success-wish-voice.webm').waitFor()
  await recordPage.getByRole('button', { name: 'Remove selected recording' }).click()
  assert.equal(await recordPage.getByRole('button', { name: 'Remove selected recording' }).count(), 0, 'Sender can remove a recording')
  await recordContext.close()

  const senderA = await makeWish(await browser.newContext({ viewport: { width: 1440, height: 850 } }), { message: messageA, theme: 'New Beginnings' })
  const senderB = await makeWish(await browser.newContext({ viewport: { width: 390, height: 850 } }), { message: messageB, theme: 'Golden Hour' })
  assert.notEqual(senderA.invitation, senderB.invitation, 'Same-name, same-school and same-year candidates need unique invitations')

  const candidateA = await openCandidate(senderA.invitation, messageA, 1440)
  const candidateB = await openCandidate(senderB.invitation, messageB, 390, true, true)
  assert.notEqual(await candidateA.page.getByTestId('success-card-message-preview').innerText(), messageB)
  assert.notEqual(await candidateB.page.getByTestId('success-card-message-preview').innerText(), messageA)
  await candidateA.page.getByText('Privacy & help', { exact: true }).click()
  await candidateA.page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await candidateA.page.getByText('You are signed out.', { exact: false }).waitFor()
  assert.equal(await candidateB.page.getByTestId('success-card-message-preview').innerText(), messageB, 'Signing out one candidate context leaves the other separate wish intact')

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
