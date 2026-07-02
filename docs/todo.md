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
- [x] **T8 · Adaptive, review-dominant daily loop** — `dailyPlan()` throttles new words by review
      debt and sizes reviews to a ~18–20 exercise session, carrying the backlog. (`startDailyLesson`,
      `renderHome`.)
- [x] **T9 · Split units >14 items** — 44 → 58 units (~8–12 words each), item ids untouched, anchor
      ids preserved on chunk 1. **New sub-unit titles/goals are AI-drafted → Ross's review.**
      (`js/data.js`.)
- [x] **T10 · Schema v3 migration (fresh start)** — `migrateV2State` keeps name/streak/lifetime
      tally, resets learning progress, restarts at unit 1. (`tests/unit/migration.test.mjs`.)
- [ ] **T11 · Phase 2 — grow vocabulary toward ~2,000 words** — source the highest-frequency missing
      words from the `tools/dict` frequency ranking (ties to **T3**), add as new ~8–12-word
      mastery-gated units by frequency + situation; regenerate audio for the new items only and bump
      `AUDIO_VERSION`. Nepali `dev` AI-drafted → Ross's review. Multi-batch — driven by the pipeline
      below (T14); each batch = select → draft → review → merge → audio.
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
- [x] **T16 · Batch 2 — everyday adjectives (~45)** — 45 high-frequency everyday adjectives, curated
      from the top-80 `--pos adj` pool (dropped semantic dupes already taught + news/formal terms) and
      wrapped in short natural frames (phrases-style). Reviewed + approved, then merged into
      `js/data.js` as 5 units after `comparing-things` (Size & Feel, Good/Bad & Right, Order &
      Sequence, Same or Different, States & Conditions); aligned अरू→अरु to the course's spelling;
      `tools/dict` coverage refreshed, audio rendered (45 phrase + 58 word clips, `AUDIO_VERSION` 8),
      dev-seed scenario added. **Still open:** the 5 unit titles + goals are AI-drafted → Ross's
      refinement; **push/deploy pending Ross's go.**
