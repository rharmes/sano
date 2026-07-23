// Build js/glosses.js — the per-word English lookup behind the tap-a-word lesson
// glosses (T37). Every word that can appear in a Nepali exercise prompt (= every word of
// every canonical + frame sentence, the tools/tts/words.json inventory) gets one short
// English gloss, keyed by the same romanized slug as its tile clip
// (audio/words/<slug>.mp3), so the app can resolve a tapped word with the exact
// slug logic it already uses for tile audio.
//
//   node tools/build-glosses.mjs    # (re)write js/glosses.js and print stats
//
// Gloss sources, in priority order:
//   1. single-word COURSE items whose romanized word IS the slug → the merged senses of
//      ALL of them (`en` + `enAlt`, course order, deduped) — a slug can be a homograph
//      (छ chha: "Yes / Is / Has" in Everyday Replies AND "Six" in Numbers) and the
//      popover must list every meaning, not just the first unit's;
//   2. the ground-truth dictionary (tools/dict/dictionary.json) entry whose Devanagari
//      matches the word's — surface form == citation form, so the lemma gloss fits;
//   3. the hand-drafted FILLS below: inflected verbs and case-suffixed nouns the
//      dictionary's lemmas can't match (आउँछु "(I) come", बजारमा "in the market").
//      These are AI-drafted surface-form glosses pending Ross's review, like every
//      AI-drafted string (CLAUDE.md) — review here, then re-run.
//
// The build FAILS if any tile-word ends up glossless, so growing the course forces a
// conscious FILLS addition (same discipline as build-words.mjs OVERRIDES). Run it after
// build-words.mjs whenever content changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const COURSE = Function(readFileSync(join(ROOT, 'js', 'data.js'), 'utf8') + '; return COURSE;')();
const SanoRomanize = Function(readFileSync(join(ROOT, 'js', 'romanize.js'), 'utf8') + '; return SanoRomanize;')();
const WORDS = JSON.parse(readFileSync(join(ROOT, 'tools', 'tts', 'words.json'), 'utf8'));
const dictFile = JSON.parse(readFileSync(join(ROOT, 'tools', 'dict', 'dictionary.json'), 'utf8'));
const DICTIONARY = Array.isArray(dictFile) ? dictFile : dictFile.entries;

// Slug logic mirrors js/sano.js playTileWord (normalize → spaces-to-dashes), like
// build-words.mjs, so lookups at runtime hit these exact keys.
const normalize = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
const slugOf = (w) => normalize(w).replace(/\s+/g, '-');
const devClean = (w) => w.replace(/[?।,!.]/g, '').trim();

// Hand-drafted glosses for the tile-words neither source covers — inflected verb forms
// and case-suffixed nouns (the dictionary is lemma-keyed, so आउँछु never matches आउनु).
// AI drafts, pending Ross's review: each is the SURFACE form's meaning, person markers in
// parens, "please …" for -नुस् imperatives. Keep them short — they render in the tap
// popover under the word.
const FILLS = {
	aae: '(I) came',
	aakaashamaa: 'in the sky',
	aamaako: "mother's",
	aamaalaai: 'to mother',
	aanpako: 'of mango',
	aaraam: 'rest',
	aaun: 'to come',
	aaunchha: '(he/she/it) comes',
	aaunchhu: '(I) come',
	aaundai: 'coming',
	aaundaina: "(he/she/it) doesn't come",
	aaunuhunchha: 'come(s) (polite)',
	aghaae: '(I) am full',
	ainaamaa: 'in the mirror',
	amilo: 'sour',
	baaghadekhi: 'from the tiger',
	baakhraako: "goat's",
	baalchhau: '(we) light',
	baaltimaa: 'in the bucket',
	baatoko: 'of the road',
	baayaantir: 'to the left',
	bachchaalaai: 'to the child',
	bajaaramaa: 'in the market',
	bajesamma: "until … o'clock",
	banaaunchhau: '(we) make',
	banaaunchhu: '(I) make',
	banamaa: 'in the forest',
	barsako: 'of years / years old',
	basamaa: 'on the bus',
	basapaarkamaa: 'at the bus stop',
	basapaarkasamma: 'up to the bus stop',
	basna: 'to sit',
	bhaanchiyo: 'broke (snapped)',
	bhaarat: 'India',
	bhaatasang: 'with rice',
	bhane: '(I) said / if',
	bhukampamaa: 'in the earthquake',
	boldina: "(I) don't speak",
	bujhe: '(I) understood',
	bujhina: "(I) didn't understand",
	chaahindaina: "isn't needed",
	chaarja: 'charge',
	chhimekilaai: 'to the neighbor',
	chitawanamaa: 'in Chitwan',
	chithi: 'letter',
	chiyaamaa: 'in the tea',
	daayaantir: 'to the right',
	dahisang: 'with yogurt',
	dasawataa: 'ten (of them)',
	dashainmaa: 'at Dashain',
	daudanchha: '(it) runs',
	dekhe: '(I) saw',
	dhokaamaa: 'at the door',
	dhunus: 'please wash',
	die: '(I) gave',
	dinchha: '(he/she/it) gives',
	dukhchha: 'hurts',
	gaaunmaa: 'in the village',
	gae: '(I) went',
	gare: '(I) did',
	garmimaa: 'in summer',
	gayo: 'went / went out',
	gharabhitra: 'inside the house',
	gharatir: 'toward home',
	gilaasamaa: 'in the glass',
	golabhendaako: 'of tomato',
	guliyo: 'sweet',
	haalnus: 'please add / put in',
	haansyo: '(he/she) laughed',
	hajuraaamaako: "grandmother's",
	haptaamaa: 'in a week',
	haraae: '(I) got lost',
	hau: '(you, informal) are',
	herchhau: '(we) watch',
	here: '(I) looked / watched',
	herna: 'to look / watch',
	hotalamaa: 'at the hotel',
	hu: '(I) am',
	hun: '(they) are',
	hunuhos: 'please be',
	jaadomaa: 'in winter',
	jaanchha: '(he/she/it) goes',
	jaanchhau: '(we) go',
	jaanubhayo: 'went (honorific)',
	jaanuhunchha: 'goes (honorific)',
	janmadin: 'birthday',
	janmadinamaa: 'on the birthday',
	jholaamaa: 'in the bag',
	jhyaalabaat: 'from the window',
	kaamamaa: 'at work',
	kaatnus: 'please cut',
	kahaanbaat: 'from where',
	kampyutaramaa: 'on the computer',
	khaae: '(I) ate',
	khaajaamaa: 'for snack',
	khaanaamaa: 'in the food',
	khaanchha: '(he/she/it) eats',
	khaanchhau: '(we) eat',
	khaandai: 'eating',
	khaandina: "(I) don't eat",
	khaanus: 'please eat',
	kheldai: 'playing',
	kholaamaa: 'in the stream',
	kholnus: 'please open',
	khuldaina: "doesn't open",
	kinchhau: '(we) buy',
	kursimaa: 'on the chair',
	kursimuni: 'under the chair',
	lagaaunuhunchha: 'wears (honorific)',
	lasunako: 'of garlic',
	lekhe: '(I) wrote',
	maagnus: 'please ask for',
	maagyo: '(he/she) asked for',
	maajhnus: 'please wash (dishes)',
	maddatako: 'for the help',
	manaaunchhau: '(we) celebrate',
	manasunamaa: 'in the monsoon',
	mandiramaa: 'at the temple',
	masang: 'with me',
	meri: 'my (feminine)',
	nabasnus: "please don't sit",
	nagarnus: "please don't do",
	najaanus: "please don't go",
	nakhaanus: "please don't eat",
	nepaalamaa: 'in Nepal',
	ochhyaanamaa: 'in bed',
	paae: '(I) got / received',
	paanimaa: 'in the water',
	paasawarda: 'password',
	padhdai: 'studying / reading',
	padhe: '(I) read (past)',
	padhna: 'to read / study',
	pahaadabaat: 'from the mountain',
	pahaadamaa: 'on the mountain',
	pahaadatir: 'toward the mountains',
	pakaaundai: 'cooking',
	pakaaunuhunchha: 'cooks (honorific)',
	phrijamaa: 'in the fridge',
	phulamaa: 'on the flower',
	pie: '(I) drank',
	piun: 'to drink',
	piunchha: '(he/she/it) drinks',
	piunchhu: '(I) drink',
	piundai: 'drinking',
	pokharaa: 'Pokhara',
	pokharaamaa: 'in Pokhara',
	puge: '(I) arrived',
	rukhamaa: 'in the tree',
	rukhamuni: 'under the tree',
	saabunale: 'with soap',
	saanpadekhi: 'from the snake',
	saathisang: 'with a friend',
	sabailaai: 'to everyone',
	sakdina: "(I) can't",
	samjhanus: 'please remember',
	shikshakalaai: 'to the teacher',
	sikdai: 'learning',
	sike: '(I) learned',
	siknu: 'to learn',
	skulamaa: 'at school',
	sune: '(I) heard',
	sutdai: 'sleeping',
	taalamaa: 'in the lake',
	tarakaarimaa: 'in the curry',
	tebalamaa: 'on the table',
	tebalamaathi: 'on top of the table',
	tebalamuni: 'under the table',
	thaalamaa: 'on the plate',
	tibhimaa: 'on TV',
	tihaaramaa: 'at Tihar',
	udchha: '(it) flies',
	uhaanko: 'his/her (honorific)',
	uhaanle: 'he/she (honorific)',
	usale: 'he/she',
	// Words that exist only in the fill-in-the-blank template items ("Ma ___ baat ho") —
	// build-words.mjs skips template sentences (a blank can't tile), so these never enter
	// words.json, but the sentences still render as glossable prompts.
	baat: 'from',
	maa: 'in / at',
	laai: 'to / for',
	nepaalimaa: 'in Nepali',
	bhanchha: 'is called / says',
	khojdai: 'looking for',
	tapaaisang: 'with you',
	banchhu: '(I) become',
};

// Top-priority sense overrides: a word whose standalone course meaning is NOT its usual
// mid-sentence sense. The item keeps its own `en` everywhere else — this only changes what
// the tap popover says when the word appears inside a sentence. AI drafts, Ross's review.
const SENSE_OVERRIDES = {
	ho: 'is / yes',
	hoina: 'is not / no',
};

// Extra senses APPENDED to an item-glossed word: genuine second meanings the course items
// don't carry but the ground-truth dictionary does (बुढा is "old man" as well as the
// course's "Husband"). AI drafts, Ross's review, like FILLS.
const EXTRA_SENSES = {
	budhaa: 'old man',
	budhi: 'old woman',
};

// Source 1: single-word course items — their romanized word IS a tile slug. Collect the
// senses of EVERY item sharing the slug (en + the reviewed enAlt alternates), in course
// order, so a homograph's popover lists all its meanings.
const itemSenses = {};
for (const unit of COURSE)
	for (const item of unit.items) {
		const np = SanoRomanize.romanize(item.dev);
		if (np.trim().split(/\s+/).length === 1) (itemSenses[slugOf(np)] ??= []).push(item.en, ...(item.enAlt || []));
	}

// Merge sense strings into one popover line: split each on " / ", drop repeats that differ
// only in case or a parenthetical ("Yes" after "Yes (polite)"), rejoin in first-seen order.
const senseKey = (s) =>
	s
		.toLowerCase()
		.replace(/\([^)]*\)/g, '')
		.replace(/[^a-z0-9 ]/g, '')
		.trim();
function mergeSenses(sources) {
	const seen = new Set();
	const out = [];
	for (const src of sources)
		for (const sense of String(src).split(' / ')) {
			const key = senseKey(sense);
			if (!key || seen.has(key)) continue;
			seen.add(key);
			out.push(sense.trim());
		}
	return out.join(' / ');
}

// Source 2: the ground-truth dictionary, keyed by cleaned Devanagari.
const dictGloss = {};
for (const entry of DICTIONARY) dictGloss[devClean(entry.dev || entry.key || '')] ??= entry.en;

// The dictionary's Claude glosses write a bare lowercase "i" ("i eat") — capitalize it
// for display; everything else ships verbatim.
const tidy = (s) => s.replace(/\bi\b/g, 'I');

// The inventory to gloss: every tile-word (words.json) PLUS any course-sentence word
// words.json doesn't carry — the fill-in-the-blank template items' words (see FILLS),
// which can still show up in a glossable prompt.
const inventory = { ...WORDS };
for (const unit of COURSE)
	for (const item of unit.items)
		for (const dev of [item.dev].concat((item.frames || []).map((f) => f.dev)))
			for (const word of SanoRomanize.romanize(dev).split(/\s+/)) {
				const slug = slugOf(word);
				if (slug && !inventory[slug]) inventory[slug] = { dev: '' };
			}

const glosses = {};
const stats = { item: 0, dict: 0, fill: 0 };
const missing = [];
const unusedFills = new Set(Object.keys(FILLS));
for (const [slug, entry] of Object.entries(inventory)) {
	const fromItem = itemSenses[slug] && mergeSenses(itemSenses[slug].concat(EXTRA_SENSES[slug] || []));
	const fromDict = dictGloss[devClean(entry.dev || '')];
	if (fromItem) stats.item++;
	else if (fromDict) stats.dict++;
	else if (FILLS[slug]) stats.fill++;
	else missing.push(`${slug} [${entry.dev}]`);
	const gloss = SENSE_OVERRIDES[slug] || fromItem || fromDict || FILLS[slug];
	if (gloss) glosses[slug] = tidy(gloss);
	if (FILLS[slug]) unusedFills.delete(slug);
}

if (missing.length) {
	console.error(`build-glosses: ${missing.length} tile-word(s) have no gloss — add FILLS entries:\n  ${missing.join('\n  ')}`);
	process.exit(1);
}
if (unusedFills.size) console.warn(`build-glosses: ${unusedFills.size} FILLS entr(ies) match no tile-word (stale?): ${[...unusedFills].join(', ')}`);

const keys = Object.keys(glosses).sort();
const body = keys.map((k) => `\t${/^[a-z][a-z0-9]*$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(glosses[k])},`).join('\n');
const out = `// Generated by tools/build-glosses.mjs — do not edit by hand; re-run it after content
// changes (it fails loudly on any un-glossed word). Per-word English for the tap-a-word
// lesson glosses (T37): romanized tile slug (the same key as audio/words/<slug>.mp3) → a
// short gloss. Sources, in priority order: the merged senses of every single-word course
// item sharing the slug (\`en\` + \`enAlt\` — homographs list ALL their meanings), the
// ground-truth dictionary (tools/dict), or a hand-drafted surface-form fill (FILLS in the
// build script — AI-drafted, pending Ross's review like every AI-drafted string).
const WORD_GLOSSES = {
${body}
};
`;
writeFileSync(join(ROOT, 'js', 'glosses.js'), out);
console.log(
	`build-glosses: wrote js/glosses.js — ${keys.length} glosses (${stats.item} from single-word items, ${stats.dict} from the dictionary, ${stats.fill} hand fills)`,
);
