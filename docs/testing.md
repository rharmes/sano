# Testing & capture recipes — sano

> Specialized verification/capture procedures pulled out of CLAUDE.md to keep the always-loaded
> instructions lean. The flaky-test stance + test-suite overview stay in CLAUDE.md ("Testing
> notes"); the tier table is in `@docs/architecture.md` ("## Tests"). Internal-only — `docs/`
> never ships.

## Screenshot harness

Write a temp `.shot-harness.html` in the repo root that seeds `sano.state.v1` and iframes the app at
the target width (reuse a builder from `tests/seed.mjs`). **Delete temp harness files before
committing.**

## Forcing light mode

Headless Chrome follows the system theme, so to capture light mode strip the dark `@media` blocks
into temp `.light.*` copies of the stylesheets.

## Sampling mid-animation state

`--virtual-time-budget` finishes animations before capture. To read a value partway through an
animation, sample `getComputedStyle(...).opacity` in a probe page and read it back with `--dump-dom`.

## App icons

`apple-touch-icon.png`, `icon-{192,512}.png`, and `icon-512-maskable.png` are generated from
`tools/make-touch-icon.html` — render the 512 masters via `tools/screenshot.sh` (`?safe` for the
maskable variant), then `sips` downscale. Not hand-edited.
