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

// The session cookie's attributes (T48) are asserted in tests/api/guards.spec.mjs, against
// logout.php — that path needs no database, so the check runs locally instead of only in
// this MySQL-gated file. What's left to prove here is that the cookie register.php issues
// actually authenticates, which the register and logout tests above and below already do.

// T47: the account lockout used to answer with its own `429 {error:"locked"}`, which only
// a username that exists could ever produce — a membership oracle. It has to still work,
// and still be invisible.
test('a locked account is indistinguishable from a wrong password or an unknown username', async ({ request }) => {
	const username = uniqueName();
	await register(request, username, 'password123');
	const wrong = { headers: CSRF, data: { username, password: 'wrongpass1' } };

	// LOCK_AFTER_FAILURES = 10. Every one of them — before the lock and after it — is the
	// same 401 with the same body: no 429, no retryAfter, nothing a probe can read.
	for (let i = 0; i < 10; i++) {
		const r = await request.post('/api/login.php', wrong);
		expect(r.status(), `attempt ${i + 1}`).toBe(401);
		expect(await r.json()).toEqual({ error: 'bad_credentials' });
	}

	// The lock did engage: the *correct* password is refused too. This is the assertion
	// that fails if hiding the lock quietly turned it off.
	const correct = await request.post('/api/login.php', { headers: CSRF, data: { username, password: 'password123' } });
	expect(correct.status()).toBe(401);

	// And it is the same answer a never-registered username gets.
	const ghost = await request.post('/api/login.php', { headers: CSRF, data: { username: uniqueName(), password: 'password123' } });
	expect(ghost.status()).toBe(correct.status());
	expect(await ghost.json()).toEqual(await correct.json());
});

// Runs only in the dedicated CI step that gives it a cleared login_attempts table and a
// small cap — the per-IP throttle is one bucket for the whole suite (every test reaches
// the API from 127.0.0.1), so a spec that deliberately exhausts it cannot share a run.
test('probing a locked account spends the prober’s rate-limit budget @ip-throttle', async ({ request }) => {
	test.skip(Number(process.env.SANO_LOGIN_IP_MAX) !== 14, 'needs the isolated SANO_LOGIN_IP_MAX=14 step');
	const username = uniqueName();
	await register(request, username, 'password123');
	const wrong = { headers: CSRF, data: { username, password: 'wrongpass1' } };

	// 10 failures lock the account; attempts 11–14 are locked-account probes. Those four
	// used to be free — the 429 "locked" returned above the attempt row — so the budget
	// would still read 10 here and a 15th request would be yet another "locked", forever.
	for (let i = 0; i < 14; i++) {
		const r = await request.post('/api/login.php', wrong);
		expect(r.status(), `attempt ${i + 1}`).toBe(401);
	}

	// Metered, the 15th is the per-IP throttle instead: the probing stopped being free.
	const throttled = await request.post('/api/login.php', wrong);
	expect(throttled.status()).toBe(429);
	expect(await throttled.json()).toEqual({ error: 'rate_limited', retryAfter: 900 });

	// The throttle is per-IP, not per-account: an unrelated username is refused as well.
	expect((await request.post('/api/login.php', { headers: CSRF, data: { username: uniqueName(), password: 'password123' } })).status()).toBe(429);
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

// The admin read paths had no coverage beyond their 403 (T54). That mattered once
// declare(strict_types=1) and PDO::ATTR_EMULATE_PREPARES => false landed: both change the
// PHP type of every value coming back from MySQL, which is exactly how a working
// aggregate query becomes a TypeError in production and nowhere else. Runs in its own CI
// step, against the account and traffic rows tests/fixtures/seed-admin.php creates.
test('an admin can read the user list and the traffic dashboard @admin', async ({ request }) => {
	test.skip(process.env.SANO_ADMIN_SEED !== '1', 'needs the seeded admin account (CI step)');
	const login = await request.post('/api/login.php', { headers: CSRF, data: { username: 'adminci', password: 'password123' } });
	expect(login.status()).toBe(200);
	expect((await login.json()).isAdmin).toBe(true);

	const users = await request.get('/api/admin-users.php');
	expect(users.status()).toBe(200);
	const list = await users.json();
	expect(list.me).toBe('adminci');
	const self = list.users.find((u) => u.username === 'adminci');
	// state_summary() over a real blob: the streak, and the graduated ids the dashboard
	// intersects against COURSE to derive a path position.
	expect(self.streak).toBe(7);
	expect(self.graduated).toEqual(expect.arrayContaining(['greet-namaste', 'greet-dhanyabaad']));

	// The populated branch of the traffic tab — every total here is a SUM/COUNT cast to
	// int, so a typing change shows up as a wrong number or a 500, not a silent pass.
	const traffic = await request.get('/api/admin-traffic.php?range=7');
	expect(traffic.status()).toBe(200);
	const t = await traffic.json();
	expect(t.hasData).toBe(true);
	expect(t.totals.requests).toBe(240); // 120 requests × 2 seeded days
	expect(t.totals.botRequests).toBe(90);
	expect(t.totals.visitors).toBe(2); // "mine" is excluded by default
	expect(t.days.length).toBeGreaterThan(0);
	expect(t.errors.some((e) => e.path === '/audio/words/gone.mp3')).toBe(true);

	// mine=1 includes the visitor whose session touched /admin/.
	const withMine = await (await request.get('/api/admin-traffic.php?range=7&mine=1')).json();
	expect(withMine.totals.visitors).toBe(4);

	// And the guard still holds: a bad window is rejected before any of this.
	expect((await request.get('/api/admin-traffic.php?range=13')).status()).toBe(400);
});
