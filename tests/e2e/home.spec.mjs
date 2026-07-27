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
//
// T56: this used to reload the page per width and then call boundingBox() once per matched
// element — 216 elements on a mid-course path, so ~1,900 IPC round trips plus 9 navigations.
// It took ~15s locally and crossed Playwright's 60s timeout under CI contention (two browser
// projects sharing a single-threaded php -S), failing about half of all runs. Two changes:
// measure every element for a width in ONE in-page evaluate, and resize in place instead of
// navigating. Resizing is faithful because the app re-renders the path on resize (the
// debounced handler in js/sano.js) — and rather than wait out that 150ms debounce, the test
// calls window.Sano.renderHome(), the very function the handler calls, so the re-render is
// synchronous and there is no timing to lose a race to.
const WIDTHS = [320, 360, 375, 390, 412, 429, 430, 519, 521];
const BOUNDED = ['#progress', '#daily-lesson', '.path-node', '.path-label'];

// Returns every layout violation at the current viewport, so one run reports all of them
// rather than stopping at the first. Also asserts the screen actually rendered — otherwise
// an empty home screen would yield zero elements and pass vacuously.
const violationsAt = (page, width, sels) =>
	page.evaluate(
		({ w, selectors }) => {
			const out = [];
			const home = document.getElementById('screen-home');
			if (!home || home.classList.contains('hide')) out.push('#screen-home is not showing');
			if (!document.querySelectorAll('.path-node').length) out.push('no path nodes rendered');
			const de = document.documentElement;
			const overflow = de.scrollWidth - de.clientWidth;
			if (overflow > 1) out.push(`page overflows by ${overflow}px`);
			for (const sel of selectors) {
				[...document.querySelectorAll(sel)].forEach((el, i) => {
					const r = el.getBoundingClientRect();
					if (!r.width) return; // hidden / not laid out — the old boundingBox check skipped these too
					if (r.x < -1) out.push(`${sel}[${i}] left edge at ${r.x.toFixed(1)}`);
					if (r.x + r.width > w + 1) out.push(`${sel}[${i}] right edge at ${(r.x + r.width).toFixed(1)}, past ${w}`);
				});
			}
			return out;
		},
		{ w: width, selectors: sels },
	);

test('no horizontal overflow across mobile widths', async ({ page }) => {
	await boot(page, seed.midCourse());
	await expect(page.locator('#screen-home')).toBeVisible();
	for (const w of WIDTHS) {
		await page.setViewportSize({ width: w, height: 760 });
		await page.evaluate(() => window.Sano.renderHome());
		expect(await violationsAt(page, w, BOUNDED), `layout at ${w}px`).toEqual([]);
	}
});

// The sweep above re-renders in place, so cover the other path too — a cold load at the
// narrowest width — without paying for nine navigations to do it.
test('a cold load at the narrowest width has no overflow', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 760 });
	await boot(page, seed.midCourse());
	await expect(page.locator('#screen-home')).toBeVisible();
	expect(await violationsAt(page, 320, BOUNDED), 'layout on a cold load at 320px').toEqual([]);
});
