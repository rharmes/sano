// DIALOGUES content-integrity checks (js/dialogues.js, schema v2). Structure only —
// never the wording of the AI-drafted np/dev/en/gloss strings. The headline guard is
// the gloss invariant from @docs/data-model.md: gloss.map(g => g.np).join(' ') === np.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftGlobals } from '../lift.mjs';

const { DIALOGUES, CHARACTER_PERSONAS, dialogueVoiceFolder, dialogueClipId } = liftGlobals('js/dialogues.js', [
	'DIALOGUES',
	'CHARACTER_PERSONAS',
	'dialogueVoiceFolder',
	'dialogueClipId',
]);
const { CHARACTER_HEADS } = liftGlobals('js/characters.js', ['CHARACTER_HEADS']);
const { COURSE } = liftGlobals('js/data.js', ['COURSE']);

const unitIds = new Set(COURSE.map((u) => u.id));
const SPECIAL = new Set(['sano', 'narrator', 'thornbush']); // valid speakers outside the cast

test('DIALOGUES: each has id/title/goal/section/after + cast/lines/questions arrays', () => {
	for (const d of DIALOGUES) {
		for (const f of ['id', 'title', 'goal', 'section', 'after']) assert.ok(d[f], `${d.id || '?'}: missing ${f}`);
		assert.ok(Array.isArray(d.cast), `${d.id}: cast not an array`);
		assert.ok(Array.isArray(d.lines) && d.lines.length, `${d.id}: no lines`);
		assert.ok(Array.isArray(d.questions) && d.questions.length, `${d.id}: no questions`);
	}
});

test('DIALOGUES: `after` references a real COURSE unit', () => {
	for (const d of DIALOGUES) assert.ok(unitIds.has(d.after), `${d.id}: after '${d.after}' is not a unit id`);
});

test('DIALOGUES: cast members have head art and a persona intro', () => {
	for (const d of DIALOGUES) {
		for (const who of d.cast) {
			assert.ok(CHARACTER_HEADS[who], `${d.id}: cast '${who}' has no head art`);
			assert.ok(CHARACTER_PERSONAS[who], `${d.id}: cast '${who}' has no persona`);
		}
	}
});

test('DIALOGUES: every line has a valid speaker and non-empty np/dev/en', () => {
	for (const d of DIALOGUES) {
		const valid = new Set([...d.cast, ...SPECIAL]);
		d.lines.forEach((ln, i) => {
			assert.ok(valid.has(ln.who), `${d.id} line ${i}: unknown speaker '${ln.who}'`);
			for (const f of ['np', 'dev', 'en']) assert.ok(typeof ln[f] === 'string' && ln[f].length, `${d.id} line ${i}: missing ${f}`);
			// Speakers rendered with a head portrait (everyone but the narrator and the prop).
			if (ln.who !== 'narrator' && ln.who !== 'thornbush')
				assert.ok(CHARACTER_HEADS[ln.who], `${d.id} line ${i}: '${ln.who}' has no head art`);
		});
	}
});

test('DIALOGUES: gloss segments join back to the romanized line (the gloss invariant)', () => {
	for (const d of DIALOGUES) {
		d.lines.forEach((ln, i) => {
			if (!ln.gloss) return; // optional; a line with no gloss renders as plain np
			assert.ok(Array.isArray(ln.gloss) && ln.gloss.length, `${d.id} line ${i}: empty gloss`);
			for (const seg of ln.gloss) {
				assert.ok(typeof seg.np === 'string' && seg.np.length, `${d.id} line ${i}: gloss segment missing np`);
				assert.ok(typeof seg.en === 'string', `${d.id} line ${i}: gloss segment missing en`);
			}
			assert.equal(ln.gloss.map((g) => g.np).join(' '), ln.np, `${d.id} line ${i}: gloss.join(' ') !== np`);
		});
	}
});

test('DIALOGUES: comprehension questions have ≥2 choices and an in-range answer index', () => {
	for (const d of DIALOGUES) {
		d.questions.forEach((q, i) => {
			assert.ok(typeof q.q === 'string' && q.q.length, `${d.id} q${i}: missing prompt`);
			assert.ok(Array.isArray(q.choices) && q.choices.length >= 2, `${d.id} q${i}: needs ≥2 choices`);
			assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, `${d.id} q${i}: answer index out of range`);
		});
	}
});

test('DIALOGUES: ElevenLabs audio tags live only in dev — never in display or translation', () => {
	const TAG = /\[[^\]\n]*\]/; // an ElevenLabs [performance tag], e.g. [whispers]
	for (const d of DIALOGUES) {
		d.lines.forEach((ln, i) => {
			// np (on-screen romanization), en (subtitle), and every gloss segment (display + tap
			// translation) must be tag-free — tags belong only in dev (the audio-render source).
			assert.ok(!TAG.test(ln.np), `${d.id} line ${i}: np must not contain an audio tag`);
			assert.ok(!TAG.test(ln.en), `${d.id} line ${i}: en must not contain an audio tag`);
			for (const seg of ln.gloss || []) {
				assert.ok(!TAG.test(seg.np), `${d.id} line ${i}: gloss np must not contain an audio tag`);
				assert.ok(!TAG.test(seg.en), `${d.id} line ${i}: gloss en must not contain an audio tag`);
			}
			// Any tags in dev must be well-formed: stripping [..] leaves no stray bracket.
			assert.ok(!/[[\]]/.test(ln.dev.replace(/\[[^\]\n]*\]/g, '')), `${d.id} line ${i}: malformed audio tag (stray bracket) in dev`);
		});
		// Comprehension questions are pure UI text — no tags.
		d.questions.forEach((q, i) => {
			assert.ok(!TAG.test(q.q), `${d.id} q${i}: question must not contain an audio tag`);
			q.choices.forEach((c, j) => assert.ok(!TAG.test(c), `${d.id} q${i} choice ${j}: must not contain an audio tag`));
		});
	}
});

test('voice helpers: dialogueVoiceFolder follows the VOICE RULES; dialogueClipId zero-pads', () => {
	const cast = { id: 'x', cast: ['pyaro'] };
	assert.equal(dialogueVoiceFolder(cast, 'sano'), 'default');
	assert.equal(dialogueVoiceFolder(cast, 'narrator'), 'thulo');
	assert.equal(dialogueVoiceFolder({ id: 'y', cast: ['thulo'] }, 'narrator'), 'gyani'); // Thulo can't narrate himself
	assert.equal(dialogueVoiceFolder(cast, 'thornbush'), 'rangin');
	assert.equal(dialogueVoiceFolder(cast, 'pyaro'), 'pyaro');
	assert.equal(dialogueClipId({ id: 'greet-pyaro' }, 3), 'greet-pyaro-03');
});
