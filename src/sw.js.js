
const CACHE_NAME = 'serqi-v4-speed';
const EXTERNAL_SCRIPTS = [
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/lucide-react@0.454.0',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html', '/manifest.json', ...EXTERNAL_SCRIPTS]);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Ensure that the service worker controls the page immediately.
  event.waitUntil(clients.claim());
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Cache First for libraries & fonts
  if (url.includes('esm.sh') || url.includes('fonts.googleapis') || url.includes('tailwindcss')) {
    event.respondWith(
      caches.match(event.request).then((res) => {
        return res || fetch(event.request).then((networkRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkRes.clone());
            return networkRes;
          });
        });
      })
    );
  } else {
    // Network First for app data and main index
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

// Handle messages to force skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
