# tools/tts — Nepali TTS bake-off & generation

Tooling for the audio-quality upgrade described in **`RESEARCH.md`**. Not deployed (lives under
`tools/`). Generates spoken-Nepali clips through a **hosted** TTS API and assembles an A/B
page for judging quality on the phone.

Per the 2026-06-20 decision: **hosted API only**, **11 voices cloned from real native
speakers**, **character voices first**. With those constraints the only hosted engine that
does **Nepali + voice cloning** is **ElevenLabs (Eleven v3)** — so that's what this targets.
(Sarvam, Resemble's hosted cloning, Fish, and Google don't do Nepali; Azure/Edge have just
two fixed Nepali voices and no cloning. See RESEARCH.md §3–4.)

## One-time setup

1. An **ElevenLabs** account with **Eleven v3** access; create an API key.
2. **Clone the voice(s) in the dashboard** (Voices → Add → Instant Voice Clone): upload a
   short native-speaker sample, name it, copy the resulting **`voice_id`**. We clone in the
   UI (reliable, drag-and-drop) and only script the synthesis.
3. Export the key for the shell session:
   ```sh
   export ELEVENLABS_API_KEY=sk_…
   ```

## Collecting clone samples

What you give ElevenLabs to clone each voice. We use **Instant Voice Cloning**, so each voice
needs only a short clip — not the hours a Professional clone wants, and nowhere near reading
every line.

**Length:** ~**1.5–2 minutes** of clean audio per voice. ElevenLabs says **don't exceed ~3
minutes** for instant cloning — more gives no gain and can make the clone worse. One clip per
character → **11 clips**. (For the first bake-off you only need **one** sample to start.)

**Record in Nepali, not English.** A clone carries the _accent and phonetics_ of its source
audio, so a native speaker reading **Nepali** is what yields an authentic Nepali accent out. An
English sample bleeds an English accent into the Nepali synthesis.

**Quality matters more than length:**

- One speaker only — no other voices, background noise, music, or echo/reverb.
- **Consistent energy** the whole clip (animated _or_ calm throughout; mixing destabilises the
  clone) — hold the persona you want for that character.
- Decent mic, quiet soft room; **MP3 ≥ 192 kbps or WAV**, mono, levels not clipping.

**What they should say:** natural, conversational Nepali in the character's tone — _not_ a flat
monotone (unless that character is a narrator), and _not_ the ~588 app phrases read back-to-back
(too choppy; the model wants connected speech). The easiest and best source is **extemporaneous
speech**: have each speaker talk naturally for ~2 minutes following a few prompts.

**Per character, before recording:** write a one-line persona (gender, age, energy) so the
sample is performed in the right tone, and keep the **same mic/room/style across all 11** so the
voices sit together as a cast.

### Optional: a shared prompt script

If you want every speaker covering the same ground (cleaner when A/B-ing voices side by side),
give them this prompt list rather than a rigid passage — natural delivery clones better than
stiff reading, and it keeps the Nepali wording in a native speaker's hands (the app's Nepali is
yours to own, so this README won't hand you unverified Nepali to read verbatim):

1. Greet, say your name, and where you're from.
2. Say what you do on a normal morning.
3. Name a few foods and drinks you like.
4. Describe a place or festival you love.
5. Count one to five, then say goodbye warmly.

Ask them to **work these words in naturally** so the clip exercises the sounds romanization
hides: धन्यवाद (dhanyabad), ठीक छ (thik cha), खाना (khana), घर (ghar), दूध (dudh), पाँच
(paanch), हुँदैन (hudaina), सञ्चै (sanchai). They cover aspirated ध/घ/ख, retroflex ठ, dental द,
nasalization (हुँ, पाँच), and the ञ ligature. (Want one _verbatim_ identical passage across all
11 instead? Have a native speaker write ~250 words hitting those same sounds — that keeps the
wording authoritative.)

## Run the bake-off

```sh
# Synthesize the 12 bake-off phrases through one cloned voice:
node tools/tts/eleven.mjs --voice <voice_id> --label anita
#   → design/_bakeoff/anita/<id>.mp3   (gitignored, never deployed)

# Repeat for any other voices/engines you want to compare, then build the page:
node tools/tts/build-compare.mjs
#   → design/tts-compare.html

# Serve and open on the phone (same Wi-Fi → use the Mac's LAN IP):
php -S 0.0.0.0:8000        # from the repo root
#   open http://<mac-ip>:8000/design/tts-compare.html
```

The compare page shows one card per phrase with a play button for **Piper (the current
voice, `audio/default/`)** and every voice you generated under `design/_bakeoff/`. The phrase
set (`phrases.mjs`) is weighted toward the sounds romanization hides — retroflex ठ/ट,
aspirated ध/घ/छ, chandrabindu nasalization (हुँ, पाँच), the ञ ligature, and one long
comma-list sentence — so a weak engine is obvious.

## Files

- **`phrases.mjs`** — the 12-phrase bake-off set (Devanagari snapshotted from `js/data.js`).
- **`eleven.mjs`** — ElevenLabs synthesis CLI (`--voice`, `--label`, `--model` [default
  `eleven_v3`], `--format` [default `mp3_44100_128`], `--out`, `--only <phrase-id>` to
  regenerate a single phrase).
- **`build-compare.mjs`** — assembles `design/tts-compare.html` from `audio/default/` +
  `design/_bakeoff/*`.

## Production audio (the shipped app voice)

The shipped audio is rendered through ElevenLabs in **Sano's cloned voice** (RESEARCH.md §9).
Two tools, run from the repo root with `ELEVENLABS_API_KEY` set:

- **`build-words.mjs`** — writes **`words.json`**, the per-word Devanagari map for word-bank
  tile audio (one entry per distinct tile-word). The tile romanization is derived from each
  phrase's `dev` via `js/romanize.js` (`romanize`), so it aligns 1:1 with the `dev` words by
  construction; a tiny `OVERRIDES` table covers the few words a non-space separator splits (e.g.
  `/`). Deterministic — re-run after editing `js/data.js`. Reviewable artifact: `words.json`.
  **Note:** the shipped `audio/words/*.mp3` are in sync with the derived slugs (re-rendered
  2026-06-27); after editing content, render only the new slugs with `synth-app.mjs --words --new`
  and bump `AUDIO_VERSION`.
- **`synth-app.mjs`** — renders the **real shipped** clips (not the bake-off dir). Pass one of
  `--sample | --phrases | --words | --dialogues`:
  - `--sample` → a small preview (tricky phrases + single words) into
    `design/_bakeoff/sano-sample/` with an `index.html`, to judge the voice before a full run.
  - `--phrases` → every `COURSE` item's `dev` → `audio/default/<id>.mp3` (~588).
  - `--words` → every `words.json` entry → `audio/words/<slug>.mp3` (~233).
  - `--dialogues` → every `DIALOGUES` line → `audio/<voice>/<clipId>.mp3`, routed to each
    speaker's voice folder (`sano` → `default`; `narrator`/`thornbush` mapped to a companion
    voice; a companion → its own id). A line's `dev` is sent **verbatim**, so inline ElevenLabs v3
    `[performance tags]` (e.g. `[whispers]`) are heard by the synth; the render log shows which
    clips carry tags. The tags stay out of the app — see `js/dialogues.js` (AUDIO TAGS).
  - `--new` (with `--phrases`/`--words`/`--dialogues`) → render only clips **not yet on disk** —
    the incremental path after adding course content or a dialogue.
  - `--only <id|slug>` (with `--phrases`/`--words`) → regenerate a single clip.
  - Defaults: Sano `--voice`, `eleven_v3`, `mp3_44100_128`.

After (re)rendering, bump **`AUDIO_VERSION`** in `js/audio.js` so caches/clients refetch.
`audio/` ships via the existing `audio` entry in `tools/deploy.sh`. All audio stays
**pre-rendered and self-hosted** — the app never calls a TTS service at runtime (CLAUDE.md).

Per-character voices (a planned follow-up) extend this: render each character's lines to
`audio/<voice>/<id>.mp3` and widen `voiceForCharacter()` in `js/audio.js`.
