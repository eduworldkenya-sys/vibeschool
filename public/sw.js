const CACHE_NAME = 'vibeschool-v1'

const STATIC_ROUTES = [
  '/',
  '/select',
  '/academy/signin',
  '/academy/signup',
  '/global/signin',
  '/global/signup',
  '/offline',
]

// Install — cache all static routes and offline fallback
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ROUTES)
    })
  )
  self.skipWaiting()
})

// Activate — delete old caches
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

// Fetch — network first, fall back to cache, fall back to /offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return

  // Skip Next.js internals and HMR
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for Next.js static assets
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
        // Network failed — serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // Nothing in cache — serve offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline')
          }
          return new Response('', { status: 408 })
        })
      })
  )
})