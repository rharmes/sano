// SR-05 depth (T28): the pure alternate-frame helpers. An item may carry extra example
// sentences in `frames`; reviews rotate through them over the SAME spaced-repetition record
// (keyed by item id), so a known word is practiced in varied contexts without new path units.
// These lift straight out of js/sano.js (the `// --- SR-05 depth … (pure)` block).
import test from 'node:test';
import assert from 'node:assert/strict';
import { liftBlock } from '../lift.mjs';

const { itemFrames, frameForSeen } = liftBlock('js/sano.js', '// --- SR-05 depth: alternate frames (pure) ---', '// --- end SR-05 depth ---', [
	'itemFrames',
	'frameForSeen',
]);

// np/pron are derived at load (js/romanize.js); here we set them by hand like the app would.
const plain = { id: 'w1', dev: 'क', np: 'ka', pron: 'kuh', en: 'A', emoji: '🅰️' };
const framed = {
	id: 'v9-x',
	dev: 'D0',
	np: 'n0',
	pron: 'p0',
	en: 'E0',
	emoji: '🧩',
	frames: [
		{ dev: 'D1', np: 'n1', pron: 'p1', en: 'E1' },
		{ dev: 'D2', np: 'n2', pron: 'p2', en: 'E2' },
	],
};

test('itemFrames: no frames → the canonical frame only (audio id = item id)', () => {
	const f = itemFrames(plain);
	assert.equal(f.length, 1);
	assert.deepEqual(f[0], { dev: 'क', np: 'ka', pron: 'kuh', en: 'A', emoji: '🅰️', audioId: 'w1' });
});

test('itemFrames: canonical + extras with -fN audio ids; emoji only on the canonical', () => {
	const f = itemFrames(framed);
	assert.equal(f.length, 3);
	assert.deepEqual(
		f.map((x) => x.audioId),
		['v9-x', 'v9-x-f1', 'v9-x-f2'],
	);
	assert.equal(f[0].emoji, '🧩'); // the item's own emoji rides its canonical sentence…
	assert.equal(f[1].emoji, undefined); // …but an alternate sentence's meaning may not match it
	assert.equal(f[2].emoji, undefined);
	assert.equal(f[1].np, 'n1'); // derived fields pass straight through
	assert.equal(f[1].en, 'E1');
	assert.equal(f[2].dev, 'D2');
});

test('frameForSeen: introduction stays canonical, then one sentence per review, wrapping', () => {
	assert.equal(frameForSeen(framed, 0).audioId, 'v9-x'); // seen 0 = a new word's first lesson
	assert.equal(frameForSeen(framed, 1).audioId, 'v9-x-f1');
	assert.equal(frameForSeen(framed, 2).audioId, 'v9-x-f2');
	assert.equal(frameForSeen(framed, 3).audioId, 'v9-x'); // wraps back to canonical
	assert.equal(frameForSeen(framed, 4).audioId, 'v9-x-f1');
});

test('frameForSeen: an item with no frames is always its canonical sentence', () => {
	for (const seen of [0, 1, 5, 99]) assert.equal(frameForSeen(plain, seen).audioId, 'w1');
});
