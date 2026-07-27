// Traffic log parsing (T40) — tools/ingest-traffic.php turns raw Apache lines into the
// aggregates /admin/#traffic shows, and every headline number depends on judgement calls
// (what's a bot, where a session breaks, who counts as Ross) that are invisible once
// they're rows in MySQL. The script's --json mode is exactly that parse with no DB and no
// sano-config.php, so it's testable here: feed it a fixture log plus a fixture geo index
// and assert the whole shape.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const SCRIPT = join(ROOT, 'tools/ingest-traffic.php');
const LOG = join(ROOT, 'tests/fixtures/traffic-access.log');
const geoDir = mkdtempSync(join(tmpdir(), 'sano-geo-'));

const php = (...args) => execFileSync('php', [SCRIPT, ...args], { encoding: 'utf8' });

let days;

before(() => {
	// Compile the two fixture CSVs into the same binary index the server builds from
	// the real CC0 data: TEST-NET-1 -> NP, TEST-NET-2 -> US, TEST-NET-3 -> GB, and the
	// IPv6 documentation range -> IN.
	php('--update-geo', '--from', join(ROOT, 'tests/fixtures/geo-ipv4-num.csv'), '--geo-dir', geoDir);
	php('--update-geo', '--from', join(ROOT, 'tests/fixtures/geo-ipv6.csv'), '--geo-dir', geoDir);
	days = JSON.parse(php('--file', LOG, '--json', '--geo-dir', geoDir)).days;
	process.on('exit', () => rmSync(geoDir, { recursive: true, force: true }));
});

const visitorsOf = (day) => days[day].visitors;
const byCountry = (day, cc) => visitorsOf(day).find((v) => v.country === cc);

test('days are bucketed by the log line’s own local date', () => {
	assert.deepEqual(Object.keys(days), ['2026-07-24', '2026-07-25']);
});

test('bots are excluded from visitors but still counted', () => {
	// The fixture holds three kinds of non-human: DreamHost SiteMonitor (x2),
	// Googlebot, and a scanner with a real browser UA that only probes /wp-admin
	// and /.env — the last one is caught by "never fetched an app path", not by UA.
	assert.equal(visitorsOf('2026-07-24').length, 4);
	assert.equal(days['2026-07-24'].botRequests, 5);
	assert.equal(days['2026-07-24'].requests, 12);
});

test('a crawler wearing a browser UA is caught by the paths it asks for', () => {
	// It fetches / and the JS exactly like a browser, so the User-Agent and the
	// "did it load the app" checks both clear it — then it asks for /llms.txt, which
	// the app never requests. That one line disqualifies the whole visitor-day, and
	// its 404 must not pollute the error list.
	assert.equal(visitorsOf('2026-07-25').length, 2);
	assert.equal(days['2026-07-25'].botRequests, 3);
	assert.ok(!days['2026-07-25'].errors.some((e) => e.path === '/llms.txt'));
});

test('a 30-minute gap splits one visitor-day into two sessions', () => {
	const iphone = byCountry('2026-07-24', 'NP');
	assert.equal(iphone.sessions, 2); // 08:15 burst, then 09:30
	assert.equal(iphone.requests, 4);
});

test('a visitor keeps the same hash across days (so returns are detectable)', () => {
	assert.equal(byCountry('2026-07-24', 'NP').visitor, byCountry('2026-07-25', 'NP').visitor);
});

test('the hash is not a raw IP or anything reversible without the salt', () => {
	for (const day of Object.values(days))
		for (const v of day.visitors) {
			assert.match(v.visitor, /^[0-9a-f]{32}$/);
			assert.ok(!JSON.stringify(day).includes('192.0.2.10'), 'a raw IP leaked into the output');
		}
});

test('countries resolve for both IPv4 and IPv6', () => {
	const seen = visitorsOf('2026-07-24')
		.map((v) => v.country)
		.sort();
	assert.deepEqual(seen, ['GB', 'IN', 'NP', 'US']); // IN is the IPv6 visitor
});

test('device and browser come off the User-Agent, CriOS-style aliases included', () => {
	const pairs = visitorsOf('2026-07-24').map((v) => `${v.device}/${v.browser}`);
	assert.ok(pairs.includes('iPhone/Safari'));
	assert.ok(pairs.includes('Android/Chrome'));
	assert.ok(pairs.includes('Windows/Chrome'));
	assert.equal(visitorsOf('2026-07-25').find((v) => v.device === 'iPad').browser, 'Safari');
});

test('a visitor who touched /admin/ is flagged as mine', () => {
	const mine = visitorsOf('2026-07-24').filter((v) => v.mine);
	assert.equal(mine.length, 1);
	assert.equal(mine[0].country, 'GB');
});

test('referrers count only page arrivals, and www is folded in', () => {
	assert.deepEqual(days['2026-07-24'].referrers, [{ mine: false, host: 'google.com', hits: 1 }]);
	assert.deepEqual(days['2026-07-25'].referrers, [{ mine: false, host: 'duckduckgo.com', hits: 1 }]);
});

test('errors are recorded for humans only, split 4xx / 5xx', () => {
	// The scanner's two 404s are a bot's, so they never reach the error list.
	assert.deepEqual(days['2026-07-24'].errors, [{ mine: false, status: 404, path: '/audio/sano/missing-clip.mp3', hits: 1 }]);
	assert.equal(days['2026-07-24'].errors4xx, 1);
	assert.equal(days['2026-07-25'].errors5xx, 1);
	assert.deepEqual(days['2026-07-25'].errors, [{ mine: false, status: 500, path: '/api/state.php', hits: 1 }]);
});

test('query strings are stripped from paths so one asset is one row', () => {
	for (const day of Object.values(days)) for (const e of day.errors) assert.ok(!e.path.includes('?'));
});
