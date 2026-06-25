// State migration (js/sano.js): defaultState / normalizeState / migrateV1State. This is
// the highest-risk path for silently corrupting a real user's saved progress, so it gets
// thorough coverage. Deps (COURSE, a localStorage stub, scheduler constants) are injected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftFns, liftBlock, liftGlobals } from '../lift.mjs';

const { COURSE } = liftGlobals('js/data.js', ['COURSE']);
const { DEFAULT_EASE, legacyLevelToInterval } = liftBlock(
	'js/sano.js',
	'// --- SR-05 spaced-repetition scheduler (SM-2-lite, pure)',
	'// --- end SR-05 scheduler',
	['DEFAULT_EASE', 'legacyLevelToInterval'],
);

function makeStore() {
	const store = {};
	return { store, getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] };
}

function lift(localStorage = makeStore()) {
	return liftFns('js/sano.js', ['defaultState', 'normalizeState', 'migrateV1State'], {
		inject: { COURSE, localStorage, DEFAULT_EASE, legacyLevelToInterval, LESSON_NEW_ITEMS: 5, STATE_KEY: 'sano.state.v1', console },
	});
}

test('defaultState: a fresh v2 record', () => {
	const { defaultState } = lift();
	const s = defaultState();
	assert.equal(s.version, 2);
	assert.equal(s.onboarded, false);
	assert.equal(s.streak, 0);
	assert.equal(s.streakFreezes, 1);
	assert.deepEqual(s.items, {});
	assert.deepEqual(s.dialoguesDone, {});
	assert.deepEqual(s.soundsDone, {});
});

test('normalizeState: fills in missing top-level fields', () => {
	const { normalizeState } = lift();
	const s = normalizeState({ name: 'Aastha' });
	assert.equal(s.version, 2);
	assert.equal(s.name, 'Aastha');
	assert.equal(s.streakFreezes, 1);
	assert.ok(s.items && s.dialoguesDone && s.soundsDone);
});

test('normalizeState: derives interval/ease from a legacy Leitner level, then drops it', () => {
	const { normalizeState } = lift();
	const s = normalizeState({ version: 2, items: { foo: { level: 2, intro: true, seen: 3, correct: 2 } } });
	const r = s.items.foo;
	assert.equal(r.interval, legacyLevelToInterval(2, true)); // 3
	assert.equal(r.ease, DEFAULT_EASE);
	assert.ok(!('level' in r));
	assert.equal(r.seen, 3); // existing counters preserved
});

test('normalizeState: leaves an existing interval/ease untouched', () => {
	const { normalizeState } = lift();
	const s = normalizeState({ version: 2, items: { bar: { interval: 12, ease: 2.1, intro: true } } });
	assert.equal(s.items.bar.interval, 12);
	assert.equal(s.items.bar.ease, 2.1);
});

test('migrateV1State: introduces the items covered by completed v1 lessons', () => {
	const { migrateV1State } = lift();
	const unit = COURSE[0];
	const out = migrateV1State({ version: 1, items: {}, units: { [unit.id]: { lessonsDone: 1 } }, lastActivityDay: '2026-06-01' });
	assert.equal(out.version, 2);
	assert.ok(!('units' in out));
	for (const it of unit.items.slice(0, 5)) assert.ok(out.items[it.id]?.intro, `${it.id} should be introduced`);
	assert.ok(!out.items[unit.items[5].id], 'items beyond the completed lesson stay untouched');
});

test('normalizeState routes a v1 blob through the v1 migration', () => {
	const { normalizeState } = lift();
	const unit = COURSE[0];
	const s = normalizeState({ version: 1, items: {}, units: { [unit.id]: { lessonsDone: 1 } } });
	assert.equal(s.version, 2);
	assert.ok(s.items[unit.items[0].id]?.intro);
});
