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
- Schema: `tools/schema.sql` (users, app_state blob + revision, sessions,
  signup_attempts, push_subscriptions). Reset/seed a password via
  `scp tools/make-user.php sano-deploy:` then
  `ssh -t sano-deploy 'php make-user.php <user> [--reset-password]'`
  (`tools/` is never deployed to the docroot).

## PWA + daily reminders

- Installable as an iOS home-screen app: `manifest.json` + iOS meta tags in
  `index.html`, plus icons (`icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`) generated from `tools/make-touch-icon.html` via
  `tools/screenshot.sh` (`?safe` query param renders the maskable variant).
- Service worker `sw.js` caches the shell (HTML network-first, stamped assets
  cache-first), passes `/api/*` through to the network, and handles `push` /
  `notificationclick` for reminders.
- Reminder opt-in: `js/push.js` (`SanoPush`) shows a "Daily reminder" toggle
  in the login panel when signed in AND running as an installed PWA. It calls
  `pushManager.subscribe(VAPID_PUBLIC_KEY)` and stores the endpoint via
  `POST /api/push-subscribe.php`. iOS only allows push for installed PWAs
  (iOS 16.4+).
- VAPID **public** key is baked into `js/push.js` (safe to ship). VAPID
  **private** key + subject are in `~/sano-config.php` on the server next to
  the DB creds (`vapid_subject`, `vapid_public_key`, `vapid_private_key`).
- Dispatch: `tools/send-reminders.php` runs server-side at 7pm PT via cron
  (`CRON_TZ=America/Los_Angeles 0 19 * * *`). It picks every user whose
  `state.lastActivityDay` isn't today PT and who has a subscription, then
  sends via minishlink/web-push (Composer dep at `~/sano-vendor/`). 410/404
  responses prune the subscription row. Flags: `--dry-run`, `--user <name>`.
- Deployed files: `manifest.json`, `sw.js`, icon PNGs, the two new
  `api/push-*.php`, `js/push.js`. `tools/send-reminders.php` and the
  Composer vendor dir are NOT in the rsync — they live on the server only.

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
- `design/` holds in-repo design artifacts (e.g. the animation tuner). It is
  committed but NOT in the deploy rsync allowlist, so nothing under it ships
  to the live site. Future design files go here too — don't add `design` to
  `tools/deploy.sh`.
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
4. Serve via `php -S 127.0.0.1:8000` from the repo root (executes `/api`;
   needs the dev `sano-config.php` one level above the repo) and ask Ross
   to review at http://127.0.0.1:8000/ BEFORE committing.
   `python3 -m http.server 8000` still works for frontend-only checks (API
   calls fail, exercising the app's offline path).
5. After approval, commit directly to `main` — never leave work on a side
   branch. Push only when asked.
6. Commit messages: short imperative summary ending with a period, plus
   `Co-Authored-By` attribution.
7. Deploy with `tools/deploy.sh` only when Ross asks; verify with the live
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
  reconsidering them; don't re-add without him. The concept lives in the
  untracked `.mockups.html`.
- Respect `prefers-reduced-motion` for any new animation (see the block at
  the bottom of `css/sano.css`). Under reduce-motion the mascot keeps only the
  eye blink (a tiny, non-vestibular scale) so Sano still reads as alive; the
  larger rotational idles (tail wag, head tilt, ear/nose wiggle) are suppressed.
  iOS Safari honors the OS Reduce Motion setting, so this is what an iPhone with
  Reduce Motion on will show — not a bug.
