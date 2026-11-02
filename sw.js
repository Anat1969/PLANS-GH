/* תוכניות בינוי · אשדוד — service worker: הדף מהרשת, נכסים מהמטמון */
const CACHE = 'plans-v1';
const ASSETS = ['icon.svg', 'icon-192.png', 'icon-512.png', 'plans-geo.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate' || /\.(html|js|json)$/.test(new URL(r.url).pathname)) {
    // דף ונתונים: קודם רשת (תמיד עדכני), מטמון רק כשאין רשת
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r)));
  } else {
    e.respondWith(caches.match(r).then(m => m || fetch(r)));
  }
});
