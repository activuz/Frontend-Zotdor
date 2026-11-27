/*
 * Zotdor service worker (FR-20). Plain JavaScript, served from the site root so its scope is "/".
 *
 * - push: shows the notification the backend sent ({title, body, url, tag}), even when the
 *   site is closed; a click focuses an open tab (or opens one) at that page.
 * - fetch: the app shell opens from the device (docs/ARCHITECTURE.md, "Kesh"):
 *   - page loads get the cached index.html at once while a fresh copy is fetched for next time;
 *   - /assets/* (hashed, immutable) come from the cache after the first download;
 *   - the logo, icons and manifest are cached at install and refreshed in the background;
 *   - Google Fonts and Nhost images (a file id never changes) come from the cache once seen;
 *   - nothing else is touched: API answers and videos always go to the network.
 *   With no cached shell and no network the browser gets offline.html; in the Android app
 *   (registered as sw.js?app=1) the failure is passed on so the app shows its own offline screen.
 */

const VERSION = 'v3';
const SHELL_CACHE = `zotdor-shell-${VERSION}`;
const ASSET_CACHE = `zotdor-assets-${VERSION}`;
const STATIC_CACHE = `zotdor-static-${VERSION}`;
// Not versioned: what they hold never changes at the same URL.
const FONT_CACHE = 'zotdor-fonts-v1';
const MEDIA_CACHE = 'zotdor-media-v1';
const KEEP = [SHELL_CACHE, ASSET_CACHE, STATIC_CACHE, FONT_CACHE, MEDIA_CACHE];
const SHELL_URL = '/index.html';
const OFFLINE_URL = '/offline.html';
const ICON = '/icons/icon-192.png';
const MAX_ASSETS = 80;
const MAX_MEDIA = 300;
const MAX_FONTS = 30;
/** Same-origin files the shell shows (Header logo, icons); public/ has no hashed names. */
const STATIC_FILES = ['/favicon.webp', '/manifest.webmanifest', '/icons/apple-touch-icon.png', ICON];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const IN_APP = new URL(self.location.href).searchParams.get('app') === '1';

/** Paths that are not the SPA even when opened as a page (vercel.json rewrites). */
const NOT_SHELL = /^\/(api|media|assets|\.well-known)\/|^\/(robots\.txt|sitemap\.xml|sw\.js|offline\.html)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_FILES)),
    ]),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('zotdor-') && !KEEP.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Fetch index.html and keep it only if it is a real page (not an error or a redirect), and only
 * after the scripts and styles it names are cached too: a stored shell must be able to start
 * on its own, even after a later deploy has removed those files from the server.
 */
async function refreshShell() {
  const response = await fetch(SHELL_URL, { cache: 'no-cache' });
  const html = (response.headers.get('content-type') || '').includes('text/html');
  if (!response.ok || response.type !== 'basic' || !html) return response;
  const text = await response.clone().text();
  const assets = [...new Set([...text.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
  const assetCache = await caches.open(ASSET_CACHE);
  const missing = [];
  for (const path of assets) if (!(await assetCache.match(path))) missing.push(path);
  await assetCache.addAll(missing);
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(SHELL_URL, response.clone());
  return response;
}

async function servePage(event) {
  const cached = await caches.match(SHELL_URL);
  const fresh = refreshShell();
  if (cached) {
    event.waitUntil(fresh.catch(() => undefined));
    return cached;
  }
  try {
    return await fresh;
  } catch (error) {
    if (IN_APP) return Response.error();
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function trim(cache, max) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

/** Logo and icons: from the cache at once, refreshed in the background for next time. */
async function serveStatic(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request, { ignoreSearch: true });
  const fresh = fetch(event.request).then(async (response) => {
    if (response.ok && response.type === 'basic') await cache.put(event.request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(fresh.catch(() => undefined));
    return cached;
  }
  return fresh;
}

/**
 * Fonts and Nhost images never change at the same URL, so once seen they come from the cache.
 * Asked for with CORS so the cached copy is a normal response; a host without CORS headers
 * gets the browser's own request and is not cached (an opaque copy would eat storage quota).
 */
async function serveImmutable(event, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request.url);
  if (cached) return cached;
  let response;
  try {
    response = await fetch(event.request.url, { mode: 'cors', credentials: 'omit' });
  } catch (error) {
    return fetch(event.request);
  }
  if (response.ok) {
    event.waitUntil(
      cache
        .put(event.request.url, response.clone())
        .then(() => trim(cache, max))
        .catch(() => undefined),
    );
  }
  return response;
}

async function serveAsset(event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok && response.type === 'basic') {
    await cache.put(event.request, response.clone());
    event.waitUntil(trim(cache, MAX_ASSETS));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.includes(url.hostname)) {
      event.respondWith(serveImmutable(event, FONT_CACHE, MAX_FONTS));
    } else if (
      request.destination === 'image' &&
      url.hostname.endsWith('.nhost.run') &&
      url.pathname.startsWith('/v1/files/')
    ) {
      event.respondWith(serveImmutable(event, MEDIA_CACHE, MAX_MEDIA));
    }
    return;
  }
  if (STATIC_FILES.includes(url.pathname)) {
    event.respondWith(serveStatic(event));
    return;
  }
  if (request.mode === 'navigate') {
    if (NOT_SHELL.test(url.pathname)) return;
    event.respondWith(servePage(event));
    return;
  }
  if (url.pathname.startsWith('/assets/')) event.respondWith(serveAsset(event));
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
