# Lite - Devanagari → Romanization Spec

This document specifies a lite romanization system used in Sano for displaying Nepali words to learners. It is optimized for _spoken comprehension_: a beginner who reads the output aloud should be understood by a native speaker.

It is **lossy and one-directional** (Devanagari → Latin). It is NOT reversible. Store Devanagari as the source of truth; derive Lite for display.

---

## Design philosophy

Lite embraces the simplifications native speakers already make unconsciously. Several written distinctions are dead in everyday speech and are deliberately merged away:

- Retroflex vs. dental stops (ट/त, ठ/थ, ड/द, ढ/ध) → merged.
- All nasals ण/न → `n`.
- Sibilants ष/स → `s`; श kept as `sh` where audible.
- व → `w` (not `v`) in normal speech.
- ऋ → `ri`.
- Vowel length collapses for i and u; only **a vs aa** is preserved.
- The inherent final schwa is deleted (राम्रो = "ramro", not "raamaro").

The biggest barrier in stricter schemes — capital-letter retroflexes — is removed entirely. Output is all lowercase.

---

## Pipeline overview

Process the input left to right. Stages are ordered because later rules depend on earlier ones (schwa deletion in particular needs cluster structure resolved first).

```
1. Tokenize graphemes
2. Consonant merge lookup        (Stage 1)
3. Vowel merge lookup            (Stage 2)
4. Resolve halant conjuncts      (Stage 3)
5. Apply nasalization            (Stage 4)
6. Delete schwa                  (Stage 5)
7. Cleanup + loanword overrides  (Stage 6)
```

---

## Stage 0 — Tokenize into graphemes

Split input into Devanagari clusters: a base consonant plus any attached vowel sign (मात्रा), halant (्), or nasalization mark. Each consonant carries an **inherent 'a'** unless a vowel sign or halant overrides it. This inherent vowel is central to Stage 5.

```
खाना → [ख + ा][न + ा] → kha-naa
```

---

## Stage 1 — Consonant merge table

Lossy merges that define Lite. Bolded sources are the core simplifications.

| Output   | Devanagari sources  |
| -------- | ------------------- |
| k / kh   | क / ख               |
| g / gh   | ग / घ               |
| ng       | ङ                   |
| ch / chh | च / छ               |
| j / jh   | ज / झ               |
| t / th   | **ट, त** / **ठ, थ** |
| d / dh   | **ड, द** / **ढ, ध** |
| n        | **ण, न**            |
| p / ph   | प / फ               |
| b / bh   | ब / भ               |
| m        | म                   |
| y        | य                   |
| r        | **र, ड़**           |
| l        | ल                   |
| w        | व                   |
| s        | **स, ष**            |
| sh       | श                   |
| h        | ह                   |
| f        | फ़                  |
| z        | ज़                  |

---

## Stage 2 — Vowel merge table

Each vowel has an **independent** form (word-initial) and a **sign/मात्रा** form (after a consonant). Both map to the same output.

| Output | Independent | Sign       | Note               |
| ------ | ----------- | ---------- | ------------------ |
| a      | अ           | (inherent) |                    |
| aa     | आ           | ा          | length kept        |
| i      | इ, ई        | ि, ी       | **length dropped** |
| u      | उ, ऊ        | ु, ू       | **length dropped** |
| e      | ए           | े          |                    |
| ai     | ऐ           | ै          |                    |
| o      | ओ           | ो          |                    |
| au     | औ           | ौ          |                    |
| ri     | ऋ           | ृ          | vocalic r          |

Only **a vs aa** preserves length, because that pair changes meaning (कम "kam" = less vs काम "kaam" = work).

---

## Stage 3 — Resolve conjuncts (halant ्)

A halant kills the inherent 'a' of the consonant before it, producing a cluster. Map known special conjuncts as units BEFORE falling back to letter-by-letter join.

| Conjunct    | Output      | Note                    |
| ----------- | ----------- | ----------------------- |
| क्ष         | ksh         |                         |
| ज्ञ         | gy          | spoken value, not "jny" |
| त्र         | tr          |                         |
| श्र         | shr         |                         |
| (other) C्C | concatenate | e.g. र्म → rm           |

Rule: halant = delete the inherent 'a' of the preceding consonant, then join to the next.

```
गर्छ → ग + र(्) + छ → ga + r + chha → garchha
```

---

## Stage 4 — Nasalization

| Mark           | Context            | Output |
| -------------- | ------------------ | ------ |
| ं anusvara     | before a consonant | n      |
| ं anusvara     | word-final         | n      |
| ँ chandrabindu | vowel nasalization | drop   |

Optional refinement: if the following consonant is labial (p/ph/b/bh/m), output `m` instead of `n` (अम्बा → amba). Safe to skip — `n` is always understood.

---

## Stage 5 — Schwa deletion (critical)

Run AFTER clusters are resolved. This is what makes output sound natural.

**Delete the inherent 'a' when:**

1. **Word-final consonant** — always drop the last consonant's inherent 'a'.
      ```
      भात → bhaat      दूध → dudh
      ```
2. **Medial consonant between two pronounced vowels**, when the result stays pronounceable.
      ```
      राम्रो → ramro
      ```

**Keep the inherent 'a' when:**

3. The consonant is **word-initial** or directly followed by a written vowel sign (then it isn't inherent — a real vowel is present).
      ```
      घर → ghar   (initial 'a' kept, final dropped)
      ```
4. Dropping it would create an **unpronounceable cluster** — keep a minimal 'a'.

**Implementation heuristic:** always delete the final inherent schwa. For medial schwas, delete only if both neighbors are single consonants forming a valid Nepali cluster. Ship a small allowlist of valid clusters, or delete medially and accept rare misfires.

Suggested starter cluster allowlist (extend as needed):

```
mr, ml, ndr, str, kr, pr, br, tr, dr, gr, shr, ksh,
nt, nd, nk, ng, mb, mp, st, sk, sp, ch, chh
```

---

## Stage 6 — Cleanup

- Collapse doubled identical vowels arising from sign + inherent interactions.
- Lowercase everything (Lite uses no capitals).
- Loanword overrides (optional): for known English loans prefer the English spelling (फोन → "phone", not "fon") via a small exception dictionary.

---

## Worked examples

**राम्रो**

```
S0: [रा][म्][रो]
S1: r / m / r
S2: raa / m / ro
S3: halant joins म to र → raamro
S5: medial simplification → ramro
OUT: ramro
```

**गर्छ**

```
S0: [ग][र्][छ]
S1: g / r / chh
S2: ga / r / chha
S3: gar + chha
S5: final schwa handling → garcha (common spoken form)
OUT: garcha
```

**ठूलो**

```
S0: [ठू][लो]
S1: th / l
S2: thu (length dropped) / lo
OUT: thulo
```

**धन्यवाद**

```
S0: [ध][न्][य][वा][द]
S1: dh / n / y / w / d
S2: dha / n / ya / waa / da
S3: dhan + ya + waad
S5: final 'a' dropped
OUT: dhanyawaad
```

---

## Merge reference (quick lookup)

Distinctions intentionally LOST in Lite — do not try to preserve these:

- ट=त (t), ठ=थ (th), ड=द (d), ढ=ध (dh) — retroflex/dental merged
- ण=न (n)
- ष=स (s); श stays sh
- ड़=र (r)
- ई=इ (i), ऊ=उ (u) — length dropped except a/aa

Because of these merges, Lite output cannot be mechanically reversed to Devanagari. Keep the source script stored separately.

---

## Recommended architecture

Two tracks kept in sync:

- **Data track:** store Devanagari as the source of truth.
- **Display track:** derive Lite on demand via this pipeline for learner- facing pronunciation.

Show learners Lite; store the precise form underneath.

---

## Implementation in sano (`js/romanize.js`)

This pipeline is implemented in **`js/romanize.js`** as the pure global `SanoRomanize.romanize(dev)`.
It loads right after `js/data.js` and **rewrites each `COURSE` item's in-memory `np` to
`romanize(item.dev)`**, so every existing `item.np` reader keeps working. The hand-drafted `np`
stays in `js/data.js` as the baseline. Scope is the `COURSE` items only; dialogue gloss segments
(no per-segment `dev`) and onboarding strings (no `dev`) are deferred. Tests:
`tests/unit/romanize.test.mjs` (golden cases) + `tests/data/romanize-coverage.test.mjs`
(every corpus codepoint mapped, clean output charset, structure preserved).

**Decisions made where the spec was silent or ambiguous (confirmed with Ross):**

- **Casing.** Capitalize the first letter of each phrase (not all-lowercase). Proper nouns stay
  capitalized via the override map. Grading is unaffected (`normalize()` lowercases).
- **ञ** is added to the Stage-1 table (the spec omits it; it occurs in the corpus, e.g. सञ्चै → n).
- **Nasalization unifies ं and ँ:** → `n` before a consonant in the same word (आउँदै→aundai,
  बैंक→baink), **dropped** word-final (तपाईं→tapaai, कहाँ→kahaa). This replaces the spec's
  "chandrabindu always drops / anusvara word-final → n", which mismatched the everyday forms.
- **"Table wins"** over a conflicting worked example: गर्छ→**garchha** (छ=chh, final schwa kept
  after ch/chh), राम्रो→**raamro** (ा=aa, the one length kept).
- **Final schwa (Stage 5):** dropped by default, but KEPT when — the preceding syllable has no
  vowel (would make a final cluster / vowelless word: सम्म→samma, भित्र→bhitra, म→ma); the syllable
  is nasalized (बोल्दिनँ→boldina); the onset is ch/chh; the word ends in the negative suffix दैन
  (हुँदैन→hundaina); or it is one of a small lexical keep-list of irregular short words that retain
  the schwa in speech (होइन, छैन, सय, तर, अब, मह, आज, बिहान, तिर, आइज).
- **Silent-nasal stem:** तपाईं → तपाई before romanizing, so तपाईंको→tapaaiko (not tapaainko).
- **Word overrides** (`WORD_OVERRIDES`): proper nouns (नेपाली→Nepali, अङ्ग्रेजी→Angreji, auto-found
  from words capitalized mid-phrase in the old np) and a small loanword set kept in English spelling
  (हस्पिटल→hospital, कम्प्युटर→computer, टिभी→TV, गिलास→glass, फ्रिज→fridge, होटल→hotel,
  डस्टबिन→dustbin, डस्टर→duster, हेडफोन→headphone, मनसुन→monsoon).
- **Postpositions** (को/मा/लाई/…) are written joined in Devanagari and are **kept joined** in the
  romanization (तपाईंको→Tapaaiko, घरमा→Gharamaa) — faithful to the script.
- **Medial schwa** deletion is not performed (Nepali pronounces most medial schwas; the corpus's
  clusters come from explicit halant, already handled) — biased to under-delete per the spec.
