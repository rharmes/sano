// SR-05 spaced-repetition scheduler (SM-2-lite) — ported from the old
// tools/check-scheduler.mjs into node:test. Lifts the pure scheduler block out of
// js/sano.js via its `// --- SR-05 … (pure)` sentinels (js/sano.js:7 / :63).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftBlock } from '../lift.mjs';

const S = liftBlock('js/sano.js', '// --- SR-05 spaced-repetition scheduler (SM-2-lite, pure)', '// --- end SR-05 scheduler', [
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
]);
const { reviewInterval, isRecallStrength, scheduleReview, exerciseGrade, legacyLevelToInterval, GRADE, DEFAULT_EASE, MIN_EASE, MAX_EASE } = S;

// Apply a grade to a fresh record and return the mutated record.
function after(rec, grade) {
	const r = Object.assign({ ease: DEFAULT_EASE, interval: 0 }, rec);
	scheduleReview(r, grade);
	return r;
}

test('reviewInterval: an introduced item with no interval yet is due after a day', () => {
	assert.equal(reviewInterval({ interval: 0 }), 1);
	assert.equal(reviewInterval({ interval: 5 }), 5);
	assert.equal(reviewInterval({}), 1);
});

test('isRecallStrength: the recognition→recall boundary sits at RECALL_INTERVAL (3)', () => {
	assert.equal(isRecallStrength({ interval: 2 }), false);
	assert.equal(isRecallStrength({ interval: 3 }), true);
	assert.equal(isRecallStrength({ interval: 0 }), false);
});

test('GOOD: gentle graduation, then multiply by ease; ease unchanged', () => {
	assert.equal(after({ interval: 0 }, GRADE.GOOD).interval, 2);
	assert.equal(after({ interval: 2 }, GRADE.GOOD).interval, 5);
	assert.equal(after({ interval: 5 }, GRADE.GOOD).interval, 13);
	assert.equal(after({ interval: 5 }, GRADE.GOOD).ease, 2.5);
});

test('EASY: bigger stretch and a small ease bump (capped at MAX_EASE)', () => {
	assert.equal(after({ interval: 0 }, GRADE.EASY).interval, 4);
	assert.equal(after({ interval: 5 }, GRADE.EASY).ease, 2.65);
	assert.equal(after({ interval: 5 }, GRADE.EASY).interval, 17);
	assert.equal(after({ interval: 5, ease: MAX_EASE }, GRADE.EASY).ease, MAX_EASE);
});

test('LAPSE: reset to daily and lower ease (floored at MIN_EASE)', () => {
	assert.equal(after({ interval: 13, ease: 2.5 }, GRADE.LAPSE).interval, 1);
	assert.equal(after({ interval: 13, ease: 2.5 }, GRADE.LAPSE).ease, 2.3);
	assert.equal(after({ interval: 1, ease: MIN_EASE }, GRADE.LAPSE).ease, MIN_EASE);
});

test('exerciseGrade: a miss always lapses; recall/listening grade above recognition', () => {
	assert.equal(exerciseGrade({ type: 'choice' }, true), GRADE.GOOD);
	assert.equal(exerciseGrade({ type: 'choice' }, false), GRADE.LAPSE);
	assert.equal(exerciseGrade({ type: 'type' }, true), GRADE.EASY);
	assert.equal(exerciseGrade({ type: 'wordbank' }, true), GRADE.EASY);
	assert.equal(exerciseGrade({ type: 'choice', listen: true }, true), GRADE.EASY);
	assert.equal(exerciseGrade({ type: 'type' }, false), GRADE.LAPSE);
});

test('legacyLevelToInterval: the old Leitner ladder, used to migrate old records', () => {
	[1, 1, 3, 7, 14].forEach((want, lvl) => assert.equal(legacyLevelToInterval(lvl, true), want));
	assert.equal(legacyLevelToInterval(9, true), 14);
	assert.equal(legacyLevelToInterval(2, false), 0);
});

test('value prop: repeated good recall stretches an item well past the old 14-day cap', () => {
	const seq = [];
	const r = { ease: DEFAULT_EASE, interval: 0 };
	for (let i = 0; i < 4; i++) {
		scheduleReview(r, GRADE.GOOD);
		seq.push(r.interval);
	}
	assert.ok(
		seq.every((v, i) => i === 0 || v > seq[i - 1]),
		`intervals should strictly increase: ${JSON.stringify(seq)}`,
	);
	assert.ok(seq[seq.length - 1] > 14, `should stretch past 14: ${JSON.stringify(seq)}`);
	assert.equal(isRecallStrength({ interval: seq[0] }), false);
	assert.equal(isRecallStrength({ interval: seq[1] }), true);
});

test('a lapse never lengthens the interval', () => {
	const strong = { ease: 2.5, interval: 33 };
	scheduleReview(strong, GRADE.LAPSE);
	assert.ok(strong.interval < 33, `interval=${strong.interval}`);
});
