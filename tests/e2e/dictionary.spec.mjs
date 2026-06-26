// Dictionary: the browsable list of learned words, each with an audio button.
import { test, expect } from '@playwright/test';
import { boot, seed } from './_helpers.mjs';

test('lists learned words with per-word audio buttons', async ({ page }) => {
	await boot(page, seed.dictReady());
	await page.locator('#nav-dictionary').click({ force: true });
	await expect(page.locator('#screen-dictionary')).toBeVisible();
	await expect(page.locator('#words .audio-inline').first()).toBeVisible();
});

test('navigates back home from the dictionary', async ({ page }) => {
	await boot(page, seed.dictReady());
	await page.locator('#nav-dictionary').click({ force: true });
	await expect(page.locator('#screen-dictionary')).toBeVisible();
	await page.locator('#nav-home').click({ force: true });
	await expect(page.locator('#screen-home')).toBeVisible();
});
