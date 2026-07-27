// The four server-side CLI scripts each carry their own copy of the same crash guard
// (T51). They can't share a require: each is installed standalone on the server —
// ~/sano-tools/ for the two cron jobs and the migration, the home directory for
// make-user.php — with no docroot and no autoloader in reach.
//
// What the guard buys: an uncaught throw would otherwise print a full stack trace into a
// log file, and a trace carries every string argument on the stack (PHP truncates them to
// 15 characters, which is not protection) plus the DSN and DB user. PHP 8.2+ masks the
// password itself behind #[\SensitiveParameter], but only inside its own APIs — a helper
// of ours that takes a secret is printed in full. A copy that quietly loses the guard
// looks exactly like the other three until the night it crashes, so diff them here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const SCRIPTS = ['tools/ingest-traffic.php', 'tools/send-reminders.php', 'tools/migrate-2026-07-traffic.php', 'tools/make-user.php'];

// From the ini call through the end of the handler it installs.
const START = "ini_set('zend.exception_ignore_args'";
const END = '});';

function guardBlock(file) {
	const src = readFileSync(join(ROOT, file), 'utf8');
	const start = src.indexOf(START);
	assert.notEqual(start, -1, `${file}: no crash guard found — did it get removed?`);
	const end = src.indexOf(END, start);
	assert.notEqual(end, -1, `${file}: the crash guard is not closed`);
	return src.slice(start, end + END.length);
}

test('every CLI script installs the crash guard, identically', () => {
	const [first, ...rest] = SCRIPTS;
	const reference = guardBlock(first);
	for (const file of rest) {
		assert.equal(guardBlock(file), reference, `${file} has drifted from ${first}`);
	}
});

test('the guard turns off trace arguments and prints one line, not a trace', () => {
	const block = guardBlock(SCRIPTS[0]);
	assert.match(block, /ini_set\('zend\.exception_ignore_args', '1'\)/);
	assert.match(block, /set_exception_handler/);
	assert.match(block, /getMessage\(\)/);
	assert.match(block, /getFile\(\)/);
	// The whole point is NOT stringifying the exception. `. $e` — the bare object, not
	// `$e->something` — would print the trace straight back into the log the ini setting
	// has just finished sanitising.
	assert.doesNotMatch(block, /getTraceAsString|\.\s*\$e(?!->)/);
});

// Same rule on the web side: api/lib.php's handler feeds the shared host's error log.
test('the api exception handler logs a message, not the whole exception', () => {
	const lib = readFileSync(join(ROOT, 'api/lib.php'), 'utf8');
	assert.match(lib, /ini_set\('zend\.exception_ignore_args', '1'\)/);
	assert.match(lib, /error_log\('sano api: ' \. get_class\(\$e\)/);
	assert.doesNotMatch(lib, /error_log\('sano api: ' \. \$e\)/);
});

// A salt committed to this repo would make every hash --json prints reversible to a raw
// IP (IPv4 is 2^32), which is the one thing the hashing exists to prevent.
test('the --json debug salt is generated, never a literal', () => {
	const src = readFileSync(join(ROOT, 'tools/ingest-traffic.php'), 'utf8');
	assert.match(src, /\$salt = bin2hex\(random_bytes\(/);
	assert.doesNotMatch(src, /\$salt = '[^']+'/);
});
