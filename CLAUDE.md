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
- `docs/pedagogy.md` — learning-science basis. `tools/tts/RESEARCH.md` —
  voice/TTS. `design/style-guide.html` — visual tokens + components (brand source of truth).

Those carry the deep detail; this file keeps the summary, the non-obvious constraints, and the
workflow. **Keep it current:** when architecture/tooling changes significantly, update this file
(and the relevant `docs/` file) in the same commit.

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
  **dialogue** (gold) and **pronunciation** (lavender) nodes woven in after their anchor unit, and
  decorative **companions** (SR-07) in the pockets. The daily-lesson button mixes new items from the
  current unit with the most-overdue reviews.
- **Spaced repetition** is **SM-2-lite** (each item has its own ease + interval, auto-graded from
  the exercise type). **Exercises escalate with strength**: `choice`/`match` for new items;
  `type`/`wordbank`/`listenMatch` + audio-only "listen" (SR-03) for recall-strength items
  (interval ≥ 3 days).
- **Story dialogues** (SR-01, `DIALOGUES` in `js/dialogues.js`, schema v2) play in a
  Duolingo-Stories-style player: every speaker on the **left** (head from `CHARACTER_HEADS` +
  bubble), **romanized-only** lines whose every word is underlined + tappable for its English
  (`js/gloss.js`, `SanoGloss.renderLine`), narrator full-width, auto-played per-voice audio, then a
  comprehension quiz. Each opens with a one-line `CHARACTER_PERSONAS` intro. `design/dialogue.html`
  is the localhost mockup. Only `greet-pyaro` is live. A line's `dev` may carry inline **ElevenLabs
  v3 performance tags** in `[brackets]` (`[whispers]`, `[laughs]`, …) — voice-acting cues passed to
  the audio render verbatim and stripped from all on-screen text (`SanoRomanize.stripTags`); they
  must never appear in `np`/`gloss`/`en` (a data test enforces it). **Pending task: Ross will add
  voice directions to the conversation scripts** — tag list + workflow in `tools/tts/voice-tags.md`.
- **First-run onboarding** (`SanoOnboard`) greets new users with a scripted Sano conversation (a
  head-only Sano beside each of Sano's bubbles), captures the name, offers experienced learners a
  **placement / skip-ahead** (`Sano.placeBefore` marks earlier units introduced at recall strength),
  and optionally creates a cloud account / shows the PWA install steps.
- **Progress** (a day **streak** with a forgiveness freeze (SR-09), daily/total counters, a
  **dictionary**) lives in localStorage `sano.state.v1` (schema v2) and syncs to the server.

## Audio (SR-02)

`SanoAudio` serves per-phrase clips `audio/<voice>/<id>.mp3` (`play(id)`, ~588) and per-word
word-bank clips `audio/words/<slug>.mp3` (`playWord(slug)`, ~233; slug = the **derived** romanized
word — from `js/romanize.js` — run through `normalize`). A missing clip is a silent no-op. **All audio is pre-rendered by
`tools/tts/synth-app.mjs` through the ElevenLabs API in Sano's cloned voice** (`eleven_v3`, voice id
in RESEARCH.md §9) — never a runtime call. `synth-app.mjs --phrases`/`--words` render the full set;
`--new` renders only clips not yet on disk (so adding content doesn't re-spend credits or churn
git). Per-word Devanagari comes from `tools/tts/words.json` (built by `tools/tts/build-words.mjs`,
phrases-only). Re-rendering bumps `AUDIO_VERSION` in `js/audio.js` to bust caches. The word clips
track the **derived** slugs (re-rendered 2026-06-27 at `AUDIO_VERSION` 5, in sync with the data);
after adding or re-spelling content, regenerate them: `build-words.mjs` → `synth-app.mjs --words
--new`, then bump `AUDIO_VERSION`.

## Server / admin / PWA (essentials; full detail in `@docs/architecture.md`)

- **Sync:** localStorage is the working copy; `SanoSync` (js/sync.js) does debounced PUTs to
  `api/state.php` with revision-checked, last-write-wins reconciliation. App stays fully usable
  offline / logged-out. Auth = username/password; DB-backed session token in an HttpOnly
  `sano_session` cookie (90 days); mutating requests need CSRF header `X-Sano-Request: 1`. Two ways
  to make an account: self-service `register.php` (open signup, throttled) and the invite-only
  `tools/make-user.php` CLI (also used for password resets). Hardening: argon2id, per-account
  lockout + per-IP throttles, CSP/HSTS/nosniff in `.htaccess`, a generic JSON-500 handler, and a
  consistent guard order (stateless method/CSRF/JSON/validation checks run before auth/`db()`).
- **Admin dashboard** at `/admin/` (standalone page, server-enforced via a `users.is_admin` flag +
  `require_admin()`): lists every account (path position, streak, last sync) with reset-password /
  delete actions. `?demo=1` renders stub rows for local UI review.
- **PWA + reminders:** installable (manifest + iOS meta + generated icons); `sw.js` caches the
  shell (HTML network-first, stamped assets cache-first) and handles `push`. A reminder needs a
  per-device subscription (`js/push.js` → `push-subscribe.php`) **and** a per-account time
  (`reminder_hour` / `reminder_tz` via `reminder.php`); `tools/send-reminders.php` dispatches hourly
  via server cron (not in the rsync). VAPID public key is baked into `js/push.js`; the private key
  is in `sano-config.php`.
- **Live-DB schema changes** go through a one-off idempotent `tools/migrate-*.php` — **never
  re-apply `schema.sql`** to an existing DB. A new column that `login.php` / `state.php` SELECT must
  be migrated **before** deploying the code.

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

- **Very low tolerance for flaky tests.** A test that passes only *sometimes* is a defect —
  in the test or the app — not noise to shrug off. When a test looks non-deterministic, stop
  and fix the root cause: wait for the real condition instead of a fixed `waitForTimeout`,
  click-and-verify-with-retry on a flaky control, freeze animations, or surface a genuine app
  race. CI `retries` are only a backstop for truly unavoidable timing — never the fix, and a
  test that needs them to pass should be hardened until it doesn't.
- **Test suite** (`tools/test.sh`, tiers `--static/--unit/--data/--api/--ui`): `node:test` for pure
  logic + data integrity (`tests/unit`, `tests/data`), Playwright for HTTP + browser (`tests/api`,
  `tests/e2e`). Pure helpers are lifted out of the classic scripts by `tests/lift.mjs` (sentinel
  block / whole-file globals / by-name function extraction) — no app-code change needed to test them.
- **e2e gotchas:** `php -S` is single-threaded, so the Playwright `webServer` sets
  `PHP_CLI_SERVER_WORKERS` (else parallel browsers starve it and pages never settle). The app's
  infinite idle animations defeat a stylesheet freeze on specificity, so `boot()` freezes them with
  inline `!important` and interaction clicks pass `{ force: true }` (pseudo-element animations can't
  be frozen inline). Seeds come from `tests/seed.mjs` — the same builders `dev-seed.html` uses.
  `prefers-reduced-motion` is driven with `page.emulateMedia`, not the config option.
- **Backend tests:** the `tests/api` guard specs run against `php -S` with **no** `sano-config.php`,
  so they assert only pre-DB guards (method/CSRF/JSON/validation). Full request-cycle integration
  (`tests/api/integration.spec.mjs`) needs MySQL and runs only when `SANO_TEST_DB` is set — CI's
  `integration` job provides a `mysql:8` service + a generated config; locally those tests skip.
  WebKit-only bugs are caught by the e2e `webkit` project in CI; real iOS-device Safari stays manual.
- **Screenshot harness:** write a temp `.shot-harness.html` in the repo root that seeds
  `sano.state.v1` and iframes the app at the target width (reuse a builder from `tests/seed.mjs`).
  **Delete temp harness files before committing.**
- **Forcing light mode:** headless Chrome follows the system theme — strip the dark `@media` blocks
  into temp `.light.*` copies. **Animations:** `--virtual-time-budget` finishes animations before
  capture, so sample `getComputedStyle(...).opacity` in a probe page and read it with `--dump-dom`.
- **App icons** (`apple-touch-icon.png`, `icon-{192,512}.png`, `icon-512-maskable.png`) are
  generated from `tools/make-touch-icon.html` (render the 512 masters via `tools/screenshot.sh`,
  `?safe` for the maskable variant, then `sips` downscale) — not hand-edited.
- **Live cache check:** `curl -sI https://namastesano.com/ | grep -i cache-control` → HTML must be
  `no-cache`; css/js are `max-age=31536000, immutable` (busted by `?v=`); `api/` responses are `no-store`.

## Repo facts

- Remote `git@github.com:rharmes/sano.git`, branch `main`. `.claude/settings.json` sets
  `worktree.bgIsolation: "none"` — background sessions edit this checkout directly; **do not use
  worktrees.** (It also configures a gitignored status-line script; restore it on a fresh clone with
  `curl -o .claude/scripts/status-line.sh https://raw.githubusercontent.com/shanraisshan/claude-code-status-line/main/status-line.sh && chmod +x .claude/scripts/status-line.sh`.)
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
  588 items grouped by unit (English, romanization, ▶, an editable Devanagari box) plus a read-only
  "Conversations" section. It POSTs only changed rows to `design/devanagari-save.php`, which merges
  them into the **gitignored** `design/devanagari-review.json` — it does **not** touch `js/data.js`.
  Serve with `php -S`.
  - **Pending task: Ross will ask Claude to merge `design/devanagari-review.json` into the `dev`
    fields of `js/data.js`** — done in-session (no merge script), then the review file is cleared.
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
  paper-cut mouse mascot named **Sano**. Sano's centered head is the favicon + app icon (the pennant
  that sat behind it was dropped 2026-06-13). All theme tokens live at the top of `css/sano.css`
  (a light block + a dark `@media` block — **change both**). The mascot is inline SVG drawn as flat
  `.f-*`-filled shapes (`.s-whisker` strokes) — no drop-shadow or grain; it runs the idle animations
  wherever it appears.
- **Prayer-flag section dividers** were built and pulled (2026-06-12) — don't re-add without Ross.
- **Respect `prefers-reduced-motion`** (block at the bottom of `css/sano.css`): under reduce-motion
  the mascot keeps only the eye blink; the larger rotational idles (tail wag, head tilt, ear/nose
  wiggle) are suppressed. iOS Safari honors the OS Reduce Motion setting — that's expected, not a bug.
