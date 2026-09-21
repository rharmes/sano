// Nepali numerals (T68): a teal note after Bigger Numbers, then two units whose Nepali side is
// the glyph itself. The learner already knows the spoken words, so the headline guards are
// that a glyph prompt never speaks or spells its answer, that the clip it borrows DOES play
// where it can't leak, and that grading tells one glyph from another.
import { test, expect } from '@playwright/test';
import { boot, seed, openScreen, savedState } from './_helpers.mjs';

// Start a lesson of hand-built exercises over real course items — each test needs ONE specific
// exercise type, which a seeded daily lesson would only reach through padding and dice.
async function startExercises(page, specs) {
	await page.evaluate((specs) => {
		const all = COURSE.flatMap((u) => u.items);
		startLesson(
			specs.map((spec) => {
				const item = all.find((it) => it.id === spec.id);
				return Object.assign({ item: item, frame: itemFrames(item)[0] }, spec.ex);
			}),
		);
	}, specs);
	await expect(page.locator('#screen-lesson')).toBeVisible();
}

// Every phrase-clip request from here on, as `voice/id` (audio/<voice>/<id>.mp3).
function trackClips(page) {
	const clips = [];
	page.on('request', (r) => {
		const m = /\/audio\/([^/]+)\/([^/?]+)\.mp3/.exec(r.url());
		if (m) clips.push(m[1] + '/' + m[2]);
	});
	return clips;
}

test('the note: unlocked after Bigger Numbers, a chart of ten glyphs whose words play, ticks off', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const node = page.locator('#path .path-node.grammar[title="Nepali numerals"]');
	await expect(node).toHaveClass(/unlocked/);
	await expect(node).toHaveText('०–९');
	await openScreen(page, node, '#screen-grammar');
	await expect(page.locator('#screen-grammar')).toHaveClass(/numerals/);
	await expect(page.locator('#grammar-eyebrow')).toHaveText('Reading note');

	// Place value, digit for digit: 1 5 0 0 over १ ५ ० ०.
	const rows = page.locator('#grammar-contrast .grammar-words');
	await expect(rows.nth(0).locator('.gram-word')).toHaveText(['1', '5', '0', '0']);
	await expect(rows.nth(1).locator('.gram-word')).toHaveText(['१', '५', '०', '०']);

	// The chart: ten rows leading with the glyph; nine words are buttons, zero is plain text.
	await expect(page.locator('#grammar-table .grammar-table-row .glyph')).toHaveText([...'०१२३४५६७८९']);
	await expect(page.locator('#grammar-table button.grammar-form')).toHaveCount(9);
	await expect(page.locator('#grammar-table .grammar-form.plain')).toHaveText('shunya');
	const clips = trackClips(page);
	// dispatchEvent, not a forced click: a forced click is positional, and under WebKit the chart's
	// rows can still be settling (late font layout), which lands the tap on the row above.
	await page.locator('#grammar-table button.grammar-form', { hasText: 'saat' }).dispatchEvent('click');
	await expect.poll(() => clips).toContain('words/saat');

	await page.locator('#grammar-done').click();
	await expect(page.locator('#screen-complete')).toBeVisible();
	expect((await savedState(page)).grammarDone.numerals).toBe(true);
});

test('the path: the two numeral units follow Bigger Numbers, the first one current', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const titles = await page.evaluate(() => COURSE.map((u) => u.id));
	const at = titles.indexOf('numbers-big');
	expect(titles.slice(at + 1, at + 3)).toEqual(['numerals', 'numerals-reading']);
	await expect(page.locator('#path .path-node.current')).toHaveAttribute('title', /Numerals 0–9/);
});

test('a new numeral: recognition both ways, typed recall, and speaking only if the course says it', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const shape = await page.evaluate(() => {
		const all = COURSE.flatMap((u) => u.items);
		const of = (id) =>
			buildExercises([all.find((it) => it.id === id)], [])
				.filter((ex) => ex.item)
				.map((ex) => ex.type + (ex.dir ? ':' + ex.dir : ''))
				.sort();
		return { said: of('numeral-7'), silent: of('numeral-0'), word: of('saat-seven') };
	});
	expect(shape.said).toEqual(['choice:en-np', 'choice:np-en', 'speak', 'type']);
	expect(shape.silent).toEqual(['choice:en-np', 'choice:np-en', 'type']); // zero has no clip to compare with
	expect(shape.word).toEqual(['choice:en-np', 'choice:np-en', 'speak', 'wordbank:en-np']); // words are unchanged
});

test('a glyph prompt is silent and unspelled; the reveal names the word and offers its clip', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const clips = trackClips(page);
	await startExercises(page, [{ id: 'numeral-7', ex: { type: 'choice', dir: 'np-en' } }]);

	await expect(page.locator('#exercise-label')).toHaveText('Select the number');
	await expect(page.locator('#exercise-word')).toHaveText('७');
	await expect(page.locator('#exercise-word .audio-btn')).toHaveCount(0);
	await expect(page.locator('#exercise-pronounce')).toHaveText('');
	// The choices are numbers, and the distractors come from the same unit.
	const choices = await page.locator('#exercise-choices button').allTextContents();
	expect(choices).toContain('7');
	for (const c of choices) expect(c).toMatch(/^\d$/);

	// A miss shows the reveal: glyph = number · word, with the borrowed clip behind the button.
	await page.locator('#exercise-choices button[data-status="incorrect"]').first().click();
	await expect(page.locator('#feedback-answer')).toHaveText(/^७ = 7 · saat/);
	expect(clips).toEqual([]); // nothing has played yet — not on the prompt, not on the answer
	await page.locator('#feedback-answer .audio-btn').click();
	await expect.poll(() => clips).toContain('default/saat-seven');
});

test('control: a spoken-word prompt still speaks itself', async ({ page }) => {
	// The same harness on an ordinary item — so the silence above is the numeral rule, not a
	// harness that never hears audio.
	await boot(page, seed.numeralsReady());
	const clips = trackClips(page);
	await startExercises(page, [{ id: 'saat-seven', ex: { type: 'choice', dir: 'np-en' } }]);
	await expect(page.locator('#exercise-word .audio-btn')).toHaveCount(1);
	await expect.poll(() => clips).toContain('default/saat-seven');
});

test('type the number: the right number passes, a neighbouring one fails, the glyph itself fails', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const clips = trackClips(page);
	for (const [given, verdict] of [
		['25', 'Correct!'],
		['26', 'Not quite.'],
		['२६', 'Not quite.'], // the answer is the NUMBER — typing glyphs back is not it
	]) {
		await startExercises(page, [{ id: 'numeral-25', ex: { type: 'type' } }]);
		await expect(page.locator('#exercise-label')).toHaveText('Type the number');
		await expect(page.locator('#exercise-word')).toHaveText('२५');
		await expect(page.locator('#type-answer')).toHaveAttribute('inputmode', 'numeric');
		await page.locator('#type-answer').fill(given);
		await page.locator('#exercise-check').click();
		await expect(page.locator('#feedback-title')).toHaveText(verdict);
		// 25 is a number the course never says: the reveal is the bare pair, with no clip.
		await expect(page.locator('#feedback-answer')).toHaveText('२५ = 25');
		await expect(page.locator('#feedback-answer .audio-btn')).toHaveCount(0);
	}
	expect(clips).toEqual([]);
});

test('the next word exercise gets its text keyboard back', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	await startExercises(page, [
		{ id: 'numeral-7', ex: { type: 'type' } },
		{ id: 'saat-seven', ex: { type: 'type' } },
	]);
	await page.locator('#type-answer').fill('7');
	await page.locator('#exercise-check').click();
	await page.locator('#lesson-continue').click();
	await expect(page.locator('#exercise-label')).toHaveText('Type the Nepali');
	await expect(page.locator('#type-answer')).toHaveAttribute('inputmode', 'text');
	await expect(page.locator('#type-answer')).toHaveAttribute('placeholder', 'Type the Nepali…');
});

test('select what you hear: the word plays and the answers are glyphs', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const clips = trackClips(page);
	await startExercises(page, [{ id: 'numeral-7', ex: { type: 'choice', dir: 'np-en', listen: true } }]);
	await expect(page.locator('#exercise-label')).toHaveText('Select what you hear');
	await expect.poll(() => clips).toContain('default/saat-seven');
	const choices = await page.locator('#exercise-choices button').allTextContents();
	expect(choices).toContain('७');
	for (const c of choices) expect(c).toMatch(/^[०-९]+$/);
	await page.locator('#exercise-choices button[data-status="correct"]').click();
	await expect(page.locator('#feedback-title')).toHaveText('Correct!');
});

test('a match grid: glyph tiles stay silent, word tiles still speak', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const clips = trackClips(page);
	await page.evaluate(() => {
		const all = COURSE.flatMap((u) => u.items);
		startLesson([{ type: 'match', items: ['numeral-3', 'numeral-4', 'saat-seven'].map((id) => all.find((it) => it.id === id)) }]);
	});
	const left = (id) => page.locator(`#exercise-match .match-tile[data-id="${id}"]`).first();
	await expect(left('numeral-3')).toHaveText('३');
	await left('saat-seven').click({ force: true });
	await expect.poll(() => clips).toContain('default/saat-seven');
	await left('numeral-3').click({ force: true });
	await left('numeral-4').click({ force: true });
	await expect(left('numeral-4')).toHaveClass(/selected/); // the taps landed…
	expect(clips.filter((c) => !c.endsWith('/saat-seven'))).toEqual([]); // …and asked for no clip
});

test('the dictionary lists a numeral with the word it is read as, and plays the borrowed clip', async ({ page }) => {
	// The dictionary is ungated — renderTables walks every unit of COURSE, met or not — which is why
	// the numeral rows are there at all; no progress has to be seeded for them.
	await boot(page, seed.numeralsReady());
	const clips = trackClips(page);
	await openScreen(page, page.locator('#nav-dictionary'), '#screen-dictionary');

	const seven = page.locator('#vocab tr', { has: page.locator('th', { hasText: /^७$/ }) });
	await expect(seven.locator('td').first()).toHaveText('saat'); // read as…
	await expect(seven.locator('td').last()).toHaveText('7');
	await seven.locator('.audio-inline').dispatchEvent('click');
	await expect.poll(() => clips).toContain('default/saat-seven'); // …and it plays the clip it borrows, not 'numeral-7'
	expect(clips.filter((c) => c.includes('numeral-'))).toEqual([]);

	// Zero has no clip to borrow: a row, but no button that could only 404.
	const zero = page.locator('#vocab tr', { has: page.locator('th', { hasText: /^०$/ }) });
	await expect(zero.locator('td').last()).toHaveText('0');
	await expect(zero.locator('.audio-inline')).toHaveCount(0);
});

test('a listening grid: the numeral tile plays its borrowed clip and pairs with its glyph', async ({ page }) => {
	await boot(page, seed.numeralsReady());
	const clips = trackClips(page);
	await page.evaluate(() => {
		const all = COURSE.flatMap((u) => u.items);
		startLesson([{ type: 'listenMatch', items: ['numeral-3', 'saat-seven'].map((id) => all.find((it) => it.id === id)) }]);
	});
	// Tile order is shuffled per column, so pick each side by class, not position.
	const sound = page.locator('#exercise-listen-match .listen-tile[data-id="numeral-3"]');
	const glyph = page.locator('#exercise-listen-match .match-tile:not(.listen-tile)[data-id="numeral-3"]');
	await sound.dispatchEvent('click');
	await expect.poll(() => clips).toContain('default/tin-three');
	await expect(glyph).toHaveText('३');
	await glyph.dispatchEvent('click');
	await expect(glyph).toHaveClass(/matched/);
});

// The review-found defect: a numeral borrows the clip of the word that says it, the two share
// neither romanization nor English, and both can be due at once — so a listening grid could
// hold two tiles with the SAME sound, one of whose pairings must grade as a miss.
test('no built lesson puts a numeral and the word whose clip it borrows — or a tile with no clip — in one listening grid', async ({ page }) => {
	const state = seed.numeralsReady();
	const due = { recalls: 2, graduated: true, ease: 2.6, interval: 6, lastSeen: seed.day(20) };
	await boot(page, state);
	const result = await page.evaluate((due) => {
		// Everything through Reading Bigger Numbers graduated; the four number units overdue at recall strength.
		for (const u of COURSE) {
			for (const it of u.items)
				state.items[it.id] = Object.assign(
					{ seen: 4, correct: 4, intro: true },
					due,
					/^num/.test(u.id) ? {} : { interval: 40, lastSeen: dayString(new Date()) },
				);
			if (u.id === 'numerals-reading') break;
		}
		let grids = 0;
		const collisions = [];
		const silent = [];
		let offered = 0;
		for (let i = 0; i < 300; i++) {
			const plan = dailyPlan();
			for (const ex of buildExercises(plan.newItems, plan.reviewItems)) {
				if (ex.type !== 'listenMatch') continue;
				grids++;
				const played = ex.items.map(itemClip);
				if (new Set(played).size !== played.length) collisions.push(ex.items.map((it) => it.id).join('+'));
			}
		}
		// A numeral with no `says` (zero, 25 …) has no clip: as a listening tile it is a pairing nobody
		// can answer, and the by-clip dedupe alone would still let ONE through (they share `null`).
		// Due reviews are taken most-overdue first, ties in course order, so the state above never
		// offers one; make them the most overdue and draw again.
		const longAgo = dayString(new Date(Date.now() - 60 * 864e5)); // same interval — they must stay recall-strength
		for (const it of COURSE.flatMap((u) => u.items)) if (isNumeral(it) && !itemClip(it)) state.items[it.id].lastSeen = longAgo;
		for (let i = 0; i < 100; i++) {
			const plan = dailyPlan();
			offered += plan.reviewItems.filter((it) => !itemClip(it)).length;
			for (const ex of buildExercises(plan.newItems, plan.reviewItems))
				if (ex.type === 'listenMatch') for (const it of ex.items) if (!itemClip(it)) silent.push(it.id);
		}
		const mixed = COURSE.flatMap((u) => u.items).filter((it) => it.says).length;
		return { grids, collisions, silent, offered, mixed };
	}, due);
	expect(result.mixed).toBeGreaterThan(0);
	expect(result.grids).toBeGreaterThan(50); // the state really does produce listening grids…
	expect(result.collisions).toEqual([]); // …and none of them plays one clip from two tiles
	expect(result.offered).toBeGreaterThan(0); // the clip-less numerals really were up for review…
	expect(result.silent).toEqual([]); // …and none became a listening tile with nothing to play
});

// The Nepali digit forms (the everyday 5 and 8) come from a digits-only font declared under the
// app's own families for U+0966–096F. A unicode-range face is fetched only when a character in
// its range is actually drawn with that family — so "loaded" is proof the glyph on screen uses it.
test('numerals are drawn with the Nepali-forms font, and only once a numeral is on screen', async ({ page }) => {
	// Early in the course: every node that would show a numeral glyph is still locked (a lock icon),
	// so nothing on the home screen draws one.
	await boot(page, seed.dictReady());
	const numeralFaces = () =>
		page.evaluate(async () => {
			await document.fonts.ready;
			return [...document.fonts]
				.filter((f) => /U\+966-96F/i.test(f.unicodeRange))
				.map((f) => f.family.replace(/["']/g, '') + ' ' + f.weight + ' ' + f.status);
		});
	await startExercises(page, [{ id: 'saat-seven', ex: { type: 'choice', dir: 'en-np' } }]);
	expect((await numeralFaces()).filter((f) => f.endsWith(' loaded'))).toEqual([]); // no numeral drawn anywhere yet → not fetched

	await startExercises(page, [{ id: 'numeral-5', ex: { type: 'choice', dir: 'np-en' } }]);
	await expect(page.locator('#exercise-word')).toHaveText('५');
	await expect.poll(async () => (await numeralFaces()).filter((f) => f.endsWith(' loaded')).length).toBeGreaterThan(0);
});
