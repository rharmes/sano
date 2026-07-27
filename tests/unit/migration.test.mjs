// State migration (js/sano.js): defaultState / normalizeState / migrateV1State /
// migrateV2State. This is the highest-risk path for silently corrupting a real user's saved
// progress, so it gets thorough coverage. Deps (COURSE, a localStorage stub, scheduler
// constants) are injected. v3 is the SR-05 relaunch: a v2 blob is FRESH-STARTED (identity +
// streak kept, learning progress reset) because the engine and course structure changed.
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
	return liftFns('js/sano.js', ['defaultState', 'normalizeState', 'migrateV1State', 'migrateV2State'], {
		inject: { COURSE, localStorage, DEFAULT_EASE, legacyLevelToInterval, LESSON_NEW_ITEMS: 5, STATE_KEY: 'sano.state.v1', console },
	});
}

test('defaultState: a fresh v3 record', () => {
	const { defaultState } = lift();
	const s = defaultState();
	assert.equal(s.version, 3);
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
	assert.equal(s.version, 3);
	assert.equal(s.name, 'Aastha');
	assert.equal(s.streakFreezes, 1);
	assert.ok(s.items && s.dialoguesDone && s.soundsDone);
});

test('normalizeState: a __proto__ key in the blob cannot replace the prototype', () => {
	const { normalizeState } = lift();
	// JSON.parse creates an OWN property called __proto__; Object.assign then copies it by
	// assignment, which runs the setter and swaps the object's prototype rather than
	// storing a key. Only this account's own synced blob can carry one, so it is
	// self-inflicted — but a state object with a replaced prototype misbehaves in ways
	// nothing in the app would explain, and the guard costs one line.
	const blob = JSON.parse('{"name":"Aastha","streak":5,"__proto__":{"polluted":true}}');
	const s = normalizeState(blob);

	assert.equal(Object.getPrototypeOf(s), Object.prototype, 'the prototype must be untouched');
	assert.equal(s.polluted, undefined);
	assert.equal({}.polluted, undefined, 'and nothing may leak into Object.prototype');
	// The legitimate fields still arrive.
	assert.equal(s.name, 'Aastha');
	assert.equal(s.streak, 5);
});

test('normalizeState: derives interval/ease from a legacy Leitner level, then drops it', () => {
	const { normalizeState } = lift();
	// A (hypothetical) v3 record still carrying a legacy `level` exercises the derivation loop.
	const s = normalizeState({ version: 3, items: { foo: { level: 2, intro: true, seen: 3, correct: 2 } } });
	const r = s.items.foo;
	assert.equal(r.interval, legacyLevelToInterval(2, true)); // 3
	assert.equal(r.ease, DEFAULT_EASE);
	assert.ok(!('level' in r));
	assert.equal(r.seen, 3); // existing counters preserved
	assert.equal(r.graduated, false); // new SR-05 fields backfilled
	assert.equal(r.recalls, 0);
});

test('normalizeState: leaves an existing interval/ease untouched', () => {
	const { normalizeState } = lift();
	const s = normalizeState({ version: 3, items: { bar: { interval: 12, ease: 2.1, intro: true } } });
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

test('migrateV2State: SR-05 fresh start keeps identity + streak, resets learning progress', () => {
	const { migrateV2State } = lift();
	const out = migrateV2State({
		version: 2,
		name: 'Aastha',
		onboarded: true,
		streak: 9,
		streakFreezes: 2,
		lastActivityDay: '2026-06-01',
		itemsToday: 5,
		itemsTotal: 300,
		items: { foo: { intro: true, interval: 40, graduated: true } },
		dialoguesDone: { 'greet-pyaro': true },
		soundsDone: { aspiration: true },
	});
	assert.equal(out.version, 3);
	// Identity + habit + lifetime tally kept.
	assert.equal(out.name, 'Aastha');
	assert.equal(out.onboarded, true);
	assert.equal(out.streak, 9);
	assert.equal(out.streakFreezes, 2);
	assert.equal(out.lastActivityDay, '2026-06-01');
	assert.equal(out.itemsTotal, 300);
	// Learning progress wiped — everyone relearns from unit 1.
	assert.deepEqual(out.items, {});
	assert.deepEqual(out.dialoguesDone, {});
	assert.deepEqual(out.soundsDone, {});
	assert.equal(out.itemsToday, 0);
});

test('normalizeState routes a v1 blob through both migrations to a v3 fresh start', () => {
	const { normalizeState } = lift();
	const unit = COURSE[0];
	const s = normalizeState({ version: 1, items: {}, units: { [unit.id]: { lessonsDone: 1 } }, name: 'Ram', streak: 7 });
	assert.equal(s.version, 3);
	assert.equal(s.name, 'Ram'); // identity survives the chain
	assert.equal(s.streak, 7);
	assert.deepEqual(s.items, {}); // …but the fresh start reset learning progress
});
