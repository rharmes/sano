# Sano — pedagogy-driven improvement roadmap

## Context
`PEDAGOGY.md` (just added) distills the second-language-acquisition / learning-science
consensus for teaching **conversational phrases** through an app. This plan applies it
to Sano as it actually exists today, and answers Ross's question about adding
Duolingo-style **two-character dialogues with comprehension questions**. Every
recommendation has a unique ID, is tied to a PEDAGOGY principle, and was confirmed
against current research (sources at the end).

This is a **menu of prioritized recommendations**, not a single feature to build now.
Nothing here is implemented yet — picking which IDs to pursue is the next step.

Constraints honored throughout: Romanized-Nepali strings and the 11 character
names/meanings are **Ross's drafts** (authoritative, not "corrected"); the app makes
**no external requests at runtime** (CLAUDE.md) — this directly shapes SR-02; `design/`
art is committed but never deployed.

## Where Sano already stands (so we don't reinvent it)
Sano is well past a blank slate — several PEDAGOGY principles are already live in
`js/sano.js` + `js/data.js`:
- **Spaced repetition** [§6]: a real Leitner system — `REVIEW_INTERVALS = [1,1,3,7,14]`,
  levels 0–4, `isDue()`/`dueItems()`, and a daily lesson that mixes new + most-overdue
  review (`startDailyLesson`, `buildExercises`).
- **Retrieval + production** [§4,§5]: four exercise types — `choice` (MC, both
  directions), `wordbank` (build-from-tiles), `type` (typed recall, edit-distance
  tolerant), `match` — and difficulty escalates with Leitner level.
- **Phrases as chunks** [§2]: 476 items / 36 units, including "Patterns:" sentence-frame
  units and a "Comprehension" unit.
- **Interleaving + habit** [§6,§7]: shuffles and mixes review across units; streak +
  daily push reminder; Duolingo-style unit path.

So the high-leverage moves are **not** "add SRS" or "add retrieval" — those exist. The
real gaps are three whole dimensions the app lacks entirely:
1. **No audio / no listening** — the single most consistent research-identified weakness
   of self-study apps. [§7,§8]
2. **No spoken output** — every exercise is tap or type. [§4]
3. **Phrases taught in isolation** — no conversational context or comprehension. [§1–3]

Latent asset: **11 paper-cut characters** (Sano + 10 companions — Pyaro, Bahadur, Gyani,
Hiun, Phurtilo, Chanchal, Thulo, Shanta, Rangin, Lamo) fully drawn/animated in
`design/characters.html`, but **only Sano is in the app today.**

## Verdict on the dialogue idea (Ross's question)
**Strongly recommended — it is SR-01.** Two-character dialogues with comprehension
questions are essentially Duolingo "Stories," and peer-reviewed evidence (Jiang 2021,
*Foreign Language Annals*; the CALICO efficacy study; Brandy's *Review of Duolingo
Stories*) shows they measurably improve **reading + listening comprehension** and
**receptive/implicit** knowledge. For Sano it's a triple win: it teaches phrases in
communicative context (PEDAGOGY §1–3), it **reuses the UI that already exists**
(`.thread` / `.bubble.sano` / `.bubble.user` with `.np`/`.pron`/`.en`, used decoratively
on the home screen, reminder modal, and onboarding), and it finally gives the 10
companion characters a job. One caveat: dialogues are far more powerful **voiced**, so it
pairs naturally with SR-02.

## Foundation — do these first (F1–F3)
Groundwork that precedes the SR features. Ross wants a solid base to build from.

- [x] **F1 — Refresh CLAUDE.md + the style guide (DO FIRST).** Reconcile the docs with reality
  before building anything else. CLAUDE.md undersells the pedagogy — the app already has a
  real **Leitner SRS** and **four exercise types with difficulty escalation** (see "Where
  Sano already stands"); also add the audio/TTS direction. Sync `design/style-guide.html`
  per the standing style-guide-sync rule (it predates onboarding, reminders, and the new
  day/night theme switch).
- [x] **F2 — Add Devanagari to every item in `js/data.js`.** *(draft injected; pending verification)* A new *additive* `dev` field per
  item (~476 items) + dialogue lines; romanized `np`/`pron` stay (Ross's drafts). This is a
  **hard prerequisite for all audio** (SR-02/03/08 — every Nepali TTS needs Devanagari
  input) and the data layer for SR-11. Spellings need Ross's verification.
- [x] **F3 — Rewrite README.md** *(README was already accurate; fixed stale refs + added a PEDAGOGY.md pointer)* to describe the app accurately: architecture (static
  HTML/CSS/JS + PHP/MySQL `api/`, PWA, offline-first localStorage + sync) and the *real*
  pedagogy (Leitner SRS, four escalating exercise types, daily new+review mix, streak) —
  more sophisticated than today's README conveys. Source from CLAUDE.md + PEDAGOGY.md.

## Recommendations (priority order — the ID number IS the priority rank)

| ✓ | ID | Recommendation | PEDAGOGY | Effort | Depends on |
|---|----|----------------|----------|--------|------------|
| ✅ | **SR-01** | Two-character dialogues + comprehension questions *(5 voiced dialogues from existing phrases — one per path section; reveal-one-bubble-at-a-time + autoplay; character heads beside bubbles)* | §1–3 | M–H | — (better with SR-02) |
| ✅ | **SR-02** | Self-hosted phrase & dialogue audio *(phrase audio shipped — 476 clips, Piper google spk 0; dialogue lines ride on SR-01; per-character voices = TODO)* | §7,§8 | H | — |
| ✅ | **SR-03** | Listening exercises ("tap/type what you hear") *(audio-only prompt on ~half of recall reviews; choose-meaning + type variants)* | §7,§8 | M | SR-02 |
| ⬜ | **SR-04** | Speaking practice (speak-before-reveal + record/compare) | §4 | M | SR-02 |
| ⬜ | **SR-05** | Evolve Leitner → per-item graded scheduler | §6 | M | — |
| ✅ | **SR-06** | Communicative "can-do" goals & progress framing *(per-unit goals on the home CTA + complete screen; path labels left alone for layout safety; goal strings AI-drafted, Ross to refine)* | §1,§9 | L–M | — |
| 🟡 | **SR-07** | Bring the 10 companions into the app *(heads now in dialogue bubbles via js/characters.js + the ported companion palette; full-body / animated section hosts = follow-up)* | §9 | L–M | SR-01 |
| ⬜ | **SR-08** | Pronunciation coaching for Nepali sounds | §4,§8 | M | SR-02 |
| ✅ | **SR-09** | Mindful gamification (streak freeze, no guilt) *(forgives one missed day, earns at 5-day milestones; home "freeze ready" notice + complete-screen "freeze used"; existing copy already gentle)* | §7,§9 | L | — |
| ⬜ | **SR-10** | Placement / skip-ahead for experienced learners | §9 | L | — |
| ⬜ | **SR-11** | Optional Devanagari script track | §8 | H | — |

### SR-01 — Two-character dialogue lessons with comprehension questions
**What:** A new lesson genre: a short scripted exchange between two characters (e.g. Sano
greets a shopkeeper companion), shown as stacked speech bubbles, followed by 2–4
comprehension questions ("What did Sano want to buy?", "What's the best reply?").
**Why:** Phrases in communicative context = comprehensible input + chunks + can-do, the
PEDAGOGY §1–3 core; comprehension questions add retrieval [§5]. Validated by Duolingo
Stories research.
**Where:** new `kind: 'dialogue'` units (or a `DIALOGUES` array) in `js/data.js` — each
`{ id, goal, cast:{A,B→characterId}, lines:[{speaker,np,pron,en,audio?}],
questions:[{q,choices,answer}] }`; a `dialogue` exercise type wired into
`renderExercise`/`buildExercises` in `js/sano.js`; reuse the existing `.thread`/`.bubble`
markup + `css/sano.css` bubble styles and the `choice` UI for questions. Ships text-first;
gains voice from SR-02.

### SR-02 — Self-hosted phrase & dialogue audio
**What:** A native-speaker (or vetted high-quality TTS) recording for every phrase and
dialogue line, with a play button on prompts, dictionary rows, and bubbles.
**Why:** The biggest gap. Listening is the foundational input channel; romanization is
*not* pronunciation, so audio is the only authoritative model [§8]. Self-study apps most
under-build the ear — Sano currently has *zero* audio.
**Where:** pre-generate files into an `audio/` dir (one per item id), served same-origin
and cached by `sw.js` — **must be pre-rendered, never a runtime TTS call** (CLAUDE.md
"no external requests at runtime"; mirrors how fonts ship as self-hosted woff2). Decision
to make: **recorded native speaker vs. batch Nepali TTS** (quality/licensing/voice) — the
main open question; flag to Ross.

### SR-03 — Listening exercises ("tap/type what you hear")
**What:** Play audio, learner selects/types what they heard; an audio-only `choice`/`type`
variant.
**Why:** Duolingo's highest-value exercise type; directly targets the listening lag the
efficacy studies flag. Needs SR-02.
**Where:** add a `listen` flag/type in `buildExercises`; reuse `renderChoice`/`renderType`
with the prompt replaced by an audio button.

### SR-04 — Speaking / output practice
**What:** Two low-risk forms: (a) "say it aloud" beat before the answer reveals
(Pimsleur anticipation), and (b) **record-and-compare** — record yourself, play back
against the SR-02 model. **Honest scope:** true automatic pronunciation *scoring* for
romanized Nepali isn't feasible (browser SpeechRecognition has no Nepali; romanization
isn't a real orthography) — so self-compare, not a grade.
**Why:** Output causes acquisition (Swain) and builds confidence [§4]; ASR research
supports speaking practice but warns it's weak for non-major languages — hence the
self-compare framing.
**Where:** new optional step in the lesson flow; `MediaRecorder` for capture; depends on
SR-02 for the model audio.

### SR-05 — Evolve the Leitner box into a per-item graded scheduler
**What:** Replace the coarse 5-bucket, one-move-per-lesson Leitner with per-item
ease/interval and **graded** recall (e.g. again/hard/good/easy), so strong items stretch
out and weak items get more reps. SM-2-lite is the pragmatic target; full FSRS (an ML
model) is overkill here but validates the direction (~20–30% fewer reviews for equal
retention).
**Why:** [§6] — refines an already-good system; better-timed reviews = more retention per
minute.
**Where:** the spaced-repetition block in `js/sano.js` (`REVIEW_INTERVALS`, `isDue`,
`overdueDays`, the level-adjust logic in `applyAnswer`/`finishMatch`); per-item fields
already exist on the state record (`level`, `lastSeen`, `seen`, `correct`).

### SR-06 — Communicative "can-do" goals & progress framing
**What:** Tag units/dialogues with a real-world goal ("You can order dal bhat," "You can
ask for directions") and express progress as **unlocked conversations**, not word counts.
**Why:** CEFR/ACTFL can-do framing + motivation [§1,§9]; pairs perfectly with SR-01 (each
dialogue *is* a can-do scenario).
**Where:** add a `goal` field per unit in `js/data.js`; surface it on the path label
(`renderPath`) and the complete screen (`finishLesson`).

### SR-07 — Bring the 10 companions into the app
**What:** Promote the companion SVGs from `design/characters.html` into the app as the
SR-01 dialogue cast and/or per-section hosts (a different friend introduces each topic).
**Why:** Activates a finished, on-brand asset and adds variety/delight [§9]. Names/meanings
stay Ross's drafts.
**Where:** extract the instrumented SVGs (the `design/build-anim-characters.mjs` generator
pattern already exists) into an app-usable form; render in dialogue bubbles. Mostly
enabled by SR-01 — a dialogue can launch with just Sano + one companion.

### SR-08 — Pronunciation coaching for the sounds romanization hides
**What:** A focused "listen & repeat" mode that flags Nepali contrasts the Latin spelling
flattens — aspirated vs. unaspirated, retroflex vs. dental, nasalization.
**Why:** [§4,§8] — these distinctions are meaning-bearing in Nepali and invisible in
`pron`; audio + repetition is the only fix. Rides on SR-02.
**Where:** a variant of SR-04's listen/repeat; optional annotations per item in `data.js`.

### SR-09 — Mindful gamification
**What:** Keep the streak (it's the strongest retention lever) but add a **streak
freeze**/forgiveness day, avoid guilt-tripping copy, and keep reminders gentle.
**Why:** [§7,§9] — streaks boost retention, but the research also documents anxiety,
pressure, and 3–4-month burnout; protect motivation and keep depth over addiction.
**Where:** streak logic in `registerActivity`/`finishLesson` (`js/sano.js`); reminder copy
in `js/push.js`.

### SR-10 — Placement / skip-ahead
**What:** Let a returning or already-competent learner test out of early units instead of
starting at "Namaste."
**Why:** Autonomy/competence [§9]; avoids boredom that drives churn.
**Where:** an onboarding branch (`js/onboarding.js`) that pre-marks items `intro:true` at a
chosen level; reuses the existing unit-unlock logic.

### SR-11 — Optional Devanagari script track (clearly optional)
**What:** Show Devanagari alongside the romanization and offer optional script-reading
practice — as an **opt-in track**, not a requirement.
**Why:** Romanization is a fine bridge for *speaking* but caps literacy; **honest caveat**
— the pedagogical evidence on transliteration-as-crutch is mixed, and script literacy is
arguably beyond a "conversational phrases" app's mission. Lowest priority by design.
**Where:** an optional `dev` field per item in `data.js`; a script toggle.

## Recommended sequencing
- **Phase 1 (headline):** SR-01 + SR-02 together — dialogues that launch *voiced*. This is
  the single biggest pedagogy upgrade and the most visible to users.
- **Phase 2 (the ear & mouth):** SR-03, then SR-04/SR-08 — turn the new audio into
  listening and speaking practice.
- **Phase 3 (sharpen + frame):** SR-05, SR-06, SR-07.
- **Phase 4 (polish/optional):** SR-09, SR-10, SR-11.

If audio sourcing (SR-02) stalls on the record-vs-TTS decision, ship **SR-01 text-first**
and backfill voice — dialogues improve reading comprehension on their own.

## Verification (when any item is built)
Follow the standard workflow (CLAUDE.md): `tools/format.sh`, `node tools/stamp-version.mjs`,
`node tools/check-viewports.mjs`, `tools/check-webkit.mjs` for any animation/audio-UI work,
then **serve on localhost and have Ross review before committing**; commit straight to
`main`, push only when asked. Feature-specific checks: SR-02 — confirm audio is same-origin
and SW-cached with **no runtime external request** (the existing live network discipline);
SR-01 — comprehension questions score and re-queue like other exercises; SR-05 — verify
review intervals lengthen/shorten per grade without breaking the v2 state schema (add a
migration if the record shape changes).

## Sources (validation for this plan; foundational refs live in PEDAGOGY.md)
- Duolingo Stories / dialogue + comprehension efficacy — Jiang et al. 2021, *Foreign
  Language Annals*: <https://onlinelibrary.wiley.com/doi/10.1111/flan.12600> · CALICO
  efficacy study: <https://utppublishing.com/doi/10.1558/cj.26704>
- Listening primacy for beginners — "Priority of Listening Comprehension over Speaking"
  (ERIC EJ1066407): <https://files.eric.ed.gov/fulltext/EJ1066407.pdf>
- ASR pronunciation feedback (and its limits for non-major languages) — Frontiers in
  Psychology 2023: <https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1210187/full>
  · *I Can Speak* (Taylor & Francis): <https://www.tandfonline.com/doi/full/10.1080/17501229.2024.2315101>
- Spaced-repetition state of the art (FSRS vs SM-2/Leitner) —
  <https://deepwiki.com/open-spaced-repetition/fsrs-optimizer/7.3-comparison-with-sm-2>
- Gamification/streaks — benefits and risks — StriveCloud:
  <https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo>
- Romanization is not pronunciation — Wiktionary transliteration/romanization note:
  <https://en.wiktionary.org/wiki/Wiktionary:Transliteration_and_romanization>

## Update 2026-06-19 — audio bake-off, voices, MMS attempt

- **Bake-off done.** Generated 5 Basics phrases (Namaste, Dhanyabad, Maaf garnuhos,
  Ke bhayo?, Subha prabhat) locally/offline with **Piper** `ne_NP-google-medium` (spk 0) +
  `ne_NP-chitwan-medium` (neural — espeak-ng used only as the phonemizer, never the voice)
  and **Apple `say` Lekha (hi_IN)** as a non-Nepali baseline. Delivered as a self-contained
  `compare.html` (embedded audio) for A/B. The prebuilt Piper macOS binary is broken (no
  dylibs); Piper runs via the `piper-tts` pip package in a venv (Python 3.14 has wheels).
- **MMS-TTS attempt → blocked.** `facebook/mms-tts-npi` and `-nep` both return **HTTP 401
  (gated)** — need an HF account/token to fetch; deferred unless we authenticate. MMS is
  also **single-speaker** (one Nepali voice), so not a source of many voices regardless.
- **11 per-character voices (Ross's requirement).** Realistic source is **Piper
  `ne_NP-google-medium` = 18 speakers** (≥ the 11 needed) + `chitwan` (a 19th) + optional
  pitch / `--length-scale` / `--noise-scale` tuning for more distinctness; community
  single-speaker Nepali VITS on HF can add more. **Next step:** render an 18-speaker
  gallery → pick 11 → map one voice to each character. Updates **SR-02** (audio is now a
  *set* of self-hosted voices, one per character) and **SR-07** (each companion speaks in
  its own voice in dialogues).
- **Voice gender (2026-06-19):** Piper's Nepali voices are **all female** (Google/openSLR —
  18 `google` speakers + `chitwan`). The only **public male** Nepali voices found are HF VITS
  models `tuskbyte/nepali_male_v1` and `procit001/nepali_male_v1` (need torch/transformers;
  may be the same underlying voice), plus female `procit001/nepali_female_v2`. Most other
  Nepali voices on HF are gated (401). The gallery now tags M/F (2 male, 20 female); for more
  male variety we'd need a gated-model token or recorded voices.
- **Devanagari** gates all of the above and is now **F2** (required groundwork), distinct
  from the optional learner-facing script track (**SR-11**).

## TODO — follow-ups
- [ ] **Assign a different voice to each character.** For now every character — and all
  phrase audio — uses a single default voice: **Piper `ne_NP-google-medium` · speaker 0**
  (Ross's pick, 2026-06-19). The audio layer is built voice-namespaced
  (`audio/<voiceId>/<id>.m4a` + a `voiceForCharacter()` map that currently points every
  character at `default`), so giving each character its own voice later is a data change +
  a re-render, not a rewrite. Pick the 11 voices from `design/voice-gallery.html`, map one
  per character, regenerate.
