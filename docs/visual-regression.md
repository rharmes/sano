# Visual screenshot-diff regression (deferred)

**Status: scoped, _not built_ — deliberately deferred.** Ross and Claude agreed (2026-06-26)
that the flakiness risk is too high to take on now, given the standing rule in `CLAUDE.md`
("Very low tolerance for flaky tests"). This file is the design + decision log so the
project can be picked up cleanly later — it is **not** a description of anything that
currently runs. The behavioral e2e suite (`tests/e2e/`, the `--ui` tier) plus manual
iOS-device review remain the visual safety net until this lands.

## Why it would be worth doing

The current e2e suite asserts **behavior and structure** — an element is visible, text
matches, the gloss popover's box stays within 320px (`tests/e2e/dialogue.spec.mjs`). None
of it asserts the page _looks_ right. You could shift every path node 40px, change the
crimson brand token, or break the Sano mascot SVG and — as long as the elements stay
present and clickable — the whole suite would still pass. For a design-forward app
("Pennant & Paper-cut"), that visual surface is the single biggest thing the automated
tests don't cover.

Visual regression closes the gap: capture a reference screenshot, pixel-compare future
runs against it, and fail on unexpected drift.

## How Playwright does it (no new dependency)

It is built into `@playwright/test`, so this adds test code and CI infra, not a package:

- `await expect(page).toHaveScreenshot('home-360.png')` — whole page or a single locator.
- First run writes a **baseline PNG** under a `*-snapshots/` directory, keyed by
  `(test, project, platform)`.
- Later runs capture the current frame and diff it (pixelmatch) with a configurable
  `maxDiffPixels` / `maxDiffPixelRatio` / `threshold`; drift over tolerance fails the test
  and emits a baseline / actual / highlighted-diff triptych into the HTML report.
- Intentional changes: re-run with `--update-snapshots`, then review and commit the new
  PNGs.

It layers onto what already exists — the same specs, the same `tests/seed.mjs` fixtures,
and the same `boot()` (which already freezes CSS animations inline).

## What to snapshot

The brand-critical surfaces, across both engines (chromium / webkit) and light + dark:

- The home path across the 9 widths (the existing overflow sweep already drives these).
- One of each lesson exercise renderer (choice / match / wordbank / type / listen / speak).
- The dialogue player — a revealed line plus the tap-to-translate popover.
- Dictionary, the onboarding first screen, the reminder modal, the standalone mascot.
- `/admin/?demo=1`.

## Why it's hard (the reason it's deferred)

A pixel diff is the **ultimate** flaky-test risk; half-doing it would violate the no-flaky
rule outright. Four problems have to be solved _before_ the first assertion is trustworthy:

1. **Determinism within a single frame.** Any animation mid-flight, a blinking caret, or an
   unsettled web font flips the diff. `boot()`'s inline animation-freeze is necessary but
   not sufficient — a screenshot also needs the mascot's idle _blink_ killed (the one motion
   the reduced-motion path deliberately keeps), text carets hidden, web-font load awaited
   (`document.fonts.ready`), the path-reveal disabled, and any audio/async UI settled. A
   dedicated `bootForSnapshot()` helper is the likely shape.
2. **Cross-platform rendering.** Chromium and WebKit anti-alias and hint text differently —
   that part is handled by per-project baselines. The real blocker is **macOS (Ross's
   laptop) vs Linux (CI)**: sub-pixel font rendering alone makes a Mac-captured baseline
   fail on the Linux renderer. The standard fix is to generate _and_ compare baselines only
   in a **single fixed environment** — the pinned Linux + Playwright Docker image that CI
   uses — never from the dev machine. This is the main infrastructure cost of the project.
3. **Baseline churn.** Baselines are committed binaries. During an active design phase every
   intentional visual tweak regenerates them and they must be eyeballed in the diff (heavier
   to review than text). Snapshots need scoping so a one-pixel brand-color change doesn't
   churn 18 images.
4. **Tolerance tuning.** Too tight → flaky; too loose → misses real regressions. Each
   surface needs its `maxDiffPixelRatio` calibrated.

## Proposed plan (when picked up)

1. Add `bootForSnapshot()` to `tests/e2e/_helpers.mjs`: `boot()` + kill the blink + hide
   carets + `await document.fonts.ready` + disable the path-reveal.
2. Add a `visual` Playwright project (or test tag) that runs **only** the snapshot specs, so
   the fast behavioral e2e tier stays independent of the slower, infra-bound visual tier.
3. Stand up the **Linux baseline pipeline**: a make-target that runs the suite inside
   `docker run mcr.microsoft.com/playwright:vX.Y.Z` to generate/update baselines, plus a
   matching CI job that compares against them. Document the update step prominently — devs
   must never run `--update-snapshots` on macOS (the baselines would be unusable in CI).
4. Prove determinism on **one** surface end-to-end (home at one width, through CI) before
   expanding to the full list above.
5. Set conservative tolerances and treat any flake as a defect to root-cause (per
   `CLAUDE.md`), never as a tolerance to loosen.

## Decision log

- **2026-06-26** — Scoped alongside the API guard-reorder refactor. Deferred by Ross: the
  flakiness risk is too high to add right now. Captured here as a pickup-ready design;
  intentionally not implemented.
