// COURSE content-integrity checks (js/data.js). Structure only — never the wording of
// the AI-drafted dev/en/usage/goal strings (those are Ross's to review; np/pron are derived).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftGlobals } from '../lift.mjs';

const { COURSE } = liftGlobals('js/data.js', ['COURSE']);
const allItems = COURSE.flatMap((u) => u.items);

test('COURSE: a non-empty array of units', () => {
	assert.ok(Array.isArray(COURSE) && COURSE.length > 0);
});

test('COURSE: unit ids are present and unique', () => {
	const ids = COURSE.map((u) => u.id);
	for (const id of ids) assert.ok(id && typeof id === 'string', `bad unit id: ${JSON.stringify(id)}`);
	assert.equal(new Set(ids).size, ids.length, 'duplicate unit id');
});

test('COURSE: every unit has title, a valid kind, a goal, and items', () => {
	for (const u of COURSE) {
		assert.ok(u.title, `${u.id}: missing title`);
		assert.ok(u.kind === 'phrases' || u.kind === 'vocab', `${u.id}: bad kind ${JSON.stringify(u.kind)}`);
		assert.ok(typeof u.goal === 'string' && u.goal.length, `${u.id}: missing goal`);
		assert.ok(Array.isArray(u.items) && u.items.length, `${u.id}: no items`);
	}
});

test('COURSE: all item ids are globally unique', () => {
	const seen = new Set();
	const dups = [];
	for (const it of allItems) {
		if (seen.has(it.id)) dups.push(it.id);
		seen.add(it.id);
	}
	assert.deepEqual(dups, [], `duplicate item ids: ${dups.join(', ')}`);
});

test('COURSE: every item has non-empty id/dev/en', () => {
	// `np` and `pron` are intentionally absent from the data now — both are derived from `dev` at
	// load by js/romanize.js (asserted in tests/data/romanize-coverage.test.mjs).
	for (const it of allItems) {
		for (const f of ['id', 'dev', 'en']) {
			assert.ok(typeof it[f] === 'string' && it[f].trim().length, `${it.id || '?'}: missing ${f}`);
		}
	}
});

test('COURSE: phrases items carry a usage note; vocab items carry an emoji', () => {
	for (const u of COURSE) {
		for (const it of u.items) {
			if (u.kind === 'vocab') assert.ok(it.emoji, `${it.id}: vocab item missing emoji`);
			else assert.ok(it.usage, `${it.id}: phrases item missing usage`);
		}
	}
});

test('COURSE: depth alternate frames are well-formed and their clip ids stay unique', () => {
	// Optional `frames: [{dev, en}]` (T28) rotate over an item's own review record. Each frame's
	// pre-rendered clip is `<id>-fN`, so those ids must not collide with any real item id or with
	// one another (the wording of dev/en is Ross's, not asserted here).
	const clipIds = new Set(allItems.map((it) => it.id));
	for (const it of allItems) {
		if (it.frames === undefined) continue;
		assert.ok(Array.isArray(it.frames) && it.frames.length, `${it.id}: frames must be a non-empty array`);
		it.frames.forEach((f, i) => {
			for (const field of ['dev', 'en']) {
				assert.ok(typeof f[field] === 'string' && f[field].trim().length, `${it.id} frame ${i + 1}: missing ${field}`);
			}
			const clip = `${it.id}-f${i + 1}`;
			assert.ok(!clipIds.has(clip), `${it.id} frame ${i + 1}: clip id ${clip} collides with an item or another frame`);
			clipIds.add(clip);
		});
	}
});

// Numeral items (T68): `dev` is Devanagari digits only. The one fact in them that is arithmetic
// rather than wording is that `en` is the same number, digit for digit — and the clip a numeral
// borrows (`says`) must be a real spoken item whose clip is on disk, or the reveal and the
// listening drill go silent.
test('COURSE: numeral items — en is the number the glyphs spell, `says` names a spoken item with a clip', async () => {
	const { existsSync } = await import('node:fs');
	const { join } = await import('node:path');
	const { ROOT } = await import('../lift.mjs');
	const { UNIT_VOICES } = liftGlobals('js/data.js', ['UNIT_VOICES']);
	const isNumeral = (it) => /^[०-९]+$/.test(it.dev);
	const numerals = allItems.filter(isNumeral);
	assert.ok(numerals.length >= 10, 'expected the numeral units');
	assert.deepEqual([...new Set(numerals.filter((it) => it.dev.length === 1).map((it) => it.dev))].sort(), [...'०१२३४५६७८९'], 'every digit ०–९ is taught');
	for (const it of numerals) {
		const number = [...it.dev].map((ch) => '०१२३४५६७८९'.indexOf(ch)).join('');
		assert.equal(it.en, number, `${it.id}: ${it.dev} is ${number}, not '${it.en}'`);
		assert.equal(it.id, 'numeral-' + number, `${it.id}: id should name its number`);
		assert.equal(it.frames, undefined, `${it.id}: a numeral has no alternate frames`);
		if (it.says === undefined) continue;
		const sayer = allItems.find((s) => s.id === it.says);
		assert.ok(sayer && !isNumeral(sayer), `${it.id}: says '${it.says}' is not a spoken course item`);
		const unit = COURSE.find((u) => u.items.includes(it));
		for (const voice of ['default', UNIT_VOICES[unit.id]])
			assert.ok(existsSync(join(ROOT, 'audio', voice, it.says + '.mp3')), `${it.id}: audio/${voice}/${it.says}.mp3 is missing`);
	}
	// A numeral unit holds nothing else: mixed in with words, its distractors would be words.
	for (const u of COURSE) if (u.items.some(isNumeral)) assert.ok(u.items.every(isNumeral), `${u.id}: mixes numerals and words`);
});
