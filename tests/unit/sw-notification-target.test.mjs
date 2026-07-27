// safeTarget() from sw.js (T53) — where a notification click is allowed to send the user.
//
// The URL comes out of the push payload, so it is only as trustworthy as the VAPID key
// that signed it. That matters more than it looks: the click handler calls
// WindowClient.navigate() on a window the user already has open, so a hostile value
// retargets the running app rather than merely opening a tab. Lifted out by its sentinels
// with a stubbed `self` — it's a pure string function once the origin is supplied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { liftBlock, ROOT } from '../lift.mjs';

const ORIGIN = 'https://namastesano.com';
const { safeTarget } = liftBlock('sw.js', '// --- notification target (pure) ---', '// --- end notification target ---', ['safeTarget'], {
	self: { location: { origin: ORIGIN } },
});

test('a same-origin path is kept, resolved to an absolute URL', () => {
	assert.equal(safeTarget('/'), `${ORIGIN}/`);
	assert.equal(safeTarget('/lesson'), `${ORIGIN}/lesson`);
	assert.equal(safeTarget('/?tab=progress#top'), `${ORIGIN}/?tab=progress#top`);
	assert.equal(safeTarget(`${ORIGIN}/admin/`), `${ORIGIN}/admin/`);
});

test('another origin is refused and falls back to the app root', () => {
	assert.equal(safeTarget('https://evil.test/phish'), '/');
	assert.equal(safeTarget('http://namastesano.com/'), '/'); // scheme is part of the origin
	assert.equal(safeTarget('https://namastesano.com.evil.test/'), '/'); // suffix trick
	assert.equal(safeTarget('https://evil.test/?next=https://namastesano.com/'), '/');
});

test('the shapes that slip past a naive same-origin check', () => {
	// Protocol-relative: no scheme, so a `startsWith("/")` test would wave it through.
	assert.equal(safeTarget('//evil.test/phish'), '/');
	// Opaque origin — resolves to the string "null", which is not our origin.
	assert.equal(safeTarget('javascript:alert(1)'), '/');
	assert.equal(safeTarget('data:text/html,<script>alert(1)</script>'), '/');
	// Backslashes are normalised to slashes by the URL parser in some positions.
	assert.equal(safeTarget('\\\\evil.test/phish'), '/');
});

test('a missing or malformed value falls back rather than throwing', () => {
	for (const bad of [undefined, null, '', 42, {}, []]) {
		assert.equal(safeTarget(bad), '/', `${JSON.stringify(bad)} should fall back`);
	}
});

// A correct guard that nothing calls is worth nothing, and the two places that consume
// `target` are the dangerous ones — c.navigate() retargets an open window, openWindow()
// follows cross-origin. Neither may ever see the raw payload value.
test('the notificationclick handler routes the payload URL through safeTarget', () => {
	const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
	const handler = src.slice(src.indexOf("addEventListener('notificationclick'"));
	assert.match(handler, /const target = safeTarget\(/);
	// Nothing may assign `target` any other way — that's how the guard gets bypassed.
	assert.doesNotMatch(handler, /const target = (?!safeTarget\()/, 'the target must come from safeTarget()');
	assert.match(handler, /c\.navigate\(target\)/);
	assert.match(handler, /openWindow\(target\)/);
});
