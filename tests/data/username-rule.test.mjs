// The username rule lives in three places: api/register.php enforces it for self-service
// signup, js/onboarding.js pre-validates so the UI can complain early, and
// tools/make-user.php applies it to accounts created from the CLI. That third copy did
// not exist until T46 — the CLI accepted anything, so it could mint `Ross`, a name with a
// trailing space, or a Cyrillic homoglyph of an existing account, all of which render as
// visually identical rows in the admin table. Three copies of an identity rule drift, and
// the drift is invisible until someone exploits it, so diff them here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const extract = (src, re, which) => {
	const m = src.match(re);
	assert.ok(m, `${which}: no username rule found — did the check move or get removed?`);
	return m[1];
};

const sources = {
	'api/register.php': extract(read('api/register.php'), /preg_match\('\/(.+?)\/',\s*\$username\)/, 'api/register.php'),
	'tools/make-user.php': extract(read('tools/make-user.php'), /preg_match\('\/(.+?)\/',\s*\$username\)/, 'tools/make-user.php'),
	'js/onboarding.js': extract(read('js/onboarding.js'), /USERNAME_RE\s*=\s*\/(.+?)\/;/, 'js/onboarding.js'),
};

test('every copy of the username rule is the same pattern', () => {
	const [reference, ...rest] = Object.entries(sources);
	for (const [file, pattern] of rest) {
		assert.equal(pattern, reference[1], `${file} disagrees with ${reference[0]} about what a username may be`);
	}
});

test('the rule actually rejects the names that make accounts confusable', () => {
	const re = new RegExp(sources['api/register.php']);
	for (const ok of ['ross', 'a_b_c', 'user123', 'abc']) assert.ok(re.test(ok), `${ok} should be allowed`);
	for (const bad of [
		'Ross', // case variants collide under the table's case-insensitive UNIQUE index
		'ross ', // trailing space
		' ross',
		'rоss', // Cyrillic o — a homoglyph of an existing account
		'ab', // too short
		'a'.repeat(33), // longer than the VARCHAR(64) column expects to need
		'ross<script>',
		'ross-admin',
		'',
	]) {
		assert.ok(!re.test(bad), `${JSON.stringify(bad)} should be rejected`);
	}
});
