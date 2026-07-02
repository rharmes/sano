// js/romanize.js — Devanagari → "Lite" romanization + the English-respelling pronunciation guide.
//
// Two pure, table-driven derivations from `dev`, sharing one syllable tokenizer:
//   • romanize(dev) — the "Lite" headword (spec: docs/romanization.md). At load this rewrites
//     each COURSE item's in-memory `np` to romanize(item.dev); the hand-drafted np was removed.
//   • pronounce(dev) — the `pron` guide: the same syllables respelled for English intuition
//     (schwa→"uh", इ/ई→"ee", ओ→"oh", ए/े→"ay", औ→"ow", फ→"f", व→"b"; छ→"chh"), hyphenated by
//     syllable, all lowercase. Conventions confirmed with Ross. The COURSE rewrite below derives
//     both np and pron from dev.
//
// Classic script defining the global `SanoRomanize` (like COURSE / SanoAudio), so the tests lift
// it (tests/lift.mjs). The COURSE rewrite at the bottom is guarded by `typeof COURSE`.
//
// DELIBERATE DEVIATIONS from docs/romanization.md (justified inline): ञ added to the consonant
// table; nasalization unifies anusvara ं and chandrabindu ँ (→ "n" before a consonant, dropped
// word-final); "table wins" over a conflicting worked example (गर्छ→garchha, राम्रो→raamro).

const SanoRomanize = (() => {
	'use strict';

	// ===== Lite romanization tables (docs/romanization.md) =====
	// Stage 1: consonants. Retroflex/dental merged, all nasals → n, ष/स → s, श → sh, व → w. `ञ`
	// added (spec omits it). Nukta forms ड़/फ़/ज़ are defensive — none occur in the corpus.
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

	// Stage 2: vowels — independent (word-initial) and matra forms map to the same output. Only
	// a/aa keeps length (काम "kaam" vs कम "kam"); i and u length dropped.
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

	// Stage 3: conjuncts that don't fall out of plain concatenation (क्ष = "ksh" not "ks"; ज्ञ =
	// "gy"). त्र / श्र are deliberately omitted — they route through the halant path, which keeps
	// the final-schwa cluster guard working (भित्र→bhitra).
	const CONJUNCT = {
		क्ष: 'ksh', // क्ष
		ज्ञ: 'gy', // ज्ञ
	};

	const HALANT = '्'; // ्  kills the inherent 'a'
	const ANUSVARA = 'ं'; // ं
	const CHANDRA = 'ँ'; // ँ
	const VISARGA = 'ः'; // ः  visarga → a coda "h" after the vowel (प्रायः → praayah, अतः → atah)

	// ===== Pronunciation tables (English respelling; conventions confirmed with Ross) =====
	// Consonants follow Lite except फ→"f". Vowels are respelled for English intuition. (व is "w" by
	// default, like Lite; the few "b" words are handled by VA_AS_B below — for both np and pron.)
	const PRON_CONS = Object.assign({}, CONS, { फ: 'f' });
	const PRON_VOWEL_INDEP = {
		अ: 'uh',
		आ: 'aa',
		इ: 'ee',
		ई: 'ee',
		उ: 'oo',
		ऊ: 'oo',
		ए: 'ay',
		ऐ: 'ai',
		ओ: 'oh',
		औ: 'ow',
		ऋ: 'ri',
	};
	const PRON_VOWEL_MATRA = {
		'ा': 'aa', // ा
		'ि': 'ee', // ि
		'ी': 'ee', // ी
		'ु': 'oo', // ु
		'ू': 'oo', // ू
		'े': 'ay', // े
		'ै': 'ai', // ै
		'ो': 'oh', // ो
		'ौ': 'ow', // ौ
		'ृ': 'ri', // ृ
	};

	// Inherent-vowel rendering (schwa) + the table bundle each output uses. tokenize() is
	// parameterized by one of these, so the syllable logic is shared.
	const LITE = { INHERENT: 'a', CONS, VOWEL_INDEP, VOWEL_MATRA, CONJUNCT };
	const PRON = { INHERENT: 'uh', CONS: PRON_CONS, VOWEL_INDEP: PRON_VOWEL_INDEP, VOWEL_MATRA: PRON_VOWEL_MATRA, CONJUNCT };

	const KEEP_FINAL_A_ONSETS = new Set(['ch', 'chh']);
	const NEG_SUFFIX = 'दैन'; // दैन
	// Irregular words that keep their final schwa in speech (Nepali retains more finals than
	// Hindi). The copula/negatives होइन/छैन, plus short words harvested from Ross's np where the
	// only difference was a kept final 'a' (सय→saya, तर→tara, आज→aaja, …).
	const LEXICAL_KEEP = new Set(['होइन', 'छैन', 'सय', 'तर', 'अब', 'मह', 'आज', 'बिहान', 'तिर', 'आइज']);

	// Stems whose written nasal is silent in speech, so it must NOT surface as "n" before a
	// following postposition: तपाईं → तपाई (so तपाईंको → tapaaiko, not tapaainko).
	const SILENT_NASAL = [['तपाईं', 'तपाई']];

	// व is usually "w" but is realized as "b" in a handful of words (native-speaker confirmed).
	// Applied in both tracks so np and pron agree: धन्यवाद→Dhanyabaad / dhuhn-yuh-baad. (व्यस्त
	// "busy" → Byasta; its pron is polished in PRON_OVERRIDES so the initial व्य reads "byas-" not "b-y".)
	const VA_AS_B = new Set(['धन्यवाद', 'वन', 'विद्यार्थी', 'वर्ष', 'व्यस्त']);

	// Stage-6 overrides for the Lite headword: whole Devanagari words → exact-cased romanization.
	// Proper nouns (capitalized, harvested from Ross's mid-phrase caps) + English loanwords.
	const WORD_OVERRIDES = {
		नेपाली: 'Nepali',
		अङ्ग्रेजी: 'Angreji', // also fixes the ङ्ग = "ngg" garble
		दशैं: 'Dashain', // festival proper noun; keep the word-final nasal the Lite scheme would drop (→ "Dashai")
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

	// Pronunciation overrides: loanwords the rules respell oddly get an English-friendly form.
	// Seeded from the review (whole Devanagari word → exact pron, lowercase).
	const PRON_OVERRIDES = {
		// English-friendly forms for loanwords the rules respell literally, plus अङ्ग्रेजी (whose
		// ङ्ग garbles to "ngg"). Lowercase, hyphenated — Ross's hand-drafted pron.
		हस्पिटल: 'hos-pi-tal',
		कम्प्युटर: 'com-pyu-ter',
		हेडफोन: 'hed-phone',
		डस्टबिन: 'dust-bin',
		डस्टर: 'dus-tar',
		गिलास: 'glass',
		फ्रिज: 'frij',
		होटल: 'ho-tal',
		मनसुन: 'mon-soon',
		टिभी: 'tee-vee',
		अङ्ग्रेजी: 'ang-gray-jee',
		व्यस्त: 'byas-ta', // native व→b word (see VA_AS_B); polished so it reads byas-ta, not b-yuhs-tuh
		दशैं: 'duh-shain', // keep the word-final nasal (Lite drops it → duh-shai); matches the WORD_OVERRIDE "Dashain"
		प्रायः: 'praa-yah', // visarga is now handled in tokenize() (→ praayah); this just polishes the pron to praa-yah
	};

	const DEV_RANGE = /[ऀ-ॿ]/;
	const isDev = (ch) => DEV_RANGE.test(ch);
	const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

	// ElevenLabs v3 performance tags — voice-acting directions in [square brackets], e.g.
	// [whispers] [laughs] [sighs] (elevenlabs.io/blog/v3-audiotags). They are placed inline in a
	// dialogue line's `dev` so the audio render hears them (tools/tts/synth-app.mjs sends `dev`
	// verbatim). They are delivery cues, NOT spoken text, and must never reach the screen, so
	// stripTags() drops them (and tidies the gap they leave) anywhere `dev` is turned into text:
	// romanize()/pronounce() strip first, and the future Devanagari track (SR-11) should call this
	// before showing any dialogue `dev`. A no-op on tag-free input (the whole COURSE corpus).
	const stripTags = (s) =>
		typeof s === 'string'
			? s
					.replace(/\[[^\]\n]*\]/g, '')
					.replace(/[ \t]{2,}/g, ' ')
					.replace(/ ([,.!?;:।])/g, '$1')
					.trim()
			: s;

	// Shared tokenizer: a pure-Devanagari word → syllable records { onset, vowel, inherentA,
	// nasalOut }, mapped through the tables `T`. Resolves the final inherent schwa and resolves
	// nasalization (ं/ँ → "n" before a consonant onset, else dropped).
	function tokenize(w, T) {
		// व → "b" for the listed words (else the table's default "w"); applies to whichever table T is.
		const CONS_T = VA_AS_B.has(w) ? Object.assign({}, T.CONS, { व: 'b' }) : T.CONS;
		for (const [from, to] of SILENT_NASAL) if (w.includes(from)) w = w.split(from).join(to);
		const syl = [];
		const last = () => syl[syl.length - 1];
		let i = 0;
		while (i < w.length) {
			let hit = null;
			for (const key in T.CONJUNCT) {
				if (w.startsWith(key, i)) {
					hit = key;
					break;
				}
			}
			if (hit) {
				syl.push({ onset: T.CONJUNCT[hit], vowel: T.INHERENT, inherentA: true, nasal: false });
				i += hit.length;
				continue;
			}
			const c = w[i];
			if (has(CONS_T, c)) {
				syl.push({ onset: CONS_T[c], vowel: T.INHERENT, inherentA: true, nasal: false });
			} else if (has(T.VOWEL_INDEP, c)) {
				syl.push({ onset: '', vowel: T.VOWEL_INDEP[c], inherentA: false, nasal: false });
			} else if (has(T.VOWEL_MATRA, c)) {
				if (syl.length) {
					last().vowel = T.VOWEL_MATRA[c];
					last().inherentA = false;
				}
			} else if (c === HALANT) {
				if (syl.length) {
					last().vowel = '';
					last().inherentA = false;
				}
			} else if (c === ANUSVARA || c === CHANDRA) {
				if (syl.length) last().nasal = true;
			} else if (c === VISARGA) {
				// visarga → a coda "h": its own vowelless syllable, so the preceding syllable keeps its
				// vowel (प्रायः → praa + ya + h → praayah) and in pron the "h" merges onto it.
				syl.push({ onset: 'h', vowel: '', inherentA: false, nasal: false });
			} else {
				// Unknown Devanagari — shouldn't happen (the coverage test guards this). Keep it
				// visible rather than silently dropped.
				syl.push({ onset: c, vowel: '', inherentA: false, nasal: false });
			}
			i++;
		}
		if (!syl.length) return syl;

		// Final inherent schwa: drop by default, but KEEP it when the preceding syllable has no
		// vowel (would make a final cluster / vowelless word: सम्म, भित्र, म), the syllable is
		// nasalized (बोल्दिनँ→…dina), the onset is ch/chh (गर्छ→…chha), the word ends in the
		// negative suffix दैन (हुँदैन→…daina), or it is a listed irregular keep (होइन, छैन, …).
		const L = last();
		const prev = syl[syl.length - 2];
		const prevHasVowel = !!prev && prev.vowel !== '';
		if (L.inherentA && !L.nasal && prevHasVowel && !KEEP_FINAL_A_ONSETS.has(L.onset) && !LEXICAL_KEEP.has(w) && !w.endsWith(NEG_SUFFIX)) {
			L.vowel = '';
		}

		// Resolve nasalization: "n" before a consonant onset in the same word, else dropped.
		for (let k = 0; k < syl.length; k++) {
			const next = syl[k + 1];
			syl[k].nasalOut = syl[k].nasal && next && next.onset !== '' ? 'n' : '';
		}
		return syl;
	}

	// Lite: concatenate syllables, no separators.
	function romanizeWord(w) {
		let out = '';
		for (const s of tokenize(w, LITE)) out += s.onset + s.vowel + s.nasalOut;
		return out;
	}

	// Pron: hyphenate syllables; a vowelless syllable (a halant coda like न्) merges into the
	// previous syllable rather than becoming its own hyphenated chunk (हुन्छ → hoon-chhuh).
	function pronounceWord(w) {
		const parts = [];
		for (const s of tokenize(w, PRON)) {
			const str = s.onset + s.vowel + s.nasalOut;
			if (s.vowel === '' && parts.length) parts[parts.length - 1] += str;
			else if (str) parts.push(str);
		}
		return parts.join('-');
	}

	// Walk a `dev` string: Devanagari word-runs go through `fn` (whole-word override first);
	// everything else (spaces, ?, _, /, …) passes through unchanged, preserving position.
	function mapWords(dev, overrides, fn) {
		const s = dev.normalize('NFC');
		let out = '';
		let i = 0;
		while (i < s.length) {
			if (isDev(s[i])) {
				let j = i;
				while (j < s.length && isDev(s[j])) j++;
				const word = s.slice(i, j);
				out += has(overrides, word) ? overrides[word] : fn(word);
				i = j;
			} else {
				out += s[i];
				i++;
			}
		}
		return out;
	}

	function romanize(dev) {
		if (!dev) return dev;
		dev = stripTags(dev); // performance tags ([whispers], …) are render-only — never romanized
		// Capitalize the first letter of the phrase; overrides keep their own case.
		return mapWords(dev, WORD_OVERRIDES, romanizeWord).replace(/[a-zA-Z]/, (c) => c.toUpperCase());
	}

	function pronounce(dev) {
		if (!dev) return dev;
		dev = stripTags(dev); // ditto: strip audio tags before the respelling
		// All lowercase by convention (a pronunciation respelling, not a headword).
		return mapWords(dev, PRON_OVERRIDES, pronounceWord);
	}

	return {
		romanize,
		pronounce,
		stripTags, // remove ElevenLabs [performance tags] from any `dev` before it becomes text
		// Exposed for the coverage test (every corpus codepoint must be a known key).
		_tables: { CONS, VOWEL_INDEP, VOWEL_MATRA, CONJUNCT, HALANT, ANUSVARA, CHANDRA, VISARGA, WORD_OVERRIDES },
	};
})();

// Activate in the browser: derive each course item's `np` and `pron` from its Devanagari `dev`.
// Guarded so the file is safe to eval in Node (the tests lift SanoRomanize with no COURSE present).
if (typeof COURSE !== 'undefined' && Array.isArray(COURSE)) {
	for (const unit of COURSE) {
		for (const item of unit.items) {
			if (item && item.dev) {
				item.np = SanoRomanize.romanize(item.dev);
				item.pron = SanoRomanize.pronounce(item.dev);
			}
			// Depth (T28): derive np/pron for each alternate frame the same way, so a rotating
			// review sentence renders and grades exactly like the item's own `dev`.
			if (item && item.frames) {
				for (const f of item.frames) {
					if (f && f.dev) {
						f.np = SanoRomanize.romanize(f.dev);
						f.pron = SanoRomanize.pronounce(f.dev);
					}
				}
			}
		}
	}
}
