# Architecture — sano

> File + function map, so a session can skip scanning `js/data.js` (~5k lines),
> `js/sano.js` (~2.1k), and `css/sano.css` (~2.8k). Load with `@docs/architecture.md`.
> Data **shapes** and the feature-code glossary live in `@docs/data-model.md`.
> Internal-only — `tools/deploy.sh` uses an explicit allowlist, so `docs/` never ships.

Plain HTML/CSS/JS, **no build step**. `index.html` is the single SPA shell; screens are
`#screen-*` divs toggled by `showScreen()`. A small PHP/MySQL sync API lives in `api/`.
No external requests at runtime (fonts self-hosted, icons an inline SVG sprite, audio
pre-rendered) — the only network calls are same-origin `fetch()`es to `api/`.

## Scripts (load order) + the global each defines

Classic scripts (not modules), all `defer`, so each defines a global the later ones use.
Order in `index.html`:

1. `js/data.js` — **`COURSE`**: 88 units / 845 items — the entire course content (the big file). Units >14 items were split into ~8–12-word chunks for the SR-05 mastery gate; item ids are unchanged. The T11 vocabulary expansion adds new frequency-sourced units by batch (batch 1: 50 everyday-verb frames as 5 units after `verbs-past`; batch 2: 45 everyday-adjective frames as 5 units after `comparing-things`; batches 3–6: everyday nouns (46), adverbs (44), function words (27), and everyday-life nouns pt.2 (45) as 5 units each appended at the end).
2. `js/romanize.js` — **`SanoRomanize`**: derives romanization + pronunciation from Devanagari (`romanize(dev)` / `pronounce(dev)`; spec `docs/romanization.md`). At load it **rewrites each `COURSE` item's `np` and `pron` from `item.dev`** (`np` and `pron` were removed from `data.js`; items store only `dev`/`en` + `usage`/`emoji`). Also exposes `stripTags(dev)` — drops inline ElevenLabs `[performance tags]` (used by dialogue `dev`) so they never reach text; `romanize`/`pronounce` strip first. Pure + classic-script, so the tests lift it.
3. `js/sync.js` — **`SanoSync`**: debounced server push, revision-checked conflict detection, last-write-wins. `adoptSession()`. Bookkeeping in localStorage `sano.sync.v1`.
4. `js/push.js` — **`SanoPush`**: PWA daily-reminder toggle + `pushManager.subscribe`. VAPID public key baked in.
5. `js/onboarding.js` — **`SanoOnboard`**: first-run scripted Sano conversation (name, placement/skip-ahead, optional account/PWA steps). Per-Sano-bubble heads from `CHARACTER_HEADS`.
6. `js/audio.js` — **`SanoAudio`**: `play(id)` (phrase clips `audio/<voice>/<id>.mp3`), `playWord(slug)` (`audio/words/<slug>.mp3`), `button(...)`. `AUDIO_VERSION` busts caches.
7. `js/dialogues.js` — **`DIALOGUES`** (schema v2) + `CHARACTER_PERSONAS`; helpers `dialogueVoiceFolder(d, who)`, `dialogueClipId(d, index)`.
8. `js/characters.js` — **`CHARACTER_HEADS`** (dialogue/onboarding bubbles, viewBox `0 0 200 200`) + **`CHARACTER_BODIES`** (path companions). **Generated** by `tools/build-character-heads.mjs` — do not hand-edit.
9. `js/gloss.js` — **`SanoGloss`**: `renderLine(line)` (underlined tappable segments) + a tap-to-translate popover; `closePop()`. Shared by the app and `design/dialogue.html`.
10. `js/sounds.js` — **`SOUND_TOPICS`**: pronunciation-drill topics (SR-08).
11. `js/sano.js` — **`window.Sano`**: the lesson engine (functions below). Public API: `state` (getter), `saveState`, `refreshHeader`, `showScreen`, `renderHome`, `applyServerState`, `placeBefore`, `placementOptions`, `resetPathReveal`.

## CSS (load order)

`css/fonts.css` (self-hosted Neuton/Lato woff2) → `css/normalize.css` → `css/barebones.css`
(**sets the rem base to 10px** via `font-size: 62.5%`; styles bare `<button>` with
`white-space: nowrap` — the reason gloss/onboarding use `<span role="button">` or override it)
→ `css/sano.css` (all app styles + theme tokens in a light block and a dark `@media` block —
change both) → `css/admin.css` (admin dashboard only).

## js/sano.js — function index (grouped)

- **Pure scheduler** (top of file; lifted + unit-tested in `tests/unit/`): `reviewInterval`, `isRecallStrength`, `isGraduated`, `nextLearningStep`, `scheduleReview`, `exerciseGrade`, `legacyLevelToInterval`.
- **State:** `defaultState`, `loadState`, `normalizeState`, `saveState`, `migrateV1State`, `migrateV2State`, `migrateLegacyState`, `applyServerState`, `itemRecord`.
- **Dates / streak:** `dayString`, `daysBetween`, `daysSince`, `isDue`, `overdueDays`, `dueItems`, `registerActivity`.
- **Home / path:** `renderHome`, `renderPath`, `currentUnit`, `unitNewItems`, `unitDueCount`, `unitIsComplete`, `unitIsIntroduced`, `unitMasteredCount`, `unitIsUnlocked`, `placeBefore`, `placementOptions`, `dialogueUnlocked`, `soundUnlocked`.
- **Lesson build / flow:** `dailyPlan`, `startDailyLesson`, `startUnitLesson`, `startLesson`, `buildExercises`, `warmupItems`, `continueLesson`, `finishLesson`, `showStreakResult`.
- **Exercise renderers:** `renderExercise` (dispatch) → `renderChoice`, `renderMatch`, `renderListenMatch`, `renderWordbank`, `renderType`, `renderSpeak`; helpers `setPrompt`, `setListenPrompt`, `getDistractors`, `wordbankDistractors`, `uniquePairItems`, `fitMatchTiles`, `hashId`/`waveformSvg`/`listenTile`, `playTileWord`, `cleanTileText`, `stripParens`.
- **Grading:** `answerExercise`, `checkExercise`, `applyAnswer`, `showFeedback`, `selectMatchTile`, `finishMatch`, `normalize`, `lenientEquals`, `editDistance`.
- **Dedup invariant:** the tap-the-pairs grids and `choice` dedupe each bundle by display text (`uniquePairItems`, plus `getDistractors`' used-text set) so two items with identical romanized/English text never appear as two tiles — which would let a correct pairing grade as wrong.
- **Dialogue player (SR-01):** `startDialogue`, `renderDialogueConvo`, `dialogueBubble`, `revealNextLine`, `advanceDialogue`, `startDialogueQuiz`, `renderDialogueQuestion`, `answerDialogueQuestion`, `continueDialogue`, `finishDialogue`, `courseItem`.
- **Sounds (SR-08):** `startSoundDrill`, `renderSoundCard`, `highlightDev`, `advanceSound`, `finishSound`, `soundExamples`.
- **Recording (SR-04 / SR-08):** `createRecorder` — mic → `MediaRecorder` → **Web Audio `decodeAudioData`** for playback (iOS refuses to decode its own `audio/mp4` in a media element; don't "simplify" to `new Audio()`).
- **Misc UI:** `openDictionary`, `renderTables`, `toggleWord`, `showScreen`, `goHome`, `refreshHeader`, `saveName`, `shuffleArray`, `itemAccuracy`, `promptText`.

## Control flow (what a session usually needs)

- **Home / path:** `renderHome` → `renderPath` draws the winding path — units in order, with dialogue (gold) and sound (lavender) nodes woven in after their `after` unit, and decorative companions in the pockets (SR-07). `currentUnit` = first unlocked, incomplete unit; **a unit is complete (unlocks the next) only when every item has `graduated` — the SR-05 mastery gate** (`unitIsIntroduced` = the weaker "all met"; the current node's ring fills by `unitMasteredCount`). The daily-lesson button (`dailyPlan`) is review-dominant and throttles new words by review debt.
- **Lesson:** `startDailyLesson` (via `dailyPlan`) / `startUnitLesson` → `buildExercises` makes the queue. Each new item: 2× `choice` + an in-session tap-based `wordbank` recall (ordered after a recognition drill) + a `speak`. Review items **escalate with maturity** — recall-strength (interval ≥ `RECALL_INTERVAL` = 2) gets a `wordbank` while still learning and free `type` once `graduated`; ~50% of recall reviews audio-only; `listenMatch`/`match` bundles for eligible vocab. `renderExercise` dispatches by type → answering routes through `applyAnswer` → `scheduleReview` (auto-graded via `exerciseGrade`; EASY grades accrue `recalls` toward graduation) → `registerActivity`. `finishLesson` shows the complete screen.
- **Dialogue (SR-01):** `startDialogue` → `renderDialogueConvo` reveals lines one at a time (`dialogueBubble` builds a head + bubble for a speaker, or a full-width narrator line; **romanized-only** via `SanoGloss.renderLine`, with autoplayed `SanoAudio`) → `startDialogueQuiz` (comprehension) → `finishDialogue` marks `dialoguesDone`.
- **Sync:** `saveState` marks the state dirty → `SanoSync` debounces a `PUT api/state.php` (revision-checked, last-write-wins). `applyServerState` adopts a server copy on login. The app is fully usable offline / logged-out (localStorage is the working copy).

## api/ endpoints (PHP + PDO; mutations need CSRF header `X-Sano-Request: 1`)

| File | Purpose |
| --- | --- |
| `lib.php` | Shared: PDO connect (reads `sano-config.php` one level above docroot), auth, `require_admin()`/`is_admin()`, JSON 500 exception handler. Not an endpoint. |
| `register.php` | Open self-service signup (argon2id, auto-login, per-IP hourly throttle via `signup_attempts`). |
| `login.php` | Username/password login; per-account lockout + per-IP throttle (`login_attempts`); returns state, revision, `isAdmin`. |
| `logout.php` | Clears the `sano_session` cookie. |
| `state.php` | `GET` fetch / `PUT` push the app-state blob; revision conflict → 409. Returns `isAdmin`. |
| `reminder.php` | `GET`/`POST` the per-account `reminder_hour` (0–23) + `reminder_tz` (IANA). |
| `push-subscribe.php` / `push-unsubscribe.php` | Store / delete a per-device Web Push subscription. |
| `admin-users.php` | Admin: every account's last-sync, streak, graduated item ids (for path position). |
| `admin-reset-password.php` | Admin: argon2id reset + clears that user's sessions. |
| `admin-delete-user.php` | Admin: delete a user (cascades app_state/sessions/subscriptions); self-delete blocked. |

Every endpoint follows one **guard order** (documented at the top of the guards in
`lib.php`): `require_method()` → `require_csrf_header()` (mutating verbs) →
`read_json_body()` → stateless field validation → `require_user()`/`require_admin()` → DB
work. Auth runs last among the guards, so a malformed request fails fast before opening a
DB connection — and the whole method/CSRF/JSON/validation surface is exercised by the no-DB
`--api` guard specs (`session_user()` returns 401 without a cookie, before any `db()`
call). Checks that need a row (revision conflict, `no_such_user`, the admin check)
necessarily follow auth and live in the DB-gated integration specs.

## tools/

| File | Purpose |
| --- | --- |
| `deploy.sh` | rsync the site to namastesano.com (explicit allowlist; `-n` dry-run). Run only when asked. |
| `format.sh` | Prettier over HTML/CSS/JS + `@prettier/plugin-php`; `--check` for CI. Part of every change. |
| `check.sh` | Static preflight: Prettier, asset stamps, `php -l`, `node --check`. Used by `test.sh --static` and CI's `npm run lint`. |
| `test.sh` | **Single test-suite entry point** — tiers `--static --unit --data --api --ui` (default = all). See "## Tests". |
| `stamp-version.mjs` | Rewrites the `?v=` content-hash stamps on local asset URLs in `index.html` + `admin/index.html`. Run after format. |
| `screenshot.sh` | Headless-Chrome screenshot wrapper (`<url> <out.png> [WxH] [budget-ms]`). |
| `dev-seed.html` | Committed dev tool (served, never deployed): seeds `sano.state.v1` and opens the app where a gated feature is visible. Add a scenario for every new feature. |
| `make-user.php` | CLI account create / `--reset-password` (invite-only; run on the server). |
| `send-reminders.php` | Server-only hourly cron: dispatch Web Push reminders (minishlink/web-push). Not in the rsync. |
| `make-touch-icon.html` | Source for the app-icon PNGs (render at 512 then `sips` downscale). |
| `build-character-heads.mjs` / `build-anim-characters.mjs` | Generate `js/characters.js` / `design/anim-characters.js` from `design/characters.html`. Re-run after editing character art. |
| `schema.sql` | Canonical DB schema (see `@docs/data-model.md`). Live changes go through a one-off idempotent `migrate-*.php`, then fold back into this file — never re-apply it to an existing DB. |
| `tts/synth-app.mjs` | Render phrase / word / dialogue-line clips through the ElevenLabs API in Sano's cloned voice — `--phrases` (→ `audio/default/<id>.mp3`, ~588) / `--words` (→ `audio/words/<slug>.mp3`, ~233) / `--dialogues` (→ `audio/<voice>/<clipId>.mp3`, per speaker). Add `--new` for only clips missing on disk, `--only` for one, `--sample` to preview. Bump `AUDIO_VERSION` (js/audio.js) after. |
| `tts/build-words.mjs` | Build `tts/words.json` (per-word Devanagari, phrases-only) for the word-bank clips. |
| `tts/dialogue-scripts.md` | The conversations' English **source of truth** (story / questions / metadata / voice-direction). `js/dialogues.js` is hand-built from it (adds the Nepali + clip routing); `synth-app.mjs --dialogues` then renders audio. Synced by hand — no generator/drift-check. |
| `tts/voice-tags.md` | Reference for the ElevenLabs v3 `[bracket]` audio tags + how they flow through the pipeline (inline in dialogue `dev` → synth verbatim → stripped from on-screen text). |
| `tts/eleven.mjs` / `tts/phrases.mjs` / `tts/build-compare.mjs` | ElevenLabs client + voice mapping + sample-comparison design tool. |
| `dict/build-dictionary.mjs` | Generate the local-only ground-truth Nepali↔English dictionary (`tools/dict/README.md`): ACQUIRE Leipzig freq list + kaikki Wiktionary → LEMMATIZE/GLOSS via Claude (register-weighted, cross-checked) → MERGE+EMIT `dictionary.json` + `coverage-report.md`. Incremental/cached like synth-app (`--acquire`/`--lemmatize`/`--gloss`/`--report-only`/`--new`). Flags COURSE translation disagreements for review (never auto-corrects). Needs `ANTHROPIC_API_KEY`; `sources/`+`cache/` gitignored. |
| `dict/select-candidates.mjs` | **T11 expansion pipeline, stage 1** (deterministic, no API): rank the everyday, not-yet-covered words of one part of speech from `dictionary.json` → `design/expansion-candidates.json`. Pure `selectCandidates()` (tested). Then Claude drafts frames → `design/expansion-draft.json`, reviewed in `design/expansion.html` (+ `expansion-save.php` → `expansion-approved.json`), merged into `js/data.js` by hand, and audio rendered (`synth-app --new --words --new`, bump `AUDIO_VERSION`). Staging JSONs gitignored. |

## Tests

One suite, one entry point (`tools/test.sh`), five tiers. Internal-only (not deployed).

| Tier | Runner | What it covers |
| --- | --- | --- |
| `--static` | `check.sh` | Prettier, asset stamps, `php -l`, `node --check`. |
| `--unit` | `node:test` (`tests/unit/*.test.mjs`) | Pure logic lifted from `js/sano.js`: SR-05 scheduler, answer matching, dates/streak/freeze, v1/legacy state migration, exercise dedup; + Devanagari→romanization golden cases (`js/romanize.js`); + the dictionary tool's Devanagari normalizer/tokenizer (`tools/dict/lib/normalize.mjs`). |
| `--data` | `node:test` (`tests/data/*.test.mjs`) | `COURSE`/`DIALOGUES`/`SOUND_TOPICS` integrity — unique ids, required fields, the gloss-join invariant, sound-mark coverage; + romanization coverage over all 638 `dev` (every codepoint mapped, clean output charset, structure preserved); + the ground-truth `dictionary.json` (schema + every COURSE word represented; skips until built). |
| `--api` | `@playwright/test` request (`tests/api/`) | Pre-DB guard specs (method/CSRF/JSON/validation, no DB) + a PHP pure-helper test; `integration.spec.mjs` adds the full request cycle, gated on `SANO_TEST_DB`. |
| `--ui` | `@playwright/test` Chromium + WebKit (`tests/e2e/`) | Onboarding, home/path + 9-width overflow, every lesson exercise type, the dialogue player + tap-gloss, dictionary, reminder modal, admin demo, idle/reduced-motion. |

- **`tests/lift.mjs`** — pulls pure declarations out of the classic (non-module) browser
  scripts without a browser: `liftBlock` (sentinel-delimited), `liftGlobals` (whole pure
  data file), `liftFns` (by-name function extraction, comment/string-aware) with optional
  `inject`/`preamble`. No app-code changes were needed to make the logic testable.
- **`tests/seed.mjs`** — the `sano.state.v1` fixture builders (`midCourse`, `dialogueReady`,
  the single-exercise `lesson*` seeds, …), the same ones `tools/dev-seed.html` uses.
- **`tests/e2e/_helpers.mjs`** — `boot()` (seed + load + inline animation-freeze) and
  `stepLesson()` (drives any exercise renderer, pairing match tiles by `data-id`).
- **CI** (`.github/workflows/ci.yml`) — three jobs: static+unit+data+api-guards; e2e
  (Chromium+WebKit); api integration against a `mysql:8` service. Real iOS-device Safari
  stays a manual check.
- **Deferred:** visual screenshot-diff regression (pixel snapshots layered over the e2e
  specs) is scoped but **not built** — it needs a pinned-Linux baseline pipeline to stay
  deterministic. Design + decision log: `docs/visual-regression.md`.
