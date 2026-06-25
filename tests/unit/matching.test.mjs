// Typed-answer grading helpers (js/sano.js): normalize / lenientEquals / editDistance.
// These decide whether a learner's typed Nepali counts as correct, so the typo-tolerance
// thresholds matter. Pure functions, lifted by name (no app-code edits).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftFns } from '../lift.mjs';

const { normalize, lenientEquals, editDistance } = liftFns('js/sano.js', ['normalize', 'lenientEquals', 'editDistance']);

test('normalize: lowercases, strips punctuation, collapses whitespace', () => {
	assert.equal(normalize('  Namaste!  '), 'namaste');
	assert.equal(normalize('K-cha,  Cha?'), 'kcha cha');
	assert.equal(normalize('Tapaaiko  naam'), 'tapaaiko naam');
	assert.equal(normalize(''), '');
});

test('editDistance: classic Levenshtein values', () => {
	assert.equal(editDistance('', ''), 0);
	assert.equal(editDistance('abc', 'abc'), 0);
	assert.equal(editDistance('abc', 'abd'), 1);
	assert.equal(editDistance('kitten', 'sitting'), 3);
	assert.equal(editDistance('a', ''), 1);
});

test('lenientEquals: exact after normalization regardless of the typos flag', () => {
	assert.equal(lenientEquals('Namaste!', 'namaste', false), true);
	assert.equal(lenientEquals('  na  maste ', 'na maste', false), true);
	assert.equal(lenientEquals('Dherai', 'dhanyabaad', false), false);
});

test('lenientEquals: typo tolerance scales with the expected length', () => {
	// length 9 (>4) => tolerance 1: a one-character slip passes...
	assert.equal(lenientEquals('dhanyabaad', 'dhanyabad', true), true);
	// ...but the same near-miss fails when typos are not allowed.
	assert.equal(lenientEquals('dhanyabaad', 'dhanyabad', false), false);
	// length 3 (<=4) => tolerance 0: even one typo fails.
	assert.equal(lenientEquals('chha', 'cha', true), false);
	// length >10 => tolerance 2.
	assert.equal(lenientEquals('namaskaarmaa', 'namaskaarma', true), true);
});
