const CACHE_NAME = 'vibeschool-v3'

// Only precache a route that is guaranteed to exist and is needed for
// offline navigation. Do not precache historical/auth routes: requesting
// removed routes during service-worker installation creates misleading 404s.
const STATIC_ROUTES = [
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ROUTES))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse.ok &&
          (url.pathname.startsWith('/_next/static/') ||
            url.pathname.startsWith('/icons/'))
        ) {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return networkResponse
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html')
          }
          return new Response('', { status: 408 })
        })
      })
  )
})
