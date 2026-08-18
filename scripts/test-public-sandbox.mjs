import { chromium } from 'playwright'

const base = process.env.PUBLIC_TEST_BASE_URL || 'http://127.0.0.1:3000'
const failures = []
const fail = (message) => failures.push(message)

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const externalDataRequests = []

  page.on('request', (request) => {
    const url = request.url()
    if (/supabase\.co|\/rest\/v1\/|\/functions\/v1\//i.test(url)) externalDataRequests.push(url)
  })

  const moveToStage = async (buttonName, headingName) => {
    await page.getByRole('button', { name: buttonName, exact: true }).click()
    await page.getByRole('heading', { name: headingName, exact: true }).waitFor({ state: 'visible' })
  }

  const response = await page.goto(base + '/sandbox', { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!response || response.status() >= 400) fail(`sandbox HTTP ${response?.status() ?? 'none'}`)

  await page.getByRole('heading', { name: 'Use VibeSchool before you sign in.', exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Demonstration boundary', { exact: true }).waitFor({ state: 'attached' })
  const initial = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    h1Count: document.querySelectorAll('h1').length,
    main: Boolean(document.getElementById('main-content')),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.innerText,
  }))

  if (initial.h1 !== 'Use VibeSchool before you sign in.') fail(`unexpected h1: ${initial.h1}`)
  if (initial.h1Count !== 1) fail(`expected one h1, got ${initial.h1Count}`)
  if (!initial.main) fail('missing #main-content')
  if (initial.overflow > 2) fail(`horizontal overflow ${initial.overflow}px`)
  for (const phrase of ['No production learner data', 'Client-only demo state']) {
    if (!initial.body.includes(phrase)) fail(`missing sandbox truth phrase: ${phrase}`)
  }

  const presentInputs = page.getByLabel('Present')
  const participatedInputs = page.getByLabel('Participated')
  await moveToStage('02 Teach', 'Record what actually happened in the lesson.')
  await presentInputs.nth(1).check()
  await participatedInputs.nth(1).check()

  await moveToStage('03 Evidence', 'Capture what each present learner demonstrated.')
  await page.getByLabel(/Identifies relevant cell structures/).nth(1).check()
  await page.getByLabel(/Explains how a structure supports a function/).nth(1).check()

  await moveToStage('04 Assess', 'Turn observations into a transparent evidence summary.')
  await page.getByText('Developing evidence coverage', { exact: true }).waitFor({ state: 'visible' })
  const assessmentText = await page.locator('main').innerText()
  if (!assessmentText.includes('Developing evidence coverage')) fail('assessment did not derive the expected evidence state')
  if (!assessmentText.includes('Evidence first. Interpretation second.')) fail('assessment evidence-boundary copy missing')

  await moveToStage('05 Understand', 'See the gap without losing the evidence behind it.')
  const understandingHeading = page.getByRole('heading', { name: 'See the gap without losing the evidence behind it.', exact: true })
  const understandingCard = understandingHeading.locator('..')
  await understandingCard.getByText('Current evidence gap', { exact: true }).waitFor({ state: 'visible' })
  await understandingCard.getByText('Apply', { exact: true }).first().waitFor({ state: 'visible' })

  await moveToStage('06 Next action', 'Close the loop with a response tied to the weakest evidence.')
  const nextActionHeading = page.getByRole('heading', { name: 'Close the loop with a response tied to the weakest evidence.', exact: true })
  const nextActionCard = nextActionHeading.locator('..')
  await nextActionCard.getByText(/Give a new example and ask learners to transfer the idea independently/).waitFor({ state: 'visible' })
  const nextText = await page.locator('main').innerText()
  if (!nextText.includes('Give a new example')) fail('next action is not tied to the weakest observed criterion')

  await page.getByRole('button', { name: 'Family', exact: true }).click()
  await page.getByRole('heading', { name: 'How is my child doing, where is the difficulty, and what happens next?', exact: true }).waitFor({ state: 'visible' })
  const familyText = await page.locator('main').innerText()
  if (!familyText.includes('How is my child doing, where is the difficulty, and what happens next?')) fail('family role lens missing')
  if (!familyText.includes('2 of 3 demonstration criteria')) fail('family lens does not reflect the same evidence state')

  await page.getByRole('button', { name: 'School leader', exact: true }).click()
  await page.getByRole('heading', { name: 'What educational signal should leadership act on?', exact: true }).waitFor({ state: 'visible' })
  const leaderText = await page.locator('main').innerText()
  if (!leaderText.includes('What educational signal should leadership act on?')) fail('school leader lens missing')
  if (!leaderText.includes('curriculum → teaching → participation → evidence → response')) fail('leadership causality chain missing')

  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await moveToStage('02 Teach', 'Record what actually happened in the lesson.')
  if (await presentInputs.nth(1).isChecked()) fail('reset did not clear demo attendance state')

  if (externalDataRequests.length) fail(`sandbox made external learner/data requests: ${externalDataRequests.join(', ')}`)

  const controls = await page.locator('button,input').evaluateAll((elements) => elements.map((element) => {
    const id = element.getAttribute('id')
    const labelled = Boolean(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim() ||
      element.closest('label') ||
      (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
    )
    return { tag: element.tagName, type: element.getAttribute('type'), labelled }
  }))
  const unlabeled = controls.filter((control) => !control.labelled)
  if (unlabeled.length) fail(`${unlabeled.length} unlabeled sandbox controls`)

  await context.close()
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('PUBLIC SANDBOX CERTIFICATION: FAIL')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log('PUBLIC SANDBOX CERTIFICATION: PASS')
console.log('No-login demo state, evidence-bound inference, role-scoped views, next-action causality, mobile layout and no production-data requests passed.')
