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
  let controlled = false
  let lastNavigationError
  for (let attempt = 1; attempt <= 3 && !controlled; attempt += 1) {
    try {
      await page.goto(`${BASE}/?pwa-browser-control=${attempt}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })
    } catch (error) {
      lastNavigationError = error
      console.log(`[pwa-browser] control navigation attempt ${attempt} was interrupted; retrying`)
    }

    controlled = await page
      .waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
  }
  assert(controlled, `service worker never controlled the page: ${lastNavigationError || 'no controller'}`)

  stage('inspect Chromium manifest')
  const cdp = await context.newCDPSession(page)
  await cdp.send('Page.enable')

  const manifest = await cdp.send('Page.getAppManifest')
  assert(manifest.url?.includes('/manifest.webmanifest'), 'Chromium did not discover the VibeSchool manifest')
  assert(!manifest.errors?.length, `Chromium manifest errors: ${JSON.stringify(manifest.errors)}`)

  if (manifest.data) {
    const manifestData = JSON.parse(manifest.data)
    const iconSources = (manifestData.icons || []).map((icon) => icon.src)
    assert(iconSources.some((src) => src.includes('/pwa-icons/v3/192')), 'manifest does not advertise the v3 192 icon')
    assert(iconSources.some((src) => src.includes('/pwa-icons/v3/512')), 'manifest does not advertise the v3 512 icon')
    assert(iconSources.some((src) => src.includes('/pwa-icons/v3/maskable-512')), 'manifest does not advertise the v3 maskable icon')
    assert(!iconSources.some((src) => src.includes('/pwa-icons/v2/')), 'manifest still advertises legacy v2 icons')
  }

  stage('inspect Chromium installability')
  const installability = await cdp.send('Page.getInstallabilityErrors')
  assert(
    installability.installabilityErrors.length === 0,
    `Chromium installability errors: ${JSON.stringify(installability.installabilityErrors)}`
  )

  stage('verify v3 PNG launcher assets')
  for (const [path, size] of [
    ['/pwa-icons/v3/192', '192'],
    ['/pwa-icons/v3/512', '512'],
    ['/pwa-icons/v3/maskable-512', 'maskable'],
  ]) {
    const result = await page.evaluate(async (url) => {
      const response = await fetch(url)
      const bytes = new Uint8Array(await response.arrayBuffer())
      return {
        ok: response.ok,
        type: response.headers.get('content-type') || '',
        cacheControl: response.headers.get('cache-control') || '',
        signature: Array.from(bytes.slice(0, 8)),
      }
    }, path)

    assert(result.ok, `${size} icon endpoint failed`)
    assert(result.type.includes('image/png'), `${size} icon is not image/png: ${result.type}`)
    assert(result.cacheControl.includes('immutable'), `${size} icon is not immutable-cache versioned content`)
    assert(
      JSON.stringify(result.signature) === JSON.stringify([137, 80, 78, 71, 13, 10, 26, 10]),
      `${size} icon is not a PNG payload`
    )
  }

  stage('verify offline fallback is precached and branded')
  const offlineCache = await page.evaluate(async () => {
    const keys = await caches.keys()
    for (const key of keys) {
      const cache = await caches.open(key)
      const response = await cache.match('/offline.html')
      if (response) {
        return {
          cacheName: key,
          text: await response.text(),
        }
      }
    }
    return null
  })

  assert(offlineCache, 'offline fallback is not present in Cache Storage')
  assert(offlineCache.cacheName === 'vibeschool-v7', `unexpected offline cache generation: ${offlineCache.cacheName}`)
  assert(offlineCache.text.includes('You’re offline'), 'cached offline fallback is missing offline message')
  assert(offlineCache.text.includes('/icons/vibeschool-logo.png'), 'cached offline fallback lost official VibeSchool branding')
  assert(
    offlineCache.text.includes('Your account data is not stored in the offline cache.'),
    'cached offline fallback lost its private-data safety message'
  )

  stage('verify normal navigation recovery')
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.title.includes('VibeSchool'))
  assert((await page.title()).includes('VibeSchool'), 'network recovery did not restore VibeSchool')

  console.log('PWA BROWSER GATE PASSED')
} catch (error) {
  console.error('[pwa-browser] FAILED', error)
  throw error
} finally {
  await browser.close()
}
