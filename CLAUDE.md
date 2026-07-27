# sano — Nepali Study Guide

A web app: essential Nepali phrases with Romanized pronunciations. Plain HTML/CSS/JS
frontend, **no build step** (`index.html`, `css/`, `js/`, `fonts/`, `tools/`) plus a small
PHP/MySQL sync API in `api/`. Deployed to namastesano.com (Apache) via `tools/deploy.sh`;
Ross tests on an iPhone running iOS 26.

## Reference docs (load with `@` at session start instead of scanning the code)

- **`@docs/architecture.md`** — file + function map, the global each script defines, control
  flow (home / lesson / dialogue / sync), and the `api/` + `tools/` tables.
- **`@docs/data-model.md`** — data shapes (`COURSE`, `DIALOGUES`, the state record), localStorage
  keys, DB schema, scheduler constants, and the **SR-\* / R\*** feature-code glossary.
- `docs/pedagogy.md` — learning-science basis. `docs/testing.md` — visual-capture + screenshot
  recipes. `tools/tts/RESEARCH.md` — voice/TTS. `design/style-guide.html` — visual tokens +
  components (brand source of truth).
- **`docs/todo.md`** — the running task backlog (what's outstanding, mostly waiting on Ross); I keep
  it current (see **Task list** below).

Those carry the deep detail; this file keeps the summary, the non-obvious constraints, and the
workflow. **Keep it current:** when architecture/tooling changes significantly, update this file
(and the relevant `docs/` file) in the same commit.

## Ask questions, especially when in Planning Mode

- **Interview me about every aspect of a plan until we reach a shared understanding.**  Walk down
  each branch of the design tree, resolving dependencies between decisions one-by-one. For each
  question, provide your recommended answer. If a question can be answered by exploring the codebase,
  explore the codebase instead.

## Non-negotiable constraints

- **No external requests at runtime.** Fonts are self-hosted woff2 (`css/fonts.css`); icons are
  an inline SVG sprite in `index.html` (`#i-*`, used via `<use href="#i-name">`); audio is
  pre-rendered MP3. The only network calls are same-origin `fetch()`es to `api/`.
- **AI-drafted strings are Ross's drafts.** Every `dev`, the per-segment dialogue `gloss` English,
  the per-unit `goal`, and the onboarding `L` strings are AI-drafted and under Ross's review — flag
  questions, **never silently "correct" them.** (The COURSE `np` and `pron` are now **derived**
  from `dev` at load by `js/romanize.js` — see `docs/romanization.md`; both were removed from
  `js/data.js`, so items store only `dev`/`en` + `usage`/`emoji`.)
- **DB / VAPID credentials are never in the repo.** `api/lib.php` reads `sano-config.php` from one
  level above the docroot (`~/sano-config.php` on the server; one level above the repo for local
  dev) → `['dsn','user','pass', vapid_*]`.
- **iOS recording playback must use the Web Audio API.** `createRecorder` (js/sano.js) plays each
  take via `AudioContext.decodeAudioData` → a buffer source. iOS records `audio/mp4` it then
  refuses to decode in a media element (`play()` → `NotSupportedError`) — don't "simplify" to
  `new Audio(url)`. (Model phrase audio, `SanoAudio`, plain `.mp3`, still uses an `<audio>` element.)
- **Prefer the everyday loanword** in Nepali translations (हस्पिटल, टोइलेट) over the formal native
  term when that's what people actually say.

## What the app is (one level down; functions in `@docs/architecture.md`, shapes in `@docs/data-model.md`)

- **Home** is a Duolingo-style winding **path** (`renderPath`): units unlock in order, with
  **dialogue** (gold) and **pronunciation** (lavender) nodes woven in after their anchor unit and
  decorative **companions** (SR-07) in the pockets. A unit is complete — and unlocks the next — only
  when every item has **graduated** (the SR-05 **mastery gate**), not merely been introduced; the
  current node's ring is **two-tone** — a faint arc for words *introduced* under a solid arc for words
  *mastered*, so it moves as you practice but fills only at unlock. The daily-lesson button (`dailyPlan`) is **review-dominant**
  and throttles new words by review debt (≈18–20 exercises).
- **Spaced repetition** is **SM-2-lite + learning steps** (per-item ease/interval/recalls, auto-graded
  from the exercise type). A new word climbs a gentle ladder (1 → 2 → 4 days) and only **graduates**
  once **recalled** ~2×; drills **escalate with maturity**: `choice`/`match` when new; a gentle
  `wordbank` recall once recall-strength (interval ≥ 2) while still learning; free `type` for single
  words only once graduated; + audio-only "listen" (SR-03). Large units are split into ~8–12-word
  chunks so the gate stays approachable. State schema is **v3** (a v2 blob is fresh-started on load).
  An item's alternate **frames** (T28 depth) are **gated** (T38): they rotate into reviews only once
  the word has graduated AND the frame adds ≤2 never-seen words — a still-learning word keeps its one
  canonical sentence, and `choice` exercises are always canonical (a long frame among short
  distractors is the obvious answer). Every **Nepali prompt** is tap-a-word glossed (T37,
  Duolingo-style dotted underline → English popover + word clip) via the **generated**
  `js/glosses.js` (`tools/build-glosses.mjs`; never hand-edit) — choices/tiles are answers and stay
  un-glossed.
- **Story dialogues** (SR-01, `DIALOGUES` in `js/dialogues.js`) play in a Duolingo-Stories player —
  **romanized-only**, every word tappable for its English (`js/gloss.js`); only `greet-pyaro` is live.
  The English **source of truth** is `tools/tts/dialogue-scripts.md`, hand-mapped into
  `js/dialogues.js` (no generator — synced by hand); a line's `dev` may carry inline `[performance
  tags]` for the TTS, stripped from all on-screen text and never allowed in `np`/`gloss`/`en`. (Full
  schema + the tags rule: `@docs/data-model.md`.)
- **First-run onboarding** (`SanoOnboard`) greets new users with a scripted Sano conversation,
  captures the name, and offers experienced learners a **placement / skip-ahead** (`Sano.placeBefore`
  marks earlier units introduced at recall strength), then optionally an account / PWA install.
- **Progress** — a day **streak** with a forgiveness freeze (SR-09), daily/total counters, and a
  **dictionary** — lives in localStorage `sano.state.v1` and syncs to the server.

## Audio (SR-02)

`SanoAudio` serves pre-rendered per-phrase clips `audio/<voice>/<id>.mp3` (`play(id)`, ~588) and
per-word `audio/words/<slug>.mp3` (`playWord(slug)`, ~233; slug = the **derived** romanized word —
from `js/romanize.js` — run through `normalize`); a missing clip is a silent no-op. **All clips are
pre-rendered by `tools/tts/synth-app.mjs` through the ElevenLabs API — never a runtime call** — in
Sano's cloned voice (`eleven_v3`, voice id in RESEARCH.md §9) or a **companion's** (T13): each
unit's path companion (`UNIT_VOICES`, js/data.js) voices that unit's **reviews**
(`reviewCompanion`, js/sano.js — introductions, word tiles, the sounds drill, and the **bundled
match/listen-match grids** stay Sano: pills on one page must share one voice), with a
head chip above the prompt and a play-time **fallback to the default clip** when a companion clip
isn't on disk (`synth-app.mjs --units [ids] --new` renders per unit; only the 6 dialogue-voiced
companions render — the other 4 stay Sano until their voices are designed). Per-word Devanagari comes from
`tools/tts/words.json` (built by `tools/tts/build-words.mjs` from every canonical + frame sentence
across all units — any word that can appear as a word-bank tile, incl. single-word items). After adding or
re-spelling content, regenerate the affected clips — `build-words.mjs` → `synth-app.mjs --words
--new` (`--new` renders only clips missing on disk, so it won't re-spend credits or churn git) — then
bump `AUDIO_VERSION` in `js/audio.js` to bust caches; also re-run `tools/build-glosses.mjs` (the
tap-gloss lexicon `js/glosses.js` — it fails loudly on any new un-glossed word). Flags + per-voice
routing: `tools/tts/README.md`.

## Server / admin / PWA (endpoints + guard order in `@docs/architecture.md`)

- **Sync:** localStorage is the working copy; `SanoSync` (js/sync.js) debounces revision-checked,
  last-write-wins PUTs to `api/state.php`; the app stays fully usable offline / logged-out. Auth is a
  username/password session token in an HttpOnly `__Host-sano_session` cookie (90 days —
  `session_cookie_name()`/`session_cookie_options()`; the prefix binds it to Secure + `Path=/` +
  no `Domain`, and both prefix and Secure come off **only** under the `php -S` dev SAPI, which is
  plain http); mutating requests
  need CSRF header `X-Sano-Request: 1`. Accounts come from self-service `register.php` (throttled) or
  the invite-only `tools/make-user.php` CLI (also password resets). Hardening: argon2id, per-account
  lockout + per-IP throttles, CSP/HSTS/nosniff, a JSON-500 handler, and a guard order that runs the
  stateless method/CSRF/JSON/validation checks before auth/`db()`. **`login.php` has exactly one
  failure response** — a wrong password, an unknown username and a locked-out account must stay
  identical in status, body, argon2id cost *and* rate-limit budget (`login_decide()`, T47); a
  friendlier "your account is locked" message would re-open a membership oracle, so the "wait a
  few minutes" hint lives in `js/sync.js`, counted client-side.
- **Admin dashboard** `/admin/` (server-enforced via `users.is_admin` + `require_admin()`), two tabs:
  **Users** lists every account with reset-password / delete actions, and **Traffic** (T40) shows
  distinct visitors / repeat sessions / countries + a daily chart, device split, referrers and errors.
  `?demo=1` renders stub data for both, for local UI review (there's no local MySQL).
- **Traffic numbers come from the Apache logs, and Dreamhost keeps only ~7 days of them** — so
  `tools/ingest-traffic.php` (server-only nightly cron, installed as `~/sano-tools/`, like
  `send-reminders.php`) is what accumulates history into the `traffic_*` tables; `api/admin-traffic.php`
  only ever reads those aggregates. A visitor is a salted `sha256(ip + UA)` — **never store a raw IP**
  (salt: `traffic_salt` in `sano-config.php`); countries come from a CC0 IP→country index compiled onto
  the server by `--update-geo`, so no third party sees an address. Roughly half the raw log is bots, so
  the ingest filters on three signals (UA, "did it load the app", crawler-only paths) and reports what
  it excluded. Definitions (session, repeat, mine) live in `@docs/data-model.md`; the parser is testable
  with `--json`, which needs no DB.
- **PWA + reminders:** installable; `sw.js` caches the shell (HTML network-first, stamped assets
  cache-first) and handles `push`. A reminder needs **both** a per-device subscription (`js/push.js` →
  `push-subscribe.php`) **and** a per-account time (`reminder_hour` / `reminder_tz` via `reminder.php`);
  `tools/send-reminders.php` dispatches hourly via server cron (not in the rsync). VAPID public key is
  baked into `js/push.js`; the private key is in `sano-config.php`. The subscription `endpoint` is a URL
  **the server POSTs to**, so it's validated against a small **allowlist of real push services**
  (`PUSH_HOSTS`, T42) — **supporting a new browser means adding its host in two places**, `api/lib.php`
  and `tools/send-reminders.php` (which can't require the docroot; `tests/data/push-allowlist.test.mjs`
  fails if they drift). Rules + the endpoint-ownership check: `@docs/data-model.md`.
- **Live-DB schema changes** go through a one-off idempotent `tools/migrate-*.php` — **never re-apply
  `schema.sql`** to an existing DB; a new column that `login.php` / `state.php` SELECT must be migrated
  **before** deploying the code.

## Workflow for every code change

1. Edit, then `tools/format.sh` (Prettier over HTML/CSS/JS/PHP; `npm install` once on a fresh
   clone). `tools/format.sh --check` is the CI form.
2. `node tools/stamp-version.mjs` — rewrites the `?v=` content-hash stamps in `index.html` +
   `admin/index.html`. Run **after** formatting; never hand-edit a stamp.
3. `tools/test.sh` runs the full suite (static + unit + data + api + e2e); pass a flag
   (`--unit`/`--data`/`--api`/`--ui`/`--static`) for one tier. Verify visually with
   `tools/screenshot.sh`. (The old `check-*.mjs` harnesses are gone: scheduler → `tests/unit/`,
   the 9-width viewport sweep + WebKit animation checks → Playwright e2e in `tests/e2e/`.)
4. **Every new user-facing feature gets a one-click scenario in `tools/dev-seed.html`** — most
   features are gated behind progress, so a fresh localhost won't show them. Pure bug
   fixes / refactors with nothing to demo can skip it.
5. Serve `php -S 127.0.0.1:8000` from the repo root (executes `/api`; needs the dev
   `sano-config.php`) and **ask Ross to review at http://127.0.0.1:8000/ before committing.**
   (`python3 -m http.server 8000` works for frontend-only checks, exercising the offline path.)
6. After approval, **commit directly to `main`** (never a side branch). **Push and deploy only when
   Ross asks.**
7. Commit message: short imperative summary ending with a period, plus `Co-Authored-By` attribution.
8. Deploy with `tools/deploy.sh` (`-n` for a dry run) only when asked, then run the live cache check.

## Testing notes (the non-obvious bits)

- **Very low tolerance for flaky tests.** A test that passes only *sometimes* is a defect — in the
  test or the app — not noise to shrug off. Fix the root cause: wait for the real condition instead of
  a fixed `waitForTimeout`, click-and-verify-with-retry on a flaky control, freeze animations, or
  surface a genuine app race. CI `retries` are a backstop for truly unavoidable timing — never the fix.
- **Test suite** — one entry point `tools/test.sh` (tiers `--static/--unit/--data/--api/--ui`; tier
  table in `@docs/architecture.md`): `node:test` for pure logic + data integrity, Playwright for HTTP
  + browser. Pure helpers are lifted from the classic scripts by `tests/lift.mjs` (no app-code change
  needed to test them); seeds come from `tests/seed.mjs` — the same builders `dev-seed.html` uses.
- **e2e gotchas:** `php -S` is single-threaded, so the Playwright `webServer` sets
  `PHP_CLI_SERVER_WORKERS` (else parallel browsers starve it and pages never settle). The app's
  infinite idle animations defeat a stylesheet freeze, so `boot()` freezes them with inline
  `!important` and interaction clicks pass `{ force: true }` (pseudo-element animations can't be frozen
  inline). `boot()` also stubs `Math.random` with a seeded PRNG — the lesson builder makes real
  random draws (exercise direction, listen rolls, which reviews bundle into a match grid), so every
  e2e run must draw the identical lesson or type-specific assertions flake (T39).
  `prefers-reduced-motion` is driven with `page.emulateMedia`, not the config option.
- **Backend tests:** the `tests/api` guard specs run against `php -S` with **no** `sano-config.php`,
  so they assert only pre-DB guards. Full integration (`tests/api/integration.spec.mjs`) needs MySQL
  and runs only when `SANO_TEST_DB` is set (CI's `integration` job); locally it skips. WebKit-only
  bugs are caught by the e2e `webkit` project in CI; real iOS-device Safari stays manual.
- **Capture recipes** — screenshot harness, forcing light mode, app-icon generation: `docs/testing.md`.
- **Live cache check:** `curl -sI https://namastesano.com/ | grep -i cache-control` → HTML must be
  `no-cache`; css/js are `max-age=…, immutable` (busted by `?v=`); `api/` responses are `no-store`.

## Repo facts

- Remote `git@github.com:rharmes/sano.git`, branch `main`. `.claude/settings.json` sets
  `worktree.bgIsolation: "none"` — background sessions edit this checkout directly; **do not use
  worktrees.**
- **Deploy** connection details live in the `sano-deploy` SSH alias (key auth) — no hostnames or
  credentials in the repo. `tools/deploy.sh` uses an **explicit allowlist**, so `tools/`, `design/`,
  `docs/`, and `send-reminders.php` never ship.
- **`design/`** holds in-repo design artifacts (committed, never deployed). `design/characters.html`
  is the **source of truth for all 11 characters + their animations**; the app art is **generated**
  from it into `js/characters.js` (`node tools/build-character-heads.mjs`) and into
  `design/anim-characters.js` for the tuner (`build-anim-characters.mjs`) — re-run after editing
  art. `style-guide.html`, `animations.html`, `characters.html` share a day/night pill (`?theme=`);
  `icons.html` and `dialogue.html` are further artifacts.
- **`design/devanagari.html`** is a localhost-only review tool for the AI-drafted `dev` strings: all
  959 items grouped by unit (English, romanization, ▶, an editable Devanagari box, and a flag-only
  column surfacing any `tools/dict/coverage-report.md` disagreement for that row). It POSTs only
  changed rows to `design/devanagari-save.php`, which merges them into the **gitignored**
  `design/devanagari-review.json` — it does **not** touch `js/data.js`. Serve with `php -S`.
- **`design/expansion.html`** is the localhost-only review surface for the **T11 vocabulary
  expansion** (grow toward ~1,550 words, the everyday-register tier). Pipeline: `tools/dict/select-candidates.mjs` ranks the
  everyday, not-yet-covered words of one part of speech → Claude drafts each as a usable frame
  (`design/expansion-draft.json`) → this tool edits/approves/rejects (live romanization; POSTs to
  `expansion-save.php` → gitignored `expansion-approved.json`) → approved rows are merged into
  `js/data.js` **by hand** → audio rendered for the new items only (bump `AUDIO_VERSION`). The three
  staging JSONs are gitignored; it does **not** touch `js/data.js`.
- **`design/frames.html`** is the localhost-only review surface for the **T11 depth pivot** (T31) —
  the same pipeline for **alternate frames** (extra example sentences that rotate into an item's
  reviews, T28/T29): Claude drafts candidate frames under their target item
  (`design/frames-draft.json`, `[{ id, item, itemEn, itemDev, dev, en }]`) → this tool groups them by
  item and edits/approves/rejects each (live romanization; POSTs to `frames-save.php` → gitignored
  `frames-approved.json`) → approved frames are merged into the items' `frames: [{dev,en}]` in
  `js/data.js` **by hand** → audio rendered for the new frame clips only (`<id>-fN`; bump
  `AUDIO_VERSION`). Both staging JSONs are gitignored; it does **not** touch `js/data.js`.
- **`tools/dict/`** is a local-only (never-deployed) **ground-truth Nepali↔English dictionary** to
  cross-check the AI-drafted translations and surface high-frequency words the course is missing
  (`tools/dict/README.md`, file map in `@docs/architecture.md`). `build-dictionary.mjs` ranks words
  from a Nepali corpus (register-weighted toward conversational) and uses **Claude** to lemmatize +
  gloss, cross-checked against the Wiktionary/kaikki extract; it **flags** COURSE translation
  disagreements for review but **never auto-corrects** them (per the AI-drafts-are-Ross's rule). Needs
  `ANTHROPIC_API_KEY`; incremental/cached like `synth-app.mjs`; `dictionary.json` is committed,
  `sources/`+`cache/` are gitignored. Frequency source is pluggable (Leipzig, or `--hf-freq` from a
  HuggingFace corpus when Leipzig is unreachable). Validated by `tests/data/dictionary.test.mjs`.

## Design direction

- Brand: **"Pennant & Paper-cut"** — softened Nepal-flag crimson + indigo on warm paper, and a
  paper-cut mouse mascot named **Sano**. Sano's centered head is the favicon + app icon. All theme
  tokens live at the top of `css/sano.css`
  (a light block + a dark `@media` block — **change both**). The mascot is inline SVG drawn as flat
  `.f-*`-filled shapes (`.s-whisker` strokes) — no drop-shadow or grain; it runs the idle animations
  wherever it appears.
- **Prayer-flag section dividers** were built and pulled — don't re-add without Ross.
- **Respect `prefers-reduced-motion`** (block at the bottom of `css/sano.css`): under reduce-motion
  the mascot keeps only the eye blink; the larger rotational idles (tail wag, head tilt, ear/nose
  wiggle) are suppressed. iOS Safari honors the OS Reduce Motion setting — that's expected, not a bug.

## Task list (`docs/todo.md`)

The backlog lives in **`docs/todo.md`** (checkbox Markdown), not here. Keep it authoritative:

- **Add every task to it** — features Ross asks for, suggestions Ross agrees to, and anything
  discovered mid-work (bugs, follow-ups, review items) — as an unchecked box (`- [ ]`).
- **Give each task a unique ID** — `T<n>`, the next sequential number with no zero-padding (`T1`,
  `T2`, … `T12`). Assign it once and never reuse it (even after the task is done), so Ross can refer
  to any task by its ID.
- **Tick the box in place** (`- [ ]` → `- [x]`) when a task is delivered, rather than deleting it, so
  the file doubles as a record of what's done.
- **Check it at the start of a session**, and update it in the **same** change that adds or delivers a
  task, so the list never drifts from reality.
