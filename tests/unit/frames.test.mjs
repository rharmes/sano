// SR-05 depth (T28/T38): the pure alternate-frame helpers. An item may carry extra example
// sentences in `frames`; reviews rotate through them over the SAME spaced-repetition record
// (keyed by item id), so a known word is practiced in varied contexts without new path units.
// T38 gates that rotation: alternates only once the item has GRADUATED, and only frames that
// spring at most FRAME_MAX_NEW_WORDS never-seen words on the learner (canonical otherwise).
// These lift straight out of js/sano.js (the `// --- SR-05 depth … (pure)` block).
import test from 'node:test';
import assert from 'node:assert/strict';
import { liftBlock } from '../lift.mjs';

const { itemFrames, frameWordKey, knownWordSet, eligibleFrames, rotateFrame, FRAME_MAX_NEW_WORDS } = liftBlock(
	'js/sano.js',
	'// --- SR-05 depth: alternate frames (pure) ---',
	'// --- end SR-05 depth ---',
	['itemFrames', 'frameWordKey', 'knownWordSet', 'eligibleFrames', 'rotateFrame', 'FRAME_MAX_NEW_WORDS'],
);

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

const graduated = { intro: true, seen: 5, graduated: true };
const learning = { intro: true, seen: 2, graduated: false };

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

test('frameWordKey: strips punctuation and case like normalize() does per word', () => {
	assert.equal(frameWordKey('Chhan?'), 'chhan');
	assert.equal(frameWordKey('Koh-thaa'), 'kohthaa');
	assert.equal(frameWordKey('?'), ''); // pure punctuation keys to nothing
});

test('knownWordSet: canonical words of INTRODUCED items only, keyed like tiles', () => {
	const course = [
		{
			id: 'u1',
			items: [
				{ id: 'a', np: 'Chaar' },
				{ id: 'b', np: 'Yo kothaa ho?' },
				{ id: 'c', np: 'Paanch' },
			],
		},
	];
	const known = knownWordSet(course, { a: { intro: true }, b: { intro: true }, c: { intro: false } });
	assert.deepEqual([...known].sort(), ['chaar', 'ho', 'kothaa', 'yo']); // c not introduced → paanch unknown
});

test('eligibleFrames: a still-learning item is ALWAYS its canonical sentence', () => {
	const known = new Set(['n1', 'n2']); // even with every frame word known…
	assert.deepEqual(
		eligibleFrames(framed, learning, known).map((f) => f.audioId),
		['v9-x'],
	);
	// …and so is an item with no record at all (never seen).
	assert.deepEqual(
		eligibleFrames(framed, undefined, known).map((f) => f.audioId),
		['v9-x'],
	);
});

test('eligibleFrames: graduated → alternates allowed, but only within the new-word budget', () => {
	const item = {
		id: 'chaar-four',
		np: 'Chaar',
		dev: 'च',
		pron: 'ch',
		en: 'Four',
		frames: [
			{ dev: 'D1', np: 'Chaar kothaa chhan', pron: 'p1', en: 'There are four rooms' }, // 2 unknown (kothaa, chhan)
			{ dev: 'D2', np: 'Malaai chaar chiyaa ra dui samosa dinus', pron: 'p2', en: 'Give me four teas and two samosas' }, // 5 unknown
		],
	};
	const known = new Set(['chaar', 'dui']);
	const eligible = eligibleFrames(item, graduated, known);
	assert.deepEqual(
		eligible.map((f) => f.np),
		['Chaar', 'Chaar kothaa chhan'], // ≤2 new words passes, 5 new words waits
	);
	// Once the frame's words are introduced elsewhere, the bigger frame becomes eligible too.
	const later = new Set(['chaar', 'dui', 'malaai', 'chiyaa', 'ra', 'samosa', 'dinus']);
	assert.equal(eligibleFrames(item, graduated, later).length, 3);
});

test('eligibleFrames: unknown-counting ignores punctuation and case', () => {
	const item = {
		id: 'x',
		np: 'Ke',
		dev: 'क',
		pron: 'k',
		en: 'What',
		frames: [{ dev: 'D1', np: 'Yo KE ho?', pron: 'p1', en: 'What is this?' }],
	};
	const known = new Set(['yo', 'ke', 'ho']);
	assert.equal(eligibleFrames(item, graduated, known).length, 2); // "KE" and "ho?" resolve to known keys
});

test('rotateFrame: index 0 on the very first exposure, then one per review, wrapping', () => {
	const frames = itemFrames(framed);
	assert.equal(rotateFrame(frames, 0).audioId, 'v9-x'); // seen 0 = a new word's first lesson
	assert.equal(rotateFrame(frames, 1).audioId, 'v9-x-f1');
	assert.equal(rotateFrame(frames, 2).audioId, 'v9-x-f2');
	assert.equal(rotateFrame(frames, 3).audioId, 'v9-x'); // wraps back to canonical
	assert.equal(rotateFrame(frames, 4).audioId, 'v9-x-f1');
	// A gated-down list just rotates over what's eligible.
	assert.equal(rotateFrame([frames[0]], 7).audioId, 'v9-x');
});

test('the new-word budget is the agreed "one or two new words"', () => {
	assert.equal(FRAME_MAX_NEW_WORDS, 2);
});
