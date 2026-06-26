// Story dialogue player (SR-01): open the unlocked "Meeting Pyaro" conversation, exercise
// the tap-to-translate gloss, then play through to the comprehension quiz and finish.
import { test, expect } from '@playwright/test';
import { boot, seed, openScreen } from './_helpers.mjs';

async function openConversation(page) {
	await boot(page, seed.dialogueReady());
	// Path nodes animate (an infinite "bob"); openScreen clicks-and-verifies with retry so a
	// click that lands mid-animation can't leave the dialogue unopened.
	await openScreen(page, page.locator('#path .path-node.dialogue').first(), '#screen-dialogue');
}

test('lines are romanized with tappable, underlined words', async ({ page }) => {
	await openConversation(page);
	await expect(page.locator('#dialogue-thread .gloss-word').first()).toBeVisible();
});

test('tapping a word pops its English and it dismisses again', async ({ page }) => {
	await openConversation(page);
	const word = page.locator('#dialogue-thread .gloss-word').first();
	// force: the tap spawns an overlapping popover, which otherwise makes Playwright's
	// post-click hit-test retry until it times out (WebKit). Visibility is asserted above.
	await word.click({ force: true });
	const pop = page.locator('.gloss-pop');
	await expect(pop).toBeVisible();
	await expect(pop).not.toBeEmpty();
	await page.keyboard.press('Escape');
	await expect(pop).toBeHidden();
});

test('the popover never overflows the viewport at 320px', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await openConversation(page);
	await page.locator('#dialogue-thread .gloss-word').first().click({ force: true });
	const pop = page.locator('.gloss-pop');
	await expect(pop).toBeVisible();
	const box = await pop.boundingBox();
	expect(box.x).toBeGreaterThanOrEqual(-1);
	expect(box.x + box.width).toBeLessThanOrEqual(321);
});

test('play through the conversation and quiz to the complete screen', async ({ page }) => {
	await openConversation(page);
	// Reveal every line, then advance into the quiz. (force — see openConversation.)
	const advance = page.locator('#dialogue-advance');
	for (let i = 0; i < 30; i++) {
		if (await page.locator('#dialogue-quiz').isVisible()) break;
		if (await advance.isVisible()) await advance.click({ force: true });
		await page.waitForTimeout(120);
	}
	await expect(page.locator('#dialogue-quiz')).toBeVisible();
	// Answer each question correctly until the conversation completes.
	for (let i = 0; i < 12; i++) {
		if (await page.locator('#screen-complete').isVisible()) break;
		await page.locator('#dialogue-choices button[data-correct="true"]').first().click({ force: true });
		await page.locator('#dialogue-continue').click({ force: true });
		await page.waitForTimeout(120);
	}
	await expect(page.locator('#screen-complete')).toBeVisible();
	await expect(page.locator('#complete-title')).toContainText(/conversation complete/i);
});
