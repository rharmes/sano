// Dictionary: the browsable list of learned words, each with an audio button.
import { test, expect } from '@playwright/test';
import { boot, seed, openScreen } from './_helpers.mjs';

test('lists learned words with per-word audio buttons', async ({ page }) => {
	await boot(page, seed.dictReady());
	await openScreen(page, page.locator('#nav-dictionary'), '#screen-dictionary');
	await expect(page.locator('#words .audio-inline').first()).toBeVisible();
});

test('navigates back home from the dictionary', async ({ page }) => {
	await boot(page, seed.dictReady());
	await openScreen(page, page.locator('#nav-dictionary'), '#screen-dictionary');
	await openScreen(page, page.locator('#nav-home'), '#screen-home');
});
