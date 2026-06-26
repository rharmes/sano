// COURSE content-integrity checks (js/data.js). Structure only — never the wording of
// the AI-drafted np/pron/dev/en/usage/goal strings (those are Ross's to review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftGlobals } from '../lift.mjs';

const { COURSE } = liftGlobals('js/data.js', ['COURSE']);
const allItems = COURSE.flatMap((u) => u.items);

test('COURSE: a non-empty array of units', () => {
	assert.ok(Array.isArray(COURSE) && COURSE.length > 0);
});

test('COURSE: unit ids are present and unique', () => {
	const ids = COURSE.map((u) => u.id);
	for (const id of ids) assert.ok(id && typeof id === 'string', `bad unit id: ${JSON.stringify(id)}`);
	assert.equal(new Set(ids).size, ids.length, 'duplicate unit id');
});

test('COURSE: every unit has title, a valid kind, a goal, and items', () => {
	for (const u of COURSE) {
		assert.ok(u.title, `${u.id}: missing title`);
		assert.ok(u.kind === 'phrases' || u.kind === 'vocab', `${u.id}: bad kind ${JSON.stringify(u.kind)}`);
		assert.ok(typeof u.goal === 'string' && u.goal.length, `${u.id}: missing goal`);
		assert.ok(Array.isArray(u.items) && u.items.length, `${u.id}: no items`);
	}
});

test('COURSE: all item ids are globally unique', () => {
	const seen = new Set();
	const dups = [];
	for (const it of allItems) {
		if (seen.has(it.id)) dups.push(it.id);
		seen.add(it.id);
	}
	assert.deepEqual(dups, [], `duplicate item ids: ${dups.join(', ')}`);
});

test('COURSE: every item has non-empty id/dev/pron/en', () => {
	// `np` is intentionally absent from the data now — it is derived from `dev` at load by
	// js/romanize.js (asserted in tests/data/romanize-coverage.test.mjs).
	for (const it of allItems) {
		for (const f of ['id', 'dev', 'pron', 'en']) {
			assert.ok(typeof it[f] === 'string' && it[f].trim().length, `${it.id || '?'}: missing ${f}`);
		}
	}
});

test('COURSE: phrases items carry a usage note; vocab items carry an emoji', () => {
	for (const u of COURSE) {
		for (const it of u.items) {
			if (u.kind === 'vocab') assert.ok(it.emoji, `${it.id}: vocab item missing emoji`);
			else assert.ok(it.usage, `${it.id}: phrases item missing usage`);
		}
	}
});
