// Home / path screen: it renders for a returning learner, shows the header state and the
// daily-lesson CTA, draws the path, and never overflows horizontally (the layout check the
// old check-viewports.mjs did, now in real Chromium + WebKit).
import { test, expect } from '@playwright/test';
import { boot, seed } from './_helpers.mjs';

test('renders the path and header for a mid-course learner', async ({ page }) => {
	await boot(page, seed.midCourse());
	await expect(page.locator('#screen-home')).toBeVisible();
	await expect(page.locator('#screen-onboarding')).toBeHidden();
	await expect(page.locator('#streak')).toHaveText('5');
	await expect(page.locator('#name')).toHaveText('Aastha');
	await expect(page.locator('#path .path-node').first()).toBeVisible();
});

test('the daily-lesson CTA invites a lesson when reviews are due', async ({ page }) => {
	await boot(page, seed.midCourse());
	const cta = page.locator('#daily-lesson');
	await expect(cta).toBeVisible();
	await expect(cta).toContainText(/start/i);
});

// Layout regression across the nine mobile widths the old check-viewports.mjs swept, now
// in real browsers: no horizontal overflow, and key elements stay within the viewport.
const WIDTHS = [320, 360, 375, 390, 412, 429, 430, 519, 521];

test('no horizontal overflow across mobile widths', async ({ page }) => {
	await boot(page, seed.midCourse());
	for (const w of WIDTHS) {
		await page.setViewportSize({ width: w, height: 760 });
		await page.reload();
		await page.waitForFunction(() => !!window.Sano);
		await expect(page.locator('#screen-home')).toBeVisible();
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow, `page overflow at ${w}px`).toBeLessThanOrEqual(1);
		for (const sel of ['#progress', '#daily-lesson', '.path-node', '.path-label']) {
			const els = page.locator(sel);
			for (let i = 0; i < (await els.count()); i++) {
				const box = await els.nth(i).boundingBox();
				if (!box || box.width === 0) continue;
				expect(box.x, `${sel} left edge at ${w}px`).toBeGreaterThanOrEqual(-1);
				expect(box.x + box.width, `${sel} right edge at ${w}px`).toBeLessThanOrEqual(w + 1);
			}
		}
	}
});
