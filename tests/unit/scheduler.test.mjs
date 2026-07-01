// SR-05 spaced-repetition scheduler (SM-2-lite + learning steps) — lifts the pure
// scheduler block out of js/sano.js via its `// --- SR-05 … (pure)` sentinels
// (js/sano.js top). A new word now climbs a gentle learning ladder and only graduates
// (leaving its unit free to complete) once it has been RECALLED a couple of times.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftBlock } from '../lift.mjs';

const S = liftBlock('js/sano.js', '// --- SR-05 spaced-repetition scheduler (SM-2-lite, pure)', '// --- end SR-05 scheduler', [
	'reviewInterval',
	'isRecallStrength',
	'isGraduated',
	'nextLearningStep',
	'scheduleReview',
	'exerciseGrade',
	'legacyLevelToInterval',
	'GRADE',
	'DEFAULT_EASE',
	'MIN_EASE',
	'MAX_EASE',
	'RECALL_INTERVAL',
	'GRADUATE_RECALLS',
	'GRADUATE_MIN_INTERVAL',
	'LEARNING_STEPS',
	'LEGACY_LEVEL_INTERVALS',
]);
const { reviewInterval, isRecallStrength, isGraduated, nextLearningStep, scheduleReview, exerciseGrade, legacyLevelToInterval } = S;
const { GRADE, DEFAULT_EASE, MIN_EASE, MAX_EASE, RECALL_INTERVAL, GRADUATE_RECALLS, GRADUATE_MIN_INTERVAL } = S;

// Apply a grade to a fresh record and return the mutated record.
function after(rec, grade) {
	const r = Object.assign({ ease: DEFAULT_EASE, interval: 0, recalls: 0, graduated: false }, rec);
	scheduleReview(r, grade);
	return r;
}

// Drive a record through a sequence of grades, returning it after the last.
function sequence(rec, grades) {
	const r = Object.assign({ ease: DEFAULT_EASE, interval: 0, recalls: 0, graduated: false }, rec);
	for (const g of grades) scheduleReview(r, g);
	return r;
}

test('reviewInterval: an introduced item with no interval yet is due after a day', () => {
	assert.equal(reviewInterval({ interval: 0 }), 1);
	assert.equal(reviewInterval({ interval: 5 }), 5);
	assert.equal(reviewInterval({}), 1);
});

test('isRecallStrength: recognition→recall boundary now sits at RECALL_INTERVAL (2)', () => {
	assert.equal(RECALL_INTERVAL, 2);
	assert.equal(isRecallStrength({ interval: 1 }), false);
	assert.equal(isRecallStrength({ interval: 2 }), true);
	assert.equal(isRecallStrength({ interval: 0 }), false);
});

test('nextLearningStep: the gentle 1 → 2 → 4 ladder, capped at the top rung', () => {
	assert.equal(nextLearningStep(0), 2);
	assert.equal(nextLearningStep(1), 2);
	assert.equal(nextLearningStep(2), 4);
	assert.equal(nextLearningStep(4), 4);
	assert.equal(nextLearningStep(9), 4);
});

test('learning GOOD: climb the gentle ladder (2 → 4, capped); no ease bump; never graduates', () => {
	assert.equal(after({ interval: 0 }, GRADE.GOOD).interval, 2);
	assert.equal(after({ interval: 2 }, GRADE.GOOD).interval, 4);
	assert.equal(after({ interval: 4 }, GRADE.GOOD).interval, 4); // capped
	assert.equal(after({ interval: 0 }, GRADE.GOOD).ease, DEFAULT_EASE); // GOOD leaves ease alone
	assert.equal(after({ interval: 4 }, GRADE.GOOD).graduated, false); // recognition alone never graduates
});

test('learning EASY: counts a recall and bumps ease, but stays on the gentle ladder', () => {
	const r = after({ interval: 0 }, GRADE.EASY);
	assert.equal(r.interval, 2);
	assert.equal(r.recalls, 1);
	assert.equal(r.ease, 2.15);
	assert.equal(r.graduated, false); // one recall isn't enough
});

test('graduation: needs GRADUATE_RECALLS recalls AND the spacing gate (interval ≥ 4)', () => {
	// Two spaced recall hits from a word already reviewed once (interval 2).
	const grad = sequence({ interval: 2 }, [GRADE.EASY, GRADE.EASY]);
	assert.equal(grad.recalls, GRADUATE_RECALLS);
	assert.ok(grad.interval >= GRADUATE_MIN_INTERVAL);
	assert.equal(grad.graduated, true);

	// Recognition-only can reach interval 4 but never graduates (no recalls).
	const recogOnly = sequence({}, [GRADE.GOOD, GRADE.GOOD, GRADE.GOOD, GRADE.GOOD]);
	assert.equal(recogOnly.recalls, 0);
	assert.equal(recogOnly.graduated, false);
	assert.ok(recogOnly.interval <= 4, `learning interval should stay capped: ${recogOnly.interval}`);
});

test('graduated: classic SM-2 multiply so a mastered word stretches far out', () => {
	assert.equal(after({ interval: 4, ease: 2.3, graduated: true }, GRADE.GOOD).interval, 9); // round(4 * 2.3)
	assert.equal(after({ interval: 4, ease: 2.3, graduated: true }, GRADE.GOOD).ease, 2.3); // GOOD leaves ease alone
	const easy = after({ interval: 4, ease: 2.3, graduated: true }, GRADE.EASY);
	assert.ok(Math.abs(easy.ease - 2.45) < 1e-9); // +0.15 (float-safe)
	assert.equal(easy.interval, 11); // round(4 * 2.45 * 1.15)
	assert.equal(after({ interval: 4, ease: MAX_EASE, graduated: true }, GRADE.EASY).ease, MAX_EASE); // capped
});

test('LAPSE: reset to daily and lower ease, but never un-graduate a word', () => {
	assert.equal(after({ interval: 13, ease: 2.5 }, GRADE.LAPSE).interval, 1);
	assert.equal(after({ interval: 13, ease: 2.5 }, GRADE.LAPSE).ease, 2.3);
	assert.equal(after({ interval: 1, ease: MIN_EASE }, GRADE.LAPSE).ease, MIN_EASE);
	assert.equal(after({ interval: 13, ease: 2.5, graduated: true }, GRADE.LAPSE).graduated, true);
});

test('isGraduated reflects the record flag', () => {
	assert.equal(isGraduated({ graduated: true }), true);
	assert.equal(isGraduated({ graduated: false }), false);
	assert.equal(isGraduated({}), false);
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

test('value prop: a word stays in frequent rotation until recalled, then stretches past 14', () => {
	// One recognition intro, then repeated spaced recalls: gentle early, long once mastered.
	const seq = [];
	const r = { ease: DEFAULT_EASE, interval: 0, recalls: 0, graduated: false };
	scheduleReview(r, GRADE.GOOD); // day 0 intro (recognition)
	seq.push(r.interval);
	for (let i = 0; i < 4; i++) {
		scheduleReview(r, GRADE.EASY); // spaced recall reviews
		seq.push(r.interval);
	}
	assert.ok(seq[0] <= 4 && seq[1] <= 4, `early intervals stay gentle: ${JSON.stringify(seq)}`);
	assert.equal(r.graduated, true);
	assert.ok(seq[seq.length - 1] > 14, `should stretch past 14 once mastered: ${JSON.stringify(seq)}`);
});
