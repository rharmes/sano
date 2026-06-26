// Lesson engine: each exercise renderer plays and the lesson reaches the complete screen.
// Seeds isolate a single exercise type so the run is deterministic (see tests/seed.mjs);
// stepLesson (tests/e2e/_helpers.mjs) drives whatever exercise is on screen.
import { test, expect } from '@playwright/test';
import { boot, seed, stepLesson, savedState } from './_helpers.mjs';

async function runToComplete(page) {
	const seen = new Set();
	for (let i = 0; i < 40; i++) {
		const t = await stepLesson(page);
		if (t === 'complete') break;
		seen.add(t);
		await page.waitForTimeout(60);
	}
	await expect(page.locator('#screen-complete')).toBeVisible();
	return seen;
}

test('a recognition (choice) lesson plays to the complete screen and records progress', async ({ page }) => {
	await boot(page, seed.lessonReviewsOnly());
	await page.locator('#daily-lesson').click({ force: true });
	await expect(page.locator('#screen-lesson')).toBeVisible();
	const seen = await runToComplete(page);
	expect([...seen]).toContain('choice');
	await expect(page.locator('#complete-title')).toContainText(/lesson complete/i);
	expect((await savedState(page)).itemsToday).toBeGreaterThan(0);
});

test('a word-bank (recall) exercise renders and can be completed', async ({ page }) => {
	await boot(page, seed.lessonOneReview('maaf-garnuhos-excuse-me-i-m-sorry', 6));
	await page.locator('#daily-lesson').click({ force: true });
	await expect(page.locator('#exercise-wordbank')).toBeVisible();
	await runToComplete(page);
});

test('a type-what-you-know (recall) exercise renders and can be completed', async ({ page }) => {
	await boot(page, seed.lessonOneReview('namaste-hello-goodbye', 6));
	await page.locator('#daily-lesson').click({ force: true });
	await expect(page.locator('#exercise-type')).toBeVisible();
	await runToComplete(page);
});

test('a matching round renders and completes by pairing tiles', async ({ page }) => {
	await boot(page, seed.lessonMatchOnly());
	await page.locator('#daily-lesson').click({ force: true });
	await expect(page.locator('#exercise-match')).toBeVisible();
	const seen = await runToComplete(page);
	expect([...seen]).toContain('match');
});

test('a new-word lesson opens with a warm-up match and includes the speaking step', async ({ page }) => {
	await boot(page, seed.lessonWithNewItems());
	await page.locator('#daily-lesson').click({ force: true });
	await expect(page.locator('#screen-lesson')).toBeVisible();
	const seen = await runToComplete(page);
	expect([...seen]).toContain('match');
	expect([...seen]).toContain('speak');
});
