// Streak + forgiveness-freeze logic (js/sano.js registerActivity, SR-09). "Today" is
// frozen by injecting a dayString that returns a fixed day; the real daysBetween is
// injected for the gap math; a fresh `state` is injected per case and mutated in place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftFns } from '../lift.mjs';

const TODAY = '2026-06-25';
const { daysBetween } = liftFns('js/sano.js', ['daysBetween']);

// Build a registerActivity bound to a given state. registerActivity reads "today" via
// dayString(new Date()); the injected dayString ignores its argument and returns TODAY.
function reg(state) {
	const { registerActivity } = liftFns('js/sano.js', ['registerActivity'], {
		preamble: 'let streakFreezeJustUsed;', // assigned inside; kept local to the wrapper
		inject: { state, dayString: () => TODAY, daysBetween },
	});
	registerActivity();
}

const fresh = (over) => Object.assign({ streak: 0, streakFreezes: 1, lastActivityDay: null, itemsToday: 0 }, over);

test('first activity ever starts the streak at 1 and resets the daily counter', () => {
	const s = fresh({ itemsToday: 9 });
	reg(s);
	assert.equal(s.streak, 1);
	assert.equal(s.lastActivityDay, TODAY);
	assert.equal(s.itemsToday, 0);
});

test('a consecutive day increments the streak', () => {
	const s = fresh({ streak: 3, lastActivityDay: '2026-06-24' }); // gap 1
	reg(s);
	assert.equal(s.streak, 4);
});

test('one missed day is forgiven by spending a freeze (SR-09)', () => {
	const s = fresh({ streak: 3, streakFreezes: 1, lastActivityDay: '2026-06-23' }); // gap 2
	reg(s);
	assert.equal(s.streak, 4);
	assert.equal(s.streakFreezes, 0);
});

test('a missed day with no freeze resets the streak to 1', () => {
	const s = fresh({ streak: 7, streakFreezes: 0, lastActivityDay: '2026-06-23' }); // gap 2
	reg(s);
	assert.equal(s.streak, 1);
});

test('a multi-day gap resets the streak and does not spend a freeze', () => {
	const s = fresh({ streak: 7, streakFreezes: 2, lastActivityDay: '2026-06-20' }); // gap 5
	reg(s);
	assert.equal(s.streak, 1);
	assert.equal(s.streakFreezes, 2);
});

test('a 5-day milestone banks a freeze, capped at 2', () => {
	const s = fresh({ streak: 4, streakFreezes: 0, lastActivityDay: '2026-06-24' }); // -> 5
	reg(s);
	assert.equal(s.streak, 5);
	assert.equal(s.streakFreezes, 1);

	const capped = fresh({ streak: 9, streakFreezes: 2, lastActivityDay: '2026-06-24' }); // -> 10
	reg(capped);
	assert.equal(capped.streak, 10);
	assert.equal(capped.streakFreezes, 2);
});

test('same-day activity does not change the streak', () => {
	const s = fresh({ streak: 5, lastActivityDay: TODAY });
	reg(s);
	assert.equal(s.streak, 5);
});
