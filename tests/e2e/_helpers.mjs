// Shared helpers for the e2e specs. Not a spec itself (no `.spec.` in the name), so
// Playwright's testMatch ignores it.
import { expect } from '@playwright/test';
import * as seed from '../seed.mjs';

export { seed };

// Click a control that should reveal a screen, retrying until the screen appears. The
// app's animated path nodes / CTAs occasionally swallow the first (forced) click under CI
// load — clicking the geometric centre can land just off the handler — so verify the
// outcome and re-click rather than trust a single tap.
export async function openScreen(page, locator, screenSel) {
	const screen = page.locator(screenSel);
	for (let i = 0; i < 4; i++) {
		await locator.click({ force: true }).catch(() => {});
		try {
			await expect(screen).toBeVisible({ timeout: 3000 });
			return;
		} catch {}
	}
	await expect(screen).toBeVisible(); // final attempt — fail loudly if still closed
}

// Seed sano.state.v1 BEFORE the app's deferred scripts run, then load and wait for the
// app global. Pass no state to exercise the first-run (onboarding) path. Set
// freezeAnimations:false only for the motion spec, which asserts animations actually run.
export async function boot(page, state, { freezeAnimations = true } = {}) {
	if (state !== undefined) {
		await page.addInitScript((s) => localStorage.setItem('sano.state.v1', s), JSON.stringify(state));
	}
	// Freeze CSS animations: the app runs infinite idle-mascot loops + a path-reveal that
	// keep elements perpetually moving, so Playwright's "stable" actionability check times
	// out before a click (WebKit especially). A stylesheet rule loses to the app's
	// higher-specificity `!important` animation rules, so set it INLINE (which beats any
	// stylesheet) on every element, with a MutationObserver for dynamically-rendered nodes.
	// Tests assert state, not motion; the motion spec opts out via freezeAnimations:false.
	if (freezeAnimations) {
		await page.addInitScript(() => {
			const kill = (el) => {
				if (!el.style) return;
				el.style.setProperty('animation', 'none', 'important');
				el.style.setProperty('transition', 'none', 'important');
			};
			const run = () => {
				document.querySelectorAll('*').forEach(kill);
				new MutationObserver((muts) => {
					for (const m of muts)
						for (const n of m.addedNodes)
							if (n.nodeType === 1) (kill(n), n.querySelectorAll && n.querySelectorAll('*').forEach(kill));
				}).observe(document.documentElement, { childList: true, subtree: true });
			};
			if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
			else run();
		});
	}
	await page.goto('/');
	await page.waitForFunction(() => !!window.Sano);
}

// The persisted state blob, as the app currently sees it.
export const savedState = (page) =>
	page.evaluate(() => {
		try {
			return JSON.parse(localStorage.getItem('sano.state.v1'));
		} catch {
			return null;
		}
	});

// Drive the currently-shown lesson exercise one step forward. Returns the exercise type
// handled, or 'complete' when the finish screen is up. Uses normal clicks (not force):
// boot()'s inline animation-freeze makes the in-screen controls stable, so a real click hits
// the exact target AND waits for it to appear. That matters most for #lesson-continue, which
// only exists after finishMatch/feedback renders — a forced click could fire while it's still
// hidden, or land just off a match tile and leave the round (and thus the continue) incomplete.
// Answers needn't be correct; the lesson advances either way.
export async function stepLesson(page) {
	const click = (sel) => page.locator(sel).first().click();
	if (await page.locator('#screen-complete').isVisible()) return 'complete';
	if (await page.locator('#exercise-speak').isVisible()) {
		await click('#speak-continue');
		return 'speak';
	}
	for (const [grid, type] of [
		['#exercise-match', 'match'],
		['#exercise-listen-match', 'listenMatch'],
	]) {
		if (await page.locator(grid).isVisible()) {
			// Tiles carry data-id; the two tiles sharing an id are the correct pair.
			const ids = await page.locator(`${grid} .match-tile`).evaluateAll((tiles) => [...new Set(tiles.map((t) => t.dataset.id))]);
			for (const id of ids) {
				const pair = page.locator(`${grid} .match-tile[data-id="${id}"]`);
				await pair.nth(0).click();
				await pair.nth(1).click();
			}
			await click('#lesson-continue'); // appears once finishMatch shows feedback
			return type;
		}
	}
	if (await page.locator('#exercise-choices').isVisible()) {
		await click('#exercise-choices button');
		await click('#lesson-continue');
		return 'choice';
	}
	if (await page.locator('#exercise-wordbank').isVisible()) {
		for (let k = 0; k < 20; k++) {
			const tile = page.locator('#wordbank-pool .wordbank-tile:not(.selected)').first();
			if (!(await tile.count())) break;
			await tile.click();
		}
		await click('#exercise-check');
		await click('#lesson-continue');
		return 'wordbank';
	}
	if (await page.locator('#exercise-type').isVisible()) {
		await page.locator('#type-answer').fill('test');
		await click('#exercise-check');
		await click('#lesson-continue');
		return 'type';
	}
	throw new Error('stepLesson: no known exercise is visible');
}
