// Grammar notes (T64): the teal word-order node sits after Pronouns & Possessives, locked
// until that unit is complete; open it, check the note renders its coloured examples, and
// tap "Got it" through to the complete screen with the note ticked off in state.
import { test, expect } from '@playwright/test';
import { boot, seed, openScreen, savedState } from './_helpers.mjs';
import { liftGlobals } from '../lift.mjs';

const { GRAMMAR_TOPICS } = liftGlobals('js/grammar.js', ['GRAMMAR_TOPICS']);

test('the node is locked while Pronouns & Possessives is incomplete', async ({ page }) => {
	await boot(page, seed.midCourse()); // units 0–2 mastered, unit 3 current: pronouns (4) not started
	const node = page.locator('#path .path-node.grammar[title="The verb goes last"]');
	await expect(node).toHaveClass(/locked/);
	await node.click({ force: true });
	await expect(page.locator('#screen-home')).toBeVisible();
	await expect(page.locator('#screen-grammar')).toBeHidden();
});

test('open the note, read it, and tick it off', async ({ page }) => {
	await boot(page, seed.grammarReady());
	const node = page.locator('#path .path-node.grammar[title="The verb goes last"]');
	await expect(node).toHaveClass(/unlocked/);
	await expect(node).toHaveText('SOV');
	await openScreen(page, node, '#screen-grammar');

	await expect(page.locator('#grammar-title')).toHaveText('The verb goes last');
	// The contrast row: an English row and a Nepali row, each three chips, verb last in Nepali.
	const rows = page.locator('#grammar-contrast .grammar-words');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0).locator('.gram-word')).toHaveCount(3);
	await expect(rows.nth(1).locator('.gram-word').last()).toHaveClass(/role-verb/);
	await expect(rows.nth(1).locator('.gram-word .np').first()).toHaveText('Ma');
	// Every example renders one chip per part with a literal gloss, ending on the verb.
	const examples = page.locator('#grammar-examples .grammar-example');
	await expect(examples).toHaveCount(4);
	for (let i = 0; i < 4; i++) {
		await expect(examples.nth(i).locator('.gram-word')).toHaveCount(3);
		await expect(examples.nth(i).locator('.gram-word').last()).toHaveClass(/role-verb/);
		await expect(examples.nth(i).locator('.audio-btn')).toBeVisible();
	}

	await page.locator('#grammar-done').click();
	await expect(page.locator('#screen-complete')).toBeVisible();
	await expect(page.locator('#complete-title')).toHaveText('Got it!');
	await expect(page.locator('#complete-streak')).toBeVisible(); // studied yesterday → streak extends
	const state = await savedState(page);
	expect(state.grammarDone['word-order']).toBe(true);

	// Back on the path the node shows as complete and opens again.
	await page.locator('#complete-continue').click();
	await expect(page.locator('#path .path-node.grammar[title="The verb goes last"]')).toHaveClass(/complete/);
});

test('every note on the path opens and renders its contrast rows, legend and examples', async ({ page }) => {
	await boot(page, seed.allNotesReady());
	const nodes = page.locator('#path .path-node.grammar');
	await expect(nodes).toHaveCount(GRAMMAR_TOPICS.length);
	for (let i = 0; i < GRAMMAR_TOPICS.length; i++) {
		const topic = GRAMMAR_TOPICS[i];
		const node = page.locator(`#path .path-node.grammar[title="${topic.title}"]`); // by title: the array order needn't match the path
		await expect(node).toHaveClass(/unlocked/);
		await expect(node).toHaveAttribute('title', topic.title);
		await openScreen(page, node, '#screen-grammar');
		await expect(page.locator('#grammar-title')).toHaveText(topic.title);
		const rows = page.locator('#grammar-contrast .grammar-words');
		await expect(rows).toHaveCount(topic.contrast.length);
		for (const row of await rows.all()) await expect(row.locator('.gram-word').first()).toBeVisible(); // no row rendered empty
		await expect(page.locator('#grammar-legend li')).toHaveCount(topic.legend.length);
		await expect(page.locator('#grammar-points li')).toHaveCount(topic.points.length);
		const examples = page.locator('#grammar-examples .grammar-example');
		await expect(examples).toHaveCount(topic.examples.length);
		for (let j = 0; j < topic.examples.length; j++) await expect(examples.nth(j).locator('.gram-word')).toHaveCount(topic.examples[j].parts.length);
		await page.locator('#grammar-back').click();
		await expect(page.locator('#screen-home')).toBeVisible();
	}
});
