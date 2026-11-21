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
  assert(offlineCache.cacheName === 'vibeschool-v9-offline-reading', `unexpected offline cache generation: ${offlineCache.cacheName}`)
  assert(offlineCache.text.includes('You’re offline'), 'cached offline fallback is missing offline message')
  assert(offlineCache.text.includes('/icons/vibeschool-logo.png'), 'cached offline fallback lost official VibeSchool branding')
  assert(
    offlineCache.text.includes('Private learner, teacher and school records are not saved'),
    'cached offline fallback lost its private-data safety message'
  )

  stage('download public games and cold navigate offline')
  await page.goto(`${BASE}/marketing-studio`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Save games for offline' }).click()
  await page.getByText('Saved public games on this device.', { exact:false }).waitFor({ timeout: 120000 })
  await context.setOffline(true)
  await page.goto(`${BASE}/spin-studio`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  // The initial offline HTML shows a loading shell until the cached JS hydrates.
  await page.getByRole('heading', { name: /^VibeSpin Studio/ }).waitFor({ timeout: 10000 })
  await context.setOffline(false)

  stage('prepare public offline book shell and cold read without internet')
  await page.goto(`${BASE}/offline/books`, { waitUntil: 'domcontentloaded' })
  const prepared = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel()
      const timeout = setTimeout(() => reject(new Error('book reader preparation timed out')), 120000)
      channel.port1.onmessage = event => { clearTimeout(timeout); resolve(event.data) }
      registration.active.postMessage({ type: 'PREPARE_OFFLINE_BOOK_READER' }, [channel.port2])
    })
  })
  assert(prepared.type === 'OFFLINE_BOOK_READER_READY', 'offline reader preparation did not succeed: '+JSON.stringify(prepared))
  await page.evaluate(async () => {
    const db = await new Promise((resolve,reject) => {
      const req=indexedDB.open('vibeschool-public-books-v1',1)
      req.onupgradeneeded=()=>req.result.createObjectStore('books',{keyPath:'id'})
      req.onsuccess=()=>resolve(req.result)
      req.onerror=()=>reject(req.error)
    })
    await new Promise((resolve,reject) => {
      const tx=db.transaction('books','readwrite')
      tx.objectStore('books').put({
        id:'offline-book-test',title:'Offline Test Book',format:'vibetextbook',savedAt:Date.now(),
        chapters:[{id:'offline-test-chapter',number:1,title:'Offline Test Chapter',blocks:[{id:'offline-text',type:'paragraph',content:'This paragraph is saved on the device.'}]}]
      })
      tx.oncomplete=resolve
      tx.onerror=()=>reject(tx.error)
    })
    db.close()
  })
  await context.setOffline(true)
  await page.goto(`${BASE}/offline/books`, {waitUntil:'domcontentloaded',timeout:30000})
  await page.getByRole('button',{name:'Read offline'}).click({timeout:30000})
  assert((await page.locator('body').innerText()).includes('Offline Test Chapter'), 'offline saved chapter did not render')
  await context.setOffline(false)

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
