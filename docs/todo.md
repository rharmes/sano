# sano — Tasks

The project backlog. Claude keeps this current: every task Ross asks for — plus any suggestion Ross
agrees to, and anything discovered mid-work — is added here as an unchecked box with a unique `T<n>`
ID, and the box is ticked in place once the task is delivered. It's plain Markdown grouped by area,
so read or edit it by hand anytime. The items below wait on Ross (a review, a decision, or a
native-speaker check) — they aren't derivable from the code, so they're easy to lose if they leave
this list. Refer to any task by its ID (e.g. "T3").

## Backlog tooling

- [ ] **T34 · Lightweight query structure for the backlog** — add a small, greppable tag convention
      to this file so tasks can be filtered without moving to an external tracker: a `waiting-on:`
      marker (`ross` / `native-speaker` / `none`) and an area/status tag where useful, plus a one-line
      `grep` recipe documented here in the header and mirrored into CLAUDE.md's **Task list** section.
      Goal: get the one thing GitHub Issues would buy us — filter/query at scale ("everything waiting
      on me", "all content-review tasks") — while keeping the backlog's strengths: co-authored and
      updated **in the same commit** that ships the code, versioned in lockstep with the tree, offline,
      and reviewable in the diff. **Decision (2026-07-20):** chose in-file structure over GitHub Issues
      — a solo, agent-co-maintained, code-lockstep backlog doesn't benefit from Issues' collaboration
      features (assignees, notifications, cross-team visibility) but would pay their costs (a split,
      networked, non-atomic update loop). Revisit Issues only if a collaborator joins or public bug
      intake is wanted.

## Dialogues & audio

- [ ] **T1 · Add voice tags to the conversations** — review `tools/tts/dialogue-scripts.md`, add
      ElevenLabs `[performance tags]` (list + pipeline: `tools/tts/voice-tags.md`), re-map changed
      lines into `js/dialogues.js`, and re-render their audio.
- [x] **T2 · Re-render the reconciled greet-pyaro audio** — `greet-pyaro-01/-07/-10` lag the text
      after the `[shouting]`/"copying" edits in `bbe8024`; re-render (`synth-app.mjs --dialogues --only greet-pyaro-01` …)
      + bump `AUDIO_VERSION` once the edits settle. First confirm line-1 नक्कल गरिरहेको ("copying")
      with a native speaker.

- [x] **T35 · Word clips for standalone single-word items** — `build-words.mjs` built its tile-word
      inventory from **phrases-unit** sentences only, so (a) a single-word item whose word appears in
      no phrase had no `audio/words/<slug>.mp3` (the e2e-log 404 for `hajaar.mp3` — हजार tiles in its
      own SR-05 word-bank recall among distractors) and (b) vocab-unit frames (word-bankable since
      T32) had no clips for their new words. **Fixed 2026-07-20** with the T29 batch 7–9 merge: the
      inventory is now every word of every canonical + frame sentence across all units (719 → 1050
      tile-words; the 331 missing clips rendered in the same pass). CLAUDE.md + architecture.md
      updated.

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
      `tools/build-character-heads.mjs` → `js/characters.js`). **Order half delivered by T13
      (2026-07-21):** `buddyOrder` now mirrors the `UNIT_VOICES` path sections (drift-guarded by
      `tests/data/unit-voices.test.mjs` — change the two together). Still open: the
      section-appropriate **art**.
- [ ] **T13 · Give the companions their own voices in lessons** — each path companion voices their
      own section's **reviews** (Sano always introduces new words and voices the word tiles / sounds
      drill), with the companion's head chip above the prompt and a play-time fallback to the default
      clip wherever a companion clip isn't rendered. Map: `UNIT_VOICES` (`js/data.js`, ten contiguous
      sections mirroring `buddyOrder`); routing: `reviewCompanion`/`ex.companion` (`js/sano.js`) +
      `CHARACTER_VOICES` (`js/audio.js`); render: `synth-app.mjs --units [ids] --new`.
  - [x] **Mechanism + 6-unit pilot (2026-07-21)** — full seam + head chip + fallback; pilot units
        rendered in the six dialogue voices (149 clips ≈ 1.7k credits): basics → Thulo,
        family-people → Pyaro, meals → Shanta, verbs-present → Gyani, colors → Rangin,
        animals-wild → Bahadur. `AUDIO_VERSION` 27; unit + data tests; dev-seed 0g. **Ross to judge
        each voice on short course phrases before the full render.** (Per Ross 2026-07-21: bundled
        match / listen-match grids stay all-Sano — a round mixes sections, and every pill on a page
        must share one voice; companion voices are single-item exercises + their feedback replays.)
  - [x] **Full render for the voiced six (2026-07-21)** — pilot voices passed Ross's review; the
        remaining 771 clips of the six companions' sections rendered (`--units --new`, ~9k credits;
        920 companion clips total across 49 units), `AUDIO_VERSION` 28. The 53 units owned by the
        un-voiced four still review in Sano's voice until T36 designs their voices.
- [ ] **T36 · Design voices for Hiun, Chanchal, Phurtilo, Lamo** — the four companions without an
      ElevenLabs voice (snow leopard, langur, tahr, gharial). Design/pick voices in the dashboard
      (persona notes: `CHARACTER_PERSONAS`, `js/dialogues.js`; process: RESEARCH.md §9), add ids to
      `VOICES` (`tools/tts/synth-app.mjs`) + `CHARACTER_VOICES` (`js/audio.js`), then render their
      `UNIT_VOICES` sections (`--units --new`). Until then their sections review in Sano's voice.

## Testing

- [x] **T17 · Fix the flaky WebKit match-lesson e2e** — `tests/e2e/lesson.spec.mjs` match rounds
      intermittently time out under WebKit: `stepLesson` (`tests/e2e/_helpers.mjs`) clicks match tiles
      with normal (non-force) clicks and relies on `boot()`'s inline animation-freeze, but that can't
      kill **pseudo-element** (`::before`/`::after`) animations — so a tile stays "unstable" and the
      click times out. Pre-existing (reproduces on clean `main`, both before and after T16). A blanket
      `*::before { animation: none !important }` loses specificity to the app's class-scoped animation
      rules, so the fix needs either a targeted freeze stylesheet or a stability-tolerant match click.
      **Fixed 2026-07-20** — took the stability-tolerant-click route: `stepLesson` now force-clicks
      each pair (past WebKit's actionability "stable" gate) and verifies both tiles reached `.matched`,
      retrying the pair, then waits for + force-clicks `#lesson-continue`. Corrected root cause: the
      destabilizer is the `tile-pop`/`tile-shake` keyframe on the tile **element** (not a pseudo-element);
      the inline freeze suppresses it, but under WebKit + parallel-load render churn the stability gate
      still intermittently timed out. Test-only change (`tests/e2e/_helpers.mjs`); verified match tests
      30× green under WebKit and full e2e (38) green.

## Romanization

- [x] **T19 · Handle visarga (ः, U+0903) in the romanizer** — `tokenize()` now maps visarga to a coda
      "h" (प्रायः → Praayah, अतः → Atah, दुःख → Duhkha); `VISARGA` is exported in `_tables` and added to
      the romanize-coverage known-set. The प्रायः `WORD_OVERRIDE` was dropped (tokenizer handles it); a
      `PRON_OVERRIDE` remains only to polish its pron to *praa-yah*. Minor cosmetic left: word-final
      visarga after an inherent vowel doubles the h in pron (अतः → uh-tuhh); harmless, none in-corpus.

- [x] **T22 · Generalize व→b for व्य- words in the romanizer** — Nepali realizes व as "b" in the
      common व्य- cluster (व्यस्त→byasta, व्यक्ति→byakti, व्यापार→byaapaar, व्यवसाय, व्यवहार), but the
      rules default व→w so these read "wy-". व्यस्त is patched via `VA_AS_B`; व्यक्ति already shipped as
      "wyakti" (batch 3). Extend `VA_AS_B` (or add a व्य→by rule) to cover the cluster, re-render the
      affected word slugs (wyakti→byakti, etc.), and bump `AUDIO_VERSION`. Then future व्य- words (e.g.
      व्यापार, deferred out of batch 6 for this reason) can be added cleanly.
      **Done 2026-07-20** — a positional व्य→"b" rule in the shared tokenizer (`js/romanize.js`),
      kept on the halant path so the final-schwa cluster guard still applies (भव्य→Bhabya); व्यस्त
      dropped from `VA_AS_B` (rule covers it); व्यक्ति pron polished (`byak-tee`, like `byas-ta`).
      The only affected clip was **renamed** (`git mv wyakti.mp3 → byakti.mp3` — the TTS input व्यक्ति
      is unchanged, so no re-render / no credits), words.json regenerated, `AUDIO_VERSION` 22. Golden
      tests added (incl. unlisted व्यापार + word-final भव्य). व्यापार is now cleanly addable (T29+).

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
- [x] **T18 · Batch 3 — everyday nouns (~46)** — 46 high-frequency everyday nouns, curated from the
      top-90 `--pos noun` pool (concrete nouns are already taught, so this is the abstract/everyday-life
      gap: reasons, decisions, plans, money, relationships). Taught as short frames (they don't emoji);
      merged as 5 units **appended at the end of the path** (Time & Events, Ideas & Conversation,
      Problems & Solutions, Money & Business, People & Places) — 73 units / 729 items. Coverage
      refreshed, audio rendered (46 phrase + 63 word clips, `AUDIO_VERSION` 9), dev-seed scenario
      added. Unit titles/goals AI-drafted → Ross's refinement. **Shipped** — verified live on namastesano.com
      2026-07-20 (units present, `AUDIO_VERSION` 21). Unit titles/goals still AI-drafted → Ross's refinement.
- [x] **T20 · Batch 4 — everyday adverbs (~44)** — 44 high-frequency everyday adverbs (only 1 of the
      top-70 was already taught), taught as short frames; merged as 5 units **appended at the end of
      the path** (How Much, Before & After, How Often, How & Where, Linking & Certainty) — 78 units /
      773 items. Dropped near-duplicate demonstratives. Coverage refreshed, audio rendered (44 phrase +
      55 word clips, `AUDIO_VERSION` 10), dev-seed scenario added. Also fixed visarga in the romanizer
      (T19) so प्रायः works. Unit titles/goals AI-drafted → Ross's refinement. **Shipped** — verified live on namastesano.com
      2026-07-20 (units present, `AUDIO_VERSION` 21). Unit titles/goals still AI-drafted → Ross's refinement.
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
- [x] **T27 · Batch 9 — linking words, more verbs & odds (~22) — FINAL breadth batch** — an honest
      assessment (verified spot-checks: ~all top "everyday not covered" dictionary rows are false gaps
      already taught in a conjugated/spelling variant, plus news-register noise) found the everyday pool
      effectively picked clean. So a last hand-curated pass of the highest-value genuine gaps: linking
      words (शायद, तैपनि, अवश्य, जहाँ, जसरी, जबसम्म, जस्तो, अलिकति), more everyday verbs (माग्नु, सम्झनु,
      बिर्सनु, रोज्नु, पढाउनु, हाँस्नु, रुनु, नाच्नु, छुनु), and odds & ends (छेउ, वारि, पारि, आधुनिक, साझा) —
      22 frames merged as **3 units appended at the end of the path** (Linking Words, More Everyday Verbs,
      Odds & Ends) — 98 units / 927 items. **Five drafted frames dropped mid-merge as spelling-variant
      dups** the initial grep missed (अरू≈अरु "else", कम्तिमा≈कम्तीमा "at least", and सोध्नु/फर्कनु/फाल्नु
      already taught as म सोध्छु / म फर्किन्छु / म फोहोर फाल्छु). Coverage refreshed, audio rendered (22
      phrase + 27 word clips, `AUDIO_VERSION` 15), dev-seed scenario added. Unit titles/goals AI-drafted
      → Ross's refinement. **After this, T11 pivots from breadth to depth** — more frames/phrases around
      words already known (a new task when Ross starts it).
- [x] **T16 · Batch 2 — everyday adjectives (~45)** — 45 high-frequency everyday adjectives, curated
      from the top-80 `--pos adj` pool (dropped semantic dupes already taught + news/formal terms) and
      wrapped in short natural frames (phrases-style). Reviewed + approved, then merged into
      `js/data.js` as 5 units after `comparing-things` (Size & Feel, Good/Bad & Right, Order &
      Sequence, Same or Different, States & Conditions); aligned अरू→अरु to the course's spelling;
      `tools/dict` coverage refreshed, audio rendered (45 phrase + 58 word clips, `AUDIO_VERSION` 8),
      dev-seed scenario added. **Still open:** the 5 unit titles + goals are AI-drafted → Ross's
      refinement; **push/deploy pending Ross's go.**

## Learning engine — T11 depth pivot (Phase 3)

The breadth expansion (T11 batches 1–9) picked the everyday-frequency pool clean, so T11 pivots from
**breadth → depth**: more frames/phrases around words already known, rather than new vocabulary.
Direction chosen with Ross 2026-07-02 — **Both** structures, emphasis on **real expressions** +
**everyday contexts**.

- [x] **T28 · Rotating-frames mechanism** — an item may carry optional `frames: [{dev,en}]`; reviews
      rotate through them so a known word is practiced in varied contexts **without adding path
      units** (the SR record stays keyed by item id — one record, many sentences). Frame 0 is the
      item's own `dev`/`en` (audio id `<id>`); extras get `<id>-f1`, `<id>-f2`, … `js/romanize.js`
      derives `np`/`pron` per frame; `itemFrames`/`frameForSeen`/`pickFrame` + `ex.frame` threaded
      through the render/grade sites (`js/sano.js`); `synth-app.mjs` + `build-words.mjs` expand frames
      so `--new` renders only the new clips. Unit test + data validation + dev-seed scenario (0f).
      Committed `3fea017`; 3 pilot items (maagnu/samjhanu/chheu) got demo frames, audio rendered
      (6 phrase + 5 word clips, `AUDIO_VERSION` 16). **Still open:** the pilot frame `dev` is
      AI-drafted → Ross's review; **push/deploy pending Ross's go.** Bulk content is T29/T30.
- [x] **T29 · Depth content — everyday-context alternate frames** — populate `frames` on a curated
      set of already-taught items with everyday-context variety, so each word stops being tied to one
      memorized sentence. Nepali `dev` AI-drafted → Ross's review; audio rendered for the new frame
      clips only, bump `AUDIO_VERSION`. Multi-batch, by part of speech.
  - [x] **Batch 1 — core present-tense verbs (10 items · 20 frames)** — everyday-context + real-expression
        frames on the `verbs-present` unit (herchu → "I watch a movie," dinchu → "Please give me water,"
        padhchu → "I read the news," …). Approved by Ross; audio rendered (20 phrase + 8 word clips,
        `AUDIO_VERSION` 17); dev-seed 0f extended.
  - [x] **Batch 2 — core past-tense verbs (12 items · 24 frames)** — everyday-context frames on the
        `verbs-past` unit (khaen → "I ate rice," gaen → "I went to the market," heren → "I watched a
        movie," …). Drafted into the T31 tool, approved by Ross, merged; audio rendered (24 phrase +
        5 word clips, `AUDIO_VERSION` 18); dev-seed 0f extended.
        (The पिउनु-for-tea quirk was fixed 2026-07-20, Ross-approved: f1 is now "मैले चिया खाएँ"
        "I had tea" — the colloquial खानु the item's own usage note teaches; clip re-rendered,
        `AUDIO_VERSION` bump folds into the next batch merge.)
  - [x] **Batch 3 — descriptive adjectives (20 items · 40 frames)** — attributive + fresh-predicate
        frames on the `adj-*` units (lamo/chiso/baliyo/khali/khula/sajilo/gahro/kharab/sundar/byasta/
        jaruri/surakshit/halka/bhari/sahi/galat/kada/pakka/bahadur/niko): "my hair is long," "a busy
        road," "this road is safe." Drafted into the T31 tool, approved by Ross, merged; audio rendered
        (40 phrase + 8 word clips, `AUDIO_VERSION` 19); dev-seed 0f now derives its framed set from
        COURSE. (Merge caught a scanner bug — double-quoted `en` strings; fixed + re-verified all 20
        match the draft exactly.)
  - [x] **Batch 4 — position + time/frequency (14 items · 28 frames)** — everyday-context frames on
        `place-position` + `duration-frequency` bare words (माथि/मुनि/अगाडि/पछाडि/भित्र/बाहिर,
        हप्ता/महिना/वर्ष/सधैं/कहिलेकाहीं/पछि/अघि/मिनेट): "next week," "I always get up in the morning,"
        "an hour ago." Approved by Ross, merged; audio in the combined render below.
  - [x] **Batch 5 — modal patterns (6 items · 12 frames)** — the can/want/must constructions
        (`modals-can-want-must`) with a different **known verb** swapped in (म पढ्न सक्छु "I can read,"
        मलाई सुत्न मन लाग्छ "I want to sleep," मलाई पढ्नु पर्छ "I have to study"), so the pattern
        generalizes. Approved by Ross, merged.
  - [x] **Batch 6 — common nouns (20 items · 40 frames)** — first depth batch on single-word `vocab`
        items (family/places/food/body/animals: आमा/बुवा/दिदी/छोरा, हस्पिटल/स्कुल/पसल/बस,
        खाना/भात/दाल/दूध/माछा, टाउको/आँखा/हात/पेट, कुकुर/बिरालो/गाई): "the dog is at home," "my eye is
        red," "the cow gives milk." Needed the **T32 routing tweak** (below) so a noun shown as a
        multi-word frame becomes a word-bank, not a type-the-sentence. Approved by Ross, merged.
        Batches 4–6 rendered together: 80 phrase + 22 word clips, `AUDIO_VERSION` 20.
  - [x] **Batches 7–9 — food & kitchen · household objects · weather, nature & animals (60 items ·
        120 frames)** — first depth batches on the object-noun pools (kitchen/pantry/fruit/veg,
        bedroom→personal items, weather/animals/colors); 2 frames per item, everyday-context +
        real-expression mix (बत्ती गयो/आयो, दसवटा मोमो दिनुस्, वाइफाइ पासवर्ड के हो?, जुत्ता बाहिर
        राख्नुस्). Every dev dup-checked against all 1,129 existing course sentences and
        romanize-verified at draft time; blanket-approved by Ross 2026-07-20, merged (145 items now
        framed). Rendering the frames surfaced the T35 root cause (below) — `build-words.mjs` now
        covers all units, so this render was 120 phrase + 331 word clips, `AUDIO_VERSION` 23.
        Dev-seed 0f derives from COURSE, no change needed. (Minor: the words build now flags 8
        cosmetic slug conflicts — the 3 known ones plus गोलभेंडा/गोलभेँडा, फूल/फुल, राति/राती,
        स्कुल/स्कूल, घमण्ड/घमन्ड — all pre-existing course spelling variants, audibly identical.)
  - [x] **Batches 10–12 — emotions & people · pronouns & connectors · numbers & weekdays (60 items ·
        120 frames)** — batch 10: all core emotions + बोर/आशा + family remainder + साथी/बच्चा/मान्छे/
        छिमेकी (चिन्ता नगर्नुस्, म तिमीलाई माया गर्छु, दाइ, नमस्ते); batch 11: 9 pronouns — म/यो/त्यो/मेरो
        skipped as already-varied — + all 11 connectors with two-clause frames per Ross (म जान्छु तर ऊ
        आउँदैन, चिया कि कफी?, अनि तपाईं?), agreement-teaching pronoun frames (उहाँ…हुनुहुन्छ,
        उनीहरू…छन्/हुन्); batch 12: numbers एक–दस sans छ/नौ + बीस/पचास/सय/हजार/आधा with shop/time frames
        (पचास प्रतिशत छुट, पाँच बज्यो) + all 7 weekdays (शनिबार बिदा हो). Dup-checked against all 1,249
        course sentences; some frames deliberately introduce transparent new forms (-दै progressives,
        आउँदैन/लाग्दैन, आउनुहुन्छ, बिदा). Blanket-approved by Ross 2026-07-20, merged (205 items now
        framed); audio 120 phrase + 20 word clips, `AUDIO_VERSION` 24. Shipped with the `VA_AS_B`
        **prefix-match** romanizer fix (वर्षको→Barsako, वनमा→Banamaa; golden tests; no existing slug
        affected). Remaining unframed pools for future batches: हजुरबुवा/हजुरआमा/बुढा/बुढी, छ/नौ, the
        formal emotions-more words, core communication units, ~135 object-noun leftovers.
  - [x] **Batch 13 — odds & ends: grandparents & spouses, छ/नौ, time-of-day, colors (20 items ·
        40 frames)** — हजुरबुवा/हजुरआमा/बुढा/बुढी with honorific frames (मेरो बुढा बजार जानुभयो, मेरी
        बुढी नेपाली सिक्दै हुनुहुन्छ), छ/नौ clock frames (नौ बजे पसल बन्द हुन्छ), the 8 time-of-day
        words (आज मेरो जन्मदिन हो, हिजो राति जाडो थियो), and 6 colors (यो निलो हो कि कालो?, मेरो कपाल
        सेतो भयो; गुलाबी/प्याजी left for the nature-leftovers batch). Approved by Ross 2026-07-21,
        merged (225 items framed), audio rendered (40 phrase + 7 word clips), `AUDIO_VERSION` 25.
        Shipped commit 5260261. Plan after this: ~2 batches core communication, ~2 batches best
        object-noun leftovers, then close T29's frame coverage (~300 items framed).
  - [x] **Batches 14–17 — the four closing batches (80 items · 160 frames)** — drafted 2026-07-21,
        blanket-approved by Ross 2026-07-21, merged in one pass (305/959 items framed), audio
        rendered, `AUDIO_VERSION` 26. **T29 frame coverage is now closed** — every high-frequency
        single-word item carries rotating everyday frames; the remaining unframed pool is the
        low-value tail + multi-word phrases that already carry context. (Minor: new cosmetic slug
        conflict chhau छौं×3/छौ×1 — informal छौ shares a slug with plural छौं under nasal-dropping;
        audibly near-identical, same class as the 8 known ones.) **14 · everyday communication & getting around:** politeness
        words नमस्ते/हजुर/होला/कृपया/धन्यवाद, question words कसरी/किन/कुन (बसपार्क कसरी जाने?),
        बिस्तारी/छिटो + informal आइज/जाऊ, the 4 comparison words (चिया कफी भन्दा सस्तो छ, अलि कम
        गर्नुस्), transport बैंक/एयरपोर्ट/बसपार्क/ट्याक्सी. **15 · places, positions & replies:**
        होटल-as-eatery, अफिस, त्यहाँ/नजिक/तिर/बायाँ/दायाँ/रोक्नुस्/बीचमा/सम्म, तिमी (introduces
        informal छौ/हौ), होइन tag-question, नमस्कार, नराम्रो, हुन्छ/हुँदैन reply pairs, the 4 -तिर
        directions with true-geography frames (हिमाल उत्तरतिर छ; introduces भारत + पोखरा). **16 ·
        food & kitchen leftovers:** पुग्यो/पर्दैन usage, तेल/मसला/फल/अचार/मह/लसुन/धनिया/काँक्रो +
        सुन्तला/आँप/कागती + चिउरा/सेलरोटी/समोसा/मिठाई/रक्सी/लस्सी/जुस; introduces the missing taste
        words गुलियो (मह गुलियो हुन्छ) and अमिलो (कागती अमिलो हुन्छ); culture frames (तिहारमा सेलरोटी
        बनाउँछौं, दहीसँग चिउरा). **17 · household & nature leftovers:** लुगा/चप्पल/चश्मा/चर्पी/सिरानी/
        ऐना/ताला/रिमोट/कम्प्युटर/मोमबत्ती/बाल्टी (बत्ती गयो, मोमबत्ती बाल्नुस्) + चन्द्रमा/ताल/खोला/
        झरना/भूकम्प/साँप/भालु (वनमा भालु छ — exercises the VA_AS_B prefix fix) + गुलाबी/प्याजी.
        Saturated words skipped throughout (हो/छ/छैन, राम्रो/ठूलो/धेरै, कहाँ/यहाँ, बजार, घरमा…).
        All 160 devs dup-checked + romanize-verified (validator caught "चर्पी कहाँ छ?" as an existing
        item → swapped). After approval: merge → render → `AUDIO_VERSION` 26 → **T29 frame coverage
        closes at ~305/959 items** (remaining unframed = the low-value tail + multi-word phrases that
        already carry context).
- [x] **T32 · Depth mechanism — route by the shown frame, not the canonical word** — `buildExercises`
      (`js/sano.js`) now computes `multiWord` from `pickFrame(item).np`, so a single-word `vocab` item
      whose review lands on a multi-word alternate frame is drilled as a word-bank (assemble the
      phrase) instead of free-typing the whole sentence. No-op for items whose canonical is already
      multi-word (all prior batches). Verified headlessly (एक → type at its word, word-bank with a
      multi-word frame); full suite green. Unlocks the large single-word noun pool for depth (T29 batch 6+).
- [x] **T30 · Depth content — new "real expression" units** — via the existing expansion pipeline
      (T14), add a few new mastery-gated units of short, high-utility whole utterances built from
      already-known vocabulary. Appended at the path's end; Nepali `dev` AI-drafted → Ross's review;
      audio rendered for the new items only, bump `AUDIO_VERSION`.
  - [x] **Batch 1 — four themed units (32 utterances)** — drafted into the T14 expansion tool
        (`design/expansion.html`), blanket-approved by Ross, merged as four new `kind:'phrases'` units
        appended at the path's end (`COURSE` now 102 units / 959 items): **Sounding Natural** (saanchai
        "really?!", chhodnus "never mind", ke garne "oh well"), **On the Move** (yahin roknus "stop
        here", kati taadha cha "how far?", baayaa/daayaa jaanus "turn left/right"), **Being a Guest**
        (ma aghaaen "I'm full", piro nahaalnus "no spice", ma shaakaahaari hu "I'm vegetarian",
        khanako lagi dhanyabaad "thanks for the food"), **At the Shop** (dherai mahango bhayo "too
        expensive", chhut dinus "give a discount", sabai kati bhayo "how much for everything?"). Every
        `dev` dedup-checked against the course; one guest phrase swapped off an eyelash-ra (ZWJ) spelling
        for a clean one. Audio rendered (32 phrase + 19 word clips, `AUDIO_VERSION` 21); dev-seed card
        added (four `seed('unit:…')` buttons). (Minor: words.json flags 3 cosmetic slug conflicts —
        `mitho` मिठो/मीठो, `sidhaa` सिधा/सीधा, pre-existing `bhane` भने/भनेँ — audibly identical, tile
        clip plays a correct pronunciation either way; easy to align spelling later if wanted.)
- [x] **T31 · Frames-review tool** — `design/frames.html` + `design/frames-save.php` (mirrors the
      `expansion.html` pipeline): groups candidate frames under their target item (English + canonical
      `dev`/romanization), live-romanizes the editable frame `dev`, and lets Ross edit / approve /
      reject; POSTs decisions to `frames-save.php` → gitignored `design/frames-approved.json` (never
      touches `js/data.js`). Draft format `design/frames-draft.json` (gitignored) = `[{ id, item,
      itemEn, itemDev, dev, en }]`; approved frames merged into the items' `frames: []` by hand, then
      audio rendered (`<id>-fN`, bump `AUDIO_VERSION`). Seeded with the next batch — **24 past-tense
      verb frames awaiting Ross's review** (T29 batch 2). Not deployed (`design/` never ships).
- [ ] **T33 · Accept either gloss for multi-English phrases** — many items carry two English
      glosses in `en` (`"Excuse me / I'm sorry"`, `"Enough / That's sufficient"`, …). Where the
      **English is the graded answer**, only the full both-glosses string is accepted today, so
      producing one gloss grades wrong. Concretely: the **`wordbank` np-en** direction
      (`js/sano.js` `renderWordbank`, target `f.en`) forces the user to assemble *all* the words of
      *both* glosses; **`choice` np-en** shows the whole `"A / B"` as a single option (works but
      clunky). The **en-np** directions are fine (one Nepali answer) but display both glosses in the
      prompt. Fix: split `en` on ` / ` and accept **any one** alternative when grading an
      English answer (and only tile/offer one gloss's words in np-en word-bank), leaving the
      display/prompt choice to review. **149 candidate items** enumerated for Ross in
      `docs/multi-english-review.md` (grouped by unit, checkbox-per-item) — a few are pronoun/register
      slashes ("He / She (informal)") that are one meaning, not accept-either; the review sorts true
      alternates from near-synonyms ("Vegetables / Curry") from those better trimmed to one gloss.
      Regenerate the list with the T33 script if data changes. Needs a dev-seed scenario + a unit test
      on the split-and-accept-either grader.
  - [x] **Mechanism (grader + data model)** — `acceptedEnglish(ex)` in `js/sano.js` returns the
        accepted glosses for a "build/type the English" (np-en) exercise: an item opts in with
        `enEither: true` (split its `en` on ` / `) or an explicit `enAlt: [...]` (for a slash that
        sits mid-phrase, e.g. `ऊ गीत सुन्छ`). `checkExercise` accepts the answer if it matches ANY
        gloss; the np-en word-bank tiles only the FIRST gloss (so it's buildable). Unflagged items
        are byte-identical to before. Unit test `tests/unit/accept-english.test.mjs` (10 cases);
        full suite green.
  - [x] **Batch 1 — top-of-course through *Places & Getting Around*** (69 items). Ross's per-item
        call is encoded in the review doc: **kept the slash → accept-either** (22 items: `enEither`,
        or `enAlt` for the one mid-phrase `ऊ गीत सुन्छ`); **trimmed to one gloss → single `en`, no
        flag** (47 items, e.g. रोटी `Bread / Flatbread`→`Flatbread`, होटल `Restaurant / eatery`→`Hotel`,
        हजुर→`Yes (polite)`). English-only edits → no audio re-render. Those sections removed from
        `docs/multi-english-review.md` (80 items remain). हजुर/हुन्छ/हुँदैन keep their trimmed display
        `en` but gained `enAlt` for the extra senses Ross noted (hajur `['Yes','You','Pardon']`, huncha
        `['Yes','Okay','It will be done']`, hudaina `['No',"It won't work"]`).
  - [ ] **Remaining batches** — 80 items still to review (Place & Position → At the Shop) + a
        dev-seed scenario once the review settles.
