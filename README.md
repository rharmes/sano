# sano — Nepali Study Guide

<img src="docs/sano-idle.gif" alt="Sano, the paper-cut mouse mascot, idling" width="220" align="left" />

Learn Nepali with short daily lessons. Live at <https://namastesano.com>.

A Duolingo-style course of essential Nepali phrases with Romanized pronunciations: a winding path of units (with Sano's paper-cut animal friends tucked into its pockets), a daily lesson that mixes new words with spaced-repetition reviews, plus a browsable dictionary. New learners get a short conversational onboarding where Sano introduces the app and captures a display name. Progress lives in localStorage and optionally syncs to the server behind an account — self-service signup, or stay fully local. The app works offline or logged out, installs as an iOS home-screen PWA, and can send an opt-in daily reminder at a time you choose.

## Architecture at a glance

Plain HTML/CSS/JS frontend with **no build step**, plus a small PHP/MySQL API. What you see in the repo is what runs in the browser.

```
index.html        Single page: all screens, inline SVG sprite + mascot art
css/
  normalize.css   Resets (vendored)
  barebones.css   Minimal base styles (vendored)
  fonts.css       @font-face for the self-hosted fonts below
  sano.css        All app styles; theme tokens at the top (light + dark)
js/
  data.js         COURSE: the entire course content as a static array
  sano.js         App logic: screens, lessons, spaced repetition, state
  sync.js         SanoSync: server sync layer + login panel logic
  onboarding.js   SanoOnboard: first-run conversational setup flow
  push.js         SanoPush: daily-reminder subscriptions + setup modal
  audio.js        SanoAudio: self-hosted phrase-audio playback (pre-rendered MP3s, SR-02)
  dialogues.js    DIALOGUES: two-character dialogue lessons + comprehension (SR-01)
  characters.js   CHARACTER_HEADS/_BODIES: generated companion art (SR-07; build-character-heads.mjs)
  sounds.js       SOUND_TOPICS: pronunciation coaching drills (SR-08)
api/              PHP endpoints (register, login, logout, state, reminder, push-*) — see "Server sync"
fonts/            Self-hosted woff2 (Neuton 700; Lato 300/400/700 + italics)
manifest.json     PWA manifest; sw.js is the service worker; icon-*.png are the app icons
tools/            Dev/ops scripts — see "Tool scripts"
.htaccess         Cache-control tiers on the Apache host
```

**No external requests at runtime.** Fonts are self-hosted, icons are Material Icons glyphs inlined as `<symbol id="i-*">` in a hidden SVG in index.html (used via `<svg><use href="#i-name">`), and the only network calls are same-origin `fetch()`es to `api/`.

### Course content (js/data.js)

`COURSE` is an array of units: `{ id, title, kind: 'phrases'|'vocab', items: [...] }`. Each item is `{ id, np, pron, en, usage }` (phrases) or `{ id, np, pron, en, emoji }` (vocab). Item ids are stable slugs (`namaste-hello-goodbye`) — they are the keys for all progress records, so **never rename an id** without writing a state migration.

### App logic (js/sano.js)

One screen at a time (`showScreen`): `onboarding` (first-run only), `home` (the unit path + daily-lesson button), `lesson`, `complete`, `dictionary`.

Lessons are a queue of exercises built by `buildExercises`: each new item gets an intro card then is tested; exercise types are multiple choice, word-bank sentence assembly, free typing (with typo leniency via edit distance), and tile matching. A daily lesson takes up to 4 new items from the current unit plus up to 6 due reviews (`DAILY_NEW_ITEMS`, `DAILY_REVIEW_ITEMS`).

**Spaced repetition** is an **SM-2-lite** graded scheduler (SR-05). Rather than a shared Leitner table, every item record carries its own review `interval` (in days) and an `ease` factor (default 2.5, clamped to 1.3–2.7), so well-known items stretch out while weak ones come back sooner. Reviews are **auto-graded** from how the answer was given (`exerciseGrade`): a miss is a _lapse_ (interval back to one day, ease nudged down), a recognition hit is _good_ (interval × ease), and recalling the word under a harder drill — typing, word bank, or listening — is _easy_ (a bigger stretch plus an ease bump). `scheduleReview` applies the grade; `isDue` compares `daysSince(lastSeen)` to the item's interval, and once that interval reaches `RECALL_INTERVAL` (3 days) the item is "recall strength" and graduates from recognition to recall/listening drills (`isRecallStrength`). Legacy records that still carry a Leitner `level` 0–4 migrate to interval/ease on load (`legacyLevelToInterval`, via the `[1, 1, 3, 7, 14]`-day ladder), and the pure scheduler math is unit-tested by `tools/check-scheduler.mjs`. The streak/daily counters live in `registerActivity`, keyed by the client's local date (`dayString`). The learning-science rationale behind these choices lives in `PEDAGOGY.md`.

**State** is one JSON object, persisted in localStorage under `sano.state.v1`:

```js
{
  version: 2,
  name,                // display name (set in onboarding or the panel), or null
  onboarded,           // true once the first-run flow completes
  streak,              // consecutive study days
  lastActivityDay,     // 'YYYY-MM-DD'
  itemsToday, itemsTotal,
  items: {             // item id -> progress record
    'namaste-hello-goodbye': { seen, correct, ease, interval, lastSeen, intro },
  },
}
```

`loadState` runs synchronously at boot and funnels everything through `normalizeState`, which fills missing fields and applies migrations (an original multi-key format → v1 → v2 lives in `migrateLegacyState` / `migrateV1State`). `saveState` writes localStorage and notifies the sync layer; it is called after every answered exercise, so saves are frequent and the sync layer must debounce.

### First-run onboarding (js/onboarding.js)

`SanoOnboard.maybeStart()` runs at boot and, when no name is saved, takes over the screen with a scripted conversation in Sano's voice — reusing the home-screen speech-bubble styling (`.scene` / `.thread` / `.bubble`). It asks the learner's name (required), then offers two optional branches: create a cloud account (username + password → `register.php`, which auto-logs-in and syncs the local progress up), and a walkthrough for installing the PWA to the home screen. Every optional step has a "Not right now" exit to a "Set up complete" celebration, then the home path. Returning users (name already set) boot straight to home. The scripted lines are Romanized Nepali with English subtitles, kept together in the `L` object at the top of the module.

## Server sync

Server-side persistence is **one JSON blob per user** — the same object as localStorage — in MySQL, fronted by a handful of PHP endpoints. localStorage stays the working copy: the app boots instantly from it, works offline, and the sync layer reconciles with the server when it can. Accounts are **optional**: a visitor can sign up themselves through the onboarding flow (`register.php`) or stay fully local with a "Sign in" affordance; the invite-only `tools/make-user.php` CLI remains for manual accounts and password resets. A visitor with no account just uses localStorage.

### API (api/)

All endpoints are same-origin JSON. `lib.php` holds the shared helpers (config, PDO, session lookup, JSON responses) and is blocked from direct access by `api/.htaccess`.

| Endpoint | Method | Request | Responses |
| --- | --- | --- | --- |
| `register.php` | POST | `{username, password}` | 201 `{ok, state, revision, updatedAt}` + session cookie · 400 bad username/password · 409 `{error:"username_taken"}` · 429 `{error:"rate_limited", retryAfter}` |
| `login.php` | POST | `{username, password}` | 200 `{ok, state, revision, updatedAt}` + session cookie · 401 bad credentials · 429 `{error:"locked", retryAfter}` |
| `logout.php` | POST | — | 204; deletes the session, clears the cookie |
| `state.php` | GET | — | 200 `{state, revision, updatedAt}` (`state` null until first PUT) · 401 |
| `state.php` | PUT | `{state, baseRevision, force?}` | 200 `{revision, updatedAt}` · 409 `{error:"conflict", state, revision, updatedAt}` · 401 |
| `reminder.php` | GET | — | 200 `{hour, tz}` (nulls if unset) · 401 |
| `reminder.php` | POST | `{hour, tz}` or `{disable:true}` | 200 `{ok, hour, tz}` · 400 bad hour/tz · 401 |
| `push-subscribe.php` · `push-unsubscribe.php` | POST | `{endpoint, keys}` · `{endpoint}` | 200 `{ok}` · 401 |

A 401 from any endpoint is the client's signal to show the login UI.

Security model:

- Passwords hashed with **argon2id** (`password_hash`; the host's PHP 8.2 supports it). Ten consecutive failures lock that account for 15 minutes (`failed_logins` / `locked_until` on the users row); a **per-IP throttle** (`login_attempts`, counted before `password_verify` so a flood can't burn argon2 CPU) bounds credential-stuffing across many usernames.
- Sessions are **DB-backed tokens**, not PHP native sessions: 32 random bytes, sent in an HttpOnly `sano_session` cookie (`Secure; SameSite=Strict; Max-Age=90 days`); the DB stores only the token's sha256, so a DB leak yields no usable tokens. Expired sessions are swept opportunistically on login.
- CSRF: mutating requests must carry `X-Sano-Request: 1`. Cross-origin pages can't add that header without a CORS preflight, which is never granted; belt-and-braces on top of SameSite=Strict.
- Signup (`register.php`) is **open but rate-limited** — at most 5 accounts/hour per IP (the `signup_attempts` table), usernames validated `^[a-z0-9_]{3,32}$`, passwords 8–200 chars, duplicates caught on the `UNIQUE(username)` constraint. No third-party captcha (it would break the no-external-requests rule); the IP throttle is the bot defense. On success it issues the same session cookie as `login.php`.
- **Credentials are never in the repo.** `api/lib.php` does `require __DIR__ . '/../../sano-config.php'` — one level _above_ the docroot. On the server that's `~/sano-config.php` (mode 600); for local dev, one level above the repo checkout. The file returns `['dsn' => 'mysql:host=...;dbname=...;charset=utf8mb4', 'user' => ..., 'pass' => ...]`.
- `api/.htaccess` marks all API responses `Cache-Control: no-store` and denies `lib.php`.
- **Fail closed:** `api/lib.php` sets `display_errors` off and a `set_exception_handler` that turns any uncaught error (PDO failure, missing config, a re-thrown insert) into a generic `{error:"server"}` 500 — no stack trace or DSN ever reaches the client.
- **Response headers** (root `.htaccess`): a strict `Content-Security-Policy` (feasible because there are no external requests — `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `style-src 'self' 'unsafe-inline'` for JS-set inline styles), plus `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy`.

### Database (tools/schema.sql)

Six InnoDB/utf8mb4 tables:

- `users` — id, username (unique), password_hash, failed_logins, locked_until, **reminder_hour** (0–23, null = no reminder), **reminder_tz** (IANA name, null), created_at.
- `app_state` — user_id (PK, FK cascade), state (MEDIUMTEXT JSON blob), revision (counter), updated_at (DATETIME(3), auto-updated).
- `sessions` — token_hash (PK), user_id (FK cascade), created_at, expires_at.
- `signup_attempts` — ip (VARBINARY(16)), created_at; per-IP signup throttle, pruned to the last hour on each attempt.
- `login_attempts` — ip (VARBINARY(16)), created_at; per-IP login throttle (failed logins), pruned to the throttle window.
- `push_subscriptions` — id, user_id (FK cascade), endpoint (unique), p256dh, auth_secret, plus delivery bookkeeping (last_success_at / last_failure_at / failure_count). One row per opted-in browser/device; the dispatcher iterates per row.

### Sync protocol (js/sync.js)

`SanoSync` keeps its bookkeeping in localStorage `sano.sync.v1`: `{ revision, dirty, localModifiedAt, username, lastUsername }`. `username` is only a UI hint — the HttpOnly cookie is the real credential, invisible to JS. `lastUsername` exists so logging into a _different_ account resets the revision counter (a revision only means something for the account that issued it). Login and signup converge on `adoptSession(username, body)`: it sets the username and runs `reconcile` on the endpoint's `{state, revision, updatedAt}` payload, so a brand-new account imports the local progress on its first sync (rule 1 below).

Flow:

- `saveState()` → `markDirty()`: set dirty + `localModifiedAt`, schedule a **debounced PUT (~2s)** if signed in.
- A successful PUT carries `baseRevision`; the server increments and returns the new revision. A stale `baseRevision` gets a **409** with the server copy, which feeds `reconcile`.
- `reconcile(server)` rules, in order:
     1. Server has no state (fresh account) → PUT local state (`force`): this is the **one-time import** of existing progress on first login.
     2. This browser has never synced with the account (`revision === 0`) → adopt the server copy. (Prevents a fresh device's five minutes of demo progress from force-clobbering months of real history.)
     3. Not dirty → adopt the server copy.
     4. Dirty and revisions match → push.
     5. Dirty and the server moved (another device) → **last-write-wins**: newest of `localModifiedAt` vs server `updatedAt`. The loser's session is silently dropped — an accepted trade-off for a personal app.
- Adopting calls `applyServerState` in sano.js (normalize, persist, refresh the header/home screen) without re-marking dirty.
- Offline: failed fetches leave the state dirty; retries happen on the `online` event and on the next save. Tab closes flush via a `fetch(..., {keepalive: true})` PUT on `pagehide`/`visibilitychange` (sendBeacon can't send the CSRF header).
- A 401 anywhere flips the UI to logged-out; the app keeps working locally.

The login panel (`#login-panel` in index.html) is opened from the person icon in the stats bar (or the "Sign in" link before a name is set) and doubles as the signed-in/logout view.

## PWA & daily reminders

Sano installs to the iOS home screen (`manifest.json` + the apple-touch / maskable icons + iOS meta tags in index.html). `sw.js` is the service worker: it caches the shell (HTML network-first, `?v=`-stamped assets cache-first), passes `/api/*` straight to the network, and handles `push` / `notificationclick`.

A working reminder needs **two** things, deliberately split:

- a **push subscription** — per browser/device. `SanoPush.enable()` requests notification permission, calls `pushManager.subscribe(VAPID_PUBLIC_KEY)`, and stores the endpoint via `push-subscribe.php` (the `push_subscriptions` table). iOS only delivers Web Push inside an _installed_ PWA (16.4+), and permission must come from a user gesture. The VAPID **public** key is baked into `js/push.js` (safe to ship); the private key + subject live only in `~/sano-config.php`.
- a **reminder time** — per account: `reminder_hour` (whole hour 0–23) + `reminder_tz` (IANA), via `reminder.php`. Whole hours only, so the cron need run just once an hour.

`SanoPush` shows a toggle + time label in the login panel (signed-in, installed PWA only) and pops a one-time **setup modal** on the home screen when such a PWA has no reminder yet. The modal collects an hour + timezone (defaulted from `Intl.DateTimeFormat().resolvedOptions().timeZone`, listed via `Intl.supportedValuesOf('timeZone')`), then subscribes and saves together. Toggling the reminder off unsubscribes _and_ clears the schedule.

**Dispatch** is `tools/send-reminders.php`, run **hourly** by cron (`0 * * * *` — no `CRON_TZ`; each user's zone is resolved in PHP, so it never depends on the MySQL timezone tables). For every reminder-enabled subscription it sends only when the current hour in that user's `reminder_tz` equals their `reminder_hour` **and** they haven't studied yet today (local date). Delivery is via minishlink/web-push (Composer dep at `~/sano-vendor/`); a 410/404 prunes the dead subscription. Flags: `--dry-run`, `--user <name>`, `--force` (ignore the hour + studied-today filters). The script and the vendor dir live **only on the server** (not in the deploy rsync) — install at `~/sano-tools/send-reminders.php`.

## Caching and deployment

- HTML is served `no-cache`; css/js get `max-age=2592000` busted by `?v=` content-hash stamps on every URL in index.html; woff2 fonts are `max-age=31536000, immutable` (they only change by filename); API responses are `no-store`. Tiers live in `.htaccess` + `api/.htaccess`.
- Deploys rsync the site to the Apache shared host. The SSH alias `sano-deploy` in `~/.ssh/config` (HostName namastesano.com + user + key) holds all connection details — nothing sensitive in the repo. On a new machine, recreate the alias; the server already has `~/sano-config.php` in place.

## Tool scripts (tools/)

- **`check.sh [--no-viewports]`** — the **preflight**: every static check in one command — `format.sh --check`, `stamp-version.mjs --check`, `php -l` over `api/` + `tools/`, `node --check` over the JS/MJS, `check-scheduler.mjs` (the SR-05 scheduler unit test), then `check-viewports.mjs`. Exits non-zero on the first failure. `--no-viewports` (= **`npm run lint`**, what CI runs) skips the headless-Chrome step. The full thing is **`npm run check`**.
- **`format.sh [--check]`** — Prettier over all HTML, CSS, JS, and PHP. Resolves Prettier and `@prettier/plugin-php` from `node_modules/` (run `npm install` once on a fresh clone — the only npm deps are tooling). Settings in `.prettierrc`; vendored CSS (`normalize.css`, `barebones.css`), `tools/schema.sql`, and `.mockups.html` are excluded via `.prettierignore`. `--check` exits non-zero on drift.
- **`deploy.sh [-n] [--allow-dirty]`** — rsync the site to the live Apache host. **To deploy:** finish the normal change workflow first (`format.sh` → `stamp-version.mjs` → `check-viewports.mjs` → browser review → commit to `main`), then run `tools/deploy.sh -n` to preview the itemized transfer and `tools/deploy.sh` to upload. It ships the working-tree files **as they are on disk** (committed or not), so as a safety net it **refuses to run on a dirty tree** — commit first, or pass `--allow-dirty` to ship uncommitted changes on purpose (`-n` dry-runs skip the guard, and untracked files like `PLAN.md` don't trip it; only tracked modifications block). It no longer stamps (that's a pre-commit step, verified by `npm run check`) — it just rsyncs the allowlist — `index.html .htaccess favicon.svg apple-touch-icon.png icon-192.png icon-512.png icon-512-maskable.png manifest.json sw.js css js fonts api` — with `--checksum --no-times` (the host resets mtimes) and **no `--delete`** (the server keeps repo-absent files: `~/sano-config.php`, `tools/send-reminders.php`, the Composer vendor dir). Anything off that list never ships, so `tools/`, `design/`, `CLAUDE.md`, `README.md`, and `PEDAGOGY.md` stay local. Connection details come from the `sano-deploy` SSH alias in `~/.ssh/config` (key auth, HostName namastesano.com) — nothing sensitive in the repo. **Verify after:** `curl -sI https://namastesano.com/ | grep -i cache-control` should report `no-cache`, and the live `css/sano.css?v=…` stamp should match the one in your local `index.html`.
- **`stamp-version.mjs [--check]`** — rewrites the `?v=<content-hash>` stamps on local asset URLs in index.html. Run after changing css/js (and after `format.sh`, since formatting changes hashes); never hand-edit a stamp. **`--check`** verifies the stamps are current without writing and is part of the preflight (`check.sh`, and thus CI), so committed stamps are always fresh and `deploy.sh` ships them without re-stamping. Skips fragment-only URLs (the icon sprite's `href="#i-*"`) and `.woff2` fonts (immutable by filename).
- **`check-viewports.mjs`** — layout regression check across **three scenarios** (home path, first-run onboarding, reminder modal) × 9 mobile widths (320–521px; headless Chrome can't open windows narrower than 500px, but iframes get their own viewport). Spins up an in-process HTTP server and loads the app in same-origin iframes; each scenario seeds `sano.state.v1`, optionally drives the iframe to a screen (e.g. advances onboarding to the account step, force-opens the modal), then asserts no horizontal overflow and that key elements stay inside the viewport. Non-zero exit + `/tmp/sano-viewports-<scenario>.png` on failure.
- **`check-webkit.mjs`** — real-Safari smoke test for the Sano idle animations, so the app isn't only validated in headless Chrome (the rest of the tooling is Chromium, which can't catch WebKit-only rendering bugs). Serves the repo in-process, drives **real Safari** through `safaridriver` (macOS's built-in WebDriver), and asserts every idle group is running its expected keyframe **and** that the eye blink actually changes the SVG transform over a blink cycle (proving WebKit animates it, not just that it reports `running`). Opens a Safari window briefly — run it after animation or mascot-CSS changes. **One-time setup:** `sudo safaridriver --enable`, then Safari > Settings > Advanced > "Show features for web developers" and Safari > Develop > "Allow Remote Automation". Note it runs without Reduce Motion, so it checks the full idle set; the reduced-motion path (blink only) is verified on-device.
- **`screenshot.sh <url> <out.png> [WxH] [budget-ms]`** — headless-Chrome screenshot wrapper with a stable command prefix (so one permission rule covers all invocations). Always use it instead of invoking Chrome directly.
- **`make-user.php`** — creates or resets (`--reset-password`) an account from the CLI. Self-service `register.php` is the usual signup path now; this is for manual accounts and password resets. Run it _on the server_, where it finds `sano-config.php` next to itself: `scp tools/make-user.php sano-deploy:` then `ssh -t sano-deploy 'php make-user.php <username>; rm make-user.php'`.
- **`send-reminders.php`** — the hourly reminder dispatcher (see "PWA & daily reminders"). Lives **only on the server** (`~/sano-tools/`), outside the deploy rsync; update it with `scp tools/send-reminders.php sano-deploy:sano-tools/`, and smoke-test with `ssh sano-deploy 'php sano-tools/send-reminders.php --user <name> --force --dry-run'`.
- **`schema.sql`** — the DDL above; apply on a fresh DB with `ssh sano-deploy 'mysql <flags> sano' < tools/schema.sql`. For incremental changes to a live DB, write a one-off idempotent migration instead — never re-run the full schema.
- **`migrate-2026-06-reminders.php`** — example of that: an idempotent PDO migration (reads `sano-config.php` like make-user.php) that adds `signup_attempts` and the `users.reminder_*` columns. `scp` it to the server home and run once with `ssh sano-deploy 'php migrate-2026-06-reminders.php'`.
- **`make-touch-icon.html`** — renders Sano's head as the app-icon art. The PNGs (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, and the maskable `icon-512-maskable.png` via the `?safe` query) are made by rendering the **512** masters with `screenshot.sh` and downscaling with `sips` — headless Chrome clamps its window to ~500px, so rendering directly at 180/192 crops the top-left. The generator is self-contained (`file://` works); never hand-edit the PNGs.

## Testing & verification

- **Preflight (one command)**: `tools/check.sh` (or `npm run check`) bundles format check + stamp check + PHP lint + JS syntax + the scheduler unit test + the viewport scenarios; `npm run lint` is the browser-less subset. The individual checks below are what it wraps.
- **Lint**: `php -l api/*.php tools/*.php`, `node --check js/*.js`.
- **Format**: `tools/format.sh --check` after any edits.
- **Scheduler**: `node tools/check-scheduler.mjs` after any change to the SR-05 spaced-repetition math — lifts the pure scheduler block out of `js/sano.js` (between its sentinel comments) and unit-tests the interval/ease grading in isolation from the DOM.
- **Layout**: `node tools/check-viewports.mjs` after every change.
- **WebKit/Safari**: `node tools/check-webkit.mjs` after animation or mascot-CSS changes — drives real Safari via `safaridriver` to confirm the SVG idle animations run in WebKit (the rest of the tooling is headless Chrome). Needs the one-time `safaridriver --enable` + Develop > Allow Remote Automation.
- **Visual**: serve locally and screenshot via a temp harness page (`.shot-harness.html` in the repo root) that seeds `sano.state.v1`, iframes the app, and clicks into specific screens; delete the harness before committing. Headless Chrome follows the system theme — to force light mode, strip the dark `@media` blocks into temp CSS copies.
- **Live API**: a curl matrix exercises every status path — unauthenticated 401s, missing-CSRF-header 403s, signup (happy path + duplicate 409 + per-IP 429 + bad-input 400), login + cookie jar, PUT revision increment, stale-revision 409, `force` override, lockout 429 after 10 bad passwords, reminder get/set/clear, logout, `api/lib.php` → 403, `/sano-config.php` → 404, and `Cache-Control: no-store` on API responses.
- **Live cache tiers**: `curl -sI https://namastesano.com/ | grep -i cache-control` (and the same for a css/js/woff2/api URL).
- **CI**: `.github/workflows/ci.yml` runs `npm run lint` (Prettier + stamp + `php -l` + `node --check`, no browser) on every push to `main` and every PR — on a GitHub Ubuntu runner (built-in PHP, `actions/setup-node`, `npm install`). The headless-Chrome layout check (`npm test`) stays local. Results show in the repo's **Actions** tab.

## Local development

```sh
php -S 127.0.0.1:8000     # from the repo root; executes /api locally
```

The PHP dev server needs a dev `sano-config.php` one level above the repo (pointing at a local MySQL) for login/sync to work. For frontend-only work, `python3 -m http.server 8000` is fine — API calls fail and the app simply runs in its offline/logged-out mode, which is itself a code path worth testing.

**npm scripts** — `npm run` with no name prints the full menu. `start` / `stop` run and kill the dev server on :8000; `format` formats in place (the only script that writes); `lint` runs the read-only static checks (format + stamps + `php -l` + `node --check`, no browser — what CI runs); `test` runs the headless-Chrome viewport scenarios; `check` is the full gate (`lint` + `test`); `stamp` rewrites the `?v=` hashes; `deploy:preview` / `deploy` dry-run / ship. (`start`, `stop`, and `test` are npm lifecycle names, so they also work without `run`.)

### Workflow for a change

1. **Edit** the code.
2. **`npm start`** — serve at `http://127.0.0.1:8000` and try it in a browser (`npm run stop` to shut the server down).
3. **`npm run format`** — Prettier-format every file in place.
4. **`npm run stamp`** — rewrite the `?v=` content-hash stamps in index.html so changed css/js bust their browser cache.
5. **`npm run check`** — the gate: format check, **stale-stamp check**, `php -l`, `node --check`, and the viewport scenarios. CI re-runs all of this except the browser step on every push.
6. **Commit** to `main`.
7. **`npm run deploy`** — pure ship: rsync the committed tree to the server (`npm run deploy:preview` dry-runs first; it refuses a dirty tree). No stamping happens here — steps 4–5 guarantee the committed stamps are already current.

## Regenerating audio

All spoken-Nepali audio is **pre-rendered and self-hosted** — the app never calls a TTS service
at runtime. Clips are synthesized through the ElevenLabs API in Sano's cloned voice by
`tools/tts/synth-app.mjs` (which lives under `tools/` and is never deployed); the rendered MP3s
under `audio/` are committed and ship with the normal deploy. You only run this when course
content changes or the voice is re-cut.

Everything runs from the repo root with an API key exported:

```sh
export ELEVENLABS_API_KEY=sk_…
```

**1. Rebuild the word map** — only if `js/data.js` changed. `tools/tts/words.json` maps each
word-bank tile-word to its Devanagari (deterministic; re-run after editing course content):

```sh
node tools/tts/build-words.mjs
```

**2. Render** the set you need (clips land under `audio/`):

```sh
node tools/tts/synth-app.mjs --phrases     # one per COURSE item  → audio/default/<id>.mp3   (~588)
node tools/tts/synth-app.mjs --words       # one per tile-word    → audio/words/<slug>.mp3   (~233)
node tools/tts/synth-app.mjs --dialogues   # each dialogue line, per character voice → audio/<voice>/<clipId>.mp3
```

Add `--new` to render only clips not yet on disk (the incremental path after adding content),
`--only <id|slug>` to redo a single clip, or run `--sample` first to preview the voice into a
gitignored scratch dir. Defaults: Sano's voice, `eleven_v3`, `mp3_44100_128`.

**3. Bust caches** — bump `AUDIO_VERSION` in `js/audio.js` so clients refetch the new clips.

A missing clip is a silent no-op in the app, so a partial render never breaks the UI. See
`tools/tts/README.md` for the voice-cloning / bake-off details and `RESEARCH.md` for the engine
choice.
