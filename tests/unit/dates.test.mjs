// Date / due-date math (js/sano.js): dayString / daysBetween / daysSince / isDue /
// overdueDays. "Today" is frozen via an injected Date so the relative helpers are
// deterministic; reviewInterval (scheduler) and `state` are injected as deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftFns, liftBlock } from '../lift.mjs';

const { reviewInterval } = liftBlock('js/sano.js', '// --- SR-05 spaced-repetition scheduler (SM-2-lite, pure)', '// --- end SR-05 scheduler', [
	'reviewInterval',
]);

// Freeze "today" at 2026-06-25 (local midnight) for daysSince/isDue/overdueDays.
const FIXED = new Date(2026, 5, 25).getTime();
class FakeDate extends Date {
	constructor(...args) {
		if (args.length === 0) super(FIXED);
		else super(...args);
	}
}
const state = { items: {} };

const { dayString, daysBetween, daysSince, isDue, overdueDays } = liftFns('js/sano.js', ['dayString', 'daysBetween', 'daysSince', 'isDue', 'overdueDays'], {
	inject: { Date: FakeDate, reviewInterval, state },
});

test('dayString: zero-pads month and day', () => {
	assert.equal(dayString(new Date(2026, 0, 5)), '2026-01-05');
	assert.equal(dayString(new Date(2026, 11, 31)), '2026-12-31');
});

test('daysBetween: signed calendar-day difference, DST-safe', () => {
	assert.equal(daysBetween('2026-01-01', '2026-01-08'), 7);
	assert.equal(daysBetween('2026-01-08', '2026-01-01'), -7);
	assert.equal(daysBetween('2026-06-25', '2026-06-25'), 0);
	// Spans the US spring-forward (2026-03-08): a 23-hour day must still count as 1.
	assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
});

test('daysSince: calendar days to frozen today (null => Infinity)', () => {
	assert.equal(daysSince('2026-06-20'), 5);
	assert.equal(daysSince('2026-06-25'), 0);
	assert.equal(daysSince(null), Infinity);
});

test('isDue: an introduced item is due once its interval has elapsed', () => {
	assert.equal(isDue({ intro: true, lastSeen: '2026-06-20', interval: 3 }), true); // 5 >= 3
	assert.equal(isDue({ intro: true, lastSeen: '2026-06-24', interval: 3 }), false); // 1 < 3
	assert.equal(isDue({ intro: false, lastSeen: '2026-01-01', interval: 3 }), false); // not introduced
});

test('overdueDays: days elapsed beyond the review interval (reads state)', () => {
	state.items = { x: { intro: true, lastSeen: '2026-06-20', interval: 3 } };
	assert.equal(overdueDays({ id: 'x' }), 2); // 5 since - 3 interval
});
