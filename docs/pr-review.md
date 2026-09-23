# The PR gauntlet — this repo

Every PR here goes through the shared gauntlet in `~/.claude/pr-review.md`, reviewed by the shared
`pr-antagonist` definition in `~/.claude/agents/` (both from Ross's setup repo, since 2026-09-23,
setup #74). Under Codex CLI the reviewer is the shared role in `~/.codex/agents/`, spawned as
`~/.codex/AGENTS.md` states (setup #75). The process is the same in every repo, so this doc holds
none of it: it is the reviewer's brief for sano and nothing else.

## Reviewer brief

**What this repo is.** sano is Ross's Nepali study app at namastesano.com: plain HTML/CSS/JS with
no build step, plus a small PHP/MySQL sync API in `api/`. Ross tests on an iPhone
running iOS 26. Three facts make review here different:

- **A merge is a production deploy.** After Ross merges, the author runs `tools/deploy.sh`
  (`CLAUDE.md` workflow step 8) with no further ask. What merges reaches learners.
- **Most of the Nepali is AI-drafted and under review.** Every `dev`, dialogue `gloss`, unit
  `goal` and onboarding `L` string is Ross's draft, and a native speaker rules on the language.
  You are not the native speaker.
- **Learner state lives on the device.** `sano.state.v1` in localStorage is the working copy and
  syncs to the server. A change that strands a saved blob loses someone's progress.

Read `CLAUDE.md` first; `docs/architecture.md` and `docs/data-model.md` carry the detail it
points to. `js/data.js` and `js/grammar.js` are large: read the touched entries whole and their
consumers in `js/sano.js`, not the entire file.

**What to hunt, in order of severity** (before the shared definition's generic list):

- **Correctness in the learning engine.** The mastery gate (a unit unlocks only when every item
  has graduated), frames rotating in only after graduation, state schema compatibility (schema
  v3), sync revision handling, and the numeral rules (a numeral is silent and un-romanized
  wherever its glyph is the question). Also JS regexes that assume `\b` works on Devanagari, and
  clip ids that don't resolve to a file on disk.
- **The repo's laws.** They are load-bearing, not style:
  - **No external requests at runtime.** Any new off-origin `<link>`, `<script>`, `<img>`,
    `@import`, `url()` or `fetch()` is blocking. Grep the diff; don't take the author's word.
  - **AI-drafted strings are Ross's drafts.** A diff that changes a `dev`, a gloss, a `goal` or
    an onboarding `L` string without the PR body flagging it as Ross's own edit is a silent
    correction.
  - **Never store a raw IP**, and `sano-config.php` stays outside the docroot.
  - **`login.php` has exactly one failure response**: status, body, argon2id cost and rate-limit
    budget. The API guard order runs stateless checks before auth and `db()`; mutating requests
    need the CSRF header; `PUSH_HOSTS` changes land in both `api/lib.php` and
    `tools/send-reminders.php`; push click targets go through `safeTarget()`.
  - **iOS recording playback stays on the Web Audio API**, never `new Audio(url)`.
  - **Generated files are never hand-edited**: `js/glosses.js`, `js/en-glosses.js`,
    `js/characters.js`, `design/anim-characters.js`, `tools/tts/words.json`, and the `?v=`
    stamps. A diff to one without its generator's input changing is a defect.
  - **Audio**: new or re-spelled content needs its clips on disk and an `AUDIO_VERSION` bump;
    nothing renders audio at runtime.
  - **Theme tokens change in both blocks** (light and dark) of `css/sano.css`; shared-style
    changes are mirrored into `design/style-guide.html`; `prefers-reduced-motion` is respected.
  - **Deploy and schema**: a new public file must be on `tools/deploy.sh`'s allowlist; a new
    column that `login.php` or `state.php` SELECTs needs an idempotent `tools/migrate-*.php`,
    never a re-applied `schema.sql`.
  - **Every new user-facing feature has a one-click scenario in `tools/dev-seed.html`.**
  - **`CLAUDE.md` and `AGENTS.md` change together** in the same commit and say the same thing;
    `tests/data/agents-md.test.mjs` holds them to it.
  - **Task list**: the PR ticks its `T##` in `docs/todo.md` and archives the full record in
    `docs/todo-archived.md` in the same change. Nothing here closes on merge.
- **Tests that depend on chance.** The lesson builder makes real random draws, and `boot()`
  stubs `Math.random` with a seeded PRNG (T39). An e2e assertion that depends on an unseeded
  draw, a fixed timeout, a retry used as a fix, or a click fired mid-scroll is a defect.
- **Docs currency, sano's usual misses**: counts in the docs (items, frames, glossed words), a
  new helper missing from `docs/architecture.md`, and a shape `docs/data-model.md` no longer
  describes.

**Checks before asking for a PR** (the flow's step 1): `tools/format.sh`, then
`node tools/stamp-version.mjs`, then `tools/test.sh`, which runs every tier.

**How to verify.** You may run `tools/test.sh` with `--static`, `--unit`, `--data` or `--api`, a
single e2e spec with `npx playwright test <file>`, and `tools/format.sh --check`. The `--api` tier
is safe to run: its guard specs hit a local `php -S` with no `sano-config.php`, so they never
reach a database, and the integration spec skips without `SANO_TEST_DB`. `tools/format.sh`
without `--check` and `tools/stamp-version.mjs` rewrite files: if you run one to show a stale
stamp or unformatted file, restore what it changed.

**Off limits.** `tools/deploy.sh`, the `sano-deploy` SSH alias, and anything on the server,
including the live database, `tools/migrate-*.php`, `tools/make-user.php`,
`tools/send-reminders.php` and `tools/ingest-traffic.php`. The paid renderers are off limits too:
`tools/tts/synth-app.mjs` (ElevenLabs) and `tools/dict/build-dictionary.mjs` (Anthropic). A
finding that needs any of them is a question for Ross.

**How findings are written here.**

- **Write Nepali in romanized form** in the review. Ross reads it in a client that mangles
  Devanagari.
- **A doubt about the Nepali itself** (a `dev` string, a gloss, a grammar claim) is a
  **question:** for Ross, who takes it to the native speaker. It is never a defect and never a
  reason to REQUEST CHANGES. What is yours: a note or doc whose prose contradicts its own
  examples, its own colouring, or the course data it cites.

**Blocking here**, beyond the shared list: a break in any law above, a correctness defect in the
learning engine, and a change that strands saved state.

**After a merge**, the author tells Ross what the merge ships. `tools/deploy.sh` sends only the
paths on its rsync list (`index.html`, `.htaccess`, the icons, `manifest.json`, `sw.js`, `css/`,
`js/`, `fonts/`, `audio/`, `api/`, `admin/`). A merge that touches none of them ships nothing,
and the deploy is skipped. Otherwise the report gives the deploy's result and the live cache check
(`CLAUDE.md` workflow step 8). A merge that needs a `tools/migrate-*.php` run says so first,
because the migration has to land before the code. A merge that changes
`tools/send-reminders.php` or `tools/ingest-traffic.php` says so too: `deploy.sh` doesn't carry
them, and the cron copy in `~/sano-tools/` stays stale until it is re-copied with `scp`.
