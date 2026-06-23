# RESEARCH.md — Upgrading Sano's spoken Nepali

Research on how to **dramatically improve the quality of Sano's TTS Nepali audio** and deliver **11 distinct voices across genders** without paying live voice actors to record every line. Free options and one+ paid option, each with pros/cons and a recommendation.

_Researched 2026-06-20. Pricing/voice lists move fast — re-check the linked pages before committing. Sources at the bottom._

---

## Decision — 2026-06-20

Ross's answers: **hosted API only · clone ~11 real native speakers · character voices first · build the bake-off now.** Deeper checks then narrowed the field hard:

- **Hosted + voice cloning + Nepali → essentially ElevenLabs (Eleven v3) alone.** v3's language list explicitly includes **Nepali (`nep`)**; its predecessor `multilingual_v2` does **not**, so we must use **v3**. Cloning is done in the ElevenLabs **dashboard** (sample → `voice_id`); we script only synthesis.
- **Sarvam is out for Nepali** — Bulbul TTS covers 11 Indian languages and **Nepali is not one** (Sarvam's Nepali is speech-to-_text_ only).
- **Resemble's hosted zero-shot cloning is 23 languages, Nepali not among them** (its 100-language "Localize" is a separate dubbing product, not zero-shot cloning); **Fish Audio** and **Google** have no Nepali; Azure/Edge expose only 2 fixed Nepali voices, no cloning.
- **Caveat:** Nepali is low-resource for ElevenLabs, so v3's Nepali quality is **unproven** — the bake-off exists to settle it. If it underwhelms, the only true-cloning fallback is **self-hosted Chatterbox-Nepali**, which means relaxing "hosted only" to run it on a **rented cloud GPU** (no local box needed).

**Built:** `tools/tts/` — a runnable bake-off (`phrases.mjs` = 12 hard-sound phrases, `eleven.mjs` = ElevenLabs synthesis CLI, `build-compare.mjs` = A/B page, `README.md`). **Blocked on two inputs from Ross:** an ElevenLabs **API key** (v3 access) and at least one native Nepali **sample cloned to a `voice_id`** in the dashboard.

---

## 1. Goal & hard constraints

- **Quality:** today's audio is **Piper** (`ne_NP-google-medium`, 18 speakers, all female,
     - `ne_NP-chitwan-medium`). Robotic/flat; we want a clear jump in naturalness.
- **11 voices, mixed gender:** one per character (Sano + the 10 companions). They must be **distinct** and read as different people.
- **No voice actors reading lines.** We will not record ~500 lines × 11 people. Ross _can_ easily supply **short native-speaker samples** (a few seconds to ~2 min each) — and that single fact unlocks **voice cloning** as the highest-fidelity route (clone a sample once, synthesize every line in that voice).
- **Devanagari is the input.** Every good Nepali TTS phonemizes from Devanagari, so this work sits **on top of F2** (the `dev` field per item). Romanized `pron` is not a usable TTS input.

### The architecture point that widens our options

All audio is **pre-rendered offline** into self-hosted `audio/<voice>/<id>.mp3` and cached by the service worker. **Nothing calls a TTS service at runtime.** So the "no external requests at runtime" rule (CLAUDE.md) does **not** rule out a paid cloud API — we'd only ever ship static MP3s. The generator is a build-time tool; it can be anything. This means **cost is essentially a non-factor** (see §5): our entire corpus is small enough that even premium APIs cost tens of dollars, and the open models are free. **Decide on quality, voice-count, licensing, and effort — not price.**

---

## 2. The decision that shapes everything: how do you get 11 voices?

Nepali is low-resource, so the big cloud engines expose **at most one or two** built-in Nepali voices. You cannot get 11 distinct voices by "picking from a list." There are only three ways:

| Route | How it makes 11 voices | Needs samples? | Best engines |
| --- | --- | --- | --- |
| **(a) Voice cloning** | Clone 11 reference clips → 11 voices | Yes (short, easy) | Chatterbox-Nepali, ElevenLabs, F5/XTTS |
| **(b) Description / preset control** | Pick from many built-in voices, or describe each (gender, pitch, pace, accent) | No (optional) | **Indic Parler-TTS (69 voices)** |
| **(c) Custom-voice training** | Train one model per voice from recordings | Lots (30 min–3 h each) | Azure Custom Neural Voice — impractical here |

Because Ross can supply samples, **(a) cloning is the highest-fidelity path** and **(b) is the strong no-cloning fallback**. **(c) is out** (gated, heavy recording per voice, costly hosting). Fixed-voice engines (Edge/Azure built-ins, Sarvam) are great _per voice_ but can't reach 11.

---

## 3. Free / open-source options

### 3.1 Chatterbox-Nepali — `officialuser/chatterbox-nepali` ⭐ primary free + cloning

A community **fine-tune of Resemble AI's Chatterbox-Multilingual-500M** specifically for Nepali (the model Ross linked).

- **Cloning:** zero-shot from a reference WAV — exactly our 11-voices mechanism.
- **Nepali + Devanagari:** trained on a Nepali dataset; notes mention explicit **Devanagari script fixes** in the training logic.
- **License: MIT** (both the base Chatterbox and this fine-tune) — commercial-safe.
- **Run it:** needs the author's **custom GitHub implementation** (not stock `chatterbox-tts` alone), `pip install chatterbox-tts`, a **CUDA GPU**, production checkpoint `t3_mtl_nepali_final.safetensors`.
- **Watermark:** Chatterbox embeds Resemble's imperceptible "Perth" neural watermark in every output. Inaudible and survives MP3 — harmless for us, worth knowing.

**Pros:** purpose-built for our exact need (Nepali + cloning + Devanagari); MIT; free; one model → all 11 voices from samples; emotion-exaggeration control could add character flavor. **Cons:** **quality is unproven** — no published metrics or curated samples, training data undocumented (hours/speakers unknown); a community fine-tune (bus-factor 1, may need code fixes); requires a GPU and some Python plumbing. **Must be ear-tested before committing.** _Also check whether Resemble's official Chatterbox "Single Language Pack" has since added a vetted Nepali — that would be more robust than a community checkpoint._

### 3.2 Indic Parler-TTS — `ai4bharat/indic-parler-tts` ⭐ primary free, no cloning needed

From **AI4Bharat + Hugging Face** — a serious, well-documented lab model, not a hobby fine-tune.

- **Nepali is officially supported** (1 of 21 Indic languages).
- **69 built-in voices** across languages, with **recommended named speakers per language** — so multiple distinct Nepali voices out of the box.
- **Description-controlled:** you steer each voice with a text prompt ("A female speaker, warm and animated, moderate pace…") — a clean way to design 11 deliberately different characters.
- **Emotion prompts for Nepali** (Happy, Sad, Conversation, Narration, Anger, Surprise…) — a real asset for the two-character **dialogues** (SR-01).
- **License: Apache-2.0** — the most permissive here.
- **Run it:** Hugging Face `transformers`, GPU recommended. No reference audio required (though samples can guide which described voice to match).

**Pros:** Nepali from a reputable lab with **known training data**; Apache-2.0; many voices + description control + **emotion** without needing samples; strong fit for dialogue. **Cons:** **not audio-cloning** — voices are designed/described, not "this exact person," so distinctness depends on prompt craft; per-line prosody can vary; GPU + Python. **Strongest free fallback, and possibly the better _starting_ point because it doesn't depend on sample quality.**

### 3.3 Edge TTS — `rany2/edge-tts` — high quality, but two voices and a ToS cloud

Free CLI that drives **Microsoft Edge's** online neural voices. Nepali: **`ne-NP-HemkalaNeural`** (female) + **`ne-NP-SagarNeural`** (male) — genuinely good Azure neural quality, free.

**Pros:** excellent naturalness, zero setup, no GPU. **Cons (disqualifying for 11 voices):** **only 2 Nepali voices**, **no cloning** (pitch/rate tweaks won't fake 9 more believable people); and it's a **reverse-engineered, undocumented Microsoft endpoint** — fine for personal tinkering, but **using it to generate assets for a public app violates Microsoft's ToS** (the wrapper is GPL-v3, but Microsoft's terms are the binding constraint; the licensed path is Azure, §4.3). **Useful only as a quick quality yardstick, not a shipping source.**

### 3.4 Piper (current baseline)

Fully offline, CPU, fast, permissive. **All Nepali voices are female**, the only public male Nepali voices are separate community VITS checkpoints, and naturalness is the weak point we're trying to leave behind. Keep as the offline fallback / what we're measuring against.

### 3.5 F5-TTS and XTTS-v2 — capable cloners, but not for Nepali today

- **F5-TTS:** excellent open zero-shot cloner, but **no ready Nepali fine-tune** — base is English-only; we'd have to **train one ourselves** on Nepali data (real effort). Permissive base exists (`OpenF5-TTS-Base`). Revisit only if 3.1/3.2 disappoint and we want to invest.
- **XTTS-v2 (Coqui):** **no Nepali** (17 languages, Hindi yes), and the model is **non-commercial CPML** with **Coqui defunct** (no one to license it). Effectively out; a Hindi-as-Nepali hack would sound wrong.

---

## 4. Paid options

### 4.1 ElevenLabs ⭐ primary paid — top quality + cloning + Nepali

The premium pick for naturalness and the easiest 11-voice cloning.

- **Nepali:** confirmed in **Eleven v3**'s language list (`nep`; v3 covers 70+ languages). The older **`multilingual_v2` does not list Nepali**, so synthesize with **v3**.
- **Cloning:** **Instant Voice Cloning** (Starter, $5/mo) and **Professional Voice Cloning** (Creator, $11/mo) — clone 11 native samples → 11 voices; a clone can speak any supported language. **Commercial license from Starter up.**
- **Pricing:** free 10k chars/mo; Starter $5/mo 30k; Creator $11/mo 100k; Pro $99/mo 500k (credits ≈ characters).

**Pros:** best-in-class quality and prosody; trivial 11-voice cloning across genders; hosted (no GPU/ML ops); commercial-safe. **Cons:** paid (small for us — §5); Nepali is lower-resource for them so **accent/quality should be ear-checked on the free tier first**, ideally cloning from **native Nepali samples** (not English voices) for an authentic accent; voices live in their account (fine, since we export MP3s). **Best choice if you want maximum quality with minimum engineering.**

### 4.2 Sarvam AI — "Bulbul" — ❌ no Nepali TTS

A Bengaluru lab strong on South-Asian languages — but **Bulbul TTS covers 11 Indian languages and Nepali is not one of them** (Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, English). Sarvam _does_ offer Nepali **speech-to-text**, which is what generic "supports Nepali" claims point to — but **not** text-to-speech. **Ruled out for our purpose** despite being cheap (~₹30/10k chars) and otherwise pleasant; revisit only if Bulbul adds Nepali output.

### 4.3 Azure AI Speech (+ Custom Neural Voice) — the licensed Edge, but heavy

- **Built-in:** the **same Hemkala/Sagar** Nepali voices as Edge, but **properly licensed** (~$16 / 1M chars neural). Still **only 2 Nepali voices**.
- **Custom Neural Voice:** train your own voices — but **access is gated** (Responsible-AI application), each voice needs **300–2,000 recorded sentences** (30 min–3 h of audio — i.e. the voice-actor work we're avoiding), training up to ~$5k, **synthesis $24/1M**, and **endpoint hosting $4.04/model/hour (~$2,900/mo per always-on voice)**.

**Pros:** enterprise reliability; the licensed way to use the nice Hemkala/Sagar voices. **Cons:** **CNV is impractical here** (gated + per-voice recordings + punishing hosting cost × 11); built-ins are only 2 voices. **Use only if you specifically want the 2 licensed built-ins.**

### 4.4 Google Cloud TTS — ❌ no Nepali

Google's voice list **does not include Nepali (ne-NP)** at all. Ruled out regardless of quality.

---

## 5. Cost at Sano's actual scale (small)

Rough corpus: ~476 items + dialogue/sound lines, avg ~30–40 Devanagari chars. A **single voice covering all items ≈ 15–20k chars**; **11 character voices doing their own dialogue lines ≈ 40–60k chars**. Call the whole project **well under ~250k characters** even generously.

- **ElevenLabs:** ~$11 (Creator, one month) to ~$99 (Pro, one month) — one-time-ish.
- **Sarvam:** ~$9, or **$0** within the ₹1,000 free credits.
- **Azure built-ins:** a few dollars.
- **Chatterbox-Nepali / Indic Parler:** **$0** software; a few dollars of rented GPU or free Colab; real cost is **engineering + quality iteration time**.

**Takeaway:** price doesn't decide this. Quality, voice distinctness, licensing/ToS, and effort do.

---

## 6. Side-by-side

| Option | Nepali? | 11 voices? | Cloning | License / ToS | $ (our scale) | GPU/host | Quality (expected) | Fit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Chatterbox-Nepali** | ✅ (Devanagari) | ✅ via clone | ✅ zero-shot | **MIT** | Free | Local GPU | ❓ unproven | ⭐ free+clone |
| **Indic Parler-TTS** | ✅ official | ✅ 69 voices/describe | ❌ (described) | **Apache-2.0** | Free | Local GPU | 🟢 good, lab-backed | ⭐ free, no samples |
| Edge TTS | ✅ 2 voices | ❌ | ❌ | ToS-gray (unofficial MS) | Free | None | 🟢 high | yardstick only |
| Piper (now) | ✅ female-only | ⚠️ limited | ❌ | Permissive | Free | CPU | 🟠 robotic | baseline |
| F5-TTS | ⚠️ DIY train | ✅ via clone | ✅ | Permissive base | Free | Local GPU | 🟢 if trained | high-effort |
| XTTS-v2 | ❌ | ✅ via clone | ✅ | **Non-commercial** | Free | Local GPU | 🟢 | ❌ no Nepali/license |
| **ElevenLabs (v3)** | ✅ (v3 only) | ✅ via clone | ✅ instant+pro | Commercial OK | ~$11–99 | Hosted | 🟢🟢 best (Nepali unproven) | ⭐ the hosted path |
| Sarvam Bulbul | ❌ (STT only) | — | ❌ | — | — | Hosted | — | ❌ no Nepali TTS |
| Azure CNV | ⚠️ built-ins=2 | ⚠️ via training | ❌ (train) | Commercial OK | $$$ hosting | Hosted | 🟢🟢 | impractical |
| Google TTS | ❌ | — | — | — | — | — | — | ❌ no Nepali |

---

## 7. Recommendation & suggested plan

_Per the 2026-06-20 decision (hosted-only), the live plan is the **ElevenLabs v3** path in the Decision block at the top; the broader recommendation below stands if that constraint is relaxed (e.g. self-hosted Chatterbox-Nepali on a cloud GPU)._

**Frame:** the labor-saver is **cloning from short samples** (or describing voices), not recording lines. Two realistic finalists plus a premium escape hatch:

1. **Lead free path — Indic Parler-TTS _or_ Chatterbox-Nepali.**
      - **Indic Parler-TTS** is the safer first bet: reputable lab, Apache-2.0, documented Nepali, many voices + **emotion** for dialogues, and it **doesn't depend on sample quality**.
      - **Chatterbox-Nepali** wins if its quality holds up, because **true cloning** from native samples gives the most authentic, most distinct 11 voices, and it's MIT.
2. **Premium escape hatch — ElevenLabs.** If both open models underwhelm on naturalness, clone the 11 samples here for the best quality at trivial cost and zero ML-ops.

**Proposed sequencing**

- **Phase 0 — Devanagari (F2).** Finish/verify `dev` for the items we'll voice. Prerequisite.
- **Phase 1 — Bake-off (reuse the 2026-06-19 pattern).** Same **8–10 phrases**, generated through: **Chatterbox-Nepali** (cloned from 1–2 native samples), **Indic Parler-TTS** (2–3 described voices), **ElevenLabs** (1 clone), **Sarvam** (1 preset), plus current **Piper** as the baseline. Ship a self-contained `compare.html` for Ross to A/B on the phone. Pick a winner for quality + Nepali accent.
- **Phase 2 — Design the 11 voices.** Map a voice to each character (gender, age, energy). For cloning: collect 11 short native clips. For Parler: write 11 voice descriptions / pick 11 recommended speakers. Render a small **gallery** (one shared phrase in all 11) → confirm they read as distinct.
- **Phase 3 — Batch-generate** all lines per voice → `audio/<voice>/<id>.mp3`, loudness-normalize, encode MP3, wire into `js/characters.js` / dialogue playback, SW-cache. No runtime API calls.

---

## 8. Open decisions (questions for Ross)

1. **Where do we generate?** Is a **CUDA GPU** available (local box, or OK to rent cloud GPU / use Colab for a few dollars), or should we avoid running models locally and lean on a **hosted API** (ElevenLabs/Sarvam)? This is the biggest fork.
2. **Free/open vs paid-hosted first?** Cost is negligible either way — do you want to invest a bit of engineering in a **free self-hosted** pipeline (Chatterbox-Nepali / Indic Parler), or prefer **least-effort top quality** (ElevenLabs) from the start?
3. **Cloning real people vs designed voices?** Clone **11 real native speakers** (max authenticity; you gather ~11 short clips, with their permission/likeness), or **synthesize designed/preset voices** (Parler descriptions / preset speakers — no real-person likeness)?
4. **Scope first pass.** Re-voice **everything** (replace the full default voice + add 11 character voices), or start with **just the 11 character voices** for dialogues/companions and keep today's default audio until the new pipeline is proven?

---

## 9. Mapping voices to the characters

- Sano the mouse (bxXWfqokkbsD3S7PPjUx): Female. Lively, based in Kathmandu. Using live audio clone.
- Pyaro the red panda (cTnqh1Daui2JhvWlVQGC): Male. From Kathmandu. Speaks excitedly. Neutral otherwise.
- Rangin the danphe (yiYB6wyWboWEOt52vuJ6): Male. Flitting through words. Distracted. Frantic.
- Bahadur the Bengal tiger (1adWuJ6CHzVMDg1XyhYS): Female. Terai accent, with more Hindu-inflection. Speaks like she's smiling. Mischievous and playful. Languorous.
- Gyani the Asian elephant (vTgg1b2Eauo5efIcWup5): Female. Older, with a wheezing, trumpeting voice. Speaks at a brisk clip, like she has other things to do.
- Thulo the one-horned rhinoceros (MW558bGi5hBsE33qo9Rw): Male. Slow and deep. Sounds old but still strong. Thick, gravelly tone with a resonant, theatrical quality.
- Hiun the snow leopard (AUAZ2heBYCZwa6O95Ays): Female. Curt and cold. Matter of fact. On the quicker side.
- Shanta the yak (Kk1jouQWkqFRzsjKXdUl): Male. Tibetan, with a mid-to-low tone. Considered pace. Speaks like he isn't used to talking much.
- Chanchal the gray langur (c4fKke5dQ8qA3djIBGhb): Male. Quick and high-pitched. Younger. Impatient.
- Lamo the gharial (ci0ei6j6LoyKXZ0eHKaL): Female. Lower-pitched. Middle-aged. Smokers voice.
- Phurtilo the Himalayan tahr: Unused for now; no voice.

---

## Sources

- Edge TTS / voices & ToS: <https://github.com/rany2/edge-tts> · <https://learn.microsoft.com/en-us/answers/questions/2088770/are-opensource-edge-tts-free-for-commercial-use>
- Chatterbox (base): <https://github.com/resemble-ai/chatterbox> · <https://www.resemble.ai/learn/models/chatterbox-multilingual>
- Chatterbox-Nepali: <https://huggingface.co/officialuser/chatterbox-nepali>
- Indic Parler-TTS: <https://huggingface.co/ai4bharat/indic-parler-tts> · <https://www.marktechpost.com/2024/12/06/ai4bharat-and-hugging-face-released-indic-parler-tts-a-multimodal-text-to-speech-technology-for-multilingual-inclusivity-and-bridging-indias-linguistic-digital-divide/>
- IndicF5 (no Nepali): <https://huggingface.co/ai4bharat/IndicF5>
- F5-TTS: <https://github.com/SWivid/F5-TTS> · <https://huggingface.co/mrfakename/OpenF5-TTS-Base>
- XTTS-v2 + license: <https://huggingface.co/coqui/XTTS-v2> · <https://www.promptquorum.com/power-local-llm/local-tts-voice-cloning-piper-coqui-xtts>
- ElevenLabs: <https://elevenlabs.io/text-to-speech/nepali> · <https://elevenlabs.io/pricing>
- Sarvam AI (Bulbul): <https://www.sarvam.ai/apis/text-to-speech> · <https://www.sarvam.ai/api-pricing>
- Azure Custom Neural Voice: <https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-neural-voice>
- Google Cloud voices (no Nepali): <https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types>
- Nepali multi-speaker cloning (academic, low-resource): <https://arxiv.org/pdf/2601.18694>
