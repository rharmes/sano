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
		if (topic.kind === 'verb') {
			// A verb card (T66): no contrast block, a table with one button per form.
			await expect(page.locator('#grammar-eyebrow')).toHaveText('Verb card');
			await expect(page.locator('#grammar-contrast')).toBeHidden();
			await expect(page.locator('#grammar-table .grammar-form')).toHaveCount(topic.table.filter((r) => r.dev).length);
			const headings = topic.table.filter((r) => r.heading).map((r) => r.heading);
			await expect(page.locator('#grammar-table .grammar-table-heading')).toHaveText(headings); // a two-verb card keeps its split
		} else if (topic.kind === 'numerals') {
			// The numerals note (T68): a contrast AND a glyph chart — covered in numerals.spec.mjs.
			await expect(page.locator('#grammar-eyebrow')).toHaveText('Reading note');
			await expect(page.locator('#grammar-contrast .grammar-words')).toHaveCount(topic.contrast.length);
			await expect(page.locator('#grammar-table .grammar-table-row')).toHaveCount(topic.table.length);
		} else {
			await expect(page.locator('#grammar-eyebrow')).toHaveText('Grammar note');
			await expect(page.locator('#grammar-table')).toBeHidden();
			const rows = page.locator('#grammar-contrast .grammar-words');
			await expect(rows).toHaveCount(topic.contrast.length);
			for (const row of await rows.all()) await expect(row.locator('.gram-word').first()).toBeVisible(); // no row rendered empty
		}
		await expect(page.locator('#grammar-legend li')).toHaveCount(topic.legend.length);
		await expect(page.locator('#grammar-points li')).toHaveCount(topic.points.length);
		const examples = page.locator('#grammar-examples .grammar-example');
		await expect(examples).toHaveCount(topic.examples.length);
		for (let j = 0; j < topic.examples.length; j++) await expect(examples.nth(j).locator('.gram-word')).toHaveCount(topic.examples[j].parts.length);
		await page.locator('#grammar-back').click();
		await expect(page.locator('#screen-home')).toBeVisible();
	}
});

// Verb cards (T66): the garnu card sits after Making & Doing in its own colour; its table shows
// every form romanized, each a button wired to that form's word clip, and "Got it" ticks it off
// under the same grammarDone key.
test('a verb card opens with its conjugation table, and every form plays a word clip', async ({ page }) => {
	await boot(page, seed.allNotesReady());
	const card = GRAMMAR_TOPICS.find((t) => t.id === 'card-garnu');
	const node = page.locator(`#path .path-node.grammar.verb[title="${card.title}"]`);
	await expect(node).toHaveClass(/unlocked/);
	await expect(node).toHaveText(card.glyph);
	await openScreen(page, node, '#screen-grammar');
	await expect(page.locator('#screen-grammar')).toHaveClass(/verb/);

	const forms = page.locator('#grammar-table .grammar-form');
	const cells = card.table.filter((r) => r.dev);
	await expect(forms).toHaveCount(cells.length);
	await expect(forms.first()).toHaveText(/^ma garchhu/);
	await expect(page.locator('#grammar-table .grammar-table-row .label').first()).toHaveText(cells[0].label);
	// Tapping a form requests its clip from audio/words/ (the slug of the voiced word).
	const requests = [];
	page.on('request', (r) => r.url().includes('/audio/words/') && requests.push(r.url()));
	await forms.nth(1).click({ force: true }); // 'haami garchhau' → garchhau, a clip that only the card made necessary
	await expect.poll(() => requests.some((u) => /\/audio\/words\/garchhau\.mp3/.test(u))).toBe(true);

	await page.locator('#grammar-done').click();
	await expect(page.locator('#screen-complete')).toBeVisible();
	await expect(page.locator('#complete-stats')).toContainText(`${cells.length} forms`);
	const state = await savedState(page);
	expect(state.grammarDone['card-garnu']).toBe(true);
	await page.locator('#complete-continue').click();
	await expect(page.locator(`#path .path-node.grammar.verb[title="${card.title}"]`)).toHaveClass(/complete/);
});
