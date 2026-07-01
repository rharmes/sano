// Validation for the generated ground-truth dictionary (tools/dict/dictionary.json).
// Offline only — no network, no API. Shares lib/normalize.mjs with the builder so tokenization
// matches exactly. The dictionary is a credentialed build artifact: when it is absent (fresh
// clone, before the first `build-dictionary.mjs` run) every test SKIPS rather than failing.
//
// HARD-fail: schema shape + the load-bearing invariant that every COURSE content word is present.
// SOFT (warn + list, never fail — AI-drafted strings are Ross's to review, never auto-corrected):
//   COURSE gloss mismatches, low-confidence rows, Wiktionary-absent lemmas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liftGlobals } from '../lift.mjs';
import { tokenize } from '../../tools/dict/lib/normalize.mjs';
import { selectCandidates, STOP } from '../../tools/dict/select-candidates.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DICT_PATH = join(ROOT, 'tools', 'dict', 'dictionary.json');
const present = existsSync(DICT_PATH);
const skip = present ? false : 'dictionary.json not built yet — run tools/dict/build-dictionary.mjs';

const { COURSE } = liftGlobals('js/data.js', ['COURSE']);
const dict = present ? JSON.parse(readFileSync(DICT_PATH, 'utf8')) : { entries: [] };
const byKey = new Map(dict.entries.map((e) => [e.key, e]));
const SOURCES = new Set(['claude', 'wiktionary', 'course', 'mt']);
const REGISTERS = new Set(['everyday', 'formal', 'literary', 'rare']);

test('dictionary: well-formed top-level shape', { skip }, () => {
	assert.equal(dict.version, 1);
	assert.ok(Array.isArray(dict.entries) && dict.entries.length > 0, 'no entries');
	assert.ok(dict.provenance && dict.provenance.model, 'missing provenance.model');
});

test('dictionary: every entry has key/dev/en, unique key, valid sources & register', { skip }, () => {
	const seen = new Set();
	for (const e of dict.entries) {
		assert.ok(e.key && typeof e.key === 'string', `entry missing key: ${JSON.stringify(e)}`);
		assert.ok(e.dev && typeof e.dev === 'string', `${e.key}: missing dev`);
		assert.ok(typeof e.en === 'string', `${e.key}: missing en`);
		assert.ok(!seen.has(e.key), `duplicate key: ${e.key}`);
		seen.add(e.key);
		assert.ok(Array.isArray(e.sources) && e.sources.length, `${e.key}: empty sources`);
		for (const s of e.sources) assert.ok(SOURCES.has(s), `${e.key}: bad source ${s}`);
		assert.ok(REGISTERS.has(e.register), `${e.key}: bad register ${e.register}`);
		if (e.freqRank != null) assert.ok(Number.isInteger(e.freqRank), `${e.key}: non-integer freqRank`);
	}
});

test('dictionary: every COURSE content word is represented (the load-bearing invariant)', { skip }, () => {
	const missing = [];
	for (const u of COURSE)
		for (const it of u.items) {
			if (!it.dev) continue;
			for (const w of tokenize(it.dev)) if (!byKey.has(w.key)) missing.push(`${w.display} (${it.id})`);
		}
	assert.deepEqual([...new Set(missing)], [], `COURSE words absent from dictionary: ${[...new Set(missing)].slice(0, 20).join(', ')}`);
});

// --- SOFT: report only, never fail ---------------------------------------------------------

test('dictionary: COURSE translations the dictionary disagrees with (review, not failure)', { skip }, () => {
	const flagged = dict.entries.filter((e) => e.review);
	if (flagged.length) {
		console.log(`\n  ${flagged.length} COURSE gloss(es) to review (flag only — never auto-changed):`);
		for (const e of flagged.slice(0, 30)) console.log(`    ${e.dev}: COURSE "${e.review.courseEn}" vs dict "${e.review.dictEn}"`);
	}
	assert.ok(true);
});

test('dictionary: coverage-gap signals (low-confidence / Wiktionary-absent)', { skip }, () => {
	const low = dict.entries.filter((e) => e.confidence === 'low').length;
	const absent = dict.entries.filter((e) => e.agreement === 'wiktionary-absent').length;
	console.log(`\n  ${low} low-confidence entries, ${absent} without Wiktionary attestation (coverage-gap signal).`);
	assert.ok(true);
});

// --- Expansion candidate selector (tools/dict/select-candidates.mjs) — pure, fixture-driven -----
// Not gated by `skip`: it exercises the filter/ranking on a fixture, no dictionary.json needed.

const FIXTURE = [
	{ key: 'a', dev: 'क', pos: 'verb', en: 'x', register: 'everyday', inCourse: false, freqRank: 3, count: 100 },
	{ key: 'b', dev: 'ख', pos: 'verb', en: 'x', register: 'everyday', inCourse: false, freqRank: 1, count: 500 },
	{ key: 'c', dev: 'ग', pos: 'verb', en: 'x', register: 'everyday', inCourse: true, freqRank: 2, count: 900 }, // already in course
	{ key: 'd', dev: 'घ', pos: 'noun', en: 'x', register: 'everyday', inCourse: false, freqRank: 4, count: 900 }, // wrong pos
	{ key: 'e', dev: 'ङ', pos: 'verb', en: 'x', register: 'formal', inCourse: false, freqRank: 5, count: 900 }, // wrong register
	{ key: 'f', dev: 'को', pos: 'verb', en: 'x', register: 'everyday', inCourse: false, freqRank: 6, count: 900 }, // stop word
	{ key: 'g', dev: 'च', pos: 'verb', en: 'x', register: 'everyday', inCourse: false, freqRank: 7, count: 300 },
];

test('select-candidates: filters to not-in-course, matching pos+register, non-stop', () => {
	const got = selectCandidates(FIXTURE, { pos: 'verb', register: 'everyday', n: 10 }).map((c) => c.key);
	assert.deepEqual(got, ['b', 'g', 'a'], 'wrong set/order (expect in-course, wrong-pos, wrong-register, stop all dropped; sorted by count·weight)');
});

test('select-candidates: honors n and includes the stop set for particles', () => {
	assert.ok(STOP.has('को'), 'expected को in the stop set');
	const two = selectCandidates(FIXTURE, { pos: 'verb', register: 'everyday', n: 2 }).map((c) => c.key);
	assert.deepEqual(two, ['b', 'g'], 'n should cap the pool after ranking');
});
