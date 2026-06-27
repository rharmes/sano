// Pure-logic checks for the dictionary tool's Devanagari normalizer/tokenizer
// (tools/dict/lib/normalize.mjs). It's load-bearing: the builder and the data test both key/tokenize
// through it, so the "every COURSE word is represented" invariant depends on it being deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTags, normalizeWord, tokenize, DEV_RE } from '../../tools/dict/lib/normalize.mjs';

test('stripTags removes ElevenLabs [performance tags] and tidies the gap', () => {
	assert.equal(stripTags('नमस्ते [whispers] साथी'), 'नमस्ते साथी');
	assert.equal(stripTags('ठीक छ [laughs] ।'), 'ठीक छ।');
	assert.equal(stripTags('घर'), 'घर'); // no-op on tag-free input
});

test('normalizeWord trims edge punctuation/danda and keeps display', () => {
	assert.equal(normalizeWord('घर।').display, 'घर');
	assert.equal(normalizeWord('"राम्रो"').display, 'राम्रो');
	assert.equal(normalizeWord(5).key, ''); // non-string is safe
});

test('normalizeWord collapses candrabindu→anusvara in the key only', () => {
	const n = normalizeWord('गाउँ');
	assert.equal(n.display, 'गाउँ'); // display preserves candrabindu
	assert.equal(n.key, 'गाउं'); // key uses anusvara for fuzzy matching
	assert.notEqual(n.key, n.display);
});

test('tokenize splits a phrase, drops non-Devanagari, dedups by key', () => {
	assert.deepEqual(
		tokenize('तपाईंलाई कस्तो छ?').map((w) => w.display),
		['तपाईंलाई', 'कस्तो', 'छ'],
	);
	assert.deepEqual(
		tokenize('ek एक 1️⃣ one').map((w) => w.display),
		['एक'],
	); // Latin + emoji dropped
	assert.equal(tokenize('घर घर। घर').length, 1); // same key collapses
	assert.deepEqual(tokenize(null), []); // non-string is safe
});

test('DEV_RE matches Devanagari, not Latin', () => {
	assert.ok(DEV_RE.test('क'));
	assert.ok(!DEV_RE.test('abc'));
});
