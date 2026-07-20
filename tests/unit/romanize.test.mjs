// Devanagari → "Lite" romanization (js/romanize.js, spec: docs/romanization.md).
// Golden cases below are fixed by the design policy (and confirmed in Ross's review) — NOT
// asserted against the stored np (which this feature replaces) nor against the function's own
// output. One minimal case per rule + the corpus edge cases that drove the implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftGlobals } from '../lift.mjs';

const { SanoRomanize } = liftGlobals('js/romanize.js', ['SanoRomanize']);
const R = SanoRomanize.romanize;
const P = SanoRomanize.pronounce;

// [dev, want, why]
const CASES = [
	// Spec worked examples, under the "table wins" policy (गर्छ→garchha not garcha; ा kept as aa).
	['राम्रो', 'Raamro', 'spec example; ा=aa kept'],
	['गर्छ', 'Garchha', 'spec example; छ=chh, final a kept after ch/chh'],
	['ठूलो', 'Thulo', 'spec example; ू=u (i/u length dropped)'],
	['धन्यवाद', 'Dhanyabaad', 'व→b (VA_AS_B exception); final schwa dropped'],
	['वन', 'Ban', 'व→b (VA_AS_B exception)'],
	['वर्षको', 'Barsako', 'VA_AS_B matches as a prefix: suffixed form stays b'],
	['वनमा', 'Banamaa', 'VA_AS_B prefix match on a locative suffix'],
	['स्वागत छ', 'Swaagat chha', 'व→w default'],
	['वारि', 'Waari', 'व→w default unaffected by the prefix rule'],
	// व्य conjunct → "by" (positional rule in tokenize, T22).
	['व्यस्त', 'Byasta', 'व्य conjunct → by (was a VA_AS_B listing)'],
	['एक व्यक्ति', 'Ek byakti', 'व्य conjunct mid-phrase'],
	['व्यापार', 'Byaapaar', 'व्य conjunct generalizes to unlisted words'],
	['भव्य', 'Bhabya', 'word-final व्य: the cluster guard keeps the final schwa'],
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

// --- pronounce(): the English-respelling `pron` guide (conventions confirmed with Ross) ---
// schwa→uh, आ→aa, इ/ई→ee, उ/ऊ→oo, ए/े→ay, ऐ→ai, ओ→oh, औ→ow; फ→f, व→b, छ→chh; syllables
// hyphenated, halant codas merge into the previous syllable; all lowercase.
const PRON_CASES = [
	['नमस्ते', 'nuh-muhs-tay', 'schwa→uh, े→ay, coda स् merges'],
	['हुन्छ', 'hoon-chhuh', 'छ→chh, coda न merges'],
	['छ', 'chhuh', 'single syllable keeps its vowel'],
	['छैन', 'chhai-nuh', 'ऐ→ai; lexical-keep final schwa'],
	['खाना', 'khaa-naa', 'आ/ा→aa'],
	['किताब', 'kee-taab', 'ि→ee'],
	['दूध', 'doodh', 'ू→oo'],
	['एक', 'ayk', 'ए→ay'],
	['मेरो', 'may-roh', 'े→ay, ो→oh'],
	['ठूलो', 'thoo-loh', 'ो→oh'],
	['औषधि', 'ow-suh-dhee', 'औ→ow'],
	['धन्यवाद', 'dhuhn-yuh-baad', 'व→b (VA_AS_B exception)'],
	['स्वागत छ', 's-waa-guht chhuh', 'व→w default'],
	['व्यस्त', 'byas-ta', 'व्य conjunct; PRON_OVERRIDES polish'],
	['व्यक्ति', 'byak-tee', 'व्य conjunct; PRON_OVERRIDES polish'],
	['फूल', 'fool', 'फ→f'],
	['भित्र', 'bheet-ruh', 'cluster: coda त merges (bheet-ruh)'],
	['तपाईं', 'tuh-paa-ee', 'तपाईं silent nasal; ई→ee'],
	['तपाईंको', 'tuh-paa-ee-koh', 'no spurious n before को'],
	['घर', 'ghuhr', 'final inherent schwa dropped'],
	['सम्म', 'suhm-muh', 'cluster keep (final schwa retained)'],
	['के भयो?', 'kay bhuh-yoh?', '? passthrough; all lowercase'],
	['हस्पिटल', 'hos-pi-tal', 'loanword override'],
	['टिभी', 'tee-vee', 'loanword override'],
	['मलाई थाहा छैन', 'muh-laa-ee thaa-haa chhai-nuh', 'multi-word, spaces preserved'],
];

test('pronounce: golden cases (one per rule + corpus edge cases)', () => {
	for (const [dev, want, why] of PRON_CASES) {
		assert.equal(P(dev), want, `${dev} → expected ${want} (${why})`);
	}
});

test('pronounce: empty input unchanged; pure and idempotent', () => {
	assert.equal(P(''), '');
	for (const [dev] of PRON_CASES) {
		assert.equal(P(dev), P(dev), `not deterministic: ${dev}`);
		assert.equal(P(P(dev)), P(dev), `not idempotent: ${dev}`);
	}
});

// --- audio tags: ElevenLabs [bracket] performance cues ride inline in dialogue `dev`, are sent
// to the synth verbatim (synth-app.mjs), and are stripped everywhere `dev` becomes text. ---
const S = SanoRomanize.stripTags;

test('stripTags: removes [bracket] tags and tidies the gap they leave', () => {
	assert.equal(S('[whispers] नमस्ते'), 'नमस्ते', 'leading tag + space');
	assert.equal(S('म [sighs] खुसी छु'), 'म खुसी छु', 'mid-line tag collapses the double space');
	assert.equal(S('खुसी [laughs]!'), 'खुसी!', 'tag before punctuation leaves no gap');
	assert.equal(S('[shouting] टाढा जाऊ!'), 'टाढा जाऊ!', 'leading tag trimmed');
	assert.equal(S('कुनै ट्याग छैन।'), 'कुनै ट्याग छैन।', 'no tags → unchanged');
	assert.equal(S(''), '', 'empty unchanged');
});

test('romanize/pronounce ignore audio tags (the tag is render-only)', () => {
	assert.equal(R('[whispers] नमस्ते'), R('नमस्ते'));
	assert.equal(R('म [sighs] खुसी छु'), R('म खुसी छु'));
	assert.equal(P('[excited] एक'), P('एक'));
	assert.equal(P('धन्यवाद [warmly]'), P('धन्यवाद'));
});
