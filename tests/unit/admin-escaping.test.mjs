// esc() from js/admin.js (T58). The admin dashboard is the one page in the app that puts
// account-controlled strings on screen, so its escaper is worth pinning rather than
// eyeballing. Lifted out of the classic script by its sentinels — no DOM needed, it's a
// string function.
//
// The bug this closes: esc() escaped &<>" but not `'`, which made it element-safe and NOT
// attribute-safe. No caller used it in an attribute, so nothing was exploitable — but a
// helper that is only safe in a context its name doesn't mention is a trap for whoever
// writes the next line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftBlock } from '../lift.mjs';

const { esc } = liftBlock('js/admin.js', '// --- html escaping (pure) ---', '// --- end html escaping ---', ['esc']);

test('escapes every character that can break out of markup', () => {
	assert.equal(esc('&'), '&amp;');
	assert.equal(esc('<'), '&lt;');
	assert.equal(esc('>'), '&gt;');
	assert.equal(esc('"'), '&quot;');
	assert.equal(esc("'"), '&#39;'); // the one it used to miss
});

test('a script tag comes back inert', () => {
	assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
	assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('it is safe in a single-quoted attribute, which is what changed', () => {
	// The old escaper left `'` alone, so this payload closed the attribute and everything
	// after it was markup: title='x' onmouseover='alert(1)'
	const attacker = "x' onmouseover='alert(1)";
	const attr = `<b title='${esc(attacker)}'>hi</b>`;
	assert.ok(!/title='x'/.test(attr), 'the attribute must not be closed early');
	assert.ok(!attr.includes("onmouseover='alert"), 'no attribute may be injected');
	assert.equal(attr, "<b title='x&#39; onmouseover=&#39;alert(1)'>hi</b>");
});

test('the ampersand is escaped first, so nothing is double-decoded', () => {
	// If & were replaced after < , then "&lt;" typed by a user would come back as a real
	// "<" when the browser decoded it. String.replace with one pass over a character class
	// can't do that, which is the property worth pinning.
	assert.equal(esc('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
});

test('non-string input is coerced, not crashed on', () => {
	assert.equal(esc(null), 'null');
	assert.equal(esc(42), '42');
	assert.equal(esc(undefined), 'undefined');
});
