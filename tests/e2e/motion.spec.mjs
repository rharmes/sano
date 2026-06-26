// Engine-level animation coverage — replaces the safaridriver-only check-webkit.mjs and
// runs in Chromium + WebKit (the iOS engine). The always-present footer mascot
// (.footer .sano-idle-head) runs the idle animations on every screen, so boot to home
// WITHOUT the test animation-freeze and inspect it. prefers-reduced-motion is driven with
// page.emulateMedia (the imperative API — reliable across engines).
import { test, expect } from '@playwright/test';
import { boot, seed } from './_helpers.mjs';

const EAR = '.footer .sano-idle-head .sano-ear';
const EYES = '.footer .sano-idle-head .sano-eyes';
const animName = (page, sel) =>
	page
		.locator(sel)
		.first()
		.evaluate((el) => getComputedStyle(el).animationName);

test('the footer mascot idle animation runs when motion is allowed', async ({ page }) => {
	await boot(page, seed.midCourse(), { freezeAnimations: false });
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	const ear = page.locator(EAR).first();
	await expect(ear).toBeVisible();
	const info = await ear.evaluate((el) => {
		const cs = getComputedStyle(el);
		return { name: cs.animationName, state: cs.animationPlayState };
	});
	expect(info.name).toBe('sano-idle-ear-wiggle');
	expect(info.state).toBe('running');
});

test('reduced motion suppresses the rotational idles but keeps the blink', async ({ page }) => {
	await boot(page, seed.midCourse(), { freezeAnimations: false });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
	await expect(page.locator(EYES).first()).toBeVisible();
	expect(await animName(page, EAR)).toBe('none'); // larger rotational idle is suppressed
	expect(await animName(page, EYES)).not.toBe('none'); // the gentle eye-blink stays alive
});
