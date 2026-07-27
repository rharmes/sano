// --update-geo replaces the compiled IP→country index that every traffic row's country
// comes from (T50). The dangerous property is that failure used to be silent and total: a
// truncated download or an HTML error page served with a 200 compiles to a valid, nearly
// empty index, `rename()` puts it over the good one, and from then on every country reads
// NULL with nothing but a "0 ranges" line in a log nobody reads to say why.
//
// So the rule under test is "the old index survives anything questionable". These run with
// no network — the remote path's only extra is a larger absolute floor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const SCRIPT = join(ROOT, 'tools/ingest-traffic.php');
const FIXTURE_V4 = join(ROOT, 'tests/fixtures/geo-ipv4-num.csv'); // three ranges

// Returns { status, stderr } instead of throwing, so a rejection is inspectable.
function updateGeo(dir, from) {
	try {
		execFileSync('php', [SCRIPT, '--update-geo', '--geo-dir', dir, '--from', from], { encoding: 'utf8', stdio: 'pipe' });
		return { status: 0, stderr: '' };
	} catch (e) {
		return { status: e.status, stderr: String(e.stderr) };
	}
}

const withDir = (fn) => {
	const dir = mkdtempSync(join(tmpdir(), 'sano-geo-guard-'));
	try {
		fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

const indexSize = (dir) => (existsSync(join(dir, 'geo-ipv4.bin')) ? statSync(join(dir, 'geo-ipv4.bin')).size : 0);

test('a deliberately small local CSV still compiles', () => {
	// The floor for a --from file is only "not empty": the operator named this file, and
	// the fixtures are three ranges on purpose. An absolute floor here would break them —
	// which is exactly what happened when this guard was first written.
	withDir((dir) => {
		assert.equal(updateGeo(dir, FIXTURE_V4).status, 0);
		assert.equal(indexSize(dir), 3 * 10); // three records, GEO_V4_REC = 10 bytes
	});
});

test('an HTML error page is refused before anything is written', () => {
	withDir((dir) => {
		const html = join(dir, 'oops.csv');
		writeFileSync(html, '<!DOCTYPE html>\n<html><body>404 Not Found</body></html>\n');
		const { status, stderr } = updateGeo(dir, html);
		assert.notEqual(status, 0);
		assert.match(stderr, /not the range CSV/);
		assert.equal(indexSize(dir), 0, 'nothing may be written from a non-CSV');
	});
});

test('an empty source is refused', () => {
	withDir((dir) => {
		const empty = join(dir, 'empty.csv');
		writeFileSync(empty, '');
		assert.notEqual(updateGeo(dir, empty).status, 0);
		assert.equal(indexSize(dir), 0);
	});
});

test('a shrunken source cannot replace a bigger index', () => {
	withDir((dir) => {
		assert.equal(updateGeo(dir, FIXTURE_V4).status, 0);
		const before = indexSize(dir);

		// One range where the index holds three: a stand-in for the download that stopped
		// part-way, which is the case an absolute floor alone would wave through.
		const short = join(dir, 'short.csv');
		writeFileSync(short, '3221225984,3221226239,NP\n');
		const { status, stderr } = updateGeo(dir, short);

		assert.notEqual(status, 0);
		assert.match(stderr, /keeping the existing index/);
		assert.match(stderr, /delete .* and re-run/, 'the operator needs a way out when the shrink is real');
		assert.equal(indexSize(dir), before, 'the good index must survive');
	});
});

test('a rejected update leaves no temp file behind', () => {
	withDir((dir) => {
		const html = join(dir, 'oops.csv');
		writeFileSync(html, '<!DOCTYPE html>\n');
		updateGeo(dir, html);
		const short = join(dir, 'short.csv');
		writeFileSync(short, '3221225984,3221226239,NP\n');
		updateGeo(dir, FIXTURE_V4);
		updateGeo(dir, short);
		assert.deepEqual(
			readdirSync(dir).filter((f) => f.endsWith('.tmp')),
			[],
			'a half-written index must not be left where the next run could trip over it',
		);
	});
});

test('the download URLs are pinned to a version line, not floating on latest', () => {
	// Not an exact pin: this package publishes daily, so an exact version would freeze the
	// data --update-geo exists to refresh. The range pin is what stops a major release
	// reordering the CSV columns and compiling a garbage index that passes every check
	// above — the one corruption the count guards cannot see.
	const src = execFileSync('grep', ['-E', 'const GEO_PKG', SCRIPT], { encoding: 'utf8' });
	assert.match(src, /@ip-location-db\/geo-whois-asn-country@\d+\.\d+/, 'GEO_PKG must carry a version');
});
