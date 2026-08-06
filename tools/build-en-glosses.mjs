// Build js/en-glosses.js — the per-word Nepali lookup behind the tap-a-word glosses on
// ENGLISH prompts (T59), the mirror of what tools/build-glosses.mjs does for Nepali ones.
//
//   node tools/build-en-glosses.mjs           # (re)write js/en-glosses.js and print stats
//   node tools/build-en-glosses.mjs --report  # also write design/en-gloss-report.json
//
// T37 could key its lookup on the word alone: a romanized Nepali word means roughly the
// same thing wherever it appears, so one slug → one gloss covers the course. The English
// side can't work that way. "have" is छ in "I have a room" and खान्छु in "have a meal",
// and only 251 of 959 items are single-word, so there is no English word → Nepali word
// table to reverse. The alignment has to be per PROMPT.
//
// So this aligns each frame's OWN English against its OWN Nepali, which makes the context
// unambiguous, using the T37 glosses as the bridge:
//
//   dev  घरमा पानी छ   → np "gharamaa paani chha"
//   WORD_GLOSSES        gharamaa "at home" · paani "Water" · chha "Yes / Is / Has"
//   en   "There is water at home"
//        └─ match each word's gloss back into the English ─┘
//   →  [ {en:"There is", np:"chha"}, {en:"water", np:"paani"}, {en:"at home", np:"gharamaa"} ]
//
// A matched span can be several English words ("at home" → gharamaa), which is the point:
// a case-suffixed noun IS a phrase in English, and underlining the phrase as one chunk
// tells the truth about the mapping. Unmatched English words stay plain, non-tappable
// text — a missing hint is fine, a WRONG hint is not.
//
// Output is keyed by the frame's audioId (item.id, or `<id>-fN` for an alternate frame),
// the same identity js/sano.js already has on `ex.frame`.
//
// Anything the aligner can't resolve is listed in the report for design/en-gloss.html,
// where Ross edits the alignment; his rulings come back here as OVERRIDES (below) — the
// same shape as FILLS in build-glosses.mjs, and reviewed the same way.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const COURSE = Function(readFileSync(join(ROOT, 'js', 'data.js'), 'utf8') + '; return COURSE;')();
const SanoRomanize = Function(readFileSync(join(ROOT, 'js', 'romanize.js'), 'utf8') + '; return SanoRomanize;')();
const WORD_GLOSSES = Function(readFileSync(join(ROOT, 'js', 'glosses.js'), 'utf8') + '; return WORD_GLOSSES;')();

// Slug logic mirrors js/sano.js playTileWord / build-glosses.mjs, so a Nepali word resolves
// to the same key here as it does at runtime.
const normalize = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
const slugOf = (w) => normalize(w).replace(/\s+/g, '-');

// Reviewed alignments, keyed by audioId — Ross's rulings out of design/en-gloss.html for
// prompts the aligner got wrong or couldn't finish. An entry REPLACES the computed
// alignment wholesale: one [englishWord, hint] pair per word of the prompt, in order, with
// an empty hint for "leave this word plain".
//
// Grouping works in both directions. Several ENGLISH words sharing one hint merge into a
// single underlined span on the way out (mergeSegs), so that side is written here as its
// individual words: [['at','gharamaa'], ['home','gharamaa']]. A hint may equally be several
// NEPALI words — a contiguous phrase of that prompt's own sentence — for the reverse case,
// where one English word is a whole Nepali phrase: [['sorry','maaf garnuhos']].
const OVERRIDES = {};

// English words that carry no meaning of their own here, so they must never be the sole
// evidence for a match: matching "the" against a gloss containing "the" would attach a
// random Nepali word to every article in the course.
const FUNCTION_WORDS = new Set(['a', 'an', 'the', 'of', 'to', 'is', 'are', 'am', 'be', 'do', 'does', 'did', 'it', 'and', 'or']);

// Crude English stemmer — enough to match a gloss's citation form against the prompt's
// inflected one ("comes"/"come", "cities"/"city"). Deliberately conservative: it only
// strips suffixes, so it can merge two different words but never invents one.
const IRREGULAR = {
	came: 'come',
	went: 'go',
	was: 'be',
	were: 'be',
	been: 'be',
	is: 'be',
	are: 'be',
	am: 'be',
	ate: 'eat',
	had: 'have',
	has: 'have',
	said: 'say',
	saw: 'see',
	did: 'do',
	does: 'do',
	got: 'get',
	made: 'make',
	took: 'take',
	gave: 'give',
	men: 'man',
	women: 'woman',
	children: 'child',
	feet: 'foot',
};
const stem = (w) => {
	if (IRREGULAR[w]) return IRREGULAR[w];
	if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
	if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
	if (/[^s]s$/.test(w) && w.length > 3) return w.slice(0, -1);
	if (/ing$/.test(w) && w.length > 5) return w.slice(0, -3);
	if (/ed$/.test(w) && w.length > 4) return w.slice(0, -2);
	return w;
};

// Split an English string into tokens that keep their original text (so the prompt can be
// rebuilt verbatim) alongside a normalized/stemmed key for matching.
//
// Two kinds of token are marked `aside` and never hinted (Ross, 2026-08-06): anything
// inside parentheses, and anything with no letters or digits at all. A prompt's "(formal)",
// "(informal)", "(cooked)" is a note about register or sense, and the "/" between two
// glosses is a separator — neither is part of the sentence, and there is no Nepali word
// standing behind either, so underlining them would promise a translation that doesn't
// exist. (The punctuation rule also covers the "___" of a fill-in-the-blank prompt and the
// stray "—".) Asides stay in the token list as plain text — the prompt must still rebuild
// verbatim — but are skipped by the matcher and never count as gaps. A parenthetical group
// can span several tokens: "(in touch)".
function tokenize(text) {
	let open = false;
	return String(text)
		.split(/\s+/)
		.filter(Boolean)
		.map((raw) => {
			const starts = raw.includes('(');
			const ends = raw.includes(')');
			const inParens = open || starts;
			if (starts && !ends) open = true;
			if (ends) open = false;
			const key = raw.toLowerCase().replace(/[^a-z0-9']/g, '');
			return { raw, key, stem: stem(key), aside: inParens || !key };
		});
}

// The candidate English phrasings of one Nepali word: its gloss, split into senses on
// " / ", each also offered with any parenthetical dropped ("(I) came" → "came", so it
// matches a prompt that has no pronoun) and with leading function words dropped.
function phrasings(gloss) {
	const out = [];
	for (const sense of String(gloss).split(' / ')) {
		const full = sense.trim();
		const noParens = full.replace(/\([^)]*\)/g, ' ').trim();
		for (const variant of [full, noParens]) {
			const toks = tokenize(variant.replace(/[()]/g, ' ')).filter((t) => t.key);
			if (!toks.length) continue;
			out.push(toks);
			// Also allow the phrase without its leading article/preposition, so the gloss
			// "in the market" still matches a prompt that says just "market".
			let i = 0;
			while (i < toks.length && FUNCTION_WORDS.has(toks[i].key)) i++;
			if (i && i < toks.length) out.push(toks.slice(i));
		}
	}
	return out;
}

// Align one frame: English prompt text + its romanized Nepali → a per-WORD assignment.
// Returns { tokens: [[englishWord, npWordOrEmpty], …] — one pair per word of the prompt, in
// order (mergeSegs turns neighbours into spans later); gaps: [english words left unhinted];
// unused: [np words nothing pointed at] }. The last two feed the review tool, not the app.
function align(en, np) {
	const promptToks = tokenize(en);
	const npWords = String(np)
		.split(/\s+/)
		.filter(Boolean)
		.map((word, i) => ({ i, word, slug: slugOf(word), gloss: WORD_GLOSSES[slugOf(word)] || '' }));

	// Every (np word, contiguous prompt span) pair the glosses support.
	const candidates = [];
	for (const nw of npWords) {
		if (!nw.gloss) continue;
		for (const phrase of phrasings(nw.gloss)) {
			for (let start = 0; start + phrase.length <= promptToks.length; start++) {
				let ok = true;
				for (let k = 0; k < phrase.length; k++) {
					const p = promptToks[start + k];
					// p.aside: never let a match reach into a parenthetical note.
					if (!p.key || p.aside || (p.key !== phrase[k].key && p.stem !== phrase[k].stem)) {
						ok = false;
						break;
					}
				}
				// A match made only of function words is no evidence at all.
				if (ok && phrase.some((t) => !FUNCTION_WORDS.has(t.key))) {
					candidates.push({ npIndex: nw.i, word: nw.word, start, len: phrase.length });
				}
			}
		}
	}

	// Longest spans win, so "at home" beats a bare "home"; ties go to the earlier prompt
	// position for a stable, order-independent result. Each prompt word and each Nepali
	// word is claimed at most once.
	candidates.sort((a, b) => b.len - a.len || a.start - b.start || a.npIndex - b.npIndex);
	// owner[i] holds a Nepali *index*, not the word: a sentence can repeat a word, and the
	// grouping pass below has to reason about which position was claimed.
	const owner = new Array(promptToks.length).fill(null);
	const takenNp = new Set();
	const claim = (c) => {
		for (let k = 0; k < c.len; k++) if (owner[c.start + k] !== null) return false;
		for (let k = 0; k < c.len; k++) owner[c.start + k] = c.npIndex;
		takenNp.add(c.npIndex);
		return true;
	};
	for (const c of candidates) if (!takenNp.has(c.npIndex)) claim(c);
	// Second pass, letting a Nepali word claim a further span. One word often carries two
	// English senses ("Namaste" is the whole of "Hello / Goodbye", "Agaadi" of "In front /
	// Ahead"), and after the one-span-each pass the second sense would sit there unhinted.
	// The evidence is the same gloss either way, so this adds reach without adding risk.
	for (const c of candidates) claim(c);

	const gaps = promptToks.filter((t, i) => owner[i] === null && t.key && !t.aside && !FUNCTION_WORDS.has(t.key)).map((t) => t.raw);

	// --- why the Nepali side is NOT grouped automatically (measured 2026-08-06) ---
	// Several Nepali words can stand for one English word ("sorry" IS "maaf garnuhos"), so a
	// hint may be a contiguous PHRASE — the format supports it and design/en-gloss.html can
	// assign it. What this script will not do is *infer* those groups.
	//
	// The obvious rule — when every English content word is hinted, attach each leftover
	// Nepali word to its one claimed neighbour — fires on 303 prompts and is wrong on most of
	// them, because the leftovers are nearly always copulas whose English counterpart is an
	// unhinted small word: "Dudh chiso chha" gave `cold → chiso chha` (gluing "is" onto
	// "cold"), "Ma chiyaa piunchhu" gave `tea → Ma chiyaa`, and "Mero naam ___ ho" swallowed
	// the fill-in blank. Every one of those is a WRONG hint on a card where the learner is
	// being graded on producing that exact Nepali — the failure mode this whole file is built
	// to avoid. So leftovers stay leftovers, and stay visible in the report for review.
	const tokens = promptToks.map((t, i) => [t.raw, owner[i] === null ? '' : npWords[owner[i]].word]);
	const unused = npWords.filter((w) => !takenNp.has(w.i)).map((w) => w.word);
	return { tokens, gaps, unused };
}

// Neighbouring prompt words that resolved to the same Nepali word become ONE tappable
// span, and unmatched words merge into runs of plain text. Alignment is stored and
// reviewed per word — spans are just how it reads on screen ("at home" underlined once,
// because that whole phrase IS gharamaa).
function mergeSegs(tokens) {
	const segs = [];
	for (const [raw, np] of tokens) {
		const last = segs[segs.length - 1];
		if (last && last.np === np) last.en += ' ' + raw;
		else segs.push({ en: raw, np });
	}
	return segs;
}

// Every frame that can appear as an English prompt: the canonical sentence of every item
// plus each alternate frame (T28), keyed the way js/sano.js keys them.
const rows = [];
for (const unit of COURSE)
	for (const item of unit.items) {
		const frames = [{ id: item.id, en: item.en, dev: item.dev }].concat(
			(item.frames || []).map((f, i) => ({ id: item.id + '-f' + (i + 1), en: f.en, dev: f.dev })),
		);
		for (const f of frames) rows.push({ ...f, unit: unit.title || unit.id, np: SanoRomanize.romanize(f.dev) });
	}

const entries = {};
const report = [];
const stats = { rows: 0, full: 0, partial: 0, none: 0, overridden: 0, words: 0, hinted: 0 };
for (const row of rows) {
	stats.rows++;
	let result;
	if (OVERRIDES[row.id]) {
		result = { tokens: OVERRIDES[row.id].map(([en, np]) => [en, np || '']), gaps: [], unused: [] };
		stats.overridden++;
	} else {
		result = align(row.en, row.np);
	}
	const segs = mergeSegs(result.tokens);
	const tappable = segs.filter((s) => s.np).length;
	const contentWords = tokenize(row.en).filter((t) => t.key && !t.aside && !FUNCTION_WORDS.has(t.key)).length;
	stats.words += contentWords;
	stats.hinted += contentWords - result.gaps.length;
	if (!tappable) stats.none++;
	else if (!result.gaps.length) stats.full++;
	else stats.partial++;
	// A prompt with nothing tappable is simply absent from the lexicon — the app then
	// renders it as the plain text it renders today.
	if (tappable) entries[row.id] = segs.map((s) => (s.np ? [s.en, s.np] : [s.en]));
	report.push({
		id: row.id,
		unit: row.unit,
		en: row.en,
		np: row.np,
		tokens: result.tokens,
		// Which words are parenthetical asides — the review tool greys them out and offers no
		// dropdown, so they never look like unfinished work.
		asides: tokenize(row.en).map((t) => t.aside),
		gaps: result.gaps,
		unused: result.unused,
		overridden: !!OVERRIDES[row.id],
	});
}

const keys = Object.keys(entries).sort();
const body = keys.map((k) => `\t${JSON.stringify(k)}: ${JSON.stringify(entries[k])},`).join('\n');
const out = `// Generated by tools/build-en-glosses.mjs — do not edit by hand; re-run it after content
// changes. Per-prompt English→Nepali alignment behind the tap-a-word hints on ENGLISH
// prompts (T59): frame audioId (item.id, or <id>-fN) → the prompt's words in order, as
// [english] for plain text or [english, romanizedNepali] for a tappable span.
//
// Keyed per PROMPT, not per word, because an English word's Nepali depends on its sentence
// ("have" is छ in one frame and खान्छु in another). Built by aligning each frame's own
// English against its own Nepali through the T37 per-word glosses; anything the aligner
// couldn't resolve stays plain text here, because a wrong hint is worse than no hint.
const EN_GLOSSES = {
${body}
};
`;
// A prompt's alignment is one long array, so where the lines wrap is Prettier's call, not
// this script's — run the repo's own config over the output rather than guess at it, or
// `tools/format.sh --check` (and CI) fails on a file nobody is supposed to hand-edit.
writeFileSync(join(ROOT, 'js', 'en-glosses.js'), await format(out, { ...JSON.parse(readFileSync(join(ROOT, '.prettierrc'), 'utf8')), parser: 'babel' }));

if (process.argv.includes('--report')) {
	writeFileSync(join(ROOT, 'design', 'en-gloss-report.json'), JSON.stringify(report, null, '\t'));
	console.log(`build-en-glosses: wrote design/en-gloss-report.json (${report.length} prompts)`);
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
console.log(
	`build-en-glosses: wrote js/en-glosses.js — ${keys.length} of ${stats.rows} prompts hintable ` +
		`(${stats.full} complete, ${stats.partial} partial, ${stats.none} with nothing matched, ${stats.overridden} from OVERRIDES); ` +
		`${stats.hinted}/${stats.words} content words hinted (${pct(stats.hinted, stats.words)}%)`,
);
