# sano — Tasks

The project backlog. Claude keeps this current: every task Ross asks for — plus any suggestion Ross
agrees to, and anything discovered mid-work — is added here as an unchecked box with a unique `T<n>`
ID, and the box is ticked in place once the task is delivered. It's plain Markdown grouped by area,
so read or edit it by hand anytime. The items below wait on Ross (a review, a decision, or a
native-speaker check) — they aren't derivable from the code, so they're easy to lose if they leave
this list. Refer to any task by its ID (e.g. "T3").

## Dialogues & audio

- [ ] **T1 · Add voice tags to the conversations** — review `tools/tts/dialogue-scripts.md`, add
      ElevenLabs `[performance tags]` (list + pipeline: `tools/tts/voice-tags.md`), re-map changed
      lines into `js/dialogues.js`, and re-render their audio.
- [ ] **T2 · Re-render the reconciled greet-pyaro audio** — `greet-pyaro-01/-07/-10` lag the text
      after the `[shouting]`/"copying" edits in `bbe8024`; re-render (`synth-app.mjs --dialogues --only greet-pyaro-01` …)
      + bump `AUDIO_VERSION` once the edits settle. First confirm line-1 नक्कल गरिरहेको ("copying")
      with a native speaker.

## Content review

- [ ] **T3 · Review the dictionary's recommendations** (`tools/dict/`; flag-only, never
      auto-applied): COURSE translations it disagrees with (`tests/data/dictionary.test.mjs` / the
      `.review` entries in `dictionary.json`) and high-frequency missing words
      (`tools/dict/coverage-report.md`).
- [ ] **T4 · Merge the Devanagari review** — `design/devanagari-review.json` (gitignored) → the `dev`
      fields of `js/data.js` (in-session, no merge script), then clear the review file.

## Companion characters

- [ ] **T5 · Pick a direction per companion, then refine and wire them in** — review the paper-cut
      explorations in `design/characters.html` (5 directions each for the 10 animal companions), pick
      a favorite per animal, refine the chosen art, and wire it into Sano's conversation system. Names
      follow the Nepali trait-word convention (Sano = "small"); the Nepali is Ross's to confirm.
