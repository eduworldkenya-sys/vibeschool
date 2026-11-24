import { chromium } from 'playwright'

const base = process.env.PUBLIC_TEST_BASE_URL || 'http://127.0.0.1:3000'
const routes = ['/home', '/product', '/evidence', '/about', '/contact', '/careers', '/institutions', '/trust', '/trust/child-safety', '/trust/security', '/trust/responsible-ai', '/legal', '/legal/privacy', '/legal/terms', '/legal/aup', '/pathways', '/pathways/check', '/pathways/subjects', '/pathways/schools', '/learn/careers', '/teacher/marketplace', '/teacher/marketplace/sandbox']
const viewports = [{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]
const failures=[]
const internalLinks=new Set()
const fail = msg => failures.push(msg)
const launchOptions = process.env.PLAYWRIGHT_BROWSER_CHANNEL
  ? { headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
  : { headless: true }

const browser = await chromium.launch(launchOptions)
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    for (const route of routes) {
      const response = await page.goto(base + route, { waitUntil:'domcontentloaded', timeout:30000 })
      if (!response || response.status() >= 400) { fail(`${route} ${viewport.width}px: HTTP ${response?.status() ?? 'none'}`); continue }

      await page.waitForFunction(
        () => Boolean(document.querySelector('main')) && document.querySelectorAll('h1').length === 1,
        { timeout: 5000 }
      ).catch(() => {})

      const result = await page.evaluate(() => {
        const root = document.documentElement
        const buttons = [...document.querySelectorAll('button')]
        const links = [...document.querySelectorAll('a')]
        const images = [...document.querySelectorAll('img')]
        const inputs = [...document.querySelectorAll('input,select,textarea')]
        const header = document.querySelector('header')
        const headerLogo = document.querySelector('header img[alt="VibeSchool"]')
        const footerLogo = document.querySelector('footer img[alt="VibeSchool"]')
        const rect = el => el ? el.getBoundingClientRect() : null
        return {
          overflow: root.scrollWidth - root.clientWidth,
          h1: document.querySelectorAll('h1').length,
          main: Boolean(document.querySelector('main')),
          mainTarget: Boolean(document.getElementById('main-content')),
          unlabeledButtons: buttons.filter(el => !(el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('title'))).length,
          emptyLinks: links.filter(el => !(el.textContent?.trim() || el.getAttribute('aria-label'))).length,
          placeholderLinks: links.filter(el => ['#','javascript:void(0)'].includes((el.getAttribute('href')||'').trim())).length,
          internalHrefs: links.map(el=>el.getAttribute('href')).filter(href=>href?.startsWith('/') && !href.startsWith('//')),
          missingAlt: images.filter(el => !el.hasAttribute('alt')).length,
          unlabeledInputs: inputs.filter(el => {
            const id = el.getAttribute('id')
            return !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest('label'))
          }).length,
          headerRect: rect(header),
          headerLogoRect: rect(headerLogo),
          footerLogoRect: rect(footerLogo),
          headerLogoSrc: headerLogo?.getAttribute('src') || '',
          footerLogoSrc: footerLogo?.getAttribute('src') || '',
        }
      })
      for (const href of result.internalHrefs) internalLinks.add(href.split('#')[0])
      if (result.overflow > 2) fail(`${route} ${viewport.width}px: horizontal overflow ${result.overflow}px`)
      if (!result.main) fail(`${route}: missing semantic main landmark`)
      if (!result.mainTarget) fail(`${route}: missing #main-content skip target`)
      if (result.h1 !== 1) fail(`${route}: expected exactly one h1, got ${result.h1}`)
      if (result.unlabeledButtons) fail(`${route}: ${result.unlabeledButtons} unlabeled buttons`)
      if (result.emptyLinks) fail(`${route}: ${result.emptyLinks} links without accessible name`)
      if (result.placeholderLinks) fail(`${route}: ${result.placeholderLinks} placeholder links`)
      if (result.missingAlt) fail(`${route}: ${result.missingAlt} images without alt`)
      if (result.unlabeledInputs) fail(`${route}: ${result.unlabeledInputs} unlabeled form controls`)
      if (result.headerRect && result.headerRect.height > 80) fail(`${route} ${viewport.width}px: public header is ${Math.round(result.headerRect.height)}px high; max is 80px`)
      if (!result.headerLogoRect) fail(`${route}: public header VibeSchool wordmark missing`)
      else if (result.headerLogoRect.height > 40 || result.headerLogoRect.width > 170) fail(`${route} ${viewport.width}px: header wordmark rendered ${Math.round(result.headerLogoRect.width)}x${Math.round(result.headerLogoRect.height)}; exceeds brand lockup budget`)
      if (!result.footerLogoRect) fail(`${route}: public footer VibeSchool wordmark missing`)
      else if (result.footerLogoRect.height > 40 || result.footerLogoRect.width > 180) fail(`${route} ${viewport.width}px: footer wordmark rendered ${Math.round(result.footerLogoRect.width)}x${Math.round(result.footerLogoRect.height)}; exceeds brand lockup budget`)
      if (result.headerLogoSrc && !result.headerLogoSrc.includes('vibeschool-wordmark.svg')) fail(`${route}: header is not using canonical SVG wordmark`)
      if (result.footerLogoSrc && !result.footerLogoSrc.includes('vibeschool-wordmark-dark.svg')) fail(`${route}: footer is not using canonical dark SVG wordmark`)
    }
    await context.close()
  }

  // Flagship Product experience: verify actual interaction, not only static layout.
  const productContext = await browser.newContext({viewport:{width:390,height:844}})
  const productPage = await productContext.newPage()
  await productPage.goto(base+'/product',{waitUntil:'domcontentloaded'})
  await productPage.getByRole('button',{name:'04 Assess'}).click()
  await productPage.getByRole('button',{name:/Try the sample question/}).click()
  if (!(await productPage.getByRole('button',{name:'Learner',exact:true}).getAttribute('aria-pressed') === 'true')) fail('product: teacher → learner handoff failed')
  await productPage.getByRole('button',{name:'90 minutes'}).click()
  if (!/Correct! 60 minutes plus 30 minutes/.test(await productPage.locator('[aria-live="polite"]').last().innerText())) fail('product: correct-answer feedback missing')
  await productPage.getByRole('button',{name:'Teacher',exact:true}).click()
  await productPage.getByRole('button',{name:'05 Next'}).click()
  if (!/One correct response/.test(await productPage.locator('main').innerText())) fail('product: correct-answer next action did not carry over')
  await productPage.getByRole('button',{name:'Learner',exact:true}).click()
  await productPage.getByRole('button',{name:'Practice',exact:true}).click()
  await productPage.getByRole('button',{name:'45 minutes'}).click()
  if (!/Try again/.test(await productPage.locator('main').innerText())) fail('product: incorrect-answer recovery missing')
  await productPage.getByRole('button',{name:'Reset',exact:true}).click()
  if (!/Choose an answer for immediate feedback/.test(await productPage.locator('main').innerText())) fail('product: question reset missing')
  await productPage.getByRole('button',{name:'Parent',exact:true}).click()
  if (!/Family access to a real learner.s data requires an authorised relationship/.test(await productPage.locator('main').innerText())) fail('product: family authority disclosure missing')
  await productPage.getByRole('button',{name:'School',exact:true}).click()
  if (!/no class results, school statistics or private student records/i.test(await productPage.locator('main').innerText())) fail('product: school sample-data disclosure missing')
  if (!(await productPage.locator('a[href="/sandbox"]').count())) fail('product: canonical public sandbox entry missing')
  await productContext.close()

  const context = await browser.newContext({viewport:{width:390,height:844}})
  const page = await context.newPage()
  await page.goto(base+'/',{waitUntil:'domcontentloaded'})
  const publicBar = page.getByRole('navigation', { name: 'Public bottom navigation' })
  if (await publicBar.getByRole('link', {name:'Explore', exact:true}).getAttribute('aria-current') !== 'page') fail('root: Explore is not selected')
  if (await page.locator('header').getByRole('link', {name:'VibeSchool home'}).getAttribute('href') !== '/home') fail('root: original homepage link missing')
  await publicBar.getByRole('link', {name:'VibeTutor', exact:true}).click()
  await page.waitForURL('**/vibetutor')
  await page.goto(base+'/',{waitUntil:'domcontentloaded'})
  // Verify keyboard activation on the hydrated client, not during a moving
  // hydration boundary that can replace the focused element between Tab and Enter.
  await page.locator('a[data-vs-public-skip][data-vs-skip-ready="true"]')
    .waitFor({state:'attached',timeout:10000})
  await page.keyboard.press('Tab')
  const firstFocused = await page.evaluate(() => ({text:document.activeElement?.textContent?.trim(),href:document.activeElement?.getAttribute('href'),outline:getComputedStyle(document.activeElement).outlineStyle}))
  if (firstFocused.href !== '#main-content') fail(`keyboard: first focus is not skip link (${JSON.stringify(firstFocused)})`)
  if (firstFocused.outline === 'none') fail('keyboard: first focused control has no visible outline')
  await page.keyboard.press('Enter')
  // Allow the browser navigation event to settle after keyboard activation.
  try {
    await page.waitForFunction(() => location.hash === '#main-content', { timeout: 3000 })
  } catch {
    const hash = await page.evaluate(() => location.hash)
    fail(`keyboard: skip link did not target main content (${hash})`)
  }
  try {
    await page.waitForFunction(() => document.activeElement?.id === 'main-content', { timeout: 3000 })
  } catch { fail('keyboard: skip link did not transfer focus to the main landmark') }

  const menu = page.locator('details summary[aria-label="Open public navigation"]')
  if (await menu.count()) {
    await menu.click()
    const mobileNavVisible = await page.locator('nav[aria-label="Mobile public navigation"]').isVisible()
    if (!mobileNavVisible) fail('mobile navigation did not open')
  } else fail('mobile navigation control missing')

  const perf = await page.evaluate(() => ({
    resourceBytes:performance.getEntriesByType('resource').reduce((sum,entry)=>sum+(entry.transferSize||0),0),
    resources:performance.getEntriesByType('resource').length,
    dcl:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? 0,
  }))
  if (perf.resourceBytes > 3_500_000) fail(`homepage transferred ${perf.resourceBytes} bytes; budget is 3.5 MB`)
  if (perf.resources > 90) fail(`homepage requested ${perf.resources} resources; budget is 90`)
  if (perf.dcl > 7000) fail(`homepage DOMContentLoaded ${Math.round(perf.dcl)}ms; CI budget is 7000ms`)
  await context.close()

  const requestContext = await browser.newContext()
  for (const href of [...internalLinks].sort()) {
    if (!href || href.startsWith('/api/') || href.startsWith('/auth/') || href.startsWith('/login') || href.startsWith('/signup') || href.startsWith('/student/') || href.startsWith('/teacher/') || href.startsWith('/parent/') || href.startsWith('/admin/') || href.startsWith('/hq/')) continue
    const response = await requestContext.request.get(base+href,{maxRedirects:4,timeout:20000})
    if (response.status() >= 400) fail(`internal link ${href}: HTTP ${response.status()}`)
  }
  await requestContext.close()

  const errorContext = await browser.newContext({viewport:{width:390,height:844}})
  const errorPage = await errorContext.newPage()
  await errorPage.route('**/rest/v1/rpc/pathways_search_public_schools_v2', route => route.abort())
  await errorPage.goto(base+'/pathways/schools',{waitUntil:'domcontentloaded'})
  await errorPage.waitForTimeout(800)
  const errorText = await errorPage.locator('body').innerText()
  if (!/could not load school information/i.test(errorText)) fail('Pathways schools network-error state is not visible')
  await errorContext.close()

  const emptyContext = await browser.newContext({viewport:{width:390,height:844}})
  const emptyPage = await emptyContext.newPage()
  await emptyPage.route('**/rest/v1/rpc/pathways_search_public_schools_v2', route => route.fulfill({status:200,contentType:'application/json',body:'[]'}))
  await emptyPage.goto(base+'/pathways/schools',{waitUntil:'domcontentloaded'})
  const schoolInput = emptyPage.getByPlaceholder('Start typing a school name')
  await schoolInput.fill('Example Missing School')
  await emptyPage.getByRole('button',{name:/search schools/i}).click()
  await emptyPage.waitForTimeout(300)
  const emptyText = await emptyPage.locator('body').innerText()
  if (!/No trusted match/i.test(emptyText) || !/Can.t find your school/i.test(emptyText)) fail('Pathways missing-school recovery state is not visible')
  await emptyContext.close()

  const notFoundContext = await browser.newContext({viewport:{width:390,height:844}})
  const notFound = await notFoundContext.newPage()
  const nf = await notFound.goto(base+'/definitely-not-a-vibeschool-route',{waitUntil:'domcontentloaded'})
  if (nf?.status() !== 404) fail(`not-found route returned ${nf?.status()}`)
  const nfText = await notFound.locator('body').innerText()
  if (!/This page is not where we expected it to be/i.test(nfText) || !/VibeSchool home/i.test(nfText)) fail('404 recovery UX missing')
  await notFoundContext.close()
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('PUBLIC BROWSER CERTIFICATION: FAIL')
  for (const item of failures) console.error(` - ${item}`)
  process.exit(1)
}
console.log('PUBLIC BROWSER CERTIFICATION: PASS')
console.log('Responsive layout, light/dark brand lockup geometry, semantic landmarks, skip targets, keyboard focus, accessible names, internal links, performance budgets, 404 recovery and Pathways failure states passed.')
