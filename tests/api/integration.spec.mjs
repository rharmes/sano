// DB-backed, full-request-cycle tests for api/. The endpoints use MySQL-specific SQL
// (FOR UPDATE, ON DUPLICATE KEY, INTERVAL, inet_pton/VARBINARY), so these need a real
// MySQL with tools/schema.sql loaded and a sano-config.php pointing at it. CI provides a
// mysql service and sets SANO_TEST_DB=1 (see .github/workflows/ci.yml); the suite is
// SKIPPED otherwise so the local run stays database-free.
//
// Each test gets its own isolated `request` fixture (own cookie jar), so registering in
// one test does not leak a session into another. Usernames are unique per test so reruns
// against a persistent DB don't collide.
import { test, expect } from '@playwright/test';

test.skip(!process.env.SANO_TEST_DB, 'set SANO_TEST_DB=1 with a MySQL service to run the api integration tests');

const CSRF = { 'X-Sano-Request': '1' };
let counter = 0;
const uniqueName = () => `u${Date.now().toString(36)}${counter++}`;
const register = (request, username, password = 'password123') => request.post('/api/register.php', { headers: CSRF, data: { username, password } });

// A well-formed Web Push subscription, as api/lib.php now requires (T42): the endpoint
// must be a real push service, p256dh an uncompressed P-256 point (65 bytes, leading
// 0x04) and auth 16 bytes, both base64url. Vary `fill` for a *different* device's keys.
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const pushKeys = (fill = 0x11) => ({ p256dh: b64url([4, ...Array(64).fill(fill)]), auth: b64url(Array(16).fill(fill)) });
const pushEndpoint = () => `https://web.push.apple.com/${uniqueName()}`;

test('register creates an account, auto-logs-in, and rejects a duplicate username', async ({ request }) => {
	const username = uniqueName();
	const res = await register(request, username);
	expect(res.status()).toBe(201);
	expect((await res.json()).ok).toBe(true);
	// Auto-login: the session cookie now authorizes a state fetch.
	expect((await request.get('/api/state.php')).status()).toBe(200);
	// Duplicate -> 409 username_taken.
	const dup = await register(request, username);
	expect(dup.status()).toBe(409);
	expect((await dup.json()).error).toBe('username_taken');
});

test('a logged-out state request is 401', async ({ request }) => {
	expect((await request.get('/api/state.php')).status()).toBe(401);
});

// T42. The endpoint is stored under UNIQUE(endpoint), so re-subscribing has to decide
// who owns the row. Re-attaching a device to a different account is legitimate (sign
// out, sign in as someone else on the same phone) — but the endpoint string alone must
// not be enough to do it, or anyone who reads one out of an ops log can move that
// device onto their own account. The device proves itself with the subscription keys.
test('a push subscription is refreshed by its own device but not stealable with the endpoint alone', async ({ request, playwright, baseURL }) => {
	const keys = pushKeys(0x11);
	const otherKeys = pushKeys(0x33); // a different device's subscription
	const endpoint = pushEndpoint();
	const subscribe = (ctx, data) => ctx.post('/api/push-subscribe.php', { headers: CSRF, data });

	await register(request, uniqueName());
	// A genuine subscription is accepted end to end — the allowlist doesn't break it.
	expect((await subscribe(request, { endpoint, keys })).status()).toBe(200);
	// The same device re-subscribing on the same account just refreshes the row.
	expect((await subscribe(request, { endpoint, keys })).status()).toBe(200);

	const other = await playwright.request.newContext({ baseURL });
	await register(other, uniqueName());

	// Knows the endpoint, not the keys: refused.
	const stolen = await subscribe(other, { endpoint, keys: otherKeys });
	expect(stolen.status()).toBe(403);
	expect((await stolen.json()).error).toBe('endpoint_taken');

	// Same physical device, now signed in as the second account: re-attaches.
	expect((await subscribe(other, { endpoint, keys })).status()).toBe(200);
	await other.dispose();
});

test('state sync increments revision and rejects a stale base revision (409 conflict)', async ({ request }) => {
	await register(request, uniqueName());
	const first = await (await request.get('/api/state.php')).json();
	expect(first.revision).toBe(0);
	expect(first.state).toBeNull();

	const put1 = await request.put('/api/state.php', { headers: CSRF, data: { state: { name: 'A', items: {} }, baseRevision: 0 } });
	expect(put1.status()).toBe(200);
	expect((await put1.json()).revision).toBe(1);

	// A second PUT from the same (now stale) base revision conflicts and returns the server copy.
	const conflict = await request.put('/api/state.php', { headers: CSRF, data: { state: { name: 'B', items: {} }, baseRevision: 0 } });
	expect(conflict.status()).toBe(409);
	const cbody = await conflict.json();
	expect(cbody.error).toBe('conflict');
	expect(cbody.revision).toBe(1);

	// `force` overrides the conflict and writes anyway.
	const forced = await request.put('/api/state.php', { headers: CSRF, data: { state: { name: 'B', items: {} }, baseRevision: 0, force: true } });
	expect(forced.status()).toBe(200);
	expect((await forced.json()).revision).toBe(2);
});

test('login rejects bad credentials and locks the account after repeated failures', async ({ request }) => {
	const username = uniqueName();
	await register(request, username, 'password123');
	const bad = await request.post('/api/login.php', { headers: CSRF, data: { username, password: 'wrongpass1' } });
	expect(bad.status()).toBe(401);
	expect((await bad.json()).error).toBe('bad_credentials');

	// LOCK_AFTER_FAILURES = 10: keep failing until the per-account lock engages (429 locked).
	let locked = false;
	for (let i = 0; i < 12 && !locked; i++) {
		const r = await request.post('/api/login.php', { headers: CSRF, data: { username, password: 'wrongpass1' } });
		locked = r.status() === 429 && (await r.json()).error === 'locked';
	}
	expect(locked).toBe(true);
});

test('the reminder schedule round-trips and validates its inputs', async ({ request }) => {
	await register(request, uniqueName());
	expect(await (await request.get('/api/reminder.php')).json()).toEqual({ hour: null, tz: null });

	const ok = await request.post('/api/reminder.php', { headers: CSRF, data: { hour: 8, tz: 'Asia/Kathmandu' } });
	expect(await ok.json()).toEqual({ ok: true, hour: 8, tz: 'Asia/Kathmandu' });
	expect(await (await request.get('/api/reminder.php')).json()).toEqual({ hour: 8, tz: 'Asia/Kathmandu' });

	expect((await request.post('/api/reminder.php', { headers: CSRF, data: { hour: 25, tz: 'Asia/Kathmandu' } })).status()).toBe(400);
	expect((await request.post('/api/reminder.php', { headers: CSRF, data: { hour: 8, tz: 'Nowhere/Nope' } })).status()).toBe(400);
});

test('push subscriptions can be stored and removed', async ({ request }) => {
	await register(request, uniqueName());
	const sub = { endpoint: pushEndpoint(), keys: pushKeys() };
	expect((await request.post('/api/push-subscribe.php', { headers: CSRF, data: sub })).status()).toBe(200);
	expect((await request.post('/api/push-unsubscribe.php', { headers: CSRF, data: { endpoint: sub.endpoint } })).status()).toBe(204); // 204 No Content
});

test('a non-admin is forbidden from the admin endpoints', async ({ request }) => {
	await register(request, uniqueName());
	const res = await request.get('/api/admin-users.php');
	expect(res.status()).toBe(403);
	expect((await res.json()).error).toBe('forbidden');
});

test('logout clears the session', async ({ request }) => {
	await register(request, uniqueName());
	expect((await request.get('/api/state.php')).status()).toBe(200); // logged in
	expect((await request.post('/api/logout.php', { headers: CSRF })).status()).toBe(204);
	expect((await request.get('/api/state.php')).status()).toBe(401); // and out again
});
