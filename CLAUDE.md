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
  `api/` (PHP + PDO): `login.php`, `logout.php`, `state.php` (GET/PUT),
  shared `lib.php`. `js/sync.js` (`SanoSync`) does debounced pushes,
  revision-checked conflict detection, and last-write-wins reconciliation;
  its bookkeeping lives in localStorage `sano.sync.v1`.
- Auth: invite-only username/password; DB-backed session tokens in an
  HttpOnly `sano_session` cookie (90 days). CSRF guard: mutating requests
  must send `X-Sano-Request: 1`.
- **DB credentials are never in the repo.** `api/lib.php` requires
  `sano-config.php` from one level above the docroot (`~/sano-config.php`
  on the server; for local dev, one level above the repo). It returns
  `['dsn' => ..., 'user' => ..., 'pass' => ...]`.
- Schema: `tools/schema.sql` (users, app_state blob + revision, sessions).
  Accounts are invite-only: `scp tools/make-user.php sano-deploy:` then
  `ssh -t sano-deploy 'php make-user.php <user> [--reset-password]'`
  (`tools/` is never deployed to the docroot).

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
- **Screenshots**: `tools/screenshot.sh <url> <out.png> [WxH] [budget-ms]` —
  headless-Chrome wrapper with a stable prefix so one permission rule covers
  all invocations; always use it instead of calling Chrome directly.
- **App icon**: `apple-touch-icon.png` is generated, not hand-edited —
  regenerate after brand-art changes by serving the repo and running
  `tools/screenshot.sh <server>/tools/make-touch-icon.html apple-touch-icon.png 180x180`.
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
  warm paper, a paper-cut mouse mascot named Sano, and a Nepal-pennant
  favicon/app icon. All theme tokens live at the top of `css/sano.css`
  (light block + dark `@media` block — change both). The mascot is inline
  SVG in `index.html`, styled by `.f-*`/`.cut`/`.paper-grain` classes.
- Prayer-flag section dividers were built and pulled (2026-06-12) — Ross is
  reconsidering them; don't re-add without him. The concept lives in the
  untracked `.mockups.html`.
- Respect `prefers-reduced-motion` for any new animation (see the block at
  the bottom of `css/sano.css`).
