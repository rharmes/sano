// Pre-DB guard checks for the api/ endpoints. Run against `php -S` with NO sano-config.php
// on disk, so any code path that reaches db() 500s — we therefore assert ONLY the guards
// that return before the first DB call. Every endpoint follows one canonical order (see
// api/lib.php): method → CSRF header → JSON parse → stateless field validation → auth →
// DB work. Because validation precedes auth — and session_user() returns null (→ 401)
// without a cookie before any db() call — the whole method/CSRF/JSON/field surface is
// reachable here with no database, and a well-formed-but-unauthenticated request likewise
// stops at a db-free 401. Behavior that needs a row (revision conflicts, account lockout,
// no_such_user, the admin/forbidden check) lives in the DB-backed integration specs, gated
// on SANO_TEST_DB.
//
// Each assertion deliberately uses inputs that stop at a guard, so the request never
// reaches db().
import { test, expect } from '@playwright/test';

const CSRF = { 'X-Sano-Request': '1' };
const read = async (res) => ({ status: res.status(), body: await res.json().catch(() => null) });

test.describe('register.php', () => {
	test('GET → 405 method', async ({ request }) => {
		expect(await read(await request.get('/api/register.php'))).toEqual({ status: 405, body: { error: 'method' } });
	});
	test('POST without the CSRF header → 403 csrf', async ({ request }) => {
		const r = await read(await request.post('/api/register.php', { data: { username: 'someone', password: 'longenough' } }));
		expect(r).toEqual({ status: 403, body: { error: 'csrf' } });
	});
	test('non-JSON body → 400 bad_json', async ({ request }) => {
		expect(await read(await request.post('/api/register.php', { headers: CSRF, data: 'not json' }))).toEqual({
			status: 400,
			body: { error: 'bad_json' },
		});
	});
	test('invalid username → 400 bad_username', async ({ request }) => {
		const r = await read(await request.post('/api/register.php', { headers: CSRF, data: { username: 'ab', password: 'longenough' } }));
		expect(r).toEqual({ status: 400, body: { error: 'bad_username' } });
	});
	test('too-short password → 400 bad_password', async ({ request }) => {
		const r = await read(await request.post('/api/register.php', { headers: CSRF, data: { username: 'gooduser', password: 'short' } }));
		expect(r).toEqual({ status: 400, body: { error: 'bad_password' } });
	});
});

// T44. The body used to be pulled into memory in full before any size check, and
// post_max_size doesn't bound a php://input read — so an unauthenticated request
// could reach a memory-exhaustion fatal (which set_exception_handler cannot catch)
// before a single guard ran. Every endpoint but state.php now caps at
// MAX_BODY_BYTES, well above anything legitimate and far below anything harmful.
test.describe('request bodies are bounded before they are parsed', () => {
	const oversize = 'x'.repeat(20_000); // > MAX_BODY_BYTES (16 KiB)

	for (const path of ['/api/login.php', '/api/register.php', '/api/reminder.php', '/api/push-subscribe.php', '/api/admin-reset-password.php']) {
		test(`${path} rejects an oversized body → 413 too_large`, async ({ request }) => {
			const r = await request.post(path, { headers: { ...CSRF, 'Content-Type': 'application/json' }, data: `{"username":"${oversize}"}` });
			expect(await read(r)).toEqual({ status: 413, body: { error: 'too_large' } });
		});
	}

	test('a body just under the cap is still parsed normally', async ({ request }) => {
		// 15 KiB of padding: over the cap this would 413, under it the request must
		// reach ordinary field validation instead. Guards the cap against being set
		// so low that real requests break.
		const data = `{"username":"gooduser","password":"longenough","pad":"${'x'.repeat(15_000)}"}`;
		const r = await request.post('/api/register.php', { headers: { ...CSRF, 'Content-Type': 'application/json' }, data });
		expect(r.status()).not.toBe(413);
	});

	test('state.php allows a much larger body but still bounds it → 413', async ({ request }) => {
		const r = await request.put('/api/state.php', {
			headers: { ...CSRF, 'Content-Type': 'application/json' },
			data: `{"state":{"blob":"${'a'.repeat(1_200_000)}"},"baseRevision":0}`,
		});
		expect(await read(r)).toEqual({ status: 413, body: { error: 'state_too_large' } });
	});
});

test.describe('login.php', () => {
	test('GET → 405', async ({ request }) => {
		expect((await request.get('/api/login.php')).status()).toBe(405);
	});
	test('POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/login.php', { data: {} })).status()).toBe(403);
	});
	test('non-JSON body → 400 bad_json', async ({ request }) => {
		expect(await read(await request.post('/api/login.php', { headers: CSRF, data: 'xxx' }))).toEqual({ status: 400, body: { error: 'bad_json' } });
	});
	test('missing fields → 400 missing_fields', async ({ request }) => {
		expect(await read(await request.post('/api/login.php', { headers: CSRF, data: {} }))).toEqual({
			status: 400,
			body: { error: 'missing_fields' },
		});
	});
});

test.describe('logout.php', () => {
	test('GET → 405', async ({ request }) => {
		expect((await request.get('/api/logout.php')).status()).toBe(405);
	});
	test('POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/logout.php')).status()).toBe(403);
	});
});

test.describe('state.php', () => {
	test('a non-GET/PUT method → 405', async ({ request }) => {
		expect((await request.post('/api/state.php', { headers: CSRF, data: {} })).status()).toBe(405);
	});
	test('PUT without CSRF → 403 csrf', async ({ request }) => {
		expect(await read(await request.put('/api/state.php', { data: {} }))).toEqual({ status: 403, body: { error: 'csrf' } });
	});
	test('PUT with a non-JSON body → 400 bad_json', async ({ request }) => {
		expect(await read(await request.put('/api/state.php', { headers: CSRF, data: 'not json' }))).toEqual({
			status: 400,
			body: { error: 'bad_json' },
		});
	});
	test('PUT with no state object → 400 missing_state', async ({ request }) => {
		expect(await read(await request.put('/api/state.php', { headers: CSRF, data: {} }))).toEqual({
			status: 400,
			body: { error: 'missing_state' },
		});
	});
	test('PUT with a non-object state → 400 missing_state', async ({ request }) => {
		expect(await read(await request.put('/api/state.php', { headers: CSRF, data: { state: 'nope' } }))).toEqual({
			status: 400,
			body: { error: 'missing_state' },
		});
	});
	// T43. json_decode turns the JSON literal 1e999 into INF, which json_encode
	// cannot represent and returns false for. Without state.php's own strict_types
	// that false measured as strlen 0, slipped past the size cap, and was stored as
	// the empty string — a row that then made the reminder cron's JSON_EXTRACT abort
	// for every user. Sent as a raw string because JSON.stringify would turn
	// Infinity into null and never reproduce it.
	test('PUT with a state that cannot be re-encoded → 400 bad_state', async ({ request }) => {
		const r = await request.put('/api/state.php', {
			headers: { ...CSRF, 'Content-Type': 'application/json' },
			data: '{"state":{"x":1e999},"baseRevision":0}',
		});
		expect(await read(r)).toEqual({ status: 400, body: { error: 'bad_state' } });
	});

	test('PUT over the size cap → 413 state_too_large', async ({ request }) => {
		const huge = { state: { blob: 'a'.repeat(1_100_000) }, baseRevision: 0 }; // state JSON > MAX_STATE_BYTES (1 MiB)
		expect((await request.put('/api/state.php', { headers: CSRF, data: huge })).status()).toBe(413);
	});
	test('a well-formed PUT still needs auth → 401 (validation precedes auth)', async ({ request }) => {
		const r = await request.put('/api/state.php', { headers: CSRF, data: { state: { items: {} }, baseRevision: 0 } });
		expect(await read(r)).toEqual({ status: 401, body: { error: 'auth' } });
	});
});

test.describe('reminder.php', () => {
	test('a non-GET/POST method → 405', async ({ request }) => {
		expect((await request.put('/api/reminder.php', { headers: CSRF, data: {} })).status()).toBe(405);
	});
	test('POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/reminder.php', { data: {} })).status()).toBe(403);
	});
	test('POST with a non-JSON body → 400 bad_json', async ({ request }) => {
		expect(await read(await request.post('/api/reminder.php', { headers: CSRF, data: 'xxx' }))).toEqual({
			status: 400,
			body: { error: 'bad_json' },
		});
	});
	test('POST an out-of-range hour → 400 bad_hour', async ({ request }) => {
		const r = await request.post('/api/reminder.php', { headers: CSRF, data: { hour: 25, tz: 'Asia/Kathmandu' } });
		expect(await read(r)).toEqual({ status: 400, body: { error: 'bad_hour' } });
	});
	test('POST an unknown tz → 400 bad_tz', async ({ request }) => {
		const r = await request.post('/api/reminder.php', { headers: CSRF, data: { hour: 8, tz: 'Nowhere/Nope' } });
		expect(await read(r)).toEqual({ status: 400, body: { error: 'bad_tz' } });
	});
});

test.describe('push endpoints', () => {
	test('subscribe GET → 405', async ({ request }) => {
		expect((await request.get('/api/push-subscribe.php')).status()).toBe(405);
	});
	test('subscribe POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/push-subscribe.php', { data: {} })).status()).toBe(403);
	});
	test('unsubscribe GET → 405', async ({ request }) => {
		expect((await request.get('/api/push-unsubscribe.php')).status()).toBe(405);
	});
	test('unsubscribe POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/push-unsubscribe.php', { data: {} })).status()).toBe(403);
	});
	test('subscribe POST with no fields → 400 missing_fields', async ({ request }) => {
		expect(await read(await request.post('/api/push-subscribe.php', { headers: CSRF, data: {} }))).toEqual({
			status: 400,
			body: { error: 'missing_fields' },
		});
	});
	test('subscribe POST with an over-long endpoint → 400 endpoint_too_long', async ({ request }) => {
		const data = { endpoint: 'https://push.example/' + 'x'.repeat(500), keys: { p256dh: 'p', auth: 'a' } };
		expect(await read(await request.post('/api/push-subscribe.php', { headers: CSRF, data }))).toEqual({
			status: 400,
			body: { error: 'endpoint_too_long' },
		});
	});
	test('unsubscribe POST with no endpoint → 400 missing_endpoint', async ({ request }) => {
		expect(await read(await request.post('/api/push-unsubscribe.php', { headers: CSRF, data: {} }))).toEqual({
			status: 400,
			body: { error: 'missing_endpoint' },
		});
	});

	// T42 — the endpoint is a URL the hourly cron POSTs to, so it is validated against
	// an allowlist of the real push services before anything is stored. These run
	// before auth, so they are reachable here with no database.
	const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
	const KEYS = { p256dh: b64url([4, ...Array(64).fill(0x11)]), auth: b64url(Array(16).fill(0x22)) };
	const APPLE = 'https://web.push.apple.com/QSAgent-test';

	for (const [label, endpoint] of [
		['loopback', 'https://127.0.0.1/x'],
		['cloud metadata', 'https://169.254.169.254/latest/meta-data/'],
		['plaintext http', 'http://web.push.apple.com/x'],
		['a lookalike host', 'https://web.push.apple.com.evil.test/x'],
		['userinfo before a real host', 'https://web.push.apple.com@evil.test/x'],
	]) {
		test(`subscribe POST with ${label} → 400 bad_endpoint`, async ({ request }) => {
			const r = await read(await request.post('/api/push-subscribe.php', { headers: CSRF, data: { endpoint, keys: KEYS } }));
			expect(r).toEqual({ status: 400, body: { error: 'bad_endpoint' } });
		});
	}

	test('subscribe POST with a real endpoint but malformed keys → 400 bad_keys', async ({ request }) => {
		const data = { endpoint: APPLE, keys: { p256dh: 'AAAA', auth: 'BBBB' } };
		expect(await read(await request.post('/api/push-subscribe.php', { headers: CSRF, data }))).toEqual({
			status: 400,
			body: { error: 'bad_keys' },
		});
	});

	// The mirror image of the rejections above: a genuine subscription must sail
	// through validation and stop only at auth. Guards the allowlist against being
	// tightened into something that silently breaks real devices.
	test('subscribe POST with a valid Apple subscription → 401 auth (not rejected by validation)', async ({ request }) => {
		const r = await read(await request.post('/api/push-subscribe.php', { headers: CSRF, data: { endpoint: APPLE, keys: KEYS } }));
		expect(r).toEqual({ status: 401, body: { error: 'auth' } });
	});
});

test.describe('admin endpoints run method, CSRF, and field validation before the admin check', () => {
	test('admin-users POST → 405 (GET-only)', async ({ request }) => {
		expect((await request.post('/api/admin-users.php', { headers: CSRF, data: {} })).status()).toBe(405);
	});
	test('admin-reset-password GET → 405', async ({ request }) => {
		expect((await request.get('/api/admin-reset-password.php')).status()).toBe(405);
	});
	test('admin-reset-password POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/admin-reset-password.php', { data: {} })).status()).toBe(403);
	});
	test('admin-reset-password POST with no username → 400 missing_fields', async ({ request }) => {
		expect(await read(await request.post('/api/admin-reset-password.php', { headers: CSRF, data: {} }))).toEqual({
			status: 400,
			body: { error: 'missing_fields' },
		});
	});
	test('admin-reset-password POST with a too-short password → 400 bad_password', async ({ request }) => {
		const r = await request.post('/api/admin-reset-password.php', { headers: CSRF, data: { username: 'someone', password: 'short' } });
		expect(await read(r)).toEqual({ status: 400, body: { error: 'bad_password' } });
	});
	test('admin-delete-user GET → 405', async ({ request }) => {
		expect((await request.get('/api/admin-delete-user.php')).status()).toBe(405);
	});
	test('admin-delete-user POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/admin-delete-user.php', { data: {} })).status()).toBe(403);
	});
	test('admin-delete-user POST with no username → 400 missing_fields', async ({ request }) => {
		expect(await read(await request.post('/api/admin-delete-user.php', { headers: CSRF, data: {} }))).toEqual({
			status: 400,
			body: { error: 'missing_fields' },
		});
	});
	test('admin-traffic POST → 405 (GET-only)', async ({ request }) => {
		expect((await request.post('/api/admin-traffic.php', { headers: CSRF, data: {} })).status()).toBe(405);
	});
	test('admin-traffic with an unknown range → 400 range, before any auth or DB work', async ({ request }) => {
		expect(await read(await request.get('/api/admin-traffic.php?range=everything'))).toEqual({ status: 400, body: { error: 'range' } });
	});
	test('admin-traffic with a valid range but no session → 401 auth', async ({ request }) => {
		expect(await read(await request.get('/api/admin-traffic.php?range=30'))).toEqual({ status: 401, body: { error: 'auth' } });
	});
});
