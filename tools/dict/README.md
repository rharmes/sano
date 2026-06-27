# tools/dict — Nepali↔English ground-truth dictionary (local only)

Generates a frequency-ranked Nepali (Devanagari) → English dictionary, committed to the repo but
**never deployed** (`tools/` is outside `deploy.sh`'s allowlist). Two jobs:

1. **Ground truth** — an independent English gloss for every word the app teaches, so the AI-drafted
   COURSE translations can be checked. Disagreements are **flagged for Ross's review, never
   auto-corrected**.
2. **Expansion roadmap** — the highest-frequency everyday words the app doesn't yet cover.

Target: ~2,000 frequency lemmas (~90% conversational coverage) **plus** every ~588 COURSE word.

## How it works

A build-time pipeline (the "no external requests" rule is runtime-only; `tools/tts/synth-app.mjs`
already calls a vendor API at build time):

| Stage | What it does | Needs |
| --- | --- | --- |
| ACQUIRE | downloads the Leipzig Nepali frequency list (CC-BY-4.0) + the kaikki.org Wiktionary extract (CC-BY-SA) into `sources/` | network |
| LEMMATIZE | Claude collapses inflected tokens → lemmas, drops proper nouns/noise, tags register (everyday/formal/literary/rare) | `ANTHROPIC_API_KEY` |
| GLOSS | Claude glosses each lemma, cross-checked against Wiktionary → confidence + provenance | `ANTHROPIC_API_KEY` |
| MERGE+EMIT | union of (all COURSE words) + (register-weighted top-N lemmas) → `dictionary.json` + `coverage-report.md` | none (reads caches) |

Register-weighting tilts the ranking toward conversational speech, since Leipzig is news/web text
that over-represents formal vocabulary.

## Running it

```sh
# 1. Download sources (run once; updates sources.lock.json with pinned sha256s)
node tools/dict/build-dictionary.mjs --acquire

# 2. Preview a small subset first (cheap), then the full pipeline
ANTHROPIC_API_KEY=…  node tools/dict/build-dictionary.mjs            # acquire→lemmatize→gloss→emit

# Iterate without re-spending tokens:
node tools/dict/build-dictionary.mjs --report-only                  # rebuild artifacts from caches, NO API
ANTHROPIC_API_KEY=…  node tools/dict/build-dictionary.mjs --lemmatize --new   # only un-cached tokens
ANTHROPIC_API_KEY=…  node tools/dict/build-dictionary.mjs --gloss --only घर   # one lemma (debug)
```

### If the Leipzig download fails

The frequency stage needs the Leipzig Nepali word list. If `--acquire` reports it as unavailable,
the build degrades gracefully to **COURSE-only** (every app word still covered, no frequency
expansion). To add the expansion set, get the Leipzig data onto disk one of these ways:

- **Paste the exact link** from <https://wortschatz.uni-leipzig.de/en/download/Nepali> (pick a news
  or web corpus, e.g. the 100K/300K/1M tier):
  `node tools/dict/build-dictionary.mjs --acquire --leipzig-url '<the .tar.gz link>'`
- **Or download it in a browser** and drop the `.tar.gz` into `tools/dict/sources/`, then
  `--acquire` (it'll extract whatever archive is there).
- **Or** drop an already-extracted `*-words.txt` in as `tools/dict/sources/leipzig-words.txt`.

Then extend the dictionary (the ~588 COURSE words are cached → only new lemmas cost tokens):
`ANTHROPIC_API_KEY=… node tools/dict/build-dictionary.mjs --lemmatize --new --gloss --new && node tools/dict/build-dictionary.mjs --report-only`

Flags: `--top <N=2000>` `--pool <M>` `--model <claude-opus-4-8>` `--force` (ignore cache) `--refresh`
(re-download sources). Cost for a cold full run (~2000+588 lemmas, Opus 4.8) is single-digit dollars;
warm re-runs are ~free thanks to the `cache/` response cache. Bumping `PROMPT_VERSION` in
`build-dictionary.mjs` re-spends everything — do it deliberately.

## What's committed vs not

- **Committed:** `build-dictionary.mjs`, `lib/`, `sources.lock.json`, `dictionary.json`,
  `coverage-report.md`, this README. Validation lives in `tests/data/dictionary.test.mjs`
  (offline; runs under `tools/test.sh --data`; skips until `dictionary.json` is built).
- **Gitignored:** `sources/` (multi-MB raw corpora), `cache/` (Claude response cache + freq
  intermediate), `_sample/`.

## Attribution

- Frequency data: **Leipzig Corpora Collection** (Nepali), CC-BY-4.0 — wortschatz-leipzig.de.
- Glosses cross-checked against **Wiktionary** via kaikki.org, CC-BY-SA-4.0.
