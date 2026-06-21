# sano — Nepali Study Guide

A web app: essential Nepali phrases with Romanized pronunciations. Plain
HTML/CSS/JS frontend, no build step: `index.html`, `css/sano.css`, `js/`,
`fonts/`, `tools/`; plus a small PHP/MySQL sync API in `api/`. Deployed to
namastesano.com (Apache) with `tools/deploy.sh`; Ross tests on an iPhone
running iOS 26.

No external requests at runtime: fonts (Neuton, Lato) are self-hosted woff2
files in `fonts/` declared in `css/fonts.css`, and icons are an inline SVG
sprite in `index.html` (`#i-*` symbols, used via `<use href="#i-name">`).
The only network calls are same-origin `fetch()`es to `api/`.

First-run onboarding (`js/onboarding.js`, `SanoOnboard`) greets brand-new users
(no saved name) with a scripted Sano conversation that captures their name, offers
experienced learners a **placement / skip-ahead** step (`Sano.placeBefore` /
`Sano.placementOptions` — picking a path section marks every earlier unit as
introduced at recall strength), and optionally creates a cloud account / shows the
PWA install steps. **The
Romanized-Nepali strings in its `L` object are drafts Ross owns** — don't treat
them as authoritative or silently "correct" them; flag questions to Ross.

## Learning model (`js/sano.js` + `js/data.js`)

Course content is `COURSE` in `js/data.js`: 36 units, each `{ id, title, kind, goal, items }`
where `kind` is `'phrases'` (items have `np`/`pron`/`dev`/`en`/`usage`) or `'vocab'` (items
also carry an `emoji`); ~476 items total. The per-item `dev` (Devanagari) and per-unit
`goal` strings are AI-drafted and under Ross's review (see the devanagari review tool
below). `js/sano.js` is the lesson engine, and it is more pedagogically built-out than
this file used to convey:

- **Home** is a Duolingo-style winding **path** of units that unlock in order
  (`renderPath`, `currentUnit`), with two-character **dialogue** nodes (gold) and
  **pronunciation** nodes (lavender) woven in after their anchor unit; a completed node
  shows a checkmark in its own colour. The daily-lesson button mixes new items from the
  current unit with the most-overdue reviews from anywhere in the course. On first render
  the path auto-scrolls to center the in-progress unit. **Decorative companions** (SR-07)
  sit in the path's empty pockets — full-body friends placed at each turn of the wave
  (ordered Thulo, Pyaro, then the rest), sized to the pocket; they run the Sano idle
  animations and do a head-shake when tapped, but are otherwise inert (`aria-hidden`,
  behind the nodes). Art comes from `CHARACTER_BODIES` in `js/characters.js`; profiles are
  flipped to face the path.
- **Spaced repetition** is an **SM-2-lite** graded scheduler. Each item record
  (`state.items[id]` = `seen/correct/ease/interval/lastSeen/intro`) carries its own `ease`
  (≥ 1.3) and `interval` in days; a review is auto-graded from the exercise type (miss →
  lapse, recognition hit → good, recall/typed/listening hit → easy), which stretches or
  resets the interval (`scheduleReview`, `reviewInterval`, `isDue`, `dueItems`). Legacy
  Leitner `level` records migrate to interval/ease on load; the pure scheduler math is
  unit-tested by `tools/check-scheduler.mjs`.
- **Exercises escalate with strength**: `choice` (multiple choice, both np→en and en→np),
  `match` (tap-the-pairs, also the new-word warm-up; tapping a Nepali tile plays its audio),
  `wordbank` (assemble a phrase from
  tiles), and `type` (typed recall, romanization-tolerant via edit distance). New items get
  multiple choice both ways; stronger items (recall strength — interval ≥ 3 days) get
  wordbank/type, and ~half of recall reviews become audio-only "listen" prompts (SR-03).
- **Progress**: a day **streak** (with a forgiveness "freeze", SR-09; extended by finishing
  any lesson, conversation, or pronunciation drill) plus daily/total
  counters in the header and the lesson-complete screen; a **dictionary** screen lists
  every item. All progress lives in localStorage `sano.state.v1` (schema version 2 — the
  per-item records plus `dialoguesDone` / `soundsDone` node completion) and syncs to the
  server (below).

`PEDAGOGY.md` (committed, not deployed) records the learning-science basis for this design
and where it is headed; the working roadmap is `PLAN.md` (committed, but excluded from
the deploy rsync). Two-character **dialogues** with comprehension questions and
self-hosted **Nepali phrase audio** (Devanagari-driven Piper TTS) have since shipped, along
with listening/speaking practice, pronunciation coaching, and the decorative full-body
**companions** on the path (above); planned next (per PLAN.md): companions that actively
host/participate in lessons & dialogues, one voice per character, and an optional Devanagari
script track.

**Recorded-voice playback (SR-04 speaking, SR-08 sounds) goes through the Web Audio API**,
not an `<audio>` element: the record-and-compare step (`createRecorder` in `js/sano.js`)
keeps each take's bytes and plays them with `AudioContext.decodeAudioData` → a buffer source.
iOS records `audio/mp4` it then refuses to decode in a media element (`play()` rejects with
`NotSupportedError`, for both `blob:` and `data:` sources), so don't "simplify" this back to
`new Audio(url)`. The model phrase audio (`SanoAudio`, plain `.mp3` files) still uses an
`<audio>` element — only the live recording needs Web Audio.

## Server sync (api/)

- Progress lives in localStorage (`sano.state.v1`, the working copy — the
  app stays fully usable offline/logged-out) and syncs to MySQL through
  `api/` (PHP + PDO): `register.php`, `login.php`, `logout.php`,
  `state.php` (GET/PUT), shared `lib.php`. `js/sync.js` (`SanoSync`) does
  debounced pushes, revision-checked conflict detection, and last-write-wins
  reconciliation; its bookkeeping lives in localStorage `sano.sync.v1`.
  `SanoSync.adoptSession(username, body)` adopts a fresh session from either
  `login.php` or `register.php`.
- Auth: username/password; DB-backed session tokens in an HttpOnly
  `sano_session` cookie (90 days). CSRF guard: mutating requests must send
  `X-Sano-Request: 1`. **Two ways to create an account:** the onboarding
  flow's self-service `register.php` (open signup — strict username/password
  validation, argon2id, auto-login; per-IP hourly throttle via
  `signup_attempts`), and the invite-only `tools/make-user.php` CLI (still
  used for password resets).
- **DB credentials are never in the repo.** `api/lib.php` requires
  `sano-config.php` from one level above the docroot (`~/sano-config.php`
  on the server; for local dev, one level above the repo). It returns
  `['dsn' => ..., 'user' => ..., 'pass' => ...]`.
- Hardening: argon2id hashing; per-account lockout (10 fails → 15min) **and**
  per-IP login throttle (`login_attempts`); per-IP signup throttle
  (`signup_attempts`); CSRF header on mutations; CSP + HSTS + nosniff in
  `.htaccess`; and a `set_exception_handler` in `lib.php` that turns any uncaught
  error into a generic JSON 500 (no stack/DSN leak).
- Schema: `tools/schema.sql` (users, app_state blob + revision, sessions,
  signup_attempts, login_attempts, push_subscriptions). Reset/seed a password via
  `scp tools/make-user.php sano-deploy:` then
  `ssh -t sano-deploy 'php make-user.php <user> [--reset-password]'`
  (`tools/` is never deployed to the docroot). **Live-DB schema changes go
  through a one-off idempotent `tools/migrate-*.php` run** (PDO, reads
  `sano-config.php` like make-user.php; e.g. `migrate-2026-06-reminders.php`) —
  never re-apply the full `schema.sql` to an existing DB.

## PWA + daily reminders

- Installable as an iOS home-screen app: `manifest.json` + iOS meta tags in
  `index.html`, plus icons (`icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`) generated from `tools/make-touch-icon.html` via
  `tools/screenshot.sh` (`?safe` query param renders the maskable variant).
- Service worker `sw.js` caches the shell (HTML network-first, stamped assets
  cache-first), passes `/api/*` through to the network, and handles `push` /
  `notificationclick` for reminders.
- Reminder opt-in: `js/push.js` (`SanoPush`) shows a "Daily reminder" toggle +
  time label in the login panel when signed in AND running as an installed PWA,
  and pops a one-time setup modal on the home screen when such a PWA has no
  reminder configured. A reminder needs two things: a *subscription* (per
  device, `pushManager.subscribe(VAPID_PUBLIC_KEY)` → `POST
  /api/push-subscribe.php`) and a *time* (per account: `reminder_hour` 0–23 +
  `reminder_tz` IANA, GET/POST `/api/reminder.php`). The modal collects a
  whole-hour time + timezone (defaulted from
  `Intl.DateTimeFormat().resolvedOptions().timeZone`), subscribes, and saves.
  iOS only allows push for installed PWAs (iOS 16.4+).
- VAPID **public** key is baked into `js/push.js` (safe to ship). VAPID
  **private** key + subject are in `~/sano-config.php` on the server next to
  the DB creds (`vapid_subject`, `vapid_public_key`, `vapid_private_key`).
- Dispatch: `tools/send-reminders.php` runs server-side **hourly** via cron
  (`0 * * * *` — no `CRON_TZ`; each user's zone is handled in PHP). It selects
  every subscription whose user set `reminder_hour`, and for each one whose
  chosen hour matches the current hour in their `reminder_tz` and who hasn't
  studied yet today (local date), sends via minishlink/web-push (Composer dep at
  `~/sano-vendor/`). 410/404 responses prune the subscription row. Flags:
  `--dry-run`, `--user <name>`, `--force` (ignore hour + studied-today filters).
- Deployed files: `manifest.json`, `sw.js`, icon PNGs, all of `api/` (now incl.
  `register.php`, `reminder.php`, `push-*.php`), and the JS (`js/push.js`,
  `js/onboarding.js`, …). `tools/send-reminders.php` and the Composer vendor dir
  are NOT in the rsync — they live on the server only.

**Keep this file current**: when testing tools or architecture change
significantly, update CLAUDE.md in the same commit.

## Repo facts

- Remote: `git@github.com:rharmes/sano.git`, branch `main`.
- `.claude/settings.json` sets `worktree.bgIsolation: "none"` — background
  sessions edit this checkout directly; do not use worktrees.
- `.claude/settings.json` also configures a status line whose script is
  gitignored; restore it on a fresh clone with
  `curl -o .claude/scripts/status-line.sh https://raw.githubusercontent.com/shanraisshan/claude-code-status-line/main/status-line.sh && chmod +x .claude/scripts/status-line.sh`.
- **Deploy**: `tools/deploy.sh` rsyncs the site to the server (`-n` for a dry
  run); run it only when Ross asks. Connection details live in the
  `sano-deploy` alias in `~/.ssh/config` (key auth) — no credentials or
  hostnames in the repo. On a new machine, recreate the alias (HostName
  namastesano.com, User + key from Ross).
- `design/` holds in-repo design artifacts. It is committed but NOT in the
  deploy rsync allowlist, so nothing under it ships to the live site. Future
  design files go here too — don't add `design` to `tools/deploy.sh`.
  - `design/characters.html` ("Sano and friends") is the **source of truth for
    all eleven characters and their animations** — Sano first, then the 10
    companions, each a whole-body + head view. Every character's parts are
    wrapped in `.part-*` groups (head/tail/eyes/ear[-left|-right]/nose) for
    animation targeting — inert in the gallery itself. The art reaches the app
    through `js/characters.js` (`CHARACTER_HEADS` for dialogue bubbles +
    `CHARACTER_BODIES` for the path companions), **generated** by
    `node tools/build-character-heads.mjs` (from `anim-characters.js`); re-run it
    after editing character art. The tuner reads the same source.
  - `design/animations.html` is the **11-character** animation tuner: pick a
    character up top, both its views mount on the left, and the per-animation
    cards on the right apply to it (cards for parts a character lacks are
    auto-hidden). All characters (incl. Sano) come from `design/anim-characters.js`,
    **generated** from `characters.html` by `node tools/build-anim-characters.mjs`
    (re-run after editing any character art; the file is `.prettierignore`d).
    A dark/light toggle (mirrors the app palette) sits in the top bar.
    `?char=<id>` and `?theme=dark|light` deep-link a character and theme.
  - All three design pages (`style-guide.html`, `animations.html`, `characters.html`) share
    one day/night **pill switch** (light on the left, dark on the right); the theme persists
    per page in localStorage and `?theme=light|dark` deep-links it.
  - `design/devanagari.html` is a **localhost-only review tool** for the native-speaker
    pass over the AI-drafted Devanagari (`dev`) strings: all 476 course items grouped by
    unit, each with its English, romanization, a ▶ that plays the `audio/default/<id>.mp3`
    clip, and an editable Devanagari box pre-filled with the current `dev`. Submitting POSTs
    only the changed rows to `design/devanagari-save.php`, which merges them (keyed by item
    id) into the **gitignored** `design/devanagari-review.json` — it does **not** touch
    `js/data.js`. Reloading restores prior corrections from that file. Uses a minimal theme
    toggle (not the shared pill); serve it with `php -S` from the repo root.
    - **Pending future task: Ross will ask Claude to merge
      `design/devanagari-review.json` into the `dev` fields of `js/data.js`** — done here
      in-session (no merge script), then the review file can be cleared.
- Recent work: see `git log` — commit messages are descriptive.

## Workflow for every code change

1. Make edits, then run `tools/format.sh` — Prettier over all HTML/CSS/JS/PHP
   (settings in `.prettierrc`, plugin via `@prettier/plugin-php`). On a fresh
   clone, `npm install` once to fetch the devDeps. Vendored CSS and the SQL
   schema are excluded via `.prettierignore`.
2. Run `node tools/stamp-version.mjs` — rewrites the `?v=` content-hash stamps
   on local asset URLs in index.html. Required for cache busting; never
   hand-edit the stamps. Must run after formatting (formatter changes hashes).
3. Run `node tools/check-viewports.mjs` and verify visually with headless
   Chrome screenshots (see below).
4. **For any new user-facing feature, add a one-click scenario to
   `tools/dev-seed.html`** (the committed dev seeding tool, served at
   `/tools/dev-seed.html`) that seeds `localStorage` and opens the app where the
   feature is visible — then point Ross at it. Most features are gated behind
   progress (due reviews, a current unit, a missed day, a completed unit), so a
   fresh localhost won't show them; the seed is how Ross tests the feature
   immediately. **Always create a dev-seed scenario for a new feature**; pure bug
   fixes / refactors with nothing new to demo can skip it.
5. Serve via `php -S 127.0.0.1:8000` from the repo root (executes `/api`;
   needs the dev `sano-config.php` one level above the repo) and ask Ross
   to review at http://127.0.0.1:8000/ BEFORE committing.
   `python3 -m http.server 8000` still works for frontend-only checks (API
   calls fail, exercising the app's offline path).
6. After approval, commit directly to `main` — never leave work on a side
   branch. Push only when asked.
7. Commit messages: short imperative summary ending with a period, plus
   `Co-Authored-By` attribution.
8. Deploy with `tools/deploy.sh` only when Ross asks; verify with the live
   cache check below.

## Testing and verification

- **Format check**: `tools/format.sh --check` (non-zero on any drift). The
  write form (`tools/format.sh`) is part of the per-change workflow above.
- **Viewport regression**: `node tools/check-viewports.mjs` tests 9 mobile
  widths (320–521px) in headless Chrome via same-origin iframes (headless
  Chrome can't open windows narrower than 500px); exits non-zero and writes
  `/tmp/sano-viewports.png` on failure.
- **WebKit animations**: `node tools/check-webkit.mjs` drives real Safari via
  `safaridriver` (everything else here is headless Chrome, which can't catch
  WebKit-only bugs) and asserts the SVG idle animations run and the eye blink
  actually moves. Run after animation/mascot-CSS changes. One-time setup:
  `sudo safaridriver --enable` + Safari > Develop > "Allow Remote Automation".
  Opens a Safari window; runs without Reduce Motion (full idle set).
- **Screenshots**: `tools/screenshot.sh <url> <out.png> [WxH] [budget-ms]` —
  headless-Chrome wrapper with a stable prefix so one permission rule covers
  all invocations; always use it instead of calling Chrome directly.
- **App icons**: all PNGs (`apple-touch-icon.png`, `icon-192.png`,
  `icon-512.png`, `icon-512-maskable.png`) are generated from
  `tools/make-touch-icon.html`, not hand-edited. Headless Chrome clamps its
  window to ~500px, so rendering directly at 180/192 yields a cropped top-left
  zoom — instead render the 512 masters and downscale:
  `tools/screenshot.sh "file://$PWD/tools/make-touch-icon.html" icon-512.png 512x512`,
  `... "?safe" icon-512-maskable.png 512x512`, then
  `sips -z 180 180 icon-512.png --out apple-touch-icon.png` and
  `sips -z 192 192 icon-512.png --out icon-192.png`. So the full-bleed sizes
  share identical framing. The generator is self-contained, so `file://` works
  (no server needed).
- **Screenshot harness**: write a temp `.shot-harness.html` in the repo root
  that (a) seeds localStorage key `sano.state.v1` (the stats bar `#progress`
  only renders with saved progress — copy the representative state from
  `tools/check-viewports.mjs`), (b) iframes the app at the desired width, and
  (c) optionally clicks elements inside the iframe to reach lesson /
  dictionary / flashcard / quiz screens. Delete temp harness files before
  committing.
- **Manual feature testing**: `tools/dev-seed.html` (committed dev tool served at
  `/tools/dev-seed.html`, never deployed) writes a ready-made `sano.state.v1` and opens
  the app where a given feature is visible — needed because most features are gated
  behind progress (due reviews, a missed day, a current unit). **Add a one-click
  scenario for every new feature** so Ross can test it on localhost immediately.
- **Forcing light mode**: headless Chrome follows the system theme. Strip the
  dark `@media` blocks into temp copies (`css/.light.css`,
  `css/.light-barebones.css`) and a `.light.html` that references them.
- **Animations**: `--virtual-time-budget` screenshots cannot catch animations
  mid-flight (the compositor finishes them before capture). Instead, sample
  `getComputedStyle(el).opacity` in a `setTimeout` inside a probe page, write
  results into the DOM, and read them with `--dump-dom`.
- **Live cache check**: `curl -sI https://namastesano.com/ | grep -i
  cache-control` → HTML must be `no-cache` (`.htaccess`); css/js are
  `max-age=2592000`, busted by the `?v=` stamps; `api/` responses are
  `no-store` (`api/.htaccess`).

## Design direction

- The brand is "Pennant & Paper-cut": softened Nepal-flag crimson + indigo on
  warm paper and a paper-cut mouse mascot named Sano. Sano's centered head is
  the favicon and the home-screen app icon (the Nepal pennant that earlier sat
  behind it was dropped 2026-06-13 — see `design/icons.html`). All theme tokens
  live at the top of `css/sano.css`
  (light block + dark `@media` block — change both). The mascot is inline
  SVG in `index.html`, drawn as flat layered shapes filled via `.f-*`
  classes (with `.s-whisker` strokes) — no drop-shadow or grain. It appears
  in the header, the lesson-complete screen, and a head-only footer crop;
  wherever it appears it runs the idle animations (see `design/animations.html`
  and `design/style-guide.html`).
- Prayer-flag section dividers were built and pulled (2026-06-12) — Ross is
  reconsidering them; don't re-add without him.
- Respect `prefers-reduced-motion` for any new animation (see the block at
  the bottom of `css/sano.css`). Under reduce-motion the mascot keeps only the
  eye blink (a tiny, non-vestibular scale) so Sano still reads as alive; the
  larger rotational idles (tail wag, head tilt, ear/nose wiggle) are suppressed.
  iOS Safari honors the OS Reduce Motion setting, so this is what an iPhone with
  Reduce Motion on will show — not a bug.
