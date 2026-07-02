# sano — Tasks

The project backlog. Claude keeps this current: every task Ross asks for — plus any suggestion Ross
agrees to, and anything discovered mid-work — is added here as an unchecked box with a unique `T<n>`
ID, and the box is ticked in place once the task is delivered. It's plain Markdown grouped by area,
so read or edit it by hand anytime. The items below wait on Ross (a review, a decision, or a
native-speaker check) — they aren't derivable from the code, so they're easy to lose if they leave
this list. Refer to any task by its ID (e.g. "T3").

## Dialogues & audio

- [ ] **T1 · Add voice tags to the conversations** — review `tools/tts/dialogue-scripts.md`, add
      ElevenLabs `[performance tags]` (list + pipeline: `tools/tts/voice-tags.md`), re-map changed
      lines into `js/dialogues.js`, and re-render their audio.
- [x] **T2 · Re-render the reconciled greet-pyaro audio** — `greet-pyaro-01/-07/-10` lag the text
      after the `[shouting]`/"copying" edits in `bbe8024`; re-render (`synth-app.mjs --dialogues --only greet-pyaro-01` …)
      + bump `AUDIO_VERSION` once the edits settle. First confirm line-1 नक्कल गरिरहेको ("copying")
      with a native speaker.

## Content review

- [ ] **T3 · Review the dictionary's recommendations** (`tools/dict/`; flag-only, never
      auto-applied): COURSE translations it disagrees with (`tests/data/dictionary.test.mjs` / the
      `.review` entries in `dictionary.json`) and high-frequency missing words
      (`tools/dict/coverage-report.md`).
- [ ] **T4 · Merge the Devanagari review** — `design/devanagari-review.json` (gitignored) → the `dev`
      fields of `js/data.js` (in-session, no merge script), then clear the review file.

## Companion characters

- [ ] **T5 · Pick a direction per companion, then refine and wire them in** — review the paper-cut
      explorations in `design/characters.html` (5 directions each for the 10 animal companions), pick
      a favorite per animal, refine the chosen art, and wire it into Sano's conversation system. Names
      follow the Nepali trait-word convention (Sano = "small"); the Nepali is Ross's to confirm.
- [ ] **T12 · Reorder companions along the path + section-appropriate art** — the decorative
      companions currently sit in a fixed order in the path pockets (`buddyOrder` in `renderPath`,
      `js/sano.js`). Reorder them so each companion lands near the section it fits, and generate
      companion art that makes sense for that section (regenerate from `design/characters.html` via
      `tools/build-character-heads.mjs` → `js/characters.js`).
- [ ] **T13 · Give the companions their own voices in lessons** — today all phrase/word audio is
      Sano's cloned voice (`CHARACTER_VOICES` in `js/audio.js` is empty; every clip resolves to
      `default`). Render per-character voice folders and widen `voiceForCharacter()` so lessons aren't
      all one voice (the dialogue player already routes per character via `synth-app.mjs`'s voice map —
      reuse those voice ids). Bump `AUDIO_VERSION` after rendering.

## Testing

- [ ] **T17 · Fix the flaky WebKit match-lesson e2e** — `tests/e2e/lesson.spec.mjs` match rounds
      intermittently time out under WebKit: `stepLesson` (`tests/e2e/_helpers.mjs`) clicks match tiles
      with normal (non-force) clicks and relies on `boot()`'s inline animation-freeze, but that can't
      kill **pseudo-element** (`::before`/`::after`) animations — so a tile stays "unstable" and the
      click times out. Pre-existing (reproduces on clean `main`, both before and after T16). A blanket
      `*::before { animation: none !important }` loses specificity to the app's class-scoped animation
      rules, so the fix needs either a targeted freeze stylesheet or a stability-tolerant match click.

## Romanization

- [x] **T19 · Handle visarga (ः, U+0903) in the romanizer** — `tokenize()` now maps visarga to a coda
      "h" (प्रायः → Praayah, अतः → Atah, दुःख → Duhkha); `VISARGA` is exported in `_tables` and added to
      the romanize-coverage known-set. The प्रायः `WORD_OVERRIDE` was dropped (tokenizer handles it); a
      `PRON_OVERRIDE` remains only to polish its pron to *praa-yah*. Minor cosmetic left: word-final
      visarga after an inherent vowel doubles the h in pron (अतः → uh-tuhh); harmless, none in-corpus.

- [ ] **T22 · Generalize व→b for व्य- words in the romanizer** — Nepali realizes व as "b" in the
      common व्य- cluster (व्यस्त→byasta, व्यक्ति→byakti, व्यापार→byaapaar, व्यवसाय, व्यवहार), but the
      rules default व→w so these read "wy-". व्यस्त is patched via `VA_AS_B`; व्यक्ति already shipped as
      "wyakti" (batch 3). Extend `VA_AS_B` (or add a व्य→by rule) to cover the cluster, re-render the
      affected word slugs (wyakti→byakti, etc.), and bump `AUDIO_VERSION`. Then future व्य- words (e.g.
      व्यापार, deferred out of batch 6 for this reason) can be added cleanly.

## Learning engine — SR-05 relaunch (Phase 1)

Restructures the learning plan for mastery-based, high-repetition progression (interviewed +
planned 2026-07-01; reviewed and shipped 2026-07-01). Green across all test tiers. The re-cut
sub-unit **titles + goals are AI-drafted — still Ross's to refine** (T9).

- [x] **T6 · Learning-steps scheduler + softened intervals** — new words climb a gentle ladder
      (1 → 2 → 4) and only graduate after being *recalled* ~2×; intervals softened (was
      1 → 2 → 5 → 16 → 55); each new word gets an in-session tap-based word-bank recall. (`js/sano.js`
      SR-05 block, `tests/unit/scheduler.test.mjs`.)
- [x] **T7 · Mastery gate + in-progress path UX** — a unit unlocks the next only when every word has
      graduated (not merely introduced); the current node's ring now fills by *mastery*; tapping an
      all-introduced-but-unmastered unit drills its weakest words. (`unitIsComplete`, `renderPath`,
      `startUnitLesson`, `placeBefore`.)
- [x] **T24 · Two-tone ring so early progress shows** — the T7 mastery-only ring sat at 0% for a
      unit's first ~4 days (nothing graduates that fast), reading as "no progress" after a couple of
      lessons (Ross-reported). `renderPath` now layers a faint `--accent-soft` "introduced" arc under
      the solid `--accent` "mastered" arc, so the ring moves the moment you practice yet still fills
      only at unlock. New `--accent-soft` token (both themes); dev-seed `earlyring` scenario (0e).
      (`js/sano.js` ring block, `css/sano.css`, `tools/dev-seed.html`.)
- [x] **T8 · Adaptive, review-dominant daily loop** — `dailyPlan()` throttles new words by review
      debt and sizes reviews to a ~18–20 exercise session, carrying the backlog. (`startDailyLesson`,
      `renderHome`.)
- [x] **T9 · Split units >14 items** — 44 → 58 units (~8–12 words each), item ids untouched, anchor
      ids preserved on chunk 1. **New sub-unit titles/goals are AI-drafted → Ross's review.**
      (`js/data.js`.)
- [x] **T10 · Schema v3 migration (fresh start)** — `migrateV2State` keeps name/streak/lifetime
      tally, resets learning progress, restarts at unit 1. (`tests/unit/migration.test.mjs`.)
- [ ] **T11 · Phase 2 — grow vocabulary toward ~1,550 words (the everyday tier)** — source the
      highest-frequency missing words from the `tools/dict` frequency ranking (ties to **T3**), add as
      new ~8–12-word mastery-gated units by frequency + situation; regenerate audio for the new items
      only and bump `AUDIO_VERSION`. Nepali `dev` AI-drafted → Ross's review. Multi-batch — driven by
      the pipeline below (T14); each batch = select → draft → review → merge → audio. **Target
      ~1,550** — the everyday-register candidates the dictionary surfaces (873 remaining as of batch 3
      start, atop 683 taught); reaching the older ~2,000 goal would mean dipping into the formal
      register. Done: batch 1 (verbs, T15), batch 2 (adjectives, T16). Next: nouns (batch 3+, ~557
      candidates — the biggest well), then adverbs (~84) and function words (~40).
- [x] **T14 · Build the expansion pipeline** (reusable across all T11 batches) —
      `tools/dict/select-candidates.mjs` (mechanical: ranks the everyday, not-yet-covered words of a
      given part of speech from `dictionary.json`), a Claude drafting pass (wraps each word in a
      usable frame → `design/expansion-draft.json`), and a localhost review tool
      `design/expansion.html` + `expansion-save.php` (edit / approve / reject → the gitignored
      `expansion-approved.json`; never touches `js/data.js`). Approved rows are merged by hand, then
      audio rendered (`build-words.mjs` → `synth-app.mjs --new --words --new`, bump `AUDIO_VERSION`).
- [x] **T15 · Batch 1 — everyday verbs (~50)** — 50 high-frequency everyday verbs, curated (dropped
      verbs already taught + advanced passives/causatives) and wrapped in short natural frames.
      Reviewed + approved, then merged into `js/data.js` as 5 units after `verbs-past` (Reactions &
      Opinions, Asking for Help, Getting Around, Making & Doing, Everyday Actions); `tools/dict`
      coverage refreshed, audio rendered (50 phrase + 57 word clips, `AUDIO_VERSION` 7), dev-seed
      scenario added. Committed 620a0bd, shipped ea07f30. **Still open:** the 5 unit titles + goals are
      AI-drafted → Ross's refinement.
- [ ] **T18 · Batch 3 — everyday nouns (~46)** — 46 high-frequency everyday nouns, curated from the
      top-90 `--pos noun` pool (concrete nouns are already taught, so this is the abstract/everyday-life
      gap: reasons, decisions, plans, money, relationships). Taught as short frames (they don't emoji);
      merged as 5 units **appended at the end of the path** (Time & Events, Ideas & Conversation,
      Problems & Solutions, Money & Business, People & Places) — 73 units / 729 items. Coverage
      refreshed, audio rendered (46 phrase + 63 word clips, `AUDIO_VERSION` 9), dev-seed scenario
      added. Unit titles/goals AI-drafted → Ross's refinement. **Merged; push/deploy pending Ross's
      go.**
- [ ] **T20 · Batch 4 — everyday adverbs (~44)** — 44 high-frequency everyday adverbs (only 1 of the
      top-70 was already taught), taught as short frames; merged as 5 units **appended at the end of
      the path** (How Much, Before & After, How Often, How & Where, Linking & Certainty) — 78 units /
      773 items. Dropped near-duplicate demonstratives. Coverage refreshed, audio rendered (44 phrase +
      55 word clips, `AUDIO_VERSION` 10), dev-seed scenario added. Also fixed visarga in the romanizer
      (T19) so प्रायः works. Unit titles/goals AI-drafted → Ross's refinement. **Merged; push/deploy
      pending Ross's go.**
- [x] **T21 · Batch 5 — essential function words (~27)** — 27 high-leverage function words
      (pronouns, conjunctions, counters, big numbers, particles/postpositions) — the grammatical glue.
      Only genuinely untaught items (course already has basic pronouns, connectors, numbers to 1000);
      taught as short frames; merged as 5 units **appended at the end of the path** (Pronouns & Self,
      If/When & Because, Counting Things, Big Numbers, Little Connecting Words) — 83 units / 800 items.
      Coverage refreshed, audio rendered (27 phrase + 30 word clips, `AUDIO_VERSION` 11), dev-seed
      scenario added. Smaller batch — function words are inherently fewer. Unit titles/goals AI-drafted
      → Ross's refinement. **Shipped** (commit e7194aa).
- [x] **T23 · Batch 6 — everyday-life nouns, part 2 (~45)** — a second nouns pass, deeper in the pool
      with hard curation for genuinely everyday domains (skipping civic/news terms): 45 nouns as short
      frames, merged as 5 units **appended at the end of the path** (Travel & Transport, City &
      Country, Money & Commerce, School & Mind, Health & Life) — 88 units / 845 items. Coverage
      refreshed, audio rendered (45 phrase + 58 word clips, `AUDIO_VERSION` 12), dev-seed scenario
      added. व्यापार deferred pending T22 (व→b). Unit titles/goals AI-drafted → Ross's refinement.
      **Shipped** (commit f0f5e94).
- [x] **T25 · Batch 7 — feelings & everyday things (~33)** — raw-frequency everyday pool exhausted
      (remaining top words are civic/news nouns or already-taught verbs), so a **hand-curated themed
      pocket** of verified gaps: emotions, body parts, clothes, food/kitchen — 33 frames merged as
      **4 units appended at the end of the path** (Feelings & States, More Body Parts, Clothes &
      Accessories, More Groceries) — 92 units / 878 items. Dropped the sentence-final danda (।) to
      match the course's no-terminal-punctuation frame convention. Coverage refreshed, audio rendered
      (33 phrase + 52 word clips, `AUDIO_VERSION` 13), dev-seed scenario added. Unit titles/goals +
      the `मलाई ___ लाग्यो` frame repetition AI-drafted → Ross's refinement.
- [x] **T26 · Batch 8 — calendar, festivals & directions (~27)** — second hand-curated themed pocket:
      the 12 Bikram Sambat months (colloquial spellings — बैशाख not वैशाख, साउन not श्रावण), major
      festivals, and cardinal directions (`-तिर` pattern) — all verified 0-coverage gaps. 27 frames
      merged as **3 units appended at the end of the path** (Nepali Calendar, Festivals & Celebrations,
      Directions & Places) — 95 units / 905 items. **दशैं forced to "Dashain"** (whole-word
      WORD_OVERRIDE + PRON_OVERRIDE in `js/romanize.js`, keeping the word-final nasal the Lite scheme
      drops) — Ross-requested. व्रत dropped (romanizes "Wrat" not "Brat"; see T22) → used पूजा. Coverage
      refreshed, audio rendered (27 phrase + 28 word clips, `AUDIO_VERSION` 14), dev-seed scenario
      added. Unit titles/goals AI-drafted → Ross's refinement.
- [x] **T16 · Batch 2 — everyday adjectives (~45)** — 45 high-frequency everyday adjectives, curated
      from the top-80 `--pos adj` pool (dropped semantic dupes already taught + news/formal terms) and
      wrapped in short natural frames (phrases-style). Reviewed + approved, then merged into
      `js/data.js` as 5 units after `comparing-things` (Size & Feel, Good/Bad & Right, Order &
      Sequence, Same or Different, States & Conditions); aligned अरू→अरु to the course's spelling;
      `tools/dict` coverage refreshed, audio rendered (45 phrase + 58 word clips, `AUDIO_VERSION` 8),
      dev-seed scenario added. **Still open:** the 5 unit titles + goals are AI-drafted → Ross's
      refinement; **push/deploy pending Ross's go.**
