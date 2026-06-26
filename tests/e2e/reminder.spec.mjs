// Daily-reminder modal (R22) layout — the 3rd scenario the old check-viewports.mjs swept.
// It only auto-opens inside an installed PWA, so (like that harness) we force it open and
// assert it fits a 320px viewport and that its time/zone selects are usable. The actual
// "Enable" save goes through a Web Push subscription that no-ops headless, so it's out of
// scope here (covered server-side by the api integration reminder test).
import { test, expect } from '@playwright/test';
import { boot, seed } from './_helpers.mjs';

async function openReminder(page) {
	await boot(page, seed.midCourse());
	// Populate the selects (the app fills them lazily) and open the dialog, mirroring how
	// tools/check-viewports.mjs drove this modal.
	await page.evaluate(() => {
		const hs = document.getElementById('reminder-hour');
		for (let h = 0; h < 24; h++) {
			const o = document.createElement('option');
			o.value = String(h);
			o.textContent = `${h}:00`;
			hs.appendChild(o);
		}
		const ts = document.getElementById('reminder-tz');
		const o = document.createElement('option');
		o.value = 'Asia/Kathmandu';
		o.textContent = 'Asia/Kathmandu';
		ts.appendChild(o);
		document.getElementById('reminder-modal').showModal();
	});
}

test('the reminder modal fits a 320px viewport and its selects work', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await openReminder(page);

	const modal = page.locator('#reminder-modal');
	await expect(modal).toBeVisible();
	const box = await modal.boundingBox();
	expect(box.x).toBeGreaterThanOrEqual(-1);
	expect(box.x + box.width).toBeLessThanOrEqual(321);

	await page.locator('#reminder-hour').selectOption('8');
	await page.locator('#reminder-tz').selectOption('Asia/Kathmandu');
	await expect(page.locator('#reminder-hour')).toHaveValue('8');
	await expect(page.locator('#reminder-tz')).toHaveValue('Asia/Kathmandu');
});
