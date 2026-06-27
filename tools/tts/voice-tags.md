# Voice-acting tags for conversation audio

ElevenLabs v3 **audio tags** are voice-acting directions written in `[square brackets]` inside the
text sent to the TTS — e.g. `[whispers]`, `[laughs]`, `[sad]`. They let Sano's single cloned voice
(and each companion's) shift emotion, pacing, and delivery line by line.

> **TODO (Ross):** go through the conversation scripts — `dialogue-scripts.md` first, then the
> matching lines in `js/dialogues.js` — and add voice directions where they sharpen the comedy or
> clarity (Pyaro excitable, Hiun flat, Thulo grandiose, …). After tagging, re-render the affected
> clips (`synth-app.mjs --dialogues --new`, or `--only <clipId>`) and bump `AUDIO_VERSION` in
> `js/audio.js`.

## How tags flow through sano

- **Author them inline in a dialogue line's Devanagari `dev`** (`js/dialogues.js`), placed right
  before the words they should affect:
  `dev: '[shouting] टाढा जाऊ! [out of breath]'`
- `tools/tts/synth-app.mjs --dialogues` sends `dev` **verbatim**, so the synth hears the tag; the
  render log flags clips that carry tags.
- The tags **never reach the app**: dialogues display the romanized `np`/`gloss`, never `dev`, and
  `SanoRomanize.stripTags()` removes `[...]` anywhere `dev` becomes text. A data test enforces that
  tags live only in `dev` (never in `np`/`gloss`/`en`). See `js/dialogues.js` → "AUDIO TAGS".
- Tags are language-agnostic performance cues — keep them in **English** even inside a Nepali line.

## Available tags

Eleven v3 interprets natural-language directions, so this is **not a fixed list** — descriptive
variants work too (`[laughs]`, `[laughs softly]`, `[laughs harder]`, `[out of breath]`). The set
below is from the ElevenLabs v3 audio-tags announcement (source at the bottom); treat it as
representative, not exhaustive.

### Emotion / tone

`[sad]` · `[angry]` · `[happily]` · `[sorrowful]` · `[excited]` · `[tired]` · `[awe]` ·
`[dramatic tone]` · `[sarcastic]`

### Human reactions / non-verbal

`[laughs]` · `[laughs softly]` · `[sighs]` / `[sigh]` · `[whispers]` / `[whisper]` ·
`[clears throat]`

### Delivery / pacing

`[shouts]` / `[shouting]` · `[pause]` · `[rushed]` · `[drawn out]` · `[interrupting]` ·
`[overlapping]`

### Accents / character voice

`[<x> accent]` — substitute the accent, e.g. `[French accent]`, `[American accent]`,
`[British accent]`, `[Southern US accent]` · `[pirate voice]`

### Sound effects

`[gunshot]` · `[clapping]` · `[explosion]`

## Tips

- **Place a tag right before the words it should affect** — it shapes delivery from that point on.
- **Combine tags** within a line or even a sentence (`[sad] … [sighs] …`).
- **Punctuation and CAPS still help** — `…` for a trailing pause, CAPS for emphasis — alongside tags.
- **Match the tag to the character** (`CHARACTER_PERSONAS` in `js/dialogues.js`).
- **If a tag is ignored**, the lever is voice **stability**: v3 follows tags best at lower stability
  ("Creative"/"Natural"); "Robust" tends to ignore them. `synth-app.mjs` currently sends no
  `voice_settings` (so each voice uses its default) — add a lower-stability `voice_settings` to the
  request body if directions feel flat. (Tuning note; not needed until we hear a problem.)

## Source

ElevenLabs — _"Prompting Eleven v3 (alpha): Audio Tags"_ — <https://elevenlabs.io/blog/v3-audiotags>
(the ElevenLabs docs carry the current, fuller list). Fetched 2026-06-27.
