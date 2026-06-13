# sano — Nepali Study Guide

Learn Nepali with short daily lessons. Live at <https://namastesano.com>.

A Duolingo-style course of essential Nepali phrases with Romanized pronunciations: a winding path of units, a daily lesson that mixes new words with spaced-repetition reviews, plus a browsable dictionary, flashcards, and a quiz. Progress syncs to the server behind an invite-only login, but the app is fully usable offline or logged out.

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
api/              PHP endpoints (login, logout, state) — see "Server sync"
fonts/            Self-hosted woff2 (Neuton 700; Lato 300/400/700 + italics)
tools/            Dev/ops scripts — see "Tool scripts"
.htaccess         Cache-control tiers on the Apache host
```

**No external requests at runtime.** Fonts are self-hosted, icons are Material Icons glyphs inlined as `<symbol id="i-*">` in a hidden SVG in index.html (used via `<svg><use href="#i-name">`), and the only network calls are same-origin `fetch()`es to `api/`.

### Course content (js/data.js)

`COURSE` is an array of units: `{ id, title, kind: 'phrases'|'vocab', items: [...] }`. Each item is `{ id, np, pron, en, usage }` (phrases) or `{ id, np, pron, en, emoji }` (vocab). Item ids are stable slugs (`namaste-hello-goodbye`) — they are the keys for all progress records, so **never rename an id** without writing a state migration.

### App logic (js/sano.js)

One screen at a time (`showScreen`): `home` (the unit path + daily-lesson button), `lesson`, `complete`, `dictionary`. Flashcards and the quiz are overlays on the dictionary's word list.

Lessons are a queue of exercises built by `buildExercises`: each new item gets an intro card then is tested; exercise types are multiple choice, word-bank sentence assembly, free typing (with typo leniency via edit distance), and tile matching. A daily lesson takes up to 4 new items from the current unit plus up to 6 due reviews (`DAILY_NEW_ITEMS`, `DAILY_REVIEW_ITEMS`).

**Spaced repetition** is a Leitner system. Every item record carries `level` 0–4 (`MAX_LEVEL`); `REVIEW_INTERVALS = [1, 1, 3, 7, 14]` days maps a level to its review delay. Correct lesson answers move an item up a level, misses move it down, and `isDue` compares `daysSince(lastSeen)` to the interval. The streak/daily counters live in `registerActivity`, keyed by the client's local date (`dayString`).

**State** is one JSON object, persisted in localStorage under `sano.state.v1`:

```js
{
  version: 2,
  name,                // display name (the header form), or null
  streak,              // consecutive study days
  lastActivityDay,     // 'YYYY-MM-DD'
  itemsToday, itemsTotal,
  items: {             // item id -> progress record
    'namaste-hello-goodbye': { seen, correct, level, lastSeen, intro },
  },
}
```

`loadState` runs synchronously at boot and funnels everything through `normalizeState`, which fills missing fields and applies migrations (an original multi-key format → v1 → v2 lives in `migrateLegacyState` / `migrateV1State`). `saveState` writes localStorage and notifies the sync layer; it is called after every answered exercise, so saves are frequent and the sync layer must debounce.

## Server sync

Server-side persistence is **one JSON blob per user** — the same object as localStorage — in MySQL, fronted by three PHP endpoints. localStorage stays the working copy: the app boots instantly from it, works offline, and the sync layer reconciles with the server when it can. Accounts are **invite-only** (no signup UI; see `tools/make-user.php`). A visitor with no account just uses localStorage forever, with an unobtrusive "Sign in" affordance.

### API (api/)

All endpoints are same-origin JSON. `lib.php` holds the shared helpers (config, PDO, session lookup, JSON responses) and is blocked from direct access by `api/.htaccess`.

| Endpoint | Method | Request | Responses |
| --- | --- | --- | --- |
| `login.php` | POST | `{username, password}` | 200 `{ok, state, revision, updatedAt}` + session cookie · 401 bad credentials · 429 `{error:"locked", retryAfter}` |
| `logout.php` | POST | — | 204; deletes the session, clears the cookie |
| `state.php` | GET | — | 200 `{state, revision, updatedAt}` (`state` null until first PUT) · 401 |
| `state.php` | PUT | `{state, baseRevision, force?}` | 200 `{revision, updatedAt}` · 409 `{error:"conflict", state, revision, updatedAt}` · 401 |

A 401 from any endpoint is the client's signal to show the login UI.

Security model:

- Passwords hashed with **argon2id** (`password_hash`; the host's PHP 8.2 supports it). Ten consecutive failures lock the account for 15 minutes (`failed_logins` / `locked_until` on the users row).
- Sessions are **DB-backed tokens**, not PHP native sessions: 32 random bytes, sent in an HttpOnly `sano_session` cookie (`Secure; SameSite=Strict; Max-Age=90 days`); the DB stores only the token's sha256, so a DB leak yields no usable tokens. Expired sessions are swept opportunistically on login.
- CSRF: mutating requests must carry `X-Sano-Request: 1`. Cross-origin pages can't add that header without a CORS preflight, which is never granted; belt-and-braces on top of SameSite=Strict.
- **Credentials are never in the repo.** `api/lib.php` does `require __DIR__ . '/../../sano-config.php'` — one level _above_ the docroot. On the server that's `~/sano-config.php` (mode 600); for local dev, one level above the repo checkout. The file returns `['dsn' => 'mysql:host=...;dbname=...;charset=utf8mb4', 'user' => ..., 'pass' => ...]`.
- `api/.htaccess` marks all API responses `Cache-Control: no-store` and denies `lib.php`.

### Database (tools/schema.sql)

Three InnoDB/utf8mb4 tables:

- `users` — id, username (unique), password_hash, failed_logins, locked_until, created_at.
- `app_state` — user_id (PK, FK cascade), state (MEDIUMTEXT JSON blob), revision (counter), updated_at (DATETIME(3), auto-updated).
- `sessions` — token_hash (PK), user_id (FK cascade), created_at, expires_at.

### Sync protocol (js/sync.js)

`SanoSync` keeps its bookkeeping in localStorage `sano.sync.v1`: `{ revision, dirty, localModifiedAt, username, lastUsername }`. `username` is only a UI hint — the HttpOnly cookie is the real credential, invisible to JS. `lastUsername` exists so logging into a _different_ account resets the revision counter (a revision only means something for the account that issued it).

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

## Caching and deployment

- HTML is served `no-cache`; css/js get `max-age=2592000` busted by `?v=` content-hash stamps on every URL in index.html; woff2 fonts are `max-age=31536000, immutable` (they only change by filename); API responses are `no-store`. Tiers live in `.htaccess` + `api/.htaccess`.
- Deploys rsync the site to the Apache shared host. The SSH alias `sano-deploy` in `~/.ssh/config` (HostName namastesano.com + user + key) holds all connection details — nothing sensitive in the repo. On a new machine, recreate the alias; the server already has `~/sano-config.php` in place.

## Tool scripts (tools/)

- **`format.sh [--check]`** — Prettier over all HTML, CSS, JS, and PHP. Resolves Prettier and `@prettier/plugin-php` from `node_modules/` (run `npm install` once on a fresh clone — the only npm deps are tooling). Settings in `.prettierrc`; vendored CSS (`normalize.css`, `barebones.css`), `tools/schema.sql`, and `.mockups.html` are excluded via `.prettierignore`. `--check` exits non-zero on drift.
- **`deploy.sh [-n]`** — rsync the site to the live Apache host. **To deploy:** finish the normal change workflow first (`format.sh` → `stamp-version.mjs` → `check-viewports.mjs` → browser review → commit to `main`), then run `tools/deploy.sh -n` to preview the itemized transfer and `tools/deploy.sh` to upload. It ships the working-tree files **as they are on disk** (committed or not), so make sure the tree is in the state you want. The script runs `stamp-version.mjs` itself, then rsyncs the allowlist — `index.html .htaccess favicon.svg apple-touch-icon.png icon-192.png icon-512.png icon-512-maskable.png manifest.json sw.js css js fonts api` — with `--checksum --no-times` (the host resets mtimes) and **no `--delete`** (the server keeps repo-absent files: `~/sano-config.php`, `tools/send-reminders.php`, the Composer vendor dir). Anything off that list never ships, so `tools/`, `design/`, `CLAUDE.md`, `README.md`, and `.mockups*` stay local. Connection details come from the `sano-deploy` SSH alias in `~/.ssh/config` (key auth, HostName namastesano.com) — nothing sensitive in the repo. **Verify after:** `curl -sI https://namastesano.com/ | grep -i cache-control` should report `no-cache`, and the live `css/sano.css?v=…` stamp should match the one in your local `index.html`.
- **`stamp-version.mjs`** — rewrites the `?v=<content-hash>` stamps on local asset URLs in index.html. Run after every edit (and after `format.sh`, since formatting changes hashes); never hand-edit a stamp. Skips fragment-only URLs (the icon sprite's `href="#i-*"`).
- **`check-viewports.mjs`** — layout regression check. Spins up an in-process HTTP server, seeds a representative `sano.state.v1`, loads the app in same-origin iframes at 9 mobile widths (320–521px; headless Chrome can't open windows narrower than 500px, but iframes get their own viewport), and asserts no horizontal overflow and that key elements stay inside the viewport. Non-zero exit + `/tmp/sano-viewports.png` on failure.
- **`screenshot.sh <url> <out.png> [WxH] [budget-ms]`** — headless-Chrome screenshot wrapper with a stable command prefix (so one permission rule covers all invocations). Always use it instead of invoking Chrome directly.
- **`make-user.php`** — creates an account (or `--reset-password`). Invite-only means this script is the only way accounts exist. Run it _on the server_, where it finds `sano-config.php` next to itself: `scp tools/make-user.php sano-deploy:` then `ssh -t sano-deploy 'php make-user.php <username>; rm make-user.php'`.
- **`schema.sql`** — the DDL above. Apply once with `ssh sano-deploy 'mysql <flags> sano' < tools/schema.sql`.
- **`make-touch-icon.html`** — renders the Nepal-pennant brand art at 180×180; `apple-touch-icon.png` is a screenshot of it (`tools/screenshot.sh <server>/tools/make-touch-icon.html apple-touch-icon.png 180x180`), regenerated after brand-art changes, never hand-edited.

## Testing & verification

- **Lint**: `php -l api/*.php tools/make-user.php`, `node --check js/*.js`.
- **Format**: `tools/format.sh --check` after any edits.
- **Layout**: `node tools/check-viewports.mjs` after every change.
- **Visual**: serve locally and screenshot via a temp harness page (`.shot-harness.html` in the repo root) that seeds `sano.state.v1`, iframes the app, and clicks into specific screens; delete the harness before committing. Headless Chrome follows the system theme — to force light mode, strip the dark `@media` blocks into temp CSS copies.
- **Live API**: a curl matrix exercises every status path — unauthenticated 401s, missing-CSRF-header 403s, login + cookie jar, PUT revision increment, stale-revision 409, `force` override, lockout 429 after 10 bad passwords, logout, `api/lib.php` → 403, `/sano-config.php` → 404, and `Cache-Control: no-store` on API responses.
- **Live cache tiers**: `curl -sI https://namastesano.com/ | grep -i cache-control` (and the same for a css/js/woff2/api URL).

## Local development

```sh
php -S 127.0.0.1:8000     # from the repo root; executes /api locally
```

The PHP dev server needs a dev `sano-config.php` one level above the repo (pointing at a local MySQL) for login/sync to work. For frontend-only work, `python3 -m http.server 8000` is fine — API calls fail and the app simply runs in its offline/logged-out mode, which is itself a code path worth testing.

Workflow for any change: edit → `tools/format.sh` → `node tools/stamp-version.mjs` → `node tools/check-viewports.mjs` → review in a browser → commit to `main`.
