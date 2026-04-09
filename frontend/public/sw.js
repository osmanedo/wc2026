const CACHE = 'wc2026-shell-v2'

// Static assets that are safe to cache long-term:
// icons and the logo never change (no hashes, but also rarely updated)
const PRECACHE = [
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/fifa-world-cup-2026-logo.png',
  '/manifest.json',
]

// Install: pre-cache static assets only (NOT index.html)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

// Activate: remove stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy:
//   - Navigation (HTML pages) → network-first, fall back to cache
//     This ensures users always get the latest index.html on deploy
//   - Vite hashed assets (/assets/*.js, /assets/*.css) → cache-first
//     These filenames change on every deploy so cached copies are always valid
//   - Supabase / external APIs → network only, never cache
//   - Everything else (icons, images) → cache-first
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip cross-origin API and font requests entirely
  if (url.hostname.includes('supabase.co')) return
  if (url.hostname.includes('fonts.googleapis.com')) return
  if (url.hostname.includes('fonts.gstatic.com')) return

  // Navigation requests (HTML) → network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/'))
      )
    )
    return
  }

  // Vite hashed assets → cache-first (immutable, filename changes on rebuild)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Everything else (icons, images, manifest) → cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
