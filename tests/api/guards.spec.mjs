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
});
