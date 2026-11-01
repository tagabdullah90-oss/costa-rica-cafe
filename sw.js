/* Costa Rica Cafe — Service Worker (عمل أوفلاين + سرعة) */
const CACHE = 'costa-rica-v1';

const CORE = [
  './',
  'index.html',
  'admin.html',
  'manifest.json',
  'assets/css/site.css',
  'assets/css/admin.css',
  'assets/js/shared.js',
  'assets/js/site.js',
  'assets/js/admin.js',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // بيانات المنيو: نجيب الأحدث من الشبكة، ولو مفيش نت نستخدم آخر نسخة محفوظة
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // الصفحات: الأحدث من الشبكة، ولو أوفلاين نرجّع المحفوظ
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((hit) => hit || caches.match('index.html'))
      )
    );
    return;
  }

  // الملفات الثابتة: من الكاش فوراً + تحديث في الخلفية
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);

      return hit || network;
    })
  );
});
