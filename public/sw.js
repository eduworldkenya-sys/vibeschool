const CACHE_NAME = 'vibeschool-v4'

// Keep private and authenticated application data out of the cache. The PWA
// only stores the offline fallback plus immutable/static presentation assets.
const STATIC_ROUTES = ['/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ROUTES)))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  const url = new URL(event.request.url)

  // Never intercept auth, API, Supabase-style server traffic or development HMR.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/_next/webpack-hmr')
  ) return

  const safeStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/offline.html'

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok && safeStaticAsset) {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        }
        return networkResponse
      })
      .catch(async () => {
        if (safeStaticAsset) {
          const cached = await caches.match(event.request)
          if (cached) return cached
        }
        if (event.request.mode === 'navigate') {
          return (await caches.match('/offline.html')) || new Response('Offline', { status: 503 })
        }
        return new Response('', { status: 408 })
      })
  )
})
