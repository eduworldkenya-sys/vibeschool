const CACHE_NAME = 'vibeschool-v5'

// Only precache a route that is guaranteed to exist and is safe for every
// anonymous/authenticated user. Private Supabase/app data must never enter
// this shared browser cache.
const STATIC_ROUTES = ['/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ROUTES)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  const url = new URL(event.request.url)

  // Auth, APIs and user-specific server traffic are always network-owned.
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/auth/')) return
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse.ok &&
          (url.pathname.startsWith('/_next/static/') ||
            url.pathname.startsWith('/icons/') ||
            url.pathname.startsWith('/pwa-icons/'))
        ) {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        }
        return networkResponse
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached
          if (event.request.mode === 'navigate') return caches.match('/offline.html')
          return new Response('', { status: 408 })
        })
      )
  )
})
