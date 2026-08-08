const CACHE_NAME = 'vibeschool-public-v3'
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/legal/privacy',
  '/legal/terms',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ROUTES)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/_next/webpack-hmr')) return

  const isStaticAsset = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
  const isPublicNavigation = request.mode === 'navigate' && PUBLIC_ROUTES.includes(url.pathname)

  if (!isStaticAsset && !isPublicNavigation) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') return caches.match('/offline.html')
        return new Response('', { status: 408, statusText: 'Offline' })
      })
  )
})
