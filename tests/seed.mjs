// Shared state fixtures for the e2e specs — the SAME seed builders tools/dev-seed.html
// uses, extracted here so the manual dev tool and the automated tests can't drift. Each
// returns a `sano.state.v1` object; a spec installs it with page.addInitScript before the
// app boots (see tests/e2e/_helpers.mjs). COURSE is lifted from js/data.js, so a seed is
// computed in Node with no browser.
import { liftGlobals } from './lift.mjs';

const { COURSE } = liftGlobals('js/data.js', ['COURSE']);

// YYYY-MM-DD for n days ago (mirrors dev-seed.html's day()).
export function day(n) {
	const d = new Date(Date.now() - n * 864e5);
	return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export const rec = (o) => Object.assign({ seen: 4, correct: 4, level: 2, lastSeen: day(0), intro: true }, o);

// Mark whole units as learned-and-settled (intro'd, not due).
function learnUnits(items, from, to, opts) {
	for (let u = from; u <= to; u++) for (const it of COURSE[u].items) items[it.id] = rec(opts);
}

// Make the first `count` items of units [from..to] overdue reviews at mixed levels.
function makeDue(items, from, to, count) {
	let made = 0;
	for (let u = from; u <= to && made < count; u++)
		for (const it of COURSE[u].items) {
			if (made >= count) break;
			items[it.id] = rec({ level: made % 2 ? 2 : 1, correct: 3, lastSeen: day(12) });
			made++;
		}
}

// Mid-course: units 0–2 done, unit 3 current, plenty of due reviews (dev-seed midCourse).
export function midCourse(extra) {
	const items = {};
	learnUnits(items, 0, 2, { level: 3, lastSeen: day(0) });
	const cur = COURSE[3];
	cur.items.forEach((it, i) => {
		if (i < Math.ceil(cur.items.length / 2)) items[it.id] = rec({ level: 1, lastSeen: day(0) });
	});
	makeDue(items, 0, 2, 12);
	return Object.assign(
		{ version: 2, name: 'Aastha', onboarded: true, streak: 5, streakFreezes: 1, lastActivityDay: day(0), itemsToday: 0, itemsTotal: 220, items },
		extra,
	);
}

// Foundations done so the greet-pyaro conversation node unlocks (dev-seed 'dialogue').
export function dialogueReady(extra) {
	const items = {};
	const done = ['basics', 'numbers', 'pronouns', 'family-people', 'introductions'];
	for (const u of COURSE) if (done.includes(u.id)) for (const it of u.items) items[it.id] = rec({ level: 3, lastSeen: day(0) });
	return Object.assign(
		{ version: 2, name: 'Aastha', onboarded: true, streak: 4, streakFreezes: 1, lastActivityDay: day(1), itemsToday: 0, itemsTotal: 30, items },
		extra,
	);
}

// First 8 Basics words introduced, for the dictionary (dev-seed 'dict').
export function dictReady(extra) {
	const items = {};
	COURSE[0].items.slice(0, 8).forEach((it) => (items[it.id] = rec({ level: 1, lastSeen: day(0) })));
	return Object.assign(
		{ version: 2, name: 'Aastha', onboarded: true, streak: 3, streakFreezes: 1, lastActivityDay: day(0), itemsToday: 3, itemsTotal: 40, items },
		extra,
	);
}

// --- single-purpose lesson seeds: each yields a small, deterministically solvable lesson ---

// Every course item learned and settled (introduced, long interval, not due).
function allSettled() {
	const items = {};
	for (const u of COURSE) for (const it of u.items) items[it.id] = rec({ interval: 40, ease: 2.6, lastSeen: day(0) });
	return items;
}
const settled = (items, extra) =>
	Object.assign(
		{ version: 2, name: 'Aastha', onboarded: true, streak: 5, streakFreezes: 1, lastActivityDay: day(1), itemsToday: 0, itemsTotal: 588, items },
		extra,
	);

// A few Basics phrases due at recognition strength (interval < 3) -> a choice-only lesson.
export function lessonReviewsOnly(extra) {
	const items = allSettled();
	for (const it of COURSE[0].items.slice(0, 6)) items[it.id] = rec({ interval: 2, ease: 2.5, lastSeen: day(5), level: 1 });
	return settled(items, extra);
}

// Exactly one item due (everything else settled). interval >= 3 = recall strength, so a
// multi-word phrase becomes word-bank and a single word becomes type-what-you-know.
export function lessonOneReview(itemId, interval = 6) {
	const items = allSettled();
	items[itemId] = rec({ interval, ease: 2.5, lastSeen: day(interval + 5) });
	return settled(items);
}

// Four vocab words due at recognition strength -> a single matching round.
export function lessonMatchOnly() {
	const items = allSettled();
	const numbers = COURSE.find((u) => u.id === 'numbers');
	for (const it of numbers.items.slice(0, 4)) items[it.id] = rec({ interval: 2, ease: 2.5, lastSeen: day(5), level: 1 });
	return settled(items);
}

// Units 0–2 settled, the next unit untouched -> a pure new-word lesson (warm-up match,
// then multiple choice + the skippable speaking step).
export function lessonWithNewItems(extra) {
	const items = {};
	for (let u = 0; u <= 2; u++) for (const it of COURSE[u].items) items[it.id] = rec({ interval: 40, ease: 2.6, lastSeen: day(0) });
	return Object.assign(
		{ version: 2, name: 'Aastha', onboarded: true, streak: 5, streakFreezes: 1, lastActivityDay: day(1), itemsToday: 0, itemsTotal: 220, items },
		extra,
	);
}
