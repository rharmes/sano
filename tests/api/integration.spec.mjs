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
	const sub = { endpoint: `https://push.example/${uniqueName()}`, keys: { p256dh: 'a'.repeat(80), auth: 'b'.repeat(20) } };
	expect((await request.post('/api/push-subscribe.php', { headers: CSRF, data: sub })).status()).toBe(200);
	expect((await request.post('/api/push-unsubscribe.php', { headers: CSRF, data: { endpoint: sub.endpoint } })).status()).toBe(200);
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
