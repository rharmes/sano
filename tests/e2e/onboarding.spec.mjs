// First-run onboarding: the scripted Sano conversation captures a name and finishes to the
// home screen. Drives the shortest path (new learner, skip the cloud account).
import { test, expect } from '@playwright/test';
import { boot, savedState } from './_helpers.mjs';

test('first run captures a name and finishes onboarding to home', async ({ page }) => {
	await boot(page); // no saved state -> the first-run flow plays
	await expect(page.locator('#screen-onboarding')).toBeVisible();

	// Name step: type a name and submit.
	await page.locator('#onboard-thread .onboard-input').fill('Aastha');
	await page.locator('#onboard-controls .onboard-primary').click();
	await expect(page.locator('#name')).toHaveText('Aastha'); // header reflects the saved name

	// Placement: brand-new learner, then decline the cloud account, then finish.
	await page.locator('.onboard-choices button', { hasText: 'just starting out' }).click();
	await page.locator('.onboard-choices button', { hasText: 'Not right now' }).click();
	await page.locator('#onboard-controls .onboard-primary', { hasText: 'Continue' }).click();

	await expect(page.locator('#screen-home')).toBeVisible();
	const s = await savedState(page);
	expect(s.name).toBe('Aastha');
	expect(s.onboarded).toBe(true);
});
