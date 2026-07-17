// T33: "accept either gloss" grading. A phrase with two interchangeable English meanings
// ("Excuse me / I'm sorry") should accept EITHER when the learner builds/types the English
// (the np-en word-bank direction). Items opt in with `enEither: true` (split the `en` on
// " / ") or an explicit `enAlt` list (for meanings whose slash sits mid-phrase). These pure
// helpers lift straight out of js/sano.js; an active alternate frame (T28) still grades
// against its own single meaning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { liftFns } from '../lift.mjs';

const { acceptedEnglish, stripParens, normalize, lenientEquals, editDistance } = liftFns('js/sano.js', [
	'acceptedEnglish',
	'stripParens',
	'normalize',
	'lenientEquals',
	'editDistance',
]);

// Mirror checkExercise's np-en decision: accept the built English if it matches ANY gloss.
const grades = (given, ex) => acceptedEnglish(ex).some((answer) => lenientEquals(given, answer, false));
// The base frame carries the item's own meaning (buildFrames sets frame.en = item.en).
const baseEx = (item) => ({ item, frame: { en: item.en } });

test('acceptedEnglish: enEither splits the en on " / "', () => {
	const ex = baseEx({ en: "Excuse me / I'm sorry", enEither: true });
	assert.deepEqual(acceptedEnglish(ex), ['Excuse me', "I'm sorry"]);
});

test('acceptedEnglish: enEither handles three-way meanings', () => {
	const ex = baseEx({ en: 'Yes / Is / Has', enEither: true });
	assert.deepEqual(acceptedEnglish(ex), ['Yes', 'Is', 'Has']);
});

test('acceptedEnglish: a register aside is dropped from the split gloss', () => {
	const ex = baseEx({ en: 'Yes (polite) / Pardon?', enEither: true });
	assert.deepEqual(acceptedEnglish(ex), ['Yes', 'Pardon?']);
});

test('acceptedEnglish: enAlt lists explicit glosses for a mid-phrase slash', () => {
	const ex = baseEx({ en: 'Do you learn / study? (polite)', enAlt: ['Do you learn?', 'Do you study?'] });
	assert.deepEqual(acceptedEnglish(ex), ['Do you learn?', 'Do you study?']);
});

test('acceptedEnglish: an unflagged multi-gloss item is NOT split (unchanged behavior)', () => {
	const ex = baseEx({ en: 'On / Above / Up' });
	assert.deepEqual(acceptedEnglish(ex), ['On / Above / Up']);
});

test('acceptedEnglish: a plain single-meaning item returns just its meaning', () => {
	const ex = baseEx({ en: 'Water' });
	assert.deepEqual(acceptedEnglish(ex), ['Water']);
});

test('acceptedEnglish: an active alternate frame grades against its own meaning only', () => {
	// frame.en differs from item.en → this is a T28 alternate sentence, not the canonical.
	const ex = { item: { en: "Excuse me / I'm sorry", enEither: true }, frame: { en: 'I said sorry to him' } };
	assert.deepEqual(acceptedEnglish(ex), ['I said sorry to him']);
});

test('grading: either gloss is accepted, a partial or wrong answer is not', () => {
	const ex = baseEx({ en: "Excuse me / I'm sorry", enEither: true });
	assert.ok(grades('Excuse me', ex));
	assert.ok(grades("I'm sorry", ex)); // the apostrophe is normalized away
	assert.ok(grades('excuse me', ex)); // case-insensitive
	assert.ok(!grades('sorry', ex)); // a fragment of a gloss is not enough
	assert.ok(!grades('Hello', ex)); // an unrelated answer
	assert.ok(!grades("Excuse me I'm sorry", ex)); // both glosses jammed together is not a gloss
});

test('grading: enAlt mid-phrase glosses each grade correctly', () => {
	const ex = baseEx({ en: 'Do you learn / study? (polite)', enAlt: ['Do you learn?', 'Do you study?'] });
	assert.ok(grades('Do you learn', ex)); // punctuation normalized away
	assert.ok(grades('do you study', ex));
	assert.ok(!grades('study', ex));
});

test('grading: an unflagged multi-gloss item still requires the whole string (regression guard)', () => {
	const ex = baseEx({ en: 'On / Above / Up' });
	assert.ok(!grades('On', ex)); // not opted in → no split, so a single word is wrong
	assert.ok(grades('On Above Up', ex)); // the full string (slash stripped by normalize) matches
});
