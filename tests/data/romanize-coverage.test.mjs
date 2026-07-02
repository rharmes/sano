// Romanization coverage over the WHOLE corpus (js/romanize.js applied to every COURSE `dev`).
// These are completeness/safety nets, not wording checks: they guarantee the algorithm handles
// every character actually present and never silently drops or garbles a word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftGlobals } from '../lift.mjs';

const { SanoRomanize } = liftGlobals('js/romanize.js', ['SanoRomanize']);
const { COURSE } = liftGlobals('js/data.js', ['COURSE']);
const R = SanoRomanize.romanize;
const P = SanoRomanize.pronounce;
// Depth alternate frames (T28) are romanized at load exactly like an item's own `dev`, so
// fold each into the coverage sweep as a pseudo-item (`<id>-fN`) — an unmapped glyph or a
// vanishing word in a rotating sentence must fail the same nets.
const items = COURSE.flatMap((u) => u.items).flatMap((it) => [it, ...(it.frames || []).map((f, i) => ({ id: `${it.id}-f${i + 1}`, dev: f.dev }))]);
const isDev = (ch) => /[ऀ-ॿ]/.test(ch);

test('coverage: every Devanagari codepoint in the corpus is a known table key', () => {
	const T = SanoRomanize._tables;
	const known = new Set([
		...Object.keys(T.CONS),
		...Object.keys(T.VOWEL_INDEP),
		...Object.keys(T.VOWEL_MATRA),
		T.HALANT,
		T.ANUSVARA,
		T.CHANDRA,
		T.VISARGA,
	]);
	for (const k of Object.keys(T.CONJUNCT)) for (const ch of k) known.add(ch);

	const missing = new Set();
	for (const it of items) {
		for (const ch of (it.dev || '').normalize('NFC')) {
			if (isDev(ch) && !known.has(ch)) missing.add(`${ch} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
		}
	}
	assert.deepEqual([...missing], [], `unmapped Devanagari codepoints: ${[...missing].join(', ')}`);
});

test('coverage: every derived form is clean Latin + the passthrough set (no leftover script)', () => {
	const bad = [];
	for (const it of items) {
		const out = R(it.dev);
		// Lowercase + uppercase Latin, space, and the only punctuation that appears in dev.
		if (!/^[A-Za-z _?,/!]*$/.test(out)) bad.push(`${it.id}: ${it.dev} → ${out}`);
	}
	assert.deepEqual(bad, [], `unexpected characters in derived np:\n  ${bad.slice(0, 20).join('\n  ')}`);
});

test('coverage: no Devanagari word silently vanishes', () => {
	const empties = [];
	for (const it of items) {
		const out = R(it.dev);
		// Anything with Devanagari must yield at least one Latin letter.
		if (/[ऀ-ॿ]/.test(it.dev) && !/[A-Za-z]/.test(out)) empties.push(it.id);
	}
	assert.deepEqual(empties, [], `items romanized to no letters: ${empties.join(', ')}`);
});

test('coverage: word and placeholder structure is preserved', () => {
	const mismatches = [];
	const count = (s, re) => (s.match(re) || []).length;
	for (const it of items) {
		const out = R(it.dev);
		const dev = it.dev.normalize('NFC');
		const wordsDev = dev.trim().split(/\s+/).filter(Boolean).length;
		const wordsOut = out.trim().split(/\s+/).filter(Boolean).length;
		if (wordsDev !== wordsOut) mismatches.push(`${it.id}: ${wordsDev}≠${wordsOut} words (${out})`);
		if (count(dev, /_/g) !== count(out, /_/g)) mismatches.push(`${it.id}: _ count drift (${out})`);
		if (count(dev, /\?/g) !== count(out, /\?/g)) mismatches.push(`${it.id}: ? count drift (${out})`);
	}
	assert.deepEqual(mismatches, [], `structure drift:\n  ${mismatches.slice(0, 20).join('\n  ')}`);
});

test('coverage: romanization is pure and idempotent across the corpus', () => {
	for (const it of items) {
		assert.equal(R(it.dev), R(it.dev), `${it.id}: not deterministic`);
		assert.equal(R(R(it.dev)), R(it.dev), `${it.id}: not idempotent`);
	}
});

// --- pronounce() coverage: same safety nets for the derived `pron` over all 588 items ---

test('coverage: every derived pron is lowercase Latin + hyphen + the passthrough set', () => {
	const bad = [];
	for (const it of items) {
		const out = P(it.dev);
		// Lowercase Latin, hyphen (syllable separator), space, and the dev punctuation passthrough.
		if (!/^[a-z _?,/!-]*$/.test(out)) bad.push(`${it.id}: ${it.dev} → ${out}`);
	}
	assert.deepEqual(bad, [], `unexpected characters in derived pron:\n  ${bad.slice(0, 20).join('\n  ')}`);
});

test('coverage: pron preserves word/placeholder structure; no word vanishes', () => {
	const issues = [];
	const count = (s, re) => (s.match(re) || []).length;
	for (const it of items) {
		const out = P(it.dev);
		const dev = it.dev.normalize('NFC');
		if (dev.trim().split(/\s+/).filter(Boolean).length !== out.trim().split(/\s+/).filter(Boolean).length)
			issues.push(`${it.id}: word count (${out})`);
		if (count(dev, /_/g) !== count(out, /_/g)) issues.push(`${it.id}: _ drift (${out})`);
		if (count(dev, /\?/g) !== count(out, /\?/g)) issues.push(`${it.id}: ? drift (${out})`);
		if (/[ऀ-ॿ]/.test(dev) && !/[a-z]/.test(out)) issues.push(`${it.id}: no letters (${out})`);
	}
	assert.deepEqual(issues, [], `pron structure drift:\n  ${issues.slice(0, 20).join('\n  ')}`);
});

test('coverage: pron is pure and idempotent across the corpus', () => {
	for (const it of items) {
		assert.equal(P(it.dev), P(it.dev), `${it.id}: not deterministic`);
		assert.equal(P(P(it.dev)), P(it.dev), `${it.id}: not idempotent`);
	}
});
