// Public offline foundation. Never cache authenticated, user-specific or API data.
const CACHE_NAME = 'vibeschool-v9-offline-reading'
const STATIC_ROUTES = ['/offline.html']
const SAFE_PUBLIC_ROUTES = ['/', '/about', '/contact', '/careers', '/institutions', '/sandbox', '/trust', '/legal']
const OFFLINE_GAME_ROUTES = ['/marketing-studio', '/spin-studio', '/coin-studio', '/pendulum-studio', '/games-studio']
const OFFLINE_BOOK_ROUTE = '/offline/books'
const SAFE_PUBLIC_PATHS = new Set([...SAFE_PUBLIC_ROUTES, ...OFFLINE_GAME_ROUTES, OFFLINE_BOOK_ROUTE])
const PUBLIC_ASSET_PREFIXES = ['/_next/static/', '/icons/', '/pwa-icons/', '/fonts/']
const OFFLINE_PREPARE = 'PREPARE_OFFLINE_GAMES'
const OFFLINE_PREPARE_BOOKS = 'PREPARE_OFFLINE_BOOK_READER'
const isPublicAsset = (path) => PUBLIC_ASSET_PREFIXES.some(prefix => path.startsWith(prefix))
const safeSameOrigin = (value) => {
  const url = new URL(value, self.location.origin)
  return url.origin === self.location.origin && !url.search && isPublicAsset(url.pathname) ? url.href : null
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    // Installation succeeds even if secondary public pages cannot be reached.
    await cache.add('/offline.html')
    await Promise.allSettled(SAFE_PUBLIC_ROUTES.map(route => cache.add(route)))
  }))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('vibeschool-') && key !== CACHE_NAME).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') { self.skipWaiting(); return }
  if (event.data?.type !== OFFLINE_PREPARE && event.data?.type !== OFFLINE_PREPARE_BOOKS) return
  const port = event.ports && event.ports[0]
  if (!port) return
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
      let files = 0
      const preparingBooks = event.data.type === OFFLINE_PREPARE_BOOKS
      const routes = preparingBooks ? [OFFLINE_BOOK_ROUTE] : OFFLINE_GAME_ROUTES
      for (const route of routes) {
        const response = await fetch(route, { credentials: 'omit', redirect: 'error', cache: 'no-store' })
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Could not prepare '+route)
        const html = await response.clone().text()
        await cache.put(route, response)
        // Next.js production uses hashed JS/CSS files; prepare them with the
        // public HTML before the user switches off data. Never cache RSC/API.
        const assets = new Set()
        for (const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
          const asset = safeSameOrigin(match[1])
          if (asset) assets.add(asset)
        }
        for (const asset of assets) {
          const existing = await cache.match(asset)
          if (existing) continue
          const file = await fetch(asset, { credentials: 'omit', redirect: 'error' })
          if (!file.ok) throw new Error('Could not download app files')
          await cache.put(asset, file)
          files++
        }
      }
      port.postMessage({ type: preparingBooks ? 'OFFLINE_BOOK_READER_READY' : 'OFFLINE_GAMES_READY', routes: routes.length, files })
    } catch (error) {
      port.postMessage({ type: event.data.type === OFFLINE_PREPARE_BOOKS ? 'OFFLINE_BOOK_READER_ERROR' : 'OFFLINE_GAMES_ERROR', message: error instanceof Error ? error.message : 'Offline download failed' })
    }
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/auth/')) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/webpack-hmr')) return
  // No caching of Next.js RSC/prefetch payloads or any user-specific route.
  const navigation = request.mode === 'navigate'
  const safeNavigation = navigation && SAFE_PUBLIC_PATHS.has(url.pathname) && !url.search
  const asset = isPublicAsset(url.pathname) && !url.search
  if (!safeNavigation && !asset) {
    if (navigation) {
      event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error()))
    }
    return
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic'
        && (!safeNavigation || response.headers.get('content-type')?.includes('text/html'))) {
        // Only public pages and static assets are permitted in the shared cache.
        event.waitUntil(cache.put(safeNavigation ? url.pathname : request, response.clone()).catch(() => {}))
      }
      return response
    } catch {
      return (await cache.match(safeNavigation ? url.pathname : request))
        || (navigation ? (await cache.match('/offline.html')) : null)
        || new Response('', { status: 503, statusText: 'Offline' })
    }
  })())
})
