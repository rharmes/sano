// Admin dashboard: the standalone /admin/ page renders its user list from stub data under
// ?demo=1 (no DB, no auth needed), so the table layout and row actions can be reviewed.
import { test, expect } from '@playwright/test';

test('the admin dashboard renders demo rows', async ({ page }) => {
	await page.goto('/admin/?demo=1');
	const content = page.locator('#admin-content');
	await expect(content).toBeVisible();
	await expect(content).not.toBeEmpty();
	// Each row offers per-account actions (reset password / delete).
	await expect(content.locator('button').first()).toBeVisible();
});
