// Pure Devanagari normalization + word tokenization for the dictionary tool.
//
// Shared by build-dictionary.mjs AND tests/data/dictionary.test.mjs, so both key and
// tokenize identically — the "every COURSE word is represented" invariant depends on it.
// No imports, no I/O: trivially unit-testable and safe to lift.
//
// Transforms mirror js/romanize.js where they overlap (the DEV range and stripTags regex),
// so the dictionary and the app agree on what a word is.

// Main Devanagari block, matching DEV_RANGE in js/romanize.js (ऀ U+0900 … ॿ U+097F).
export const DEV_RE = /[ऀ-ॿ]/;

const ZERO_WIDTH = /[‌‍]/g; // ZWNJ / ZWJ — joiners that don't change the word identity
const CANDRABINDU = /ँ/g; // ँ  → collapse to anusvara ं (U+0902) for the match key only

// Drop ElevenLabs [performance tags] before any text use — mirrors stripTags in js/romanize.js:199.
// A no-op on tag-free input (all of COURSE except a couple of dialogue lines).
export function stripTags(s) {
	if (typeof s !== 'string') return s;
	return s
		.replace(/\[[^\]\n]*\]/g, '')
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/ ([,.!?;:।])/g, '$1')
		.trim();
}

// Normalize one word to a stable { display, key } pair.
//   display — what we show/store: NFC, tags stripped, joiners removed, edge punctuation trimmed.
//   key     — the fuzzy match key: display + candrabindu→anusvara, for deduping surface variants.
// Preserving display while collapsing only the key avoids fusing genuine minimal pairs in output.
export function normalizeWord(word) {
	if (typeof word !== 'string') return { display: '', key: '' };
	let display = stripTags(word).normalize('NFC').replace(ZERO_WIDTH, '');
	// Trim leading/trailing punctuation, danda, quotes, digits-as-bullets, whitespace.
	display = display.replace(/^[\s।॥,.!?;:()"'“”‘’\-—–]+/u, '').replace(/[\s।॥,.!?;:()"'“”‘’\-—–]+$/u, '');
	const key = display.replace(CANDRABINDU, 'ं');
	return { display, key };
}

// Split a phrase `dev` string into word-level tokens, keeping only tokens that contain at least
// one Devanagari letter (drops Latin, standalone punctuation, emoji). Returns normalized
// { display, key } objects, deduped per call by key.
export function tokenize(dev) {
	const out = [];
	const seen = new Set();
	for (const piece of splitWords(dev)) {
		const norm = normalizeWord(piece);
		if (!norm.key || seen.has(norm.key)) continue;
		seen.add(norm.key);
		out.push(norm);
	}
	return out;
}

// Raw word split (tags stripped, Devanagari-bearing pieces only) — NOT normalized, NOT deduped.
// For frequency counting, where every occurrence matters. `tokenize` builds on this.
export function splitWords(dev) {
	if (typeof dev !== 'string') return [];
	return stripTags(dev)
		.split(/[\s।॥,.!?;:()"'“”‘’\-—–/\\]+/u)
		.filter((p) => p && DEV_RE.test(p));
}
