// js/romanize.js — Devanagari → "Lite" romanization (the spec: docs/romanization.md).
//
// WHY: step one of "store only English + Devanagari, derive everything else by repeatable
// rules". Loaded right after js/data.js, this rewrites each COURSE item's in-memory `np` to
// romanize(item.dev), so every existing `item.np` reader (display, grading, dedup in
// js/sano.js) keeps working unchanged. The hand-drafted `np` stays in js/data.js as the
// review baseline until the derived output is trusted.
//
// PURE + classic script: defines the global `SanoRomanize` (like COURSE / SanoAudio / …), so
// the tests can lift it with no browser (tests/lift.mjs `liftGlobals` → tests/unit/
// romanize.test.mjs + tests/data/romanize-coverage.test.mjs). The COURSE rewrite at the
// bottom is guarded by `typeof COURSE` so the file is safe to eval in Node.
//
// DELIBERATE DEVIATIONS from the spec (each justified inline below):
//   • ञ is added to the consonant table — the spec's Stage-1 table omits it, but it occurs in
//     the corpus (e.g. सञ्चै).
//   • Nasalization unifies anusvara ं and chandrabindu ँ: → "n" before a consonant in the same
//     word, dropped word-final. (The spec drops chandrabindu always — which would silence
//     audible nasals like आउँदै / सँग — and maps anusvara word-final → "n", which doesn't match
//     the everyday forms तपाईं→tapai, कहाँ→kahaa.)
//   • "Table wins" over a conflicting worked-example: गर्छ→garchha (छ = chh; final schwa kept
//     after ch/chh), राम्रो→raamro (ा = aa, the one vowel length we preserve).

const SanoRomanize = (() => {
	'use strict';

	// --- Stage 1: consonants (docs/romanization.md §Stage 1). Retroflex/dental merged, all
	// nasals → n, ष/स → s, श → sh, व → w. `ञ` added (spec omits it). The nukta forms फ़/ज़ and
	// ड़ are defensive — none occur in the current corpus.
	const CONS = {
		क: 'k',
		ख: 'kh',
		ग: 'g',
		घ: 'gh',
		ङ: 'ng',
		च: 'ch',
		छ: 'chh',
		ज: 'j',
		झ: 'jh',
		ञ: 'n',
		ट: 't',
		ठ: 'th',
		ड: 'd',
		ढ: 'dh',
		ण: 'n',
		त: 't',
		थ: 'th',
		द: 'd',
		ध: 'dh',
		न: 'n',
		प: 'p',
		फ: 'ph',
		ब: 'b',
		भ: 'bh',
		म: 'm',
		य: 'y',
		र: 'r',
		ल: 'l',
		व: 'w',
		श: 'sh',
		ष: 's',
		स: 's',
		ह: 'h',
		ड़: 'r',
		फ़: 'f',
		ज़: 'z', // ड़ फ़ ज़ (defensive; nukta unused in corpus)
	};

	// --- Stage 2: vowels. Independent (word-initial) and matra (post-consonant) forms map to
	// the same output. Only a/aa keeps length (काम "kaam" vs कम "kam"); i and u length dropped.
	const VOWEL_INDEP = {
		अ: 'a',
		आ: 'aa',
		इ: 'i',
		ई: 'i',
		उ: 'u',
		ऊ: 'u',
		ए: 'e',
		ऐ: 'ai',
		ओ: 'o',
		औ: 'au',
		ऋ: 'ri',
	};
	const VOWEL_MATRA = {
		'ा': 'aa', // ा
		'ि': 'i', // ि
		'ी': 'i', // ी
		'ु': 'u', // ु
		'ू': 'u', // ू
		'े': 'e', // े
		'ै': 'ai', // ै
		'ो': 'o', // ो
		'ौ': 'au', // ौ
		'ृ': 'ri', // ृ
	};

	// --- Stage 3: special conjuncts that DON'T fall out of plain concatenation. क्ष is "ksh"
	// (not क+ष = "ks") and ज्ञ is the spoken "gy" (not "jn"). Matched greedily before the
	// per-letter walk. (Keys built with an explicit halant ्.) त्र / श्र are deliberately NOT
	// listed: they already concatenate correctly via the halant path (त्→t, र→r ⇒ "tr"), and
	// routing them through that path keeps the final-schwa cluster guard working (भित्र→bhitra,
	// not bhitr).
	const CONJUNCT = {
		क्ष: 'ksh', // क्ष
		ज्ञ: 'gy', // ज्ञ
	};

	const HALANT = '्'; // ्  kills the inherent 'a'
	const ANUSVARA = 'ं'; // ं
	const CHANDRA = 'ँ'; // ँ

	// Final inherent 'a' is morphological, not orthographic (कान "kaan" drops it, होइन "hoina"
	// keeps it — same final न). We DROP by default, but KEEP after ch/chh (the छ-final verb
	// forms गर्छ→garchha), after the productive negative suffix दैन (…→…daina), and for a small
	// set of irregular copula/negatives. Seeded here; extend from the review.
	const KEEP_FINAL_A_ONSETS = new Set(['ch', 'chh']);
	const NEG_SUFFIX = 'दैन'; // दैन
	// Irregular words that keep their final schwa in speech (Nepali retains more finals than
	// Hindi). The copula/negatives होइन/छैन, plus the short words harvested from Ross's np where
	// the only difference was a kept final 'a' (सय→saya, तर→tara, आज→aaja, …).
	const LEXICAL_KEEP = new Set(['होइन', 'छैन', 'सय', 'तर', 'अब', 'मह', 'आज', 'बिहान', 'तिर', 'आइज']);

	// Stems whose written nasal is silent in speech, so it must NOT surface as "n" before a
	// following postposition: तपाईं → तपाई (so तपाईंको → tapaaiko, not tapaainko).
	const SILENT_NASAL = [['तपाईं', 'तपाई']];

	// --- Stage 6 overrides: whole Devanagari words → exact-cased romanization. Two jobs:
	// (1) proper nouns the rules would lowercase (नेपाली→Nepali) — auto-harvested from the words
	//     Ross capitalized mid-phrase in the hand-drafted np; (2) loanwords the rules garble
	//     (अङ्ग्रेजी→Angreji, फोन→phone). The value is emitted verbatim, so its case survives
	//     even mid-phrase. The harvested set is shown in the review for confirmation.
	const WORD_OVERRIDES = {
		// Proper nouns (capitalized — harvested from Ross's mid-phrase caps in the old np).
		नेपाली: 'Nepali',
		अङ्ग्रेजी: 'Angreji', // also fixes the ङ्ग = "ngg" garble
		// English loanwords Ross spells in English (lowercase → capitalized at phrase start by
		// the cleanup step; mid-phrase they read as the common nouns they are). Confirm in the
		// review — flip any to its phonetic form (e.g. गिलास→"gilaas") if you prefer.
		हस्पिटल: 'hospital',
		कम्प्युटर: 'computer',
		हेडफोन: 'headphone',
		डस्टबिन: 'dustbin',
		डस्टर: 'duster',
		गिलास: 'glass',
		फ्रिज: 'fridge',
		होटल: 'hotel',
		मनसुन: 'monsoon',
		टिभी: 'TV',
	};

	const DEV_RANGE = /[ऀ-ॿ]/;
	const isDev = (ch) => DEV_RANGE.test(ch);
	const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

	// Romanize one pure-Devanagari word (no spaces / punctuation): tokenize into syllables,
	// resolve nasalization + the final schwa, assemble. Output is lowercase; the caller applies
	// overrides + first-letter capitalization.
	function romanizeWord(w) {
		for (const [from, to] of SILENT_NASAL) if (w.includes(from)) w = w.split(from).join(to);
		// 1. Tokenize into syllable records { onset, vowel, inherentA, nasal }.
		const syl = [];
		const last = () => syl[syl.length - 1];
		let i = 0;
		while (i < w.length) {
			// Greedy special-conjunct test (each key is consonant + halant + consonant).
			let hit = null;
			for (const key in CONJUNCT) {
				if (w.startsWith(key, i)) {
					hit = key;
					break;
				}
			}
			if (hit) {
				syl.push({ onset: CONJUNCT[hit], vowel: 'a', inherentA: true, nasal: false });
				i += hit.length;
				continue;
			}
			const c = w[i];
			if (has(CONS, c)) {
				syl.push({ onset: CONS[c], vowel: 'a', inherentA: true, nasal: false });
			} else if (has(VOWEL_INDEP, c)) {
				syl.push({ onset: '', vowel: VOWEL_INDEP[c], inherentA: false, nasal: false });
			} else if (has(VOWEL_MATRA, c)) {
				if (syl.length) {
					last().vowel = VOWEL_MATRA[c];
					last().inherentA = false;
				}
			} else if (c === HALANT) {
				if (syl.length) {
					last().vowel = '';
					last().inherentA = false;
				}
			} else if (c === ANUSVARA || c === CHANDRA) {
				if (syl.length) last().nasal = true;
			} else {
				// Unknown Devanagari — shouldn't happen (the coverage test guards this). Emit it
				// verbatim so it's visible rather than silently dropped.
				syl.push({ onset: c, vowel: '', inherentA: false, nasal: false });
			}
			i++;
		}
		if (!syl.length) return '';

		// 2. Final inherent schwa. Drop by default, but KEEP it when: the preceding syllable has
		// no vowel — dropping would create a final consonant cluster (भित्र→bhitra, सम्म→samma)
		// or leave a single-syllable word with no vowel at all (म→ma) — per the spec's Stage 5
		// "keep when dropping would create an unpronounceable cluster"; the syllable is nasalized
		// (a realized nasal schwa — the 1st-person negative बोल्दिनँ→boldina); the onset is ch/chh
		// (गर्छ→garchha); the word ends in the negative suffix दैन (हुँदैन→hundaina); or it is a
		// listed irregular copula/negative (होइन, छैन).
		const L = last();
		const prev = syl[syl.length - 2];
		const prevHasVowel = !!prev && prev.vowel !== '';
		if (
			L.inherentA &&
			L.vowel === 'a' &&
			!L.nasal &&
			prevHasVowel &&
			!KEEP_FINAL_A_ONSETS.has(L.onset) &&
			!LEXICAL_KEEP.has(w) &&
			!w.endsWith(NEG_SUFFIX)
		) {
			L.vowel = '';
		}

		// 3. Resolve nasalization + assemble. A nasal becomes "n" iff a later syllable in the
		// word has a consonant onset; otherwise (word-final / before a vowel) it is dropped.
		let out = '';
		for (let k = 0; k < syl.length; k++) {
			const s = syl[k];
			out += s.onset + s.vowel;
			if (s.nasal) {
				const next = syl[k + 1];
				if (next && next.onset !== '') out += 'n';
			}
		}
		return out;
	}

	// Romanize a full `dev` string: split into Devanagari-word runs vs everything-else runs
	// (spaces, ?, _, /, …), romanize the former (whole-word override first), pass the latter
	// through unchanged, then capitalize the first letter of the phrase. Proper-noun capitals
	// come from the overrides, so they survive mid-phrase.
	function romanize(dev) {
		if (!dev) return dev;
		const s = dev.normalize('NFC');
		let out = '';
		let i = 0;
		while (i < s.length) {
			if (isDev(s[i])) {
				let j = i;
				while (j < s.length && isDev(s[j])) j++;
				const word = s.slice(i, j);
				out += has(WORD_OVERRIDES, word) ? WORD_OVERRIDES[word] : romanizeWord(word);
				i = j;
			} else {
				out += s[i];
				i++;
			}
		}
		return out.replace(/[a-zA-Z]/, (c) => c.toUpperCase());
	}

	return {
		romanize,
		// Exposed for the coverage test (every corpus codepoint must be a known key).
		_tables: { CONS, VOWEL_INDEP, VOWEL_MATRA, CONJUNCT, HALANT, ANUSVARA, CHANDRA, WORD_OVERRIDES },
	};
})();

// Activate in the browser: derive each course item's `np` from its Devanagari `dev`. Guarded
// so the file is safe to eval in Node (the tests lift SanoRomanize with no COURSE present).
if (typeof COURSE !== 'undefined' && Array.isArray(COURSE)) {
	for (const unit of COURSE) {
		for (const item of unit.items) {
			if (item && item.dev) item.np = SanoRomanize.romanize(item.dev);
		}
	}
}
