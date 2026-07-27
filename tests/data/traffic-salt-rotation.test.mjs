// The visitor salt rotates yearly (T55). A visitor id is a salted hash of ip + UA, so one
// permanent salt means one identifier linking a person's visits for as long as the rows
// live. Keying the salt to the calendar year of the day being ingested caps that at a
// year — automatically, with nobody having to remember a January chore.
//
// The property that makes it safe is subtler than "the hash changes": the ingest is
// idempotent (re-running replaces a day wholesale), so the salt has to be *derived* from
// the year rather than rolled. A random-per-rotation salt would turn one returning visitor
// into two on any re-ingest. The linkage behaviour is asserted end-to-end below; the
// derivation is pinned at the source, because --json's base salt is random per invocation
// by design (T51) and so cannot demonstrate reproducibility across processes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const SCRIPT = join(ROOT, 'tools/ingest-traffic.php');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IP = '198.51.100.77';

// One visitor, one request per given day. `is_app_path` requires a real app fetch for the
// visitor to count as human at all, so ask for the page itself.
const logFor = (dates) => dates.map((d) => `${IP} - - [${d} -0700] "GET / HTTP/2.0" 200 4510 "-" "${UA}"`).join('\n') + '\n';

function visitorsByDay(logText) {
	const dir = mkdtempSync(join(tmpdir(), 'sano-salt-'));
	try {
		const log = join(dir, 'access.log');
		writeFileSync(log, logText);
		const out = execFileSync('php', [SCRIPT, '--file', log, '--json', '--geo-dir', dir], { encoding: 'utf8' });
		const { days } = JSON.parse(out);
		return Object.fromEntries(Object.entries(days).map(([day, d]) => [day, d.visitors.map((v) => v.visitor)]));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

test('the same visitor keeps one id within a calendar year', () => {
	const byDay = visitorsByDay(logFor(['01/Jan/2026:09:00:00', '31/Dec/2026:22:00:00']));
	assert.deepEqual(Object.keys(byDay).sort(), ['2026-01-01', '2026-12-31']);
	assert.equal(byDay['2026-01-01'][0], byDay['2026-12-31'][0], 'returns within a year must stay linkable — that is what the dashboard counts');
});

test('the id changes across the year boundary', () => {
	const byDay = visitorsByDay(logFor(['31/Dec/2026:23:50:00', '01/Jan/2027:00:10:00']));
	// Ten minutes apart in wall-clock time, and deliberately not the same person as far as
	// the stored rows are concerned.
	assert.notEqual(byDay['2026-12-31'][0], byDay['2027-01-01'][0], 'a year boundary must break the link');
});

test('the year salt is derived from the base secret, never rolled randomly', () => {
	// Re-ingest reproducibility is the property that matters here — the ingest replaces a
	// day wholesale, so a salt that changed between runs would turn one returning visitor
	// into two. It cannot be observed through --json, whose base salt is deliberately
	// random per invocation (T51: a fixed one committed to this repo would make every
	// printed hash reversible to a raw IP). On the real path the base comes from
	// sano-config.php and is stable, so what's left to pin is the derivation itself.
	const src = readFileSync(join(ROOT, 'tools/ingest-traffic.php'), 'utf8');
	const fn = src.slice(src.indexOf('function year_salt'), src.indexOf('function purge_old_visitors'));
	assert.match(fn, /hash_hmac\('sha256', \$year, \$base, true\)/, 'the salt must be an HMAC of the year under the base secret');
	assert.doesNotMatch(fn, /random_bytes|mt_rand|uniqid/, 'anything random here breaks re-ingest idempotence');
	assert.match(fn, /substr\(\$day, 0, 4\)/, 'and it must key on the calendar year of the day being ingested');
});

test('the id is still an opaque 16-byte hash, not anything reversible', () => {
	for (const id of Object.values(visitorsByDay(logFor(['05/Mar/2026:12:00:00']))).flat()) {
		assert.match(id, /^[0-9a-f]{32}$/);
		assert.ok(!id.includes('198'), 'no fragment of the address may survive');
	}
});
