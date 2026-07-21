// T13 companion voices: the pure routing helpers. A review is voiced by the companion who
// owns the item's unit on the path (UNIT_VOICES, js/data.js) — but only once that companion
// has a designed voice (CHARACTER_VOICES, js/audio.js); everything else stays Sano's
// default, and new-word introductions are never tagged at all (buildExercises only tags
// review exercises). These lift straight out of js/sano.js (the `// --- T13 … (pure)` block)
// with COURSE / UNIT_VOICES / SanoAudio injected as stubs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { liftBlock, liftGlobals } from '../lift.mjs';

// Mirrors CHARACTER_VOICES in js/audio.js: the six designed voices resolve to their own
// folder, everyone else (incl. the un-voiced hiun/chanchal/phurtilo/lamo) to default.
const VOICED = ['pyaro', 'gyani', 'shanta', 'bahadur', 'rangin', 'thulo'];
const sanoAudioStub = {
	DEFAULT_VOICE: 'default',
	voiceForCharacter: (c) => (VOICED.includes(c) ? c : 'default'),
};

const lift = (COURSE, UNIT_VOICES) =>
	liftBlock(
		'js/sano.js',
		'// --- T13 companion voices (pure) ---',
		'// --- end T13 companion voices ---',
		['itemCompanion', 'reviewCompanion', 'exVoice'],
		{ COURSE, UNIT_VOICES, SanoAudio: sanoAudioStub },
	);

const fakeCourse = [
	{ id: 'u-voiced', items: [{ id: 'a1' }, { id: 'a2' }] },
	{ id: 'u-unvoiced', items: [{ id: 'b1' }] },
	{ id: 'u-unmapped', items: [{ id: 'c1' }] },
];
const fakeVoices = { 'u-voiced': 'pyaro', 'u-unvoiced': 'hiun' };

test('reviewCompanion: an item in a voiced companion’s unit gets that companion', () => {
	const { reviewCompanion } = lift(fakeCourse, fakeVoices);
	assert.equal(reviewCompanion({ id: 'a1' }), 'pyaro');
	assert.equal(reviewCompanion({ id: 'a2' }), 'pyaro');
});

test('reviewCompanion: an un-voiced companion (or unmapped unit) stays Sano (null)', () => {
	const { reviewCompanion } = lift(fakeCourse, fakeVoices);
	assert.equal(reviewCompanion({ id: 'b1' }), null, 'hiun has no designed voice yet');
	assert.equal(reviewCompanion({ id: 'c1' }), null, 'unit missing from UNIT_VOICES');
	assert.equal(reviewCompanion({ id: 'nope' }), null, 'unknown item id');
});

test('exVoice: only a companion-tagged exercise gets a voiceId', () => {
	const { exVoice } = lift(fakeCourse, fakeVoices);
	assert.equal(exVoice({ companion: 'thulo' }), 'thulo');
	assert.equal(exVoice({}), undefined, 'untagged (new-word) exercises play the default voice');
});

// Spot-check against the real data: the pilot pairings hold, and the un-voiced long tail
// stays Sano.
test('real COURSE + UNIT_VOICES: pilot units route to their companions', () => {
	const { COURSE, UNIT_VOICES } = liftGlobals('js/data.js', ['COURSE', 'UNIT_VOICES']);
	const { reviewCompanion } = lift(COURSE, UNIT_VOICES);
	const firstItem = (unitId) => COURSE.find((u) => u.id === unitId).items[0];
	assert.equal(reviewCompanion(firstItem('basics')), 'thulo');
	assert.equal(reviewCompanion(firstItem('meals')), 'shanta');
	assert.equal(reviewCompanion(firstItem('colors')), 'rangin');
	assert.equal(reviewCompanion(firstItem('at-the-shop')), null, 'lamo has no designed voice yet');
});
