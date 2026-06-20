#!/usr/bin/env node
// Unit test for the SR-05 spaced-repetition scheduler (SM-2-lite).
//
// The scheduler in js/sano.js is a plain browser script, not a module, so rather
// than load the whole app we lift just the pure scheduler block — everything
// between the two sentinel comments — and evaluate it in isolation. The block is
// deliberately free of DOM and shared state so this works without a browser.
//
// Usage: node tools/check-scheduler.mjs   (exits non-zero on any failed assertion)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'js', 'sano.js'), 'utf8');

const START = '// --- SR-05 spaced-repetition scheduler (SM-2-lite, pure)';
const END = '// --- end SR-05 scheduler';
const a = src.indexOf(START);
const b = src.indexOf(END);
if (a === -1 || b === -1) {
	console.error('Could not find the SR-05 scheduler sentinels in js/sano.js');
	process.exit(1);
}
const block = src.slice(a, b);

// Expose the block's declarations by returning them out of a Function wrapper.
const exported = [
	'reviewInterval',
	'isRecallStrength',
	'scheduleReview',
	'exerciseGrade',
	'legacyLevelToInterval',
	'GRADE',
	'DEFAULT_EASE',
	'MIN_EASE',
	'MAX_EASE',
	'RECALL_INTERVAL',
	'LEGACY_LEVEL_INTERVALS',
];
const S = new Function(block + '\nreturn { ' + exported.join(', ') + ' };')();
const { reviewInterval, isRecallStrength, scheduleReview, exerciseGrade, legacyLevelToInterval, GRADE, DEFAULT_EASE, MIN_EASE, MAX_EASE } = S;

let failures = 0;
function check(name, cond, detail) {
	if (cond) return;
	failures++;
	console.error('FAIL: ' + name + (detail ? ' — ' + detail : ''));
}
function eq(name, got, want) {
	check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
// Apply a grade to a fresh record and return the mutated record.
function after(rec, grade) {
	const r = Object.assign({ ease: DEFAULT_EASE, interval: 0 }, rec);
	scheduleReview(r, grade);
	return r;
}

// --- reviewInterval: an introduced item with no interval yet is due after a day ---
eq('reviewInterval(0) -> 1', reviewInterval({ interval: 0 }), 1);
eq('reviewInterval(5) -> 5', reviewInterval({ interval: 5 }), 5);
eq('reviewInterval(undefined) -> 1', reviewInterval({}), 1);

// --- isRecallStrength: the recognition -> recall boundary sits at RECALL_INTERVAL (3) ---
eq('strength interval 2 = recognition', isRecallStrength({ interval: 2 }), false);
eq('strength interval 3 = recall', isRecallStrength({ interval: 3 }), true);
eq('strength fresh = recognition', isRecallStrength({ interval: 0 }), false);

// --- GOOD: gentle graduation, then multiply by ease; ease unchanged ---
eq('GOOD fresh -> 2', after({ interval: 0 }, GRADE.GOOD).interval, 2);
eq('GOOD 2 -> 5', after({ interval: 2 }, GRADE.GOOD).interval, 5);
eq('GOOD 5 -> 13', after({ interval: 5 }, GRADE.GOOD).interval, 13);
eq('GOOD keeps ease', after({ interval: 5 }, GRADE.GOOD).ease, 2.5);

// --- EASY: bigger stretch and a small ease bump (capped at MAX_EASE) ---
eq('EASY fresh -> 4', after({ interval: 0 }, GRADE.EASY).interval, 4);
eq('EASY raises ease', after({ interval: 5 }, GRADE.EASY).ease, 2.65);
eq('EASY 5 -> 17', after({ interval: 5 }, GRADE.EASY).interval, 17);
eq('EASY ease capped', after({ interval: 5, ease: MAX_EASE }, GRADE.EASY).ease, MAX_EASE);

// --- LAPSE: reset to daily and lower ease (floored at MIN_EASE) ---
eq('LAPSE resets interval', after({ interval: 13, ease: 2.5 }, GRADE.LAPSE).interval, 1);
eq('LAPSE lowers ease', after({ interval: 13, ease: 2.5 }, GRADE.LAPSE).ease, 2.3);
eq('LAPSE ease floored', after({ interval: 1, ease: MIN_EASE }, GRADE.LAPSE).ease, MIN_EASE);

// --- exerciseGrade: a miss always lapses; recall/listening grade above recognition ---
eq('choice correct = GOOD', exerciseGrade({ type: 'choice' }, true), GRADE.GOOD);
eq('choice wrong = LAPSE', exerciseGrade({ type: 'choice' }, false), GRADE.LAPSE);
eq('type correct = EASY', exerciseGrade({ type: 'type' }, true), GRADE.EASY);
eq('wordbank correct = EASY', exerciseGrade({ type: 'wordbank' }, true), GRADE.EASY);
eq('listen choice correct = EASY', exerciseGrade({ type: 'choice', listen: true }, true), GRADE.EASY);
eq('type wrong = LAPSE', exerciseGrade({ type: 'type' }, false), GRADE.LAPSE);

// --- legacyLevelToInterval: the old Leitner ladder, used to migrate old records ---
[1, 1, 3, 7, 14].forEach((want, lvl) => eq('legacy level ' + lvl, legacyLevelToInterval(lvl, true), want));
eq('legacy level clamps high', legacyLevelToInterval(9, true), 14);
eq('legacy not-introduced -> 0', legacyLevelToInterval(2, false), 0);

// --- The value prop: repeated good recall stretches an item well past the old cap ---
const seq = [];
let r = { ease: DEFAULT_EASE, interval: 0 };
for (let i = 0; i < 4; i++) {
	scheduleReview(r, GRADE.GOOD);
	seq.push(r.interval);
}
check(
	'intervals strictly increase',
	seq.every((v, i) => i === 0 || v > seq[i - 1]),
	JSON.stringify(seq),
);
check('stretches past the old 14-day cap', seq[seq.length - 1] > 14, JSON.stringify(seq));
// After one good review it's still recognition; after two it has reached recall.
eq('recognition after 1 good', isRecallStrength({ interval: seq[0] }), false);
eq('recall after 2 goods', isRecallStrength({ interval: seq[1] }), true);
// A lapse anywhere never lengthens the interval.
const strong = { ease: 2.5, interval: 33 };
scheduleReview(strong, GRADE.LAPSE);
check('lapse never lengthens', strong.interval < 33, 'interval=' + strong.interval);

if (failures) {
	console.error(`\n${failures} assertion(s) failed.`);
	process.exit(1);
}
console.log('check-scheduler: all assertions passed');
