# tools/tts — Nepali TTS bake-off & generation

Tooling for the audio-quality upgrade described in **`TTS.md`**. Not deployed (lives under
`tools/`). Generates spoken-Nepali clips through a **hosted** TTS API and assembles an A/B
page for judging quality on the phone.

Per the 2026-06-20 decision: **hosted API only**, **11 voices cloned from real native
speakers**, **character voices first**. With those constraints the only hosted engine that
does **Nepali + voice cloning** is **ElevenLabs (Eleven v3)** — so that's what this targets.
(Sarvam, Resemble's hosted cloning, Fish, and Google don't do Nepali; Azure/Edge have just
two fixed Nepali voices and no cloning. See TTS.md §3–4.)

## One-time setup

1. An **ElevenLabs** account with **Eleven v3** access; create an API key.
2. **Clone the voice(s) in the dashboard** (Voices → Add → Instant Voice Clone): upload a
   short native-speaker sample, name it, copy the resulting **`voice_id`**. We clone in the
   UI (reliable, drag-and-drop) and only script the synthesis.
3. Export the key for the shell session:
   ```sh
   export ELEVENLABS_API_KEY=sk_…
   ```

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
  `eleven_v3`], `--format` [default `mp3_44100_128`], `--out`).
- **`build-compare.mjs`** — assembles `design/tts-compare.html` from `audio/default/` +
  `design/_bakeoff/*`.

## After a winner is picked (production, later)

Map one cloned `voice_id` to each of the 11 characters, then batch-synthesize each
character's lines to `audio/<voice>/<id>.mp3`, loudness-normalize, and wire into
`js/characters.js` / dialogue playback. All audio stays **pre-rendered and self-hosted** —
the app never calls a TTS service at runtime (CLAUDE.md).
