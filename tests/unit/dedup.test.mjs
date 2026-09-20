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

// T68: the listening grid dedupes by CLIP as well — a numeral borrows the clip of the word that
// says it, and the two share neither romanization nor English, so uniquePairItems keeps both.
test('uniqueClipItems: a numeral and the word whose clip it borrows never share a listening grid', () => {
	const { uniqueClipItems } = liftFns('js/sano.js', ['uniqueClipItems']);
	const clipOf = (item) => item.says || item.id;
	const items = [
		{ id: 'ek-one', np: 'Ek', en: 'One' },
		{ id: 'numeral-1', np: '१', en: '1', says: 'ek-one' }, // same clip as ek-one -> dropped
		{ id: 'numeral-2', np: '२', en: '2', says: 'dui-two' }, // first on its clip -> kept
		{ id: 'dui-two', np: 'Dui', en: 'Two' }, // same clip as numeral-2 -> dropped
	];
	assert.deepEqual(
		uniquePairItems(items).map((i) => i.id),
		['ek-one', 'numeral-1', 'numeral-2', 'dui-two'], // the text dedupe alone lets all four through
	);
	assert.deepEqual(
		uniqueClipItems(items, clipOf).map((i) => i.id),
		['ek-one', 'numeral-2'],
	);
});
