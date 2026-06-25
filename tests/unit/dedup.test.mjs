// The tap-the-pairs dedup invariant (js/sano.js uniquePairItems): a match/listenMatch
// bundle must never hold two tiles with the same romanization or English, or a correct
// pairing could grade as wrong (see @docs/architecture.md "Dedup invariant"). Pure fn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftFns } from '../lift.mjs';

const { uniquePairItems } = liftFns('js/sano.js', ['uniquePairItems']);

test('drops later items that collide on romanization or English (case-insensitive)', () => {
	const items = [
		{ id: 'a', np: 'Ho', en: 'Yes' },
		{ id: 'b', np: 'ho', en: 'Yeah' }, // same np as a -> dropped
		{ id: 'c', np: 'Hoina', en: 'yes' }, // same en as a -> dropped
		{ id: 'd', np: 'Pani', en: 'Also' }, // unique -> kept
	];
	assert.deepEqual(
		uniquePairItems(items).map((i) => i.id),
		['a', 'd'],
	);
});

test('keeps the first occurrence and preserves order', () => {
	const items = [
		{ id: '1', np: 'K', en: 'A' },
		{ id: '2', np: 'L', en: 'B' },
		{ id: '3', np: 'K', en: 'C' },
	];
	assert.deepEqual(
		uniquePairItems(items).map((i) => i.id),
		['1', '2'],
	);
});

test('a collision-free bundle is returned intact', () => {
	const items = [
		{ id: '1', np: 'A', en: 'a' },
		{ id: '2', np: 'B', en: 'b' },
	];
	assert.equal(uniquePairItems(items).length, 2);
});
