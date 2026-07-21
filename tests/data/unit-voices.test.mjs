// UNIT_VOICES integrity (js/data.js, T13): every COURSE unit is owned by exactly one of
// the ten path companions, the sections are contiguous stretches of the path (that's what
// "the companion beside this stretch quizzes you" means), and buddyOrder in renderPath
// (js/sano.js) walks the same sections in the same order so pocket art and voice agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { liftGlobals, ROOT } from '../lift.mjs';

const { COURSE, UNIT_VOICES } = liftGlobals('js/data.js', ['COURSE', 'UNIT_VOICES']);

const COMPANIONS = ['thulo', 'pyaro', 'shanta', 'gyani', 'chanchal', 'rangin', 'hiun', 'bahadur', 'phurtilo', 'lamo'];

test('UNIT_VOICES: exactly the COURSE unit ids, no strays', () => {
	for (const u of COURSE) assert.ok(UNIT_VOICES[u.id], `${u.id}: unit has no companion`);
	for (const id of Object.keys(UNIT_VOICES))
		assert.ok(
			COURSE.some((u) => u.id === id),
			`${id}: not a COURSE unit`,
		);
});

test('UNIT_VOICES: every value is a known companion', () => {
	for (const [id, c] of Object.entries(UNIT_VOICES)) assert.ok(COMPANIONS.includes(c), `${id}: unknown companion ${JSON.stringify(c)}`);
});

test('UNIT_VOICES: each companion owns one contiguous stretch of the path', () => {
	const order = [];
	for (const u of COURSE) {
		const c = UNIT_VOICES[u.id];
		if (order[order.length - 1] !== c) order.push(c);
	}
	assert.equal(new Set(order).size, order.length, `a companion's section is split: ${order.join(' → ')}`);
});

test('buddyOrder (renderPath) matches the section order of UNIT_VOICES', () => {
	const src = readFileSync(join(ROOT, 'js', 'sano.js'), 'utf8');
	const m = src.match(/const buddyOrder = \[([^\]]*)\]/);
	assert.ok(m, 'buddyOrder not found in js/sano.js');
	const buddyOrder = m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
	const sectionOrder = [];
	for (const u of COURSE) {
		const c = UNIT_VOICES[u.id];
		if (sectionOrder[sectionOrder.length - 1] !== c) sectionOrder.push(c);
	}
	assert.deepEqual(buddyOrder, sectionOrder, 'reorder buddyOrder and UNIT_VOICES together');
});
