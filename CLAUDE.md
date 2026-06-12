# sano — Nepali Study Guide

A static web app: essential Nepali phrases with Romanized pronunciations.
Plain HTML/CSS/JS, no build step: `index.html`, `css/sano.css`, `js/`,
`tools/`. Deployed by manually uploading files to namastesano.com (Apache);
Ross tests on an iPhone running iOS 26.

**Keep this file current**: when testing tools or architecture change
significantly, update CLAUDE.md in the same commit.

## Repo facts

- Remote: `git@github.com:rharmes/sano.git`, branch `main`.
- `.claude/settings.json` sets `worktree.bgIsolation: "none"` — background
  sessions edit this checkout directly; do not use worktrees.
- `.claude/settings.json` also configures a status line whose script is
  gitignored; restore it on a fresh clone with
  `curl -o .claude/scripts/status-line.sh https://raw.githubusercontent.com/shanraisshan/claude-code-status-line/main/status-line.sh && chmod +x .claude/scripts/status-line.sh`.
- Recent work: see `git log` — commit messages are descriptive.

## Workflow for every code change

1. Make edits, then run `node tools/stamp-version.mjs` — rewrites the `?v=`
   content-hash stamps on local asset URLs in index.html. Required for cache
   busting; never hand-edit the stamps.
2. Run `node tools/check-viewports.mjs` and verify visually with headless
   Chrome screenshots (see below).
3. Serve via `python3 -m http.server 8000` from the repo root and ask Ross to
   review at http://127.0.0.1:8000/ BEFORE committing.
4. After approval, commit directly to `main` — never leave work on a side
   branch. Push only when asked.
5. Commit messages: short imperative summary ending with a period, plus
   `Co-Authored-By` attribution.

## Testing and verification

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
  `max-age=2592000`, busted by the `?v=` stamps.

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
