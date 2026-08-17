const CACHE_NAME = 'vibeschool-v7'

// Only cache surfaces that are safe for every visitor. Authenticated pages,
// APIs, Pathways data responses and private Supabase traffic remain network-owned.
const SAFE_PUBLIC_ROUTES = ['/offline.html','/','/about','/contact','/careers','/institutions','/trust','/legal']
const SAFE_PUBLIC_PATHS = new Set(SAFE_PUBLIC_ROUTES.filter((route) => route !== '/offline.html'))

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.add('/offline.html')
      await Promise.allSettled(SAFE_PUBLIC_ROUTES.filter((route) => route !== '/offline.html').map((route) => cache.add(route)))
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/_next/webpack-hmr')) return

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok && (
          url.pathname.startsWith('/_next/static/') ||
          url.pathname.startsWith('/icons/') ||
          url.pathname.startsWith('/pwa-icons/') ||
          (event.request.mode === 'navigate' && SAFE_PUBLIC_PATHS.has(url.pathname))
        )) {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        }
        return networkResponse
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached
        if (event.request.mode === 'navigate') {
          if (SAFE_PUBLIC_PATHS.has(url.pathname)) return caches.match(url.pathname).then((safe) => safe || caches.match('/offline.html'))
          return caches.match('/offline.html')
        }
        return new Response('', { status: 408 })
      }))
  )
})
