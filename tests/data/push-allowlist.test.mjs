// The Web Push allowlist (T42) exists twice on purpose: api/push-subscribe.php uses
// the copy in api/lib.php to validate on write, and tools/send-reminders.php carries
// its own because it runs from ~/sano-tools/ on the server and can't require anything
// out of the docroot. Two copies of a security allowlist is exactly the thing that
// drifts silently — one gets a new push service, the other keeps rejecting it, and the
// only symptom is that somebody's reminders quietly stop. So diff them here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const LIB = readFileSync(join(ROOT, 'api/lib.php'), 'utf8');
const CRON = readFileSync(join(ROOT, 'tools/send-reminders.php'), 'utf8');

// The shared region runs from the host list through the end of push_key_ok().
const TAIL = 'return $firstByte < 0 || ord($raw[0]) === $firstByte;';

function validatorBlock(src, which) {
	const start = src.indexOf('const PUSH_HOSTS');
	assert.notEqual(start, -1, `${which}: PUSH_HOSTS not found`);
	const end = src.indexOf(TAIL, start);
	assert.notEqual(end, -1, `${which}: push_key_ok not found after PUSH_HOSTS`);
	return src
		.slice(start, end + TAIL.length)
		.split('\n')
		.map((line) => line.replace(/\/\/.*$/, '').trim())
		.filter(Boolean)
		.join('\n');
}

const hostsOf = (block) => [...block.matchAll(/'([a-z0-9.-]+\.[a-z]{2,})'/g)].map((m) => m[1]).sort();

test('both copies of the push allowlist name the same hosts', () => {
	const lib = hostsOf(validatorBlock(LIB, 'api/lib.php'));
	const cron = hostsOf(validatorBlock(CRON, 'tools/send-reminders.php'));
	assert.ok(lib.includes('web.push.apple.com'), 'the live subscriptions are Apple — that host must be allowed');
	assert.ok(lib.length >= 4, 'expected at least the four Web Push services');
	assert.deepEqual(cron, lib);
});

test('both copies of the validator logic are byte-identical once comments are stripped', () => {
	assert.equal(validatorBlock(CRON, 'tools/send-reminders.php'), validatorBlock(LIB, 'api/lib.php'));
});
