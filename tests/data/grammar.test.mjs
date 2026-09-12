// GRAMMAR_TOPICS content-integrity checks (js/grammar.js, T64). Structure only — never the
// wording of the AI-drafted prose or glosses. The headline guard: every example's `parts`
// join back to the exact `dev` of the real course sentence its `clip` names, so the note can
// colour that sentence word by word and the clip it plays is the one already shipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { liftGlobals, ROOT } from '../lift.mjs';

const { GRAMMAR_TOPICS, GRAMMAR_ROLES } = liftGlobals('js/grammar.js', ['GRAMMAR_TOPICS', 'GRAMMAR_ROLES']);
const { COURSE } = liftGlobals('js/data.js', ['COURSE']);
const { SanoRomanize } = liftGlobals('js/romanize.js', ['SanoRomanize']);

const unitIds = new Set(COURSE.map((u) => u.id));
const items = COURSE.flatMap((u) => u.items);
const roles = new Set(Object.keys(GRAMMAR_ROLES));

// Mirror of grammarSentence() in js/sano.js: an item id, or `<itemId>-fN` for a frame.
function sentence(clip) {
	const byId = items.find((it) => it.id === clip);
	if (byId) return byId.dev;
	const m = /^(.+)-f(\d+)$/.exec(clip);
	const item = m && items.find((it) => it.id === m[1]);
	const frame = item && item.frames && item.frames[Number(m[2]) - 1];
	return frame ? frame.dev : null;
}

// Every sentence a note colours: its examples plus any contrast row that carries its own parts.
const sentences = (t) => t.examples.concat(t.contrast.filter((r) => r.parts));

test('GRAMMAR_TOPICS: shape, `after` is a real unit, ids unique', () => {
	for (const t of GRAMMAR_TOPICS) {
		for (const f of ['id', 'glyph', 'title', 'sub', 'intro', 'tip']) assert.ok(t[f], `${t.id || '?'}: missing ${f}`);
		assert.ok(unitIds.has(t.after), `${t.id}: after '${t.after}' is not a unit id`);
		assert.ok(Array.isArray(t.points) && t.points.length, `${t.id}: no points`);
		assert.ok(Array.isArray(t.examples) && t.examples.length, `${t.id}: no examples`);
		assert.ok(Array.isArray(t.contrast) && t.contrast.length >= 2, `${t.id}: needs at least two contrast rows`);
		for (const r of t.contrast) {
			assert.ok(r.label, `${t.id}: contrast row without a label`);
			if (r.chips) for (const c of r.chips) assert.ok(roles.has(c.role) && c.en, `${t.id}: bad contrast chip ${JSON.stringify(c)}`);
			else if (!r.parts)
				assert.ok(
					t.examples.some((e) => e.clip === r.clip),
					`${t.id}: contrast row '${r.label}' names clip '${r.clip}', not one of its examples`,
				);
		}
		assert.ok(Array.isArray(t.legend) && t.legend.length, `${t.id}: no legend`);
		const used = new Set(
			sentences(t)
				.flatMap((e) => e.parts.map((p) => p.role))
				.concat(t.contrast.flatMap((r) => (r.chips || []).map((c) => c.role))),
		);
		for (const l of t.legend) assert.ok(roles.has(l.role) && l.label, `${t.id}: bad legend entry ${JSON.stringify(l)}`);
		for (const role of used)
			assert.ok(
				t.legend.some((l) => l.role === role),
				`${t.id}: role '${role}' is used but not in the legend`,
			);
	}
	const ids = GRAMMAR_TOPICS.map((t) => t.id);
	assert.equal(new Set(ids).size, ids.length, 'duplicate grammar-topic id');
	// One note per anchor unit: the path takes the first match, so a second would be unreachable.
	const anchors = GRAMMAR_TOPICS.map((t) => t.after);
	assert.equal(new Set(anchors).size, anchors.length, 'two grammar notes anchored after the same unit');
});

test('GRAMMAR_TOPICS: every example is a real course sentence whose parts join back to its dev', () => {
	for (const t of GRAMMAR_TOPICS) {
		for (const ex of sentences(t)) {
			const dev = sentence(ex.clip);
			assert.ok(dev, `${t.id}: clip '${ex.clip}' is neither an item id nor an item's frame`);
			assert.ok(Array.isArray(ex.parts) && ex.parts.length >= 2, `${t.id}/${ex.clip}: needs at least two parts`);
			assert.equal(ex.parts.map((p) => p.dev).join(' '), dev, `${t.id}/${ex.clip}: parts don't join back to the dev`);
			for (const p of ex.parts) {
				assert.ok(roles.has(p.role), `${t.id}/${ex.clip}: unknown role '${p.role}'`);
				assert.ok(p.en, `${t.id}/${ex.clip}: '${p.dev}' has no literal gloss`);
			}
			// One romanized word per part: the screen splits the romanized sentence on spaces.
			assert.equal(SanoRomanize.romanize(dev).split(/\s+/).length, ex.parts.length, `${t.id}/${ex.clip}: romanized word count ≠ parts`);
		}
	}
});

test('GRAMMAR_TOPICS: every example clip is on disk in the default voice', () => {
	for (const t of GRAMMAR_TOPICS)
		for (const ex of sentences(t))
			assert.ok(existsSync(join(ROOT, 'audio', 'default', ex.clip + '.mp3')), `${t.id}: audio/default/${ex.clip}.mp3 is missing`);
});
