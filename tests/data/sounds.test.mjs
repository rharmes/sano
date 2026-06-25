// SOUND_TOPICS content-integrity checks (js/sounds.js, SR-08). Structure only. The key
// guarantee: each drill's `marks` actually occur in some shipped course word's `dev`, so
// no pronunciation topic surfaces an empty example set at runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftGlobals } from '../lift.mjs';

const { SOUND_TOPICS } = liftGlobals('js/sounds.js', ['SOUND_TOPICS']);
const { COURSE } = liftGlobals('js/data.js', ['COURSE']);

const unitIds = new Set(COURSE.map((u) => u.id));
const allDev = COURSE.flatMap((u) => u.items)
	.map((it) => it.dev)
	.join('\n');

test('SOUND_TOPICS: shape + `after` references a real unit + non-empty marks', () => {
	for (const t of SOUND_TOPICS) {
		for (const f of ['id', 'glyph', 'title', 'sub', 'intro', 'tip']) assert.ok(t[f], `${t.id || '?'}: missing ${f}`);
		assert.ok(unitIds.has(t.after), `${t.id}: after '${t.after}' is not a unit id`);
		assert.ok(Array.isArray(t.marks) && t.marks.length, `${t.id}: no marks`);
	}
});

test('SOUND_TOPICS: every topic finds at least one real example in COURSE `dev`', () => {
	for (const t of SOUND_TOPICS) {
		const hit = t.marks.some((m) => allDev.includes(m));
		assert.ok(hit, `${t.id}: no course word's dev contains any of [${t.marks.join(' ')}]`);
	}
});

test('SOUND_TOPIC ids are unique', () => {
	const ids = SOUND_TOPICS.map((t) => t.id);
	assert.equal(new Set(ids).size, ids.length, 'duplicate sound-topic id');
});
