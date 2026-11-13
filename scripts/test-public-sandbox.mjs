import { chromium } from 'playwright'

const base = process.env.PUBLIC_TEST_BASE_URL || 'http://127.0.0.1:3000'
const failures = []
const fail = (message) => failures.push(message)
const launchOptions = process.env.PLAYWRIGHT_BROWSER_CHANNEL
  ? { headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
  : { headless: true }

const browser = await chromium.launch(launchOptions)
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const externalDataRequests = []

  page.on('request', (request) => {
    const url = request.url()
    if (/supabase\.co|\/rest\/v1\/|\/functions\/v1\//i.test(url)) externalDataRequests.push(url)
  })

  const response = await page.goto(base + '/sandbox', { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!response || response.status() >= 400) fail('sandbox HTTP ' + (response?.status() ?? 'none'))

  await page.getByRole('heading', { name: 'One lesson. Everything connected.', exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Demonstration boundary.', { exact: true }).waitFor({ state: 'attached' })

  const initial = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    h1Count: document.querySelectorAll('h1').length,
    main: Boolean(document.getElementById('main-content')),
    officialLogo: Boolean(document.querySelector('header img[alt="VibeSchool"]')),
    focusedFooter: Boolean(document.querySelector('footer a[href="/trust"]')),
    mobileNavigationVisible: [...document.querySelectorAll('nav[aria-label="Public bottom navigation"]')].some(nav => getComputedStyle(nav).display !== 'none'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.innerText,
    links: [...document.querySelectorAll('main a, header a')].map((link) => link.getAttribute('href')),
  }))

  if (initial.h1 !== 'One lesson. Everything connected.') fail('unexpected h1: ' + initial.h1)
  if (initial.h1Count !== 1) fail('expected one h1, got ' + initial.h1Count)
  if (!initial.main) fail('missing #main-content')
  if (!initial.officialLogo) fail('sandbox does not use canonical VibeSchool header logo')
  if (!initial.focusedFooter) fail('sandbox missing public trust/footer navigation')
  if (!initial.mobileNavigationVisible) fail('sandbox missing public mobile bottom navigation')
  if (initial.overflow > 2) fail('mobile horizontal overflow: ' + initial.overflow + 'px')
  for (const href of ['/', '/sandbox', '/learn', '/product', '/evidence', '/login/global', '/learn?grade=Grade+8&subject=Mathematics']) {
    if (!initial.links.includes(href)) fail('sandbox shared navigation missing: ' + href)
  }
  if (initial.links.includes('/global/signup')) fail('sandbox reintroduced legacy global signup entry')
  for (const phrase of ['No production learner data', 'Client-only demo state', 'Interactive sample']) {
    if (!initial.body.includes(phrase)) fail('missing demonstration truth phrase: ' + phrase)
  }

  // The visitor can begin immediately; no stage, tutorial or Next gate.
  await page.getByRole('heading', { name: 'Ratios describe a relationship.' }).waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: /There are 3 red counters/ }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '6 blue counters', exact: true }).click()
  await page.getByText('Not quite. Try the scale factor.', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText(/Find the scale factor from 3 to 12/).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '8 blue counters', exact: true }).click()
  await page.getByText('Correct: 8 blue counters', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText(/One question is evidence of this response/).waitFor({ state: 'visible' })

  await page.getByRole('button', { name: 'Family', exact: true }).click()
  await page.getByText('One practice response recorded', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText(/does not establish the learner’s overall performance/).waitFor({ state: 'visible' })

  await page.getByRole('button', { name: 'School leader', exact: true }).click()
  await page.getByText('One observed sample response', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText(/cannot show class attainment/).waitFor({ state: 'visible' })

  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await page.getByText('Your answer appears here', { exact: true }).waitFor({ state: 'visible' })
  const selectedAfterReset = await page.locator('button[aria-pressed="true"]').count()
  if (selectedAfterReset !== 1) fail('reset must restore default teacher role with no selected practice answer')

  await page.setViewportSize({ width: 320, height: 720 })
  const tinyOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (tinyOverflow > 2) fail('320px horizontal overflow: ' + tinyOverflow + 'px')

  const telemetryResponse = await page.request.post(base + '/api/public-telemetry', { data: { event: 'public_sandbox_pilot', path: '/sandbox' } })
  if (telemetryResponse.status() !== 204) fail('sandbox telemetry rejected: ' + telemetryResponse.status())

  if (externalDataRequests.length) fail('sandbox made external learner/data requests: ' + externalDataRequests.join(', '))

  const controls = await page.locator('button,input').evaluateAll((elements) => elements.map((element) => {
    const id = element.getAttribute('id')
    const labelled = Boolean(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim() ||
      element.closest('label') ||
      (id && document.querySelector('label[for="' + CSS.escape(id) + '"]'))
    )
    return { tag: element.tagName, type: element.getAttribute('type'), labelled }
  }))
  const unlabeled = controls.filter((control) => !control.labelled)
  if (unlabeled.length) fail(unlabeled.length + ' unlabeled sandbox controls')

  await context.close()
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('PUBLIC SANDBOX CERTIFICATION: FAIL')
  for (const failure of failures) console.error(' - ' + failure)
  process.exit(1)
}

console.log('PUBLIC SANDBOX CERTIFICATION: PASS')
console.log('One-screen, mobile, canonical public navigation/footer, Grade 8 Learn continuation, response-derived feedback, role views, reset, telemetry and demo isolation passed.')
