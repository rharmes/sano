// Pre-DB guard checks for the api/ endpoints. Run against `php -S` with NO sano-config.php
// on disk, so any code path that reaches db() 500s — we therefore assert ONLY the guards
// that return before the first DB call: HTTP method, the CSRF header, JSON parsing, and
// field/format validation. Full request-cycle behavior (auth, revision conflicts, account
// lockout, admin) lives in the DB-backed integration specs, gated on SANO_TEST_DB.
//
// Each assertion deliberately uses inputs that fail at a guard, so the request never
// reaches db(). The guard order per endpoint was read straight from api/*.php.
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
});

test.describe('reminder.php', () => {
	test('a non-GET/POST method → 405', async ({ request }) => {
		expect((await request.put('/api/reminder.php', { headers: CSRF, data: {} })).status()).toBe(405);
	});
	test('POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/reminder.php', { data: {} })).status()).toBe(403);
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
});

test.describe('admin endpoints enforce method + CSRF before the admin check', () => {
	test('admin-users POST → 405 (GET-only)', async ({ request }) => {
		expect((await request.post('/api/admin-users.php', { headers: CSRF, data: {} })).status()).toBe(405);
	});
	test('admin-reset-password GET → 405', async ({ request }) => {
		expect((await request.get('/api/admin-reset-password.php')).status()).toBe(405);
	});
	test('admin-reset-password POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/admin-reset-password.php', { data: {} })).status()).toBe(403);
	});
	test('admin-delete-user GET → 405', async ({ request }) => {
		expect((await request.get('/api/admin-delete-user.php')).status()).toBe(405);
	});
	test('admin-delete-user POST without CSRF → 403', async ({ request }) => {
		expect((await request.post('/api/admin-delete-user.php', { data: {} })).status()).toBe(403);
	});
});
