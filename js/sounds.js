// SR-08: pronunciation coaching for the Nepali contrasts that romanization flattens.
//
// Each topic names a sound distinction the Latin `pron` can't show, explains it, and is
// illustrated by REAL course words chosen at runtime by scanning their Devanagari `dev`
// for the listed `marks` — so the audio and the Nepali are the ones already shipped in
// COURSE (no new content, no runtime TTS, matching the app's offline-first discipline).
//
// The `marks` are factual Devanagari letters. The `title`/`sub`/`intro`/`tip` prose is a
// draft of standard Nepali phonology — accurate as far as it goes, but Ross owns the
// final wording like the rest of the Nepali-facing copy, so treat it as a draft to refine
// rather than authoritative. Because examples are pulled by `dev`, they inherit the
// accuracy of that (AI-drafted, under-review) field; a wrong `dev` would mis-sort a word.
const SOUND_TOPICS = [
	{
		id: 'aspiration',
		after: 'basics', // path anchor: this node sits just after this unit
		glyph: 'ख', // Devanagari icon for the path node
		title: 'Aspirated consonants',
		sub: 'kh · gh · chh · th · ph',
		intro: 'Nepali pairs many consonants with an aspirated version — released with a small puff of breath. Romanization shows it with an added “h” (k → kh, t → th, p → ph), but the breath is easy to drop, and dropping it can land you on a different word.',
		tip: 'Hold a hand to your mouth: you should feel a puff of air on the aspirated sound and almost none on its plain partner.',
		marks: ['ख', 'घ', 'छ', 'झ', 'थ', 'ध', 'फ', 'भ'],
	},
	{
		id: 'retroflex',
		after: 'kitchen-items', // path anchor: this node sits just after this unit
		glyph: 'ट', // Devanagari icon for the path node
		title: 'Retroflex vs. dental',
		sub: 'ṭ / ḍ  vs.  t / d',
		intro: 'Nepali has two families of t- and d-sounds: retroflex (tongue curled back toward the roof of the mouth — ट ठ ड ढ) and dental (tongue against the teeth — त थ द ध). Romanization writes both as “t” and “d”, so the contrast vanishes on the page even though it carries meaning.',
		tip: 'For the retroflex sound, curl your tongue tip up and back; for the dental, press it against the back of your top teeth.',
		marks: ['ट', 'ठ', 'ड', 'ढ', 'ण'],
	},
	{
		id: 'nasal',
		after: 'cleaning-items', // path anchor: this node sits just after this unit
		glyph: 'अँ', // Devanagari icon for the path node
		title: 'Nasal vowels',
		sub: 'vowels through the nose',
		intro: 'A vowel can be nasalized — sent partly through the nose (written ँ in Devanagari). It is often the only thing separating two words, yet romanization usually leaves it out altogether.',
		tip: 'Let the vowel hum through your nose — like the feeling at the end of “song” — without fully closing into an n or m.',
		marks: ['ँ'],
	},
	{
		id: 'vowel-length',
		after: 'time', // path anchor: this node sits just after this unit
		glyph: 'ई', // Devanagari icon for the path node
		title: 'Long vs. short vowels',
		sub: 'i / ī  ·  u / ū',
		intro: 'Devanagari marks short and long vowels separately (इ/ई, उ/ऊ), but romanization tends to write both the same way — so a single “i” or “u” can stand for a quick vowel or a held one, and the length can change the word.',
		tip: 'Give the long vowel noticeably more time — hold ī and ū for roughly twice as long as i and u.',
		marks: ['ी', 'ू', 'ई', 'ऊ'],
	},
];
