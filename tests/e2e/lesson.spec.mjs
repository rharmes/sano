// Lesson engine: each exercise renderer plays and the lesson reaches the complete screen.
// Seeds isolate a single exercise type so the run is deterministic (see tests/seed.mjs);
// stepLesson (tests/e2e/_helpers.mjs) drives whatever exercise is on screen.
import { test, expect } from '@playwright/test';
import { boot, seed, stepLesson, savedState, openScreen } from './_helpers.mjs';

async function runToComplete(page) {
	const seen = new Set();
	// Lessons are now a uniform ~18 cards (padded), and a missed card re-queues once, so allow
	// generous headroom before giving up.
	for (let i = 0; i < 80; i++) {
		const t = await stepLesson(page);
		if (t === 'complete') break;
		seen.add(t);
	}
	await expect(page.locator('#screen-complete')).toBeVisible();
	return seen;
}

test('a recognition (choice) lesson plays to the complete screen and records progress', async ({ page }) => {
	await boot(page, seed.lessonReviewsOnly());
	await openScreen(page, page.locator('#daily-lesson'), '#screen-lesson');
	await expect(page.locator('#screen-lesson')).toBeVisible();
	const seen = await runToComplete(page);
	expect([...seen]).toContain('choice');
	await expect(page.locator('#complete-title')).toContainText(/lesson complete/i);
	expect((await savedState(page)).itemsToday).toBeGreaterThan(0);
});

test('a word-bank (recall) exercise renders and can be completed', async ({ page }) => {
	// A graduated multi-word phrase is due; the lesson pads to a uniform length, so word bank
	// appears among the cards (not necessarily first). Step through and assert it rendered.
	await boot(page, seed.lessonOneReview('maaf-garnuhos-excuse-me-i-m-sorry', 6));
	await openScreen(page, page.locator('#daily-lesson'), '#screen-lesson');
	const seen = await runToComplete(page);
	expect([...seen]).toContain('wordbank');
});

test('a type-what-you-know (recall) exercise renders and can be completed', async ({ page }) => {
	// Graduated single words come back as free typing; the padded lesson includes some.
	await boot(page, seed.lessonOneReview('namaste-hello-goodbye', 6));
	await openScreen(page, page.locator('#daily-lesson'), '#screen-lesson');
	const seen = await runToComplete(page);
	expect([...seen]).toContain('type');
});

test('a matching round renders and completes by pairing tiles', async ({ page }) => {
	// Four still-learning vocab words bundle into a matching round; the lesson pads to a uniform
	// length around it, so match appears among the cards (not necessarily first).
	await boot(page, seed.lessonMatchOnly());
	await openScreen(page, page.locator('#daily-lesson'), '#screen-lesson');
	const seen = await runToComplete(page);
	expect([...seen]).toContain('match');
});

test('a new-word lesson opens with a warm-up match and includes the speaking step', async ({ page }) => {
	await boot(page, seed.lessonWithNewItems());
	await openScreen(page, page.locator('#daily-lesson'), '#screen-lesson');
	await expect(page.locator('#screen-lesson')).toBeVisible();
	const seen = await runToComplete(page);
	expect([...seen]).toContain('match');
	expect([...seen]).toContain('speak');
});
