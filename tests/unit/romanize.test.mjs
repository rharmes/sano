// Devanagari → "Lite" romanization (js/romanize.js, spec: docs/romanization.md).
// Golden cases below are fixed by the design policy (and confirmed in Ross's review) — NOT
// asserted against the stored np (which this feature replaces) nor against the function's own
// output. One minimal case per rule + the corpus edge cases that drove the implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftGlobals } from '../lift.mjs';

const { SanoRomanize } = liftGlobals('js/romanize.js', ['SanoRomanize']);
const R = SanoRomanize.romanize;

// [dev, want, why]
const CASES = [
	// Spec worked examples, under the "table wins" policy (गर्छ→garchha not garcha; ा kept as aa).
	['राम्रो', 'Raamro', 'spec example; ा=aa kept'],
	['गर्छ', 'Garchha', 'spec example; छ=chh, final a kept after ch/chh'],
	['ठूलो', 'Thulo', 'spec example; ू=u (i/u length dropped)'],
	['धन्यवाद', 'Dhanyawaad', 'spec example; व=w, final schwa dropped'],
	// Basic syllables + final inherent-schwa drop.
	['नमस्ते', 'Namaste', 'inherent a kept medially, े ends the word'],
	['घर', 'Ghar', 'final inherent schwa dropped'],
	['भात', 'Bhaat', 'ा=aa, final schwa dropped'],
	['नमस्कार', 'Namaskaar', 'multi-syllable, final schwa dropped'],
	['दिन', 'Din', 'ि=i (length dropped), final schwa dropped'],
	['आज', 'Aaja', 'short word in the lexical keep-list (final schwa retained)'],
	['तर', 'Tara', 'lexical keep-list'],
	// ञ — added to the table (the spec omits it).
	['सञ्चै', 'Sanchai', 'ञ=n (spec table omitted it)'],
	// Conjuncts: क्ष needs the table ("ksh"); त्र routes through the halant path ("tr").
	['शिक्षक', 'Shikshak', 'क्ष=ksh conjunct'],
	['भित्र', 'Bhitra', 'त्र via halant; final schwa KEPT (cluster guard)'],
	// Final schwa KEPT to avoid a final consonant cluster, gemination, or a vowelless word.
	['सम्म', 'Samma', 'kept: would be a final mm cluster'],
	['मद्दत', 'Maddat', 'geminate dd via halant; final schwa dropped'],
	['म', 'Ma', 'single syllable: keep its only vowel'],
	['छ', 'Chha', 'single syllable; छ=chh'],
	['हुन्छ', 'Hunchha', 'final a kept after chh'],
	// Nasalization: → n before a consonant; dropped word-final (unified ं/ँ).
	['आउँदै', 'Aaundai', 'chandrabindu before a consonant → n'],
	['बैंक', 'Baink', 'anusvara before a consonant → n'],
	['हुँदैन', 'Hundaina', 'nasal→n; दैन negative suffix keeps final a'],
	['बोल्दिनँ', 'Boldina', 'nasalized final schwa kept (1st-person negative)'],
	['तपाईं', 'Tapaai', 'word-final nasal dropped'],
	['तपाईंको', 'Tapaaiko', 'तपाईं silent-nasal stem: no spurious n before को'],
	['कहाँ', 'Kahaa', 'word-final nasal dropped'],
	['हुँ', 'Hu', 'word-final nasal dropped'],
	// Vowel length: only a/aa preserves length.
	['काम', 'Kaam', 'ा=aa preserved (kaam vs kam)'],
	['आमा', 'Aamaa', 'both aa preserved'],
	// Irregular copula/negatives kept lexically.
	['होइन', 'Hoina', 'lexical keep'],
	['छैन', 'Chhaina', 'lexical keep'],
	// Whole-word overrides (proper nouns capitalized; loanwords lowercase → capitalized at start).
	['नेपाली', 'Nepali', 'proper-noun override'],
	['अङ्ग्रेजी', 'Angreji', 'proper-noun override (also fixes ngg)'],
	['हस्पिटल', 'Hospital', 'loanword override'],
	['टिभी', 'TV', 'loanword override (stays uppercase)'],
	// Passthrough of non-Devanagari + first-letter capitalization, multi-word.
	['के भयो?', 'Ke bhayo?', '? passthrough, capitalize first letter'],
	['मलाई थाहा छैन', 'Malaai thaahaa chhaina', 'multi-word, spaces preserved'],
	['नेपालीमा ___ लाई के भन्छ?', 'Nepaalimaa ___ laai ke bhanchha?', '___ placeholder + ? passthrough'],
];

test('romanize: golden cases (one per rule + corpus edge cases)', () => {
	for (const [dev, want, why] of CASES) {
		assert.equal(R(dev), want, `${dev} → expected ${want} (${why})`);
	}
});

test('romanize: pure proper-noun capital survives mid-phrase', () => {
	assert.equal(R('तपाईं नेपाली बोल्नुहुन्छ?'), 'Tapaai Nepali bolnuhunchha?');
});

test('romanize: empty / falsy input is returned unchanged', () => {
	assert.equal(R(''), '');
	assert.equal(R(undefined), undefined);
	assert.equal(R(null), null);
});

test('romanize: pure and idempotent', () => {
	for (const [dev] of CASES) {
		assert.equal(R(dev), R(dev), `not deterministic: ${dev}`);
		// A second pass sees only Latin/passthrough, so the output is a fixed point.
		assert.equal(R(R(dev)), R(dev), `not idempotent: ${dev}`);
	}
});
