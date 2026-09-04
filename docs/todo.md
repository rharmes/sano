# sano — Tasks

The project backlog. Claude keeps this current: every task Ross asks for — plus any suggestion Ross
agrees to, and anything discovered mid-work — is added here as an unchecked box with a unique `T<n>`
ID and the tags below, and the box is ticked in place once the task is **resolved** — delivered, or
closed `wontfix` with the reason in the archive. It's plain Markdown grouped by area, so read or
edit it by hand anytime. Most items here wait on Ross (a review, a decision, or a native-speaker
check) — they aren't derivable from the code, so they're easy to lose if they leave this list.
Refer to any task by its ID (e.g. "T3").

**Delivered tasks shrink to one line here**, and their full record — decisions, rulings, measured
numbers, what was deliberately *not* done — moves to **`docs/todo-archived.md`** in the same change.
This file is loaded into context every session, so it stays small; the archive is read on demand.
IDs are never reused, so a `T##` in a commit message still resolves.

## Tags (T34)

Every **open, top-level** task carries all of its tags on its title line — never wrapped onto a
continuation line, even when that runs the line long — so one `grep` returns one line per task and
that line says which task it is. (Markdown isn't Prettier-formatted here, so nothing reflows them.)
Ticked tasks and indented sub-items carry none: they'd be noise, and "who is this waiting on" is
meaningless once it's done.

- **`waiting-on:`** — required, exactly one of **`ross`** · **`native-speaker`** · **`none`**. This
  is about **people**: `none` means no human owes anything before the work can proceed. It does not
  mean "startable" on its own — a task can wait on nobody and still be held up by another task,
  which is what `blocked-by:` is for.
- **`area:`** — required, exactly one of **`content`** · **`companions`** · **`dialogues`** ·
  **`vocab`** · **`engine`** · **`app`** · **`tooling`** · **`server`** · **`security`** ·
  **`testing`**. This is deliberately *not* just the `##` heading: `grep` can't see headings, and a
  task can sit under one section while the work is another kind (T33 files under the learning engine
  but is content review). Note the two frontend values: `engine` is the scheduler and lesson builder
  specifically, and `app` is everything else the user touches (screens, navigation, reference
  surfaces). Prose in these bullets stays in plain code ticks — the **bold**-code form is what the
  test reads as the vocabulary itself, so bolding a word here would quietly make it a legal value.
- **`blocked-by:T##`** — optional, only where a real dependency exists. Must point at a task that
  is still open in this file; a `blocked-by:` aimed at a delivered task is stale by definition.

```sh
T=docs/todo.md; O='^- \[ \]'                     # O = "an open task line", not this header
grep -nE "$O.*waiting-on:ross" $T                # everything sitting on Ross
grep -nE "$O.*area:content" $T                   # one area, across every section
grep -nE "$O.*blocked-by:" $T                    # held up by a task rather than a person
grep -nE "$O.*waiting-on:none" $T | grep -v blocked-by   # startable right now, by anyone
```

The `^- \[ \]` anchor matters: without it every recipe also matches this header's own prose and
code, and the ticked one-line summaries. And the last one composes only because a task's tags all
share one line — which is why the title-line rule above is a rule and not a preference.

`tests/data/todo-tags.test.mjs` enforces all of the above, and reads the two vocabularies out of
**this header** — so adding a value means documenting it here first, and the docs can't drift from
what's in use.

## Backlog tooling

- [x] **T34 · Lightweight query structure for the backlog** — `waiting-on:` / `area:` /
      `blocked-by:` tags on every open task's title line, documented in the **Tags** header above and
      enforced by `tests/data/todo-tags.test.mjs` (2026-08-07).

## Agent instructions

- [x] **T62 · `AGENTS.md`, a Codex-CLI twin of `CLAUDE.md`** — the same instructions under three
      harness substitutions, the same-commit rule stated in both, and `tests/data/agents-md.test.mjs`
      failing on any other difference (2026-09-03).

## Dialogues & audio

- [ ] **T1 · Add voice tags to the conversations** `waiting-on:ross` `area:dialogues` — review `tools/tts/dialogue-scripts.md`, add
      ElevenLabs `[performance tags]` (list + pipeline: `tools/tts/voice-tags.md`), re-map changed
      lines into `js/dialogues.js`, and re-render their audio.
- [x] **T2 · Re-render the reconciled greet-pyaro audio** — `greet-pyaro-01/-07/-10` re-rendered to
      match the text after the `[shouting]`/"copying" edits.
- [x] **T35 · Word clips for standalone single-word items** — the word inventory now covers every
      canonical + frame sentence in every unit (719 → 1050 tile-words), 2026-07-20.

## Content review

- [ ] **T3 · Review the dictionary's recommendations** `waiting-on:ross` `area:content` (`tools/dict/`; flag-only, never
      auto-applied): COURSE translations it disagrees with (`tests/data/dictionary.test.mjs` / the
      `.review` entries in `dictionary.json`) and high-frequency missing words
      (`tools/dict/coverage-report.md`).
- [ ] **T4 · Merge the Devanagari review** `waiting-on:ross` `area:content` — `design/devanagari-review.json` (gitignored) → the `dev`
      fields of `js/data.js` (in-session, no merge script), then clear the review file.

## Companion characters

- [x] **T5 · Pick a direction per companion, then refine and wire them in** — **closed wontfix
      (2026-08-07, Ross):** the 5-directions-per-animal review in `design/characters.html` was never
      run, and the generated heads are good enough to ship behind. Art direction stays open under
      T12.
- [ ] **T12 · Reorder companions along the path + section-appropriate art** `waiting-on:ross` `area:companions` — the decorative
      companions currently sit in a fixed order in the path pockets (`buddyOrder` in `renderPath`,
      `js/sano.js`). Reorder them so each companion lands near the section it fits, and generate
      companion art that makes sense for that section (regenerate from `design/characters.html` via
      `tools/build-character-heads.mjs` → `js/characters.js`). **Order half delivered by T13
      (2026-07-21):** `buddyOrder` now mirrors the `UNIT_VOICES` path sections (drift-guarded by
      `tests/data/unit-voices.test.mjs` — change the two together). Still open: the
      section-appropriate **art**.
- [ ] **T13 · Give the companions their own voices in lessons** `waiting-on:none` `area:companions` `blocked-by:T36` — each path companion voices their
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
- [ ] **T36 · Design voices for Hiun, Chanchal, Phurtilo, Lamo** `waiting-on:ross` `area:companions` — the four companions without an
      ElevenLabs voice (snow leopard, langur, tahr, gharial). Design/pick voices in the dashboard
      (persona notes: `CHARACTER_PERSONAS`, `js/dialogues.js`; process: RESEARCH.md §9), add ids to
      `VOICES` (`tools/tts/synth-app.mjs`) + `CHARACTER_VOICES` (`js/audio.js`), then render their
      `UNIT_VOICES` sections (`--units --new`). Until then their sections review in Sano's voice.

## Server & admin

- [x] **T40 · Traffic numbers in the admin dashboard** — nightly Apache-log ingest → the `traffic_*`
      tables → the Traffic tab; a visitor is a salted hash, never a raw IP (2026-07-26).

## Security

Findings from the full security review of 2026-07-26 (six parallel reviews: auth/session, API
injection & authz, frontend XSS, Apache/exposure, server-side scripts & privacy, secrets/supply
chain). **Nothing Critical or High was found, and no credential has ever been committed** — the auth
design (CSPRNG tokens hashed at rest, argon2id, bound parameters throughout, no `X-Forwarded-For`
trust, no client-settable `is_admin`) held up under scrutiny. All fifteen items — plus T57 and T58,
split out of T54's bundle once they outgrew "not individually urgent" — are delivered and deployed.
Findings, rulings, measurements and what was deliberately left undone: `docs/todo-archived.md`.

- [x] **T41 · Turn off Apache directory listing** — `Options -Indexes`, verified against a real
      Apache 2.4 and guarded by the static tier.
- [x] **T42 · Validate and scope push subscriptions** — https + a host allowlist, key-shape checks,
      an owner-scoped upsert, and a 20-row cap per user.
- [x] **T43 · Fix `api/state.php` write handling** — `strict_types`, a `json_encode` failure now
      400s, and the write is one atomic revision-checked `UPDATE`.
- [x] **T44 · Bound request bodies before decode, and catch fatals** — `read_body()` caps by
      `Content-Length` and by the read itself; a shutdown handler emits the JSON 500.
- [x] **T45 · Stop `api/admin-users.php` loading every user's full state blob** — rows are streamed
      and summarized by a bounded `state_summary()`.
- [x] **T46 · Revoke sessions on the CLI password reset** — the reset now deletes the user's
      sessions and applies the same username regex as signup.
- [x] **T47 · Close the login account-existence oracles** — a wrong password, an unknown username
      and a locked account are one 401, identical in cost and rate-limit budget.
- [x] **T48 · Harden the session cookie and HTTPS enforcement** — `__Host-` prefix, unconditional
      `Secure`, and the http→https 301 codified in `.htaccess`.
- [x] **T49 · Bound the traffic ingest against a log flooder** — per-day and per-visitor caps, a
      parse-time bot filter, and `mine` now requires a 2xx from an admin endpoint.
- [x] **T50 · Harden `--update-geo`** — a version-pinned source, absolute + ratio floors before the
      rename, and `ctype_alpha()` on the country code.
- [x] **T51 · Keep secrets and device IDs out of the cron logs** — one-line exception handlers in
      all four CLI scripts, and a random per-invocation salt for `--json`.
- [x] **T52 · Make the reminder cron fault-tolerant** — each subscription queues and flushes inside
      its own `try`/`catch`, and is dropped after 10 consecutive failures.
- [x] **T53 · Same-origin guard on the service-worker notification URL** — `safeTarget()` resolves
      the payload URL against our origin and falls back to `/`.
- [x] **T54 · Security hardening bundle** — eight of nine small items (rehash-on-login, the
      `__proto__` guard, `strict_types`, throttle indexes, four headers, `--delete-after`, CI
      permissions); `PDO::ATTR_EMULATE_PREPARES` deliberately left for its own change.
- [x] **T55 · Traffic retention and salt rotation** — a 13-month purge plus a per-year derived salt;
      `traffic_salt` documented as a credential of the same class as the DB password.
- [x] **T57 · Bucket the per-IP throttles by /64, not by address** — `throttle_ip()`; IPv4 whole,
      IPv4-mapped unmapped first so a dual-stack proxy can't share one bucket.
- [x] **T58 · Close the `showNotice` innerHTML sink** — notices build text nodes, links go through
      `showNoticeLink()`, and `esc()` is now attribute-safe.

## Testing

- [x] **T56 · Fix the flaky `no horizontal overflow across mobile widths` e2e** — one in-page
      measurement per width and resize-in-place instead of re-navigating: 14.5 s → ~1 s.
- [x] **T17 · Fix the flaky WebKit match-lesson e2e** — force-click each pair and verify both tiles
      reached `.matched`, retrying the pair.
- [x] **T39 · Watch: webkit type-recall e2e retried once under full-suite load (2026-07-22)** — not
      timing: the lesson draw was random, so `boot()` now stubs `Math.random` with a seeded PRNG.

## Romanization

- [x] **T19 · Handle visarga (ः, U+0903) in the romanizer** — `tokenize()` maps it to a coda "h"
      (प्रायः → Praayah).
- [x] **T22 · Generalize व→b for व्य- words in the romanizer** — a positional व्य→"b" rule in the
      shared tokenizer; the one affected clip was renamed `wyakti` → `byakti`.

## Reference & lookup

- [ ] **T60 · Look-up / translator on the dictionary screen** `waiting-on:none` `area:app` — a search field above the two dictionary tables taking **English, romanized Nepali, or Devanagari** and answering with matches; the tables below filter to the hits. Interviewed 2026-08-07; Ross's rulings:
      - **Placement — folded into `screen-dictionary`, not a new screen.** The header already carries
        four controls plus the name, and the dictionary *is* the reference surface. It also fixes that
        screen's standing weakness: 959 rows with no way to find anything in them.
      - **Corpus — COURSE plus a shipped slice of the ground-truth dictionary.** COURSE gives 959
        items + ~610 frames; `tools/dict/dictionary.json` adds 2,471 entries of which **1,484 are
        beyond the course**, so an ordinary word you haven't met still answers. Trimmed to
        key/dev/en/pos that slice is **132K raw, 39K gzipped** — lazy-loaded on first search so cold
        start is untouched. Out-of-course hits are labelled as such.
      - **Not machine translation, and deliberately so.** This is a lookup over a fixed corpus. Real
        MT over arbitrary sentences needs a paid key behind `api/`, breaks offline, and would put
        un-reviewed Nepali in front of Ross — ruled out, not deferred.
      - **Input — sniff the script, no input UI.** Devanagari works through the iOS Nepali keyboard;
        romanized is the everyday path, matched via `normalize` so diacritics and spelling drift still
        land. An on-screen Devanagari keypad and romanized→Devanagari auto-transliteration were both
        considered and dropped as disproportionate.
      - **A result row shows** a play button (`SanoAudio.button` — a silent no-op for every
        out-of-course word, which is expected), where the word sits in the course (unit + introduced /
        learning / mastered), and its canonical example sentence carrying the T37 tap-glosses.
      - **Explicit non-goal: no "practice this" button.** Lookup never writes to the scheduler, so an
        afternoon of browsing can't reshape the review queue. Ross declined this deliberately — revisit
        only on a fresh ruling.
      - Open before building: whether the trimmed slice is generated by a new `tools/build-lookup.mjs`
        into a `js/lookup.js` (keeping `dictionary.json` local-only, consistent with the other
        generated `js/*.js` — recommended), and whether out-of-course results appear by default or
        behind a "look beyond your course" toggle.

## App & UX

- [x] **T61 · Word-bank pill: immediate visual feedback, decoupled from the tap audio** — tap
      handlers now place/select the tile first and start the clip just after the paint
      (`afterPaint`, `js/sano.js`); word-bank, match and listen tiles (2026-08-24).

## Learning engine — SR-05 relaunch (Phase 1)

Restructures the learning plan for mastery-based, high-repetition progression (interviewed +
planned 2026-07-01; reviewed and shipped 2026-07-01). Green across all test tiers. **Every batch's
unit titles + goals below are AI-drafted — still Ross's to refine**, as are the re-cut sub-unit
titles from T9.

- [x] **T6 · Learning-steps scheduler + softened intervals** — new words climb 1 → 2 → 4 days and
      graduate only after being *recalled* ~2×.
- [x] **T7 · Mastery gate + in-progress path UX** — a unit unlocks the next only when every word has
      graduated, and the ring fills by mastery.
- [x] **T24 · Two-tone ring so early progress shows** — a faint "introduced" arc under the solid
      "mastered" arc, so the ring moves the moment you practice.
- [x] **T8 · Adaptive, review-dominant daily loop** — `dailyPlan()` throttles new words by review
      debt and sizes a ~18–20 exercise session.
- [x] **T9 · Split units >14 items** — 44 → 58 units (~8–12 words each), item ids untouched.
- [x] **T10 · Schema v3 migration (fresh start)** — keeps name/streak/lifetime tally, resets
      learning progress, restarts at unit 1.
- [x] **T14 · Build the expansion pipeline** — select → Claude draft → `design/expansion.html`
      review → hand merge → audio; reusable across every T11 batch.
- [x] **T15 · Batch 1 — everyday verbs (~50)** — merged as 5 units after `verbs-past`.
- [x] **T18 · Batch 3 — everyday nouns (~46)** — 5 units appended; 73 units / 729 items.
- [x] **T20 · Batch 4 — everyday adverbs (~44)** — 5 units appended; 78 units / 773 items.
- [x] **T21 · Batch 5 — essential function words (~27)** — 5 units appended; 83 units / 800 items.
- [x] **T23 · Batch 6 — everyday-life nouns, part 2 (~45)** — 5 units appended; 88 units / 845 items.
- [x] **T25 · Batch 7 — feelings & everyday things (~33)** — first hand-curated themed pocket, 4
      units appended; 92 units / 878 items.
- [x] **T26 · Batch 8 — calendar, festivals & directions (~27)** — 3 units appended; 95 units /
      905 items.
- [x] **T27 · Batch 9 — linking words, more verbs & odds (~22)** — the final breadth batch, 3 units
      appended; 98 units / 927 items. After this T11 pivots from breadth to depth.
- [x] **T16 · Batch 2 — everyday adjectives (~45)** — merged as 5 units after `comparing-things`.
- [ ] **T11 · Phase 2 — grow vocabulary toward ~1,550 words (the everyday tier)** `waiting-on:none` `area:vocab` — source the
      highest-frequency missing words from the `tools/dict` frequency ranking (ties to **T3**), add as
      new ~8–12-word mastery-gated units by frequency + situation; regenerate audio for the new items
      only and bump `AUDIO_VERSION`. Nepali `dev` AI-drafted → Ross's review. Multi-batch — driven by
      the pipeline below (T14); each batch = select → draft → review → merge → audio. **Target
      ~1,550** — the everyday-register candidates the dictionary surfaces (873 remaining as of batch 3
      start, atop 683 taught); reaching the older ~2,000 goal would mean dipping into the formal
      register. Done: batch 1 (verbs, T15), batch 2 (adjectives, T16). Next: nouns (batch 3+, ~557
      candidates — the biggest well), then adverbs (~84) and function words (~40).

## Learning engine — T11 depth pivot (Phase 3)

The breadth expansion (T11 batches 1–9) picked the everyday-frequency pool clean, so T11 pivots from
**breadth → depth**: more frames/phrases around words already known, rather than new vocabulary.
Direction chosen with Ross 2026-07-02 — **Both** structures, emphasis on **real expressions** +
**everyday contexts**. All frame and unit `dev`/English below is AI-drafted → Ross's review.

- [x] **T28 · Rotating-frames mechanism** — an item may carry optional `frames: [{dev,en}]` that
      reviews rotate through, so a known word is practiced in varied contexts without new path units.
- [x] **T29 · Depth content — everyday-context alternate frames** — 17 batches, closed 2026-07-21:
      every high-frequency single-word item now carries rotating everyday frames (~305/959 framed).
- [x] **T32 · Depth mechanism — route by the shown frame, not the canonical word** — `multiWord` is
      computed from the shown frame, so a single-word item on a multi-word frame becomes a word-bank.
- [x] **T30 · Depth content — new "real expression" units** — 4 themed units of 32 whole utterances
      appended at the path's end; 102 units / 959 items.
- [x] **T31 · Frames-review tool** — `design/frames.html` + `design/frames-save.php`, mirroring the
      `expansion.html` pipeline (never touches `js/data.js`; `design/` never ships).
- [x] **T37 · Tap-a-word glosses in lesson exercises** — every word of a Nepali *prompt* taps to its
      English, backed by the generated `js/glosses.js` (1,130 entries). **Open: the 182 hand-drafted
      FILLS + 2 sense overrides + 2 extra senses are AI-drafted → Ross's review** (in the build
      script, greppable).
- [x] **T38 · Gate alternate frames by learner knowledge** — an alternate frame is eligible only once
      the item has graduated AND it adds ≤ 2 never-seen words; `choice` always shows the canonical.
- [x] **T59 · Tap-a-word hints on English prompts (T37 in reverse)** — an English prompt's words are
      dotted-underlined and tap to their **romanized Nepali**, on all three produce-the-Nepali cards.
      Ross's rulings: always available, **silent**, no SR penalty. Backed by the generated
      `js/en-glosses.js` (`tools/build-en-glosses.mjs`), keyed **per prompt** because an English
      word's Nepali depends on its sentence. **Open: 73% of content words are hinted (921 of 1,569
      prompts complete) — the remaining gaps are Ross's to fill in `design/en-gloss.html`**, whose
      rulings come back as `OVERRIDES`.
- [ ] **T33 · Accept either gloss for multi-English phrases** `waiting-on:ross` `area:content` — many items carry two English
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
