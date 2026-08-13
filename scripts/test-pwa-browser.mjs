import { chromium } from 'playwright'

const BASE = process.env.PWA_TEST_BASE_URL || 'http://127.0.0.1:3000'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function stage(message) {
  console.log(`[pwa-browser] ${message}`)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ serviceWorkers: 'allow' })
const page = await context.newPage()

try {
  stage('open production build')
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load')

  stage('wait for service worker readiness')
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('service workers unavailable')
    await navigator.serviceWorker.ready
  })

  stage('navigate into service-worker control')
  await page.goto(`${BASE}/?pwa-browser-control=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

  stage('inspect Chromium manifest')
  const cdp = await context.newCDPSession(page)
  await cdp.send('Page.enable')

  const manifest = await cdp.send('Page.getAppManifest')
  assert(manifest.url?.includes('/manifest.webmanifest'), 'Chromium did not discover the VibeSchool manifest')
  assert(!manifest.errors?.length, `Chromium manifest errors: ${JSON.stringify(manifest.errors)}`)

  stage('inspect Chromium installability')
  const installability = await cdp.send('Page.getInstallabilityErrors')
  assert(
    installability.installabilityErrors.length === 0,
    `Chromium installability errors: ${JSON.stringify(installability.installabilityErrors)}`
  )

  stage('verify versioned PNG launcher assets')
  for (const [path, size] of [
    ['/pwa-icons/v2/192', '192'],
    ['/pwa-icons/v2/512', '512'],
    ['/pwa-icons/v2/maskable-512', 'maskable'],
  ]) {
    const result = await page.evaluate(async (url) => {
      const response = await fetch(url)
      const bytes = new Uint8Array(await response.arrayBuffer())
      return {
        ok: response.ok,
        type: response.headers.get('content-type') || '',
        signature: Array.from(bytes.slice(0, 8)),
      }
    }, path)

    assert(result.ok, `${size} icon endpoint failed`)
    assert(result.type.includes('image/png'), `${size} icon is not image/png: ${result.type}`)
    assert(
      JSON.stringify(result.signature) === JSON.stringify([137, 80, 78, 71, 13, 10, 26, 10]),
      `${size} icon is not a PNG payload`
    )
  }

  stage('verify real offline navigation fallback')
  await context.setOffline(true)
  await page.goto(`${BASE}/pwa-offline-probe`, { waitUntil: 'domcontentloaded' })
  const offlineText = await page.locator('body').innerText()
  assert(offlineText.includes('You’re offline'), 'offline navigation did not render the offline fallback')
  assert(
    offlineText.includes('Your account data is not stored in the offline cache.'),
    'offline fallback lost its private-data safety message'
  )

  stage('restore network and verify recovery')
  await context.setOffline(false)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.title.includes('VibeSchool'))
  assert((await page.title()).includes('VibeSchool'), 'network recovery did not restore VibeSchool')

  console.log('PWA BROWSER GATE PASSED')
} catch (error) {
  console.error('[pwa-browser] FAILED', error)
  throw error
} finally {
  await context.setOffline(false).catch(() => undefined)
  await browser.close()
}
