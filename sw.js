// Service worker for the Sano PWA.
//   - Caches the app shell at runtime as it's fetched (HTML network-first, the
//     content-stamped assets cache-first), so a returning visit works offline.
//     There's no install-time precache: the ?v= asset URLs aren't known here, and
//     a returning visit has already populated the cache.
//   - Lets /api/* pass through to the network untouched.
//   - Handles `push` and `notificationclick` for daily reminders.
//
// Bump VERSION when the cache strategy changes so existing clients drop their old cache.

const VERSION = 'sano-v2';

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return;
	if (url.pathname.startsWith('/api/')) return;

	event.respondWith(handleFetch(req, url));
});

async function handleFetch(req, url) {
	const cache = await caches.open(VERSION);

	// HTML / navigations: network-first so new ?v= stamps land immediately; cache as fallback.
	const isHtml = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
	if (isHtml) {
		try {
			const res = await fetch(req);
			if (res.ok) cache.put(req, res.clone());
			return res;
		} catch (err) {
			return (await cache.match(req)) || (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
		}
	}

	// Static assets: cache-first. URLs are content-stamped (?v=hash) so a content change is a new URL.
	const cached = await cache.match(req);
	if (cached) return cached;
	try {
		const res = await fetch(req);
		if (res.ok && res.type === 'basic') cache.put(req, res.clone());
		return res;
	} catch (err) {
		return Response.error();
	}
}

// --- Push notifications (server sends from tools/send-reminders.php in phase 3) ---

self.addEventListener('push', (event) => {
	let payload = { title: 'Sano', body: 'Time for today’s lesson.', url: '/' };
	try {
		if (event.data) payload = { ...payload, ...event.data.json() };
	} catch (_) {
		if (event.data) payload.body = event.data.text();
	}
	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			data: { url: payload.url },
		}),
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = (event.notification.data && event.notification.data.url) || '/';
	event.waitUntil(
		(async () => {
			const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const c of clients) {
				if (new URL(c.url).origin === location.origin) {
					await c.focus();
					if ('navigate' in c) await c.navigate(target);
					return;
				}
			}
			await self.clients.openWindow(target);
		})(),
	);
});
