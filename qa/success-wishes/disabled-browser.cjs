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
const screenshots = process.env.CI ? path.join(process.cwd(),'qa/success-wishes/artifacts') : path.join(os.tmpdir(), 'success-wishes-artifacts')
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

async function expandField(page, title) {
  const section = page.locator('#wish-composer details').filter({has:page.locator('summary strong').filter({hasText:title})})
  if (!await section.evaluate(element=>element.open)) await section.locator('summary').click()
}

async function editField(page, input, value, focusOnly = false) {
  const field = await input.evaluate(el => el.closest('details[data-wish-field]')?.dataset.wishField)
  if (field) {
    const section = page.locator(`[data-wish-field="${field}"]`)
    if (!await section.evaluate(el=>el.open)) await section.locator('summary').click()
  }
  if (focusOnly) await input.focus()
  else await input.fill(value)
}

async function makeWish(context, { message, theme }) {
  await context.addInitScript(() => { try { sessionStorage.setItem('success-wishes-2026-floating-offer-dismissed', '1') } catch {} })
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
  const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  const offerClose = page.getByRole('button', { name: 'Close offer details', exact: true })
  if (await offerClose.isVisible().catch(() => false)) await offerClose.click()
  const dismissOffer = page.getByRole('button', { name: 'Dismiss Success Cards advert', exact: true })
  if (await dismissOffer.isVisible().catch(() => false)) await dismissOffer.click()
  assert.equal(response.status(), 200)
  await page.getByRole('heading', { name: /Wish students good luck.*success/i }).waitFor()
  assert.equal(await page.getByText('Start your wish. Text saves in this tab as you type. Recordings are not saved.').count(), 0, 'No redundant draft instructions')
  assert.equal(await page.getByText('Your wish appears as you type.').count(), 0, 'Empty mobile preview has no redundant instruction')
  assert.equal(await page.getByText(/Enter the candidate’s name.*Enter your name.*Write a wish or choose a starter below/).count(), 0, 'No combined missing-fields explanation')
  const previewSend = page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' })
  const formSend = page.locator('#wish-composer [class*="sendRow"]').getByRole('button', { name: 'Send this wish' })
  assert.equal(await previewSend.count(), 0, 'The lower send action is hidden before personalisation is complete')
  assert.equal(await formSend.count(), 0, 'The upper send button is hidden before personalisation is complete')
  const designButton = page.getByRole('button', { name: `Choose ${theme} card` })
  await designButton.click()
  assert.equal(await designButton.getAttribute('aria-pressed'), 'true', 'Choosing a design updates the selected card immediately')
  await page.waitForFunction(() => { const top=document.getElementById('wish-composer').getBoundingClientRect().top; return top>=0 && top<innerHeight-180 }) // A shorter composer may already fit at the document's scroll limit.
  const mini = page.locator('[aria-label="Live card preview"]')
  assert.equal(await mini.isVisible(), page.viewportSize().width <= 850, 'Mini preview appears only on mobile/tablet layouts')
  await page.screenshot({ path: path.join(screenshots, `design-preview-${theme.replace(/\s+/g, '-')}.png`) })

  await page.getByRole('textbox', { name: 'Candidate name' }).fill('John Mwangi')
  await page.locator('[aria-label="Success Wishes 2026 offers"]').waitFor({state:'hidden'})
  assert.equal(await page.evaluate(() => window.__successWishChimeOscillators), 0, 'Sender form is silent until sound is explicitly enabled')
  const yearInput = page.getByRole('textbox', { name: 'Exam year' , includeHidden: true })
  await editField(page, yearInput, undefined, true)
  assert.equal(await page.evaluate(() => window.__successWishChimeOscillators), 0, 'Focusing another field does not start a melody')
  assert.equal(await yearInput.inputValue(), '2026', 'Exam year defaults to 2026')
  const schoolInput = page.getByRole('combobox', { name: 'School (optional)' , includeHidden: true })
  await expandField(page, 'Find their school')
  assert.equal(await schoolInput.isVisible(), true, 'The optional school field opens from its compact summary')
  assert.equal(await schoolInput.getAttribute('required'), null, 'School remains optional')
  await editField(page, schoolInput, 'Embakasi')
  await page.getByRole('option', { name: /Embakasi Garrison/ }).waitFor()
  await page.getByRole('option', { name: /Embakasi Girls Secondary School/i }).waitFor()
  await page.getByRole('option', { name: /Embakasi Garrison/ }).click()
  assert.equal(await schoolInput.inputValue(), 'Embakasi Garrison', 'A directory school can be selected')
  await expandField(page, 'Find their school')
  await editField(page, schoolInput, 'Gilgil Township')
  await page.getByRole('option', { name: /^Gilgil Township/ }).click()
  await page.locator('#wish-composer summary').filter({hasText:'Gilgil Township'}).waitFor()
  assert.deepEqual(schoolSearchCalls, [
    { p_query: 'Embakasi', p_limit: 12 },
    { p_query: 'Gilgil Township', p_limit: 12 },
  ], 'Public Success Wishes search uses the safe full-directory projection and supports changing schools')
  await editField(page, page.getByRole('textbox', {name:'Your name',includeHidden:true}), 'Synthetic sender')
  await editField(page, page.getByRole('textbox', {name:'Phone to receive this wish',includeHidden:true}), '0733000111')
  await expandField(page, 'Your wish')
  const wishInput = page.getByRole('textbox', { name: 'Your wish' , includeHidden: true })
  const starterText = 'You have worked so hard to reach this moment. Walk in with courage; we believe in you.'
  await page.getByRole('button', { name: 'Use wish starter: Trust your work' }).click()
  assert.equal(await wishInput.inputValue(), starterText, 'A visible wish starter fills the editable message')
  assert.equal(await wishInput.evaluate(element => document.activeElement === element), true, 'Choosing a starter moves focus into the message')
  await page.getByRole('button', {name:'Turn wish sounds on'}).click()
  await expandField(page, 'Your wish')
  await editField(page, wishInput, message)
  assert.equal(await page.evaluate(() => window.__successWishChimeOscillators), 4, 'Opted-in message editing plays the short four-note melody')
  assert.equal(await formSend.isEnabled(), true, 'The upper send button appears when all required personalisation fields are valid')
  const liveWish = page.getByTestId('success-card-message-preview')
  assert.equal(await liveWish.count(), 0, 'Typing never opens the gift automatically')
  await page.getByRole('button', { name: 'Open the envelope and reveal the success card' }).click()
  await liveWish.waitFor({ state: 'visible' })
  assert.equal(await liveWish.innerText(), message, 'Intentional sender preview contains the exact wish')
  await previewSend.waitFor({ state: 'visible' })
  assert.equal(await previewSend.isEnabled(), true, 'Reaching or interacting with the full preview reveals its checkout action')
  const book = page.locator('[data-book-phase]')
  assert.equal(await book.getAttribute('data-book-phase'), 'opened')
  const expectedPalette = await book.evaluate(el => getComputedStyle(el).getPropertyValue('--book-top').trim())
  assert(expectedPalette, 'The selected canonical palette is applied')
  assert.equal(await page.getByRole('button', { name: 'Replay opening' }).count(), 0, 'Sender preview has no replay control')
  assert.equal(await page.locator('#wish-preview').getByText('Text Wish', { exact: true }).count(), 0, 'The lower preview does not repeat the product summary')
  assert.equal(await page.locator('#wish-preview').getByText('KES 50', { exact: true }).count(), 0, 'The lower preview does not repeat the price')
  assert.equal(await page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' }).count(), 1, 'The preview has a send action without scrolling back to the form')
  assert.equal(await page.locator('#wish-composer [class*="sendRow"]').getByRole('button', { name: 'Send this wish' }).count(), 1, 'The original form action is preserved')
  await page.getByRole('button', { name: 'Close the book card' }).click()
  await page.getByRole('button', { name: 'Open the book card' }).waitFor()
  assert.equal(await liveWish.count(), 0, 'Closing removes private text from the DOM')
  await page.getByRole('button', { name: 'Open the book card' }).click()
  await liveWish.waitFor({ state: 'visible' })
  if (page.viewportSize().width <= 850) {
    await expandField(page,'Your wish')
    await editField(page, wishInput, undefined, true)
    await page.evaluate(() => window.scrollBy(0, 160))
    const miniBounds = await mini.boundingBox()
    assert(miniBounds.height < 90, 'Compact preview leaves room for fields and keyboard')
    assert.equal(await mini.locator('strong').innerText(), 'John Mwangi')
    assert.equal(await mini.locator('p').innerText(), message)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Typing creates no horizontal overflow')
    await mini.getByRole('button', { name: 'View card' }).click()
    await page.waitForFunction(() => {
      const top = document.getElementById('wish-preview').getBoundingClientRect().top
      return top >= 0 && top < innerHeight - 150
    })
  }
  const checkoutRequests = [],checkoutActions=[]
  const trackCheckout = request => { if (request.url().includes('/api/success-wishes/')) checkoutRequests.push(request.url());if(request.url().endsWith('/checkout')&&request.method()==='POST')checkoutActions.push(request.postDataJSON().action) }
  page.on('request', trackCheckout)
  await page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' }).click()
  const checkout = page.getByRole('dialog')
  await checkout.getByRole('heading', { name: 'Review your wish' }).waitFor()
  assert.equal(await checkout.getByText(/Pay to Till 949529/).count(),0,'Compact checkout omits payment destination explanation')
  assert.equal(await checkout.getByText(/The recipient does not need to register/).count(),0,'Compact checkout omits recipient instructions')
  assert.equal(await checkout.getByText('Already started a payment?').count(),0,'Compact checkout omits manual recovery accordion')
  assert.equal(await checkout.getByLabel('M-Pesa number',{exact:true}).count(),0,'Free campaign hides paid M-Pesa controls')
  assert.equal(await checkout.getByLabel('Your free-card code',{exact:true}).count(),1,'Current campaign uses an existing code field')
  assert.equal(await checkout.getByRole('button',{name:'Pay KSh 50',exact:true}).count(),0,'Free campaign never offers a charge')
  assert.equal(await checkout.getByLabel('Recipient’s private wish request link').count(),0)
  await checkout.getByRole('button',{name:'Apply',exact:true}).click()
  await checkout.getByRole('alert').waitFor()
  assert.equal(checkoutRequests.filter(url=>url.endsWith('/checkout')).length,0,'Failed free-code check cannot create a paid order')
  assert.deepEqual(checkoutActions,[],'No M-Pesa checkout is initiated when sending is disabled')
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
  await context.addInitScript(() => { try { sessionStorage.setItem('success-wishes-2026-floating-offer-dismissed', '1') } catch {} })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const claim = page.waitForResponse(response => response.url().includes('/api/success-wishes/test-access') && response.request().method() === 'POST')
  await page.goto(invitation, { waitUntil: 'domcontentloaded', timeout: 90000 })
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
  await page.reload({ waitUntil: 'domcontentloaded' })
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
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) })
  const widths = []
  for (const width of [320, 360, 390, 412, 560, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
    await context.addInitScript(() => { try { sessionStorage.setItem('success-wishes-2026-floating-offer-dismissed', '1') } catch {} })
  const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const response = await page.goto(`${ROOT}/success-wishes`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    assert.equal(response.status(), 200)
    await page.getByRole('heading', { name: /Wish students good luck.*success/i }).waitFor()
    await page.locator('#wish-composer[data-draft-hydrated="true"]').waitFor()
    const close=page.getByRole('button',{name:'Close offer details',exact:true});if(await close.isVisible().catch(()=>false))await close.click()
    const dismiss=page.getByRole('button',{name:'Dismiss Success Cards advert',exact:true});if(await dismiss.isVisible().catch(()=>false))await dismiss.click()
    for (const design of ['Golden Hour', 'New Beginnings', 'Bright Star', 'Above & Beyond']) {
      assert.equal(await page.getByRole('button', { name: `Choose ${design} card` }).count(), 1)
    }
    const gallery = page.locator('section[aria-labelledby="choose-card-title"]')
    assert.equal(await gallery.getByRole('heading', { name: 'Choose a success card design' }).count(), 1)
    assert.equal(await gallery.locator('svg text[textLength], svg text[lengthAdjust]').count(), 0, 'Card lettering must never be stretched to fit')
    assert.equal(await gallery.getByText('Tap a card to choose it').count(), 0, 'Design selection needs no extra instructions')
    assert.equal(await page.locator('section[aria-label="Wish versions and prices"]').locator('[class*="purchaseNote"]').count(), 0, 'Do not duplicate price totals in the selector')
    assert.equal(await page.getByRole('button', { name: 'Create one free Success Card', exact: true }).count(), 1)
    assert.equal(await page.getByRole('button', { name: /Choose Four: up to four students, KSh 100/ }).count(), 0)
    assert.equal(await page.getByRole('button', { name: /Voice Wish|Video Wish|Record voice|Record video|Choose audio file|Choose video file/ }).count(), 0, 'Uncommissioned media controls remain hidden in the text-card product')
    // The current sender flow defaults to Text; Voice/Video selectors are not displayed.
    assert.equal(await page.locator('#wish-composer').count(), 1, 'Sender composer is available')
    assert.equal(await page.getByRole('button', { name: /Text Wish · KES 50/ }).count(), 0, 'Do not restore the retired version selector')
    assert.equal(await page.getByRole('textbox', { name: 'Exam year' }).inputValue(), '2026', 'Year is prefilled for the sender')
    assert.equal(await page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' }).count(), 0, 'No lower CTA appears before the required details are complete')
    assert.equal(await page.locator('#wish-composer [class*="sendRow"]').getByRole('button', { name: 'Send this wish' }).count(), 0, 'No upper CTA appears before the required details are complete')
    assert.equal(await page.getByRole('button', { name: /Preview my card/ }).count(), 0, 'The live preview needs no second preview button')
    // Sender draft and allowed-length text regressions; never initiate a real payment.
    const candidateInput = page.getByRole('textbox', { name: 'Candidate name', exact: true , includeHidden: true })
    const senderInput = page.getByRole('textbox', { name: 'Your name', exact: true , includeHidden: true })
    const wishInput = page.getByRole('textbox', { name: 'Your wish', exact: true , includeHidden: true })
    const yearInput = page.getByRole('textbox', { name: 'Exam year', exact: true , includeHidden: true })
    const schoolInput = page.getByRole('combobox', { name: 'School (optional)' , includeHidden: true })
    await page.route('**/rest/v1/rpc/success_wishes_school_search_public_v1', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    const deliveryInput = page.getByRole('textbox', { name: 'Phone to receive this wish' , includeHidden: true })
    const longCandidate = 'C'.repeat(48), longSender = 'S'.repeat(48), longSchool = 'N'.repeat(80)
    const longWish = Array(7).fill('a'.repeat(30)).join(' ')
    await page.getByRole('button', { name: 'Choose Bright Star card' }).click()
    await page.waitForFunction(() => document.querySelector('button[aria-label="Choose Bright Star card"]')?.getAttribute('aria-pressed') === 'true')
    await editField(page, candidateInput, longCandidate)
    assert.equal(await candidateInput.isVisible(),true,'Active candidate stays expanded while typing')
    await expandField(page,'Your name')
    await editField(page, senderInput, longSender)
    assert.equal(await senderInput.inputValue(), longSender, 'Sender details remain editable without depending on auto-collapse')
    await expandField(page,'Candidate details')
    assert.equal(await candidateInput.inputValue(),longCandidate,'One-tap edit preserves the completed name')
    await editField(page, candidateInput, '')
    await expandField(page,'Your name')
    await editField(page, senderInput, undefined, true)
    await expandField(page,'Candidate details')
    assert.equal(await candidateInput.inputValue(),'','Invalid candidate stays editable when reopened')
    await editField(page, candidateInput, longCandidate)
    await expandField(page,'Your name')
    await editField(page, senderInput, undefined, true)
    await editField(page, schoolInput, longSchool)
    await editField(page, deliveryInput, '0733000111')
    await expandField(page,'Your wish')
    await editField(page, wishInput, longWish)
    await expandField(page, 'Candidate details')
    await editField(page, yearInput, '20')
    await expandField(page,'Your wish')
    await editField(page, wishInput, undefined, true)
    assert.equal(await yearInput.getAttribute('aria-invalid'), 'true')
    await expandField(page,'Candidate details')
    await page.getByText('Enter a four-digit exam year, such as 2026.', { exact: true }).waitFor()
    assert.equal(await page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' }).count(), 0, 'Invalid exam year hides the lower send action')
    assert.equal(await page.locator('#wish-composer [class*="sendRow"]').getByRole('button', { name: 'Send this wish' }).count(), 0, 'Invalid exam year hides the upper send action')
    await expandField(page, 'Candidate details')
    await editField(page, yearInput, '2027')
    await expandField(page,'Your wish')
    await editField(page, wishInput, undefined, true)
    assert.equal(await yearInput.getAttribute('aria-invalid'), 'false')
    assert.equal(await page.locator('#wish-composer [class*="sendRow"]').getByRole('button', { name: 'Send this wish' }).isEnabled(), true, 'Valid year reveals the upper action')
    await page.locator('#wish-preview').scrollIntoViewIfNeeded()
    await page.locator('#wish-preview').click({position:{x:5,y:5}})
    await page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' }).waitFor({ state: 'visible' })
    await expandField(page,'Your wish')
    await editField(page, wishInput, '')
    assert.equal(await page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' }).count(), 0, 'Clearing a required field hides the lower CTA again')
    assert.equal(await page.locator('#wish-composer [class*="sendRow"]').getByRole('button', { name: 'Send this wish' }).count(), 0, 'Upper send action also disappears when a required field is cleared')
    await expandField(page,'Your wish')
    await editField(page, wishInput, longWish)
    assert.equal(await page.locator('#wish-preview').getByRole('button', { name: 'Send this wish' }).isEnabled(), true, 'Restoring the required message restores the lower action')
    assert.equal(await page.locator('#wish-composer [class*="sendRow"]').getByRole('button', { name: 'Send this wish' }).isEnabled(), true, 'Restoring the required message also restores the upper action')
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('vibeschool:success-wishes:sender-draft:v1'))?.draft.examYear === '2027')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('status').filter({ hasText: 'Draft restored.' }).waitFor()
    assert.equal(await candidateInput.inputValue(), longCandidate, 'Refresh restores candidate')
    assert.equal(await senderInput.inputValue(), longSender, 'Refresh restores sender')
    assert.equal(await schoolInput.inputValue(), longSchool, 'Refresh restores school')
    assert.equal(await wishInput.inputValue(), longWish, 'Refresh restores the exact wish')
    assert.equal(await yearInput.inputValue(), '2027')
    assert.equal(await page.getByRole('button', { name: 'Choose Bright Star card' }).getAttribute('aria-pressed'), 'true')
    await expandField(page,'Your wish')
    await editField(page, wishInput, undefined, true)
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
    await page.locator('#wish-composer').screenshot({path:path.join(screenshots,`sender-collapsed-${width}.png`)})
    const completedSurface=await page.locator('#wish-composer details').first().evaluate(el=>getComputedStyle(el).backgroundColor)
    assert.equal(completedSurface,'rgba(0, 0, 0, 0)','Compact sections use the flat parent surface')
    await page.screenshot({ path: path.join(screenshots, `sender-long-text-${width}.png`), fullPage: true })
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: 'Clear draft' }).click()
    assert.equal(await candidateInput.inputValue(), longCandidate, 'Cancel clear preserves draft')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Clear draft' }).click()
    assert.equal(await candidateInput.inputValue(), '')
    await page.waitForFunction(() => sessionStorage.getItem('vibeschool:success-wishes:sender-draft:v1') === null)
    await page.reload({ waitUntil: 'domcontentloaded' })
    assert.equal(await candidateInput.inputValue(), '', 'Cleared draft stays cleared after refresh')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, `Unexpected horizontal overflow at ${width}px: ${overflow}`)
    const config = await page.request.get(`${ROOT}/api/success-wishes/config`)
    assert.deepEqual(await config.json(), { freeTrialEnabled: false, enabled: false, mediaEnabled: false, paymentsEnabled: false, groupPaymentsEnabled: false, maxSeconds: 60, maxBytes: 26214400 })
    assert.deepEqual(errors, [], `Browser errors at ${width}px`)
    await page.screenshot({ path: path.join(screenshots, `ecommerce-${width}.png`), fullPage: true })
    widths.push({ width, page: 'single unified journey', overflow: false, productionSending: false })
    await context.close()
  }

  const messageA = 'John, we are proud of your hard work. Go forward with courage.'
  const messageB = 'John, may your next chapter bring you joy and opportunity.'
  // Voice/video remain covered by recording/media unit contracts; the public text MVP must not expose their controls.
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
