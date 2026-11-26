/*
 * Zotdor service worker (FR-20). Plain JavaScript, served from the site root so its scope is "/".
 *
 * - push: shows the notification the backend sent ({title, body, url, tag}), even when the
 *   site is closed; a click focuses an open tab (or opens one) at that page.
 * - fetch: page loads go to the network; only when it fails is the cached offline page shown.
 *   Nothing else is cached, so the site never serves stale data.
 */

const CACHE = 'zotdor-offline-v1';
const OFFLINE_URL = '/offline.html';
const ICON = '/icons/icon-192.png';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, ICON])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('zotdor-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Zotdor.uz';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: ICON,
      badge: ICON,
      tag: data.tag || undefined,
      lang: 'uz',
      data: { url: data.url || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
