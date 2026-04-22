// AVA Service Worker — cache del shell para arranque offline
// Cachea recursos estáticos (HTML, libs CDN, manifest). Los endpoints
// /api/* siempre van a red (sin cache) porque son stateful.

const CACHE_NAME = 'ava-shell-v1';
const PRECACHE = [
  '/ava.html',
  '/manifest.webmanifest',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/postprocessing/EffectComposer.js',
  'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/postprocessing/RenderPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/postprocessing/ShaderPass.js',
  'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/postprocessing/UnrealBloomPass.js',
  'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@0.6.11/lib/three-vrm.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] precache miss:', url, err.message))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // /api/* → siempre red (no cachear respuestas dinámicas)
  if (url.pathname.startsWith('/api/')) return;

  // Navegación → intenta red primero, fallback cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/ava.html'))
    );
    return;
  }

  // Estáticos → cache-first con revalidación en background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchProm = fetch(event.request).then((res) => {
        if (res && res.status === 200 && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchProm;
    })
  );
});
