# Sano — review TODO

A full-codebase audit (frontend, PHP API, `tools/`, build/deploy) after shipping
onboarding + self-service signup + per-user reminders. Goal: changes that favor
**reusability, readability, and consistency**. The codebase is in good shape —
clean CSS tokens, versioned/migrated state, solid PHP, a distinctive
"Pennant & Paper-cut" brand. This is a polish-and-harden pass, not a rewrite.

Items are numbered `R#` and tagged **[P1]** (do first — correctness or
high-leverage/low-effort), **[P2]** (worthwhile), **[P3]** (polish). Check items
off as they land.

## Headline finding

The biggest opportunity is **CSS reusability/consistency**: `design/style-guide.html`
already designed the shared component classes (`.btn-primary` + `.indigo`/`:disabled`,
`.icon-btn`, `.field`, `.check`, `.panel`) — but the app never adopted them.
`css/sano.css` instead hand-rolls that same crimson button **six times**
(`#daily-lesson`, `.onboard-primary`, `#exercise-check/#lesson-continue/#complete-continue`,
`#login-panel button`, `.reminder-actions button`+`#reminder-save`, `.bubble.user.choice`),
each re-undoing barebones' `height:38px; text-transform:uppercase; letter-spacing:0.1rem`.
The app and its own contract have drifted. Closing that gap (R1–R5) is the
highest-leverage change.

## 1. CSS reusability & style-guide consistency

- [x] **R1 [P1] Adopt `.btn-primary` as a real class.** Promote the style guide's
  `.btn-primary` / `.btn-primary.indigo` / `:disabled` into `css/sano.css` and
  replace the six duplicate button blocks with it + small per-element modifiers
  (e.g. `#daily-lesson` keeps only its full-width/larger-type delta).
- [x] **R2 [P1] One button reset.** The `height:auto; text-transform:none;
  letter-spacing:normal` every custom button repeats is undoing
  `css/barebones.css:251-265`. Centralize it so new buttons inherit the brand shape.
- [x] **R3 [P2] Converge panels onto `.panel`.** `#login-panel` (radius `1rem`,
  shadow `.18`) and `.reminder-card` (radius `1.4rem`, shadow `.4`) are the same
  concept with different numbers. Adopt the style guide's `.panel` for both.
- [x] **R4 [P2] Converge inputs onto `.field`.** `#login-panel input`, `#type-answer`,
  `.reminder-field select`, `.onboard-input` vary. Base them on `.field`; keep
  `.onboard-input` as a documented fill-in-the-blank variant.
- [x] **R5 [P2] Re-sync `design/style-guide.html`.** It predates onboarding (no
  input/choice-bubble variants, no reminder modal) and still shows "Daily reminder
  at 7pm PT" (`style-guide.html:1318`). After R1/R3/R4 the app and guide share classes.
- [x] **R6 [P3] DRY + token nits.** _(+ lesson buttons normalized to mixed-case)_ `#nepali.container` (sano.css:325-332) re-declares
  all of `.container` just to change `max-width`. Drop the two `!important` in
  `#name-form` (412-423). Promote `--button-primary-color` (today only in barebones)
  into sano.css's token block.

## 2. Performance

- [x] **R7 [P1] `defer` the scripts.** `index.html:29-33` load five scripts in
  `<head>` with no `defer` — render-blocking (data.js alone is 100K). sano.js waits
  for `DOMContentLoaded` and the others only define globals, so `defer` is safe and
  preserves order.
- [x] **R8 [P1] Preload hero fonts.** `<link rel="preload" as="font" type="font/woff2"
  crossorigin>` for `fonts/neuton-latin-700.woff2` + `fonts/lato-latin-400.woff2` to
  cut FOUT/LCP.
- [x] **R9 [P2] Put caching + gzip in the repo.** _(Apache config — verify live)_ Live returns `max-age=2592000` +
  gzip for css/js, but those rules are host-managed, not in `.htaccess` — invisible
  and unportable. Add explicit `Cache-Control: max-age=31536000, immutable` for
  css/js (safe — URLs are `?v=`-stamped) + a `mod_deflate` block.
- [x] **R10 [P3] Lazy-render the dictionary.** `renderTables()` (sano.js:913) builds
  every word row + vocab card at boot though `#screen-dictionary` is hidden.
- [x] **R11 [P3] sw.js precache vs. comment.** The comment claims it caches the shell,
  but caching is lazy/runtime. Add an install-time `cache.addAll([…])` or soften the
  comment.

## 3. Security & hardening

- [x] **R12 [P1] API error boundary.** `set_exception_handler` → clean JSON 500 +
  `display_errors` off in `api/lib.php`. Today an uncaught `PDOException` is a raw PHP
  fatal that can leak the DSN/paths if display_errors is on.
- [x] **R13 [P2] Security headers in `.htaccess`.** _(deployed config — verify live)_ No external requests makes a strict
  CSP feasible (`default-src 'self'; style-src 'self' 'unsafe-inline'; object-src
  'none'; base-uri 'self'; frame-ancestors 'none'; …`), plus HSTS,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`. (Apache-only — verify live.)
- [x] **R14 [P2] Per-IP login throttle.** _(needs the login_attempts migration on the live DB)_ `login.php` has per-account lockout but no
  per-IP limit, so credential-stuffing across many usernames is unbounded. Reuse the
  `signup_attempts` pattern.
- [x] **R15 [P3] Note the lockout-DoS tradeoff.** Per-account lockout (10 fails →
  15min) lets someone lock out a known username. Fine for a personal app — document it.
- [x] **R16 [P3] Username enumeration.** register.php's 409 reveals taken usernames;
  already IP-throttled, acceptable — note it.

## 4. Architecture & readability

- [x] **R17 [P2] Make the module contract explicit.** `SanoSync`/`SanoPush`/`SanoOnboard`
  reach into sano.js's bare globals (`state`, `saveState`, `showScreen`, `renderHome`,
  `pathRevealed`, …). Expose a small `window.Sano = { … }` surface so the modules use it.
- [x] **R18 [P3] ~~Optionally split sano.js (~990 lines).~~** _Evaluated — keep whole: splitting in a no-build app scatters functions into more implicit globals, against R17._ State + SRS + path geometry +
  lesson engine + rendering. Extracting `renderPath` and/or the lesson engine aids
  readability. Low priority.
- [x] **R19 [P3] Tokenize stray hardcoded colors.** `#fff`, `rgba(10,8,14,…)`,
  `hsl(0,65%,50%)`, `hsla(36,88%,55%,…)` bypass the token system. Promote to
  `--on-accent` / `--shadow-color` / etc.

## 5. Frontend-design polish (brand is strong — elevate, don't redesign)

- [x] **R20 [P2] Modal accessibility.** Make `#reminder-modal` a real dialog (`<dialog>`
  or `role="dialog" aria-modal="true"`) with focus trap, Escape-to-close, focus return.
  Spot-check `--text-color-soft` contrast.
- [x] **R21 [P3] Type scale as tokens.** Font-sizes are scattered magic rems. Define
  `--text-display/-word/-body/-label/…` matching the style guide's specimens (ties to R6).
- [ ] **R22 [P3] Warm the reminder modal to Sano's voice.** A small Sano head + a line
  in his voice would make it feel of a piece with the conversational onboarding.
- [ ] **R23 [P3] Gentle modal entrance + memorable celebration.** Give the modal a
  `pop-in`/`rise-in` entrance (reduced-motion-safe); spend a touch more motion budget
  on the onboarding celebration.

## 6. Tools, build & deploy

- [x] **R24 [P1] Extend `check-viewports.mjs` to the new screens.** It seeds a *named*
  state, so onboarding + the reminder modal are never layout-tested. Add a no-name
  seed (onboarding) and a forced-modal case.
- [x] **R25 [P2] One-command preflight.** `tools/check.sh` (+ `npm run check`) =
  `format.sh --check` + `php -l api/*.php tools/*.php` + `node --check js/*.js` +
  `check-viewports.mjs`.
- [x] **R26 [P2] CI on GitHub.** A GitHub Action running the R25 preflight on push/PR.
- [x] **R27 [P3] `deploy.sh` dirty-tree guard.** It rsyncs the working tree (committed
  or not). Add a `git diff --quiet` warn/abort.
- [x] **R28 [P3] ~~Formalize migrations.~~** _Evaluated — keep the one-off idempotent `migrate-*.php` pattern; a framework is over-engineering at this cadence._ The one-off `migrate-*.php` works but is ad
  hoc. A `tools/migrations/NNNN_*.sql` convention + a runner scales better.

## Suggested sequencing

- **P1 batch:** R1, R2 (button consolidation), R7 (defer), R8 (font preload), R12 (API
  error boundary), R24 (viewport coverage).
- **P2 batch:** R3, R4, R5 (panels/fields/style-guide sync), R9 (explicit caching), R13,
  R14 (headers + login throttle), R17 (module contract), R20 (modal a11y), R25, R26.
- **P3 batch:** the rest.

## Verification

- **CSS refactor (R1–R6):** format → stamp → `check-viewports.mjs` → screenshot-harness
  sweep (home, lesson, complete, dictionary, onboarding states, login panel, reminder
  modal) in light + dark, diffed for pixel-parity (a pure consolidation should look
  identical).
- **defer/preload (R7/R8):** before/after Lighthouse, or confirm no regression.
- **API error boundary (R12):** point dev `sano-config.php` at an unreachable DB →
  expect a clean JSON 500, no stack trace.
- **Headers (R13):** `curl -I` live → confirm headers; click through to confirm CSP
  doesn't break inline styles/SVG.
- **Tooling (R24–R26):** extended viewport check passes new cases; a deliberate format
  violation fails CI.
