# Data model + glossary — sano

> The data **shapes**, storage keys, DB tables, scheduler constants, and the
> feature-code glossary — so a session can skip reading `js/data.js` / `js/sano.js`.
> Load with `@docs/data-model.md`. File/function map is in `@docs/architecture.md`.
> Internal-only (not deployed).
>
> **AI-drafted strings are Ross's drafts:** every `np`/`pron`/`dev`/`gloss en` and per-unit
> `goal` is AI-drafted and under Ross's review — flag questions, never silently "correct" them.

## Course content — `COURSE` (js/data.js)

A unit:

```js
{ id, title, kind, goal, items, section?, after? }
// kind: 'phrases' | 'vocab'
// section: path-section banner label (optional)
// after:   anchor unit id for ordering (intermediate units sit next to what they build on)
```

An item (`kind: 'phrases'`):

```js
{ id, pron, dev, en, usage }
// dev = Devanagari (source of truth), en = English, usage = dictionary note, pron = pron guide
// NOTE: `np` (romanized) AND `pron` (pronunciation) are DERIVED at load from `dev` by
// js/romanize.js (romanize / pronounce; spec: docs/romanization.md). `np` was removed from the
// data; the stored `pron` remains only as a baseline and is overridden at load — it will be
// removed too, leaving just English + Devanagari.
```

An item (`kind: 'vocab'`) — carries an `emoji`, no `usage`:

```js
{ id, pron, dev, en, emoji } // np derived; pron stored-but-derived (see the note above)
```

Two verb units (`verbs-present`, `verbs-past`) and five intermediate units
(`modals-can-want-must`, `comparing-things`, `place-position`, `jobs-work`,
`duration-frequency`) extend the path by topic.

## Story dialogues — `DIALOGUES` (js/dialogues.js, schema v2)

```js
{ id, title, goal, section, after, cast, lines, questions }
// cast: companion ids in the story (excludes 'narrator'); after: anchor unit id
```

A line (inline, schema v2):

```js
{ who, np, dev, en, gloss }
// who: 'sano' | a companion id | 'narrator' | 'thornbush'
// gloss: ordered tappable segmentation of the romanized line (optional)
```

A gloss segment — the player renders romanization from these (each = one underlined,
tappable chunk); **`gloss.map(g => g.np).join(' ')` must equal `np`**:

```js
{ np, en }   // en: '' => plain, non-tappable text (e.g. an em-dash). No gloss => plain np (back-compat).
```

Only `greet-pyaro` is live; its `gloss` English is AI-drafted and awaits review. Per-line
audio is voiced per character; a head comes from `CHARACTER_HEADS[who]`.

## Pronunciation drills — `SOUND_TOPICS` (js/sounds.js, SR-08)

```js
{ id, after, glyph, title, sub, intro, tip, marks }
// marks: Devanagari characters to find in each item's `dev` to surface real examples
```

## Character art — js/characters.js (generated)

```js
CHARACTER_HEADS  = { [id]: '<svg viewBox="0 0 200 200">…</svg>' }  // dialogue + onboarding bubbles
CHARACTER_BODIES = { [id]: '<svg>…full body…</svg>' }              // decorative path companions
// ids: sano, pyaro, thulo, rangin, bahadur, gyani, hiun, chanchal, shanta, phurtilo, lamo
// SVGs use .f-* fill classes (in css/sano.css) + .part-* animation groups
```

## Progress state — localStorage `sano.state.v1` (schema version 2)

The working copy; the app stays usable offline/logged-out, and `SanoSync` mirrors it to the
server. Written via the `STATE_KEY` constant.

```js
{
  version: 2,
  name, onboarded,
  streak, streakFreezes,            // streakFreezes: forgiveness days, earned at 5-day marks, cap 2 (SR-09)
  lastActivityDay,                  // 'YYYY-MM-DD'
  itemsToday, itemsTotal,
  items: { [itemId]: record },
  dialoguesDone: { [dialogueId]: true },
  soundsDone:    { [soundTopicId]: true },
}
```

A per-item `record` (SM-2-lite; mutated by `scheduleReview`):

```js
{ seen, correct, ease, interval, lastSeen, intro }
// ease: starts 2.5, clamped [1.3, 2.7]   interval: days (0 = not introduced)
// lastSeen: 'YYYY-MM-DD'                  intro: true once seen
```

Legacy Leitner `level` records migrate to `interval`/`ease` on load (`migrateLegacyState`,
`migrateV1State`).

## Sync bookkeeping — localStorage `sano.sync.v1` (js/sync.js)

```js
{ revision, dirty, localModifiedAt, username, lastUsername, isAdmin }
```

## All localStorage keys

| Key | Owner | Purpose |
| --- | --- | --- |
| `sano.state.v1` | sano.js (`STATE_KEY`) | Progress state (above). |
| `sano.sync.v1` | sync.js | Sync metadata (above). |
| `sano.onboard.dismissed` | push.js (`DISMISS_KEY`) | Reminder-setup modal dismissed. |
| `name`, `streak`, `itemsCompletedToday`, `totalItemsCompleted`, `lastActivity`, `wordRecord` | — | **Legacy**, read once by `migrateLegacyState` then superseded. |

## Scheduler constants (js/sano.js)

| Const | Value | Meaning |
| --- | --- | --- |
| `LESSON_NEW_ITEMS` | 5 | New items per unit lesson. |
| `DAILY_NEW_ITEMS` | 4 | Max new items in a daily lesson. |
| `DAILY_REVIEW_ITEMS` | 6 | Max overdue reviews in a daily lesson. |
| `DEFAULT_EASE` | 2.5 | New-item ease. |
| `MIN_EASE` / `MAX_EASE` | 1.3 / 2.7 | Ease clamp. |
| `EASY_BONUS` | 1.3 | Extra interval stretch on a recall/listen hit. |
| `RECALL_INTERVAL` | 3 | Interval ≥ 3 days ⇒ "recall strength" ⇒ escalate to type/wordbank/listenMatch. |
| `LISTEN_PROBABILITY` | 0.5 | Share of recall reviews made audio-only. |
| `WARMUP_SIZE` | 5 | New-word warm-up padding. |

Grades (`exerciseGrade` → `scheduleReview`): miss ⇒ **LAPSE** (interval→1, ease −0.2);
recognition hit (`choice`/`match`) ⇒ **GOOD** (interval × ease); recall/typed/listening hit
(`type`/`wordbank`/`listenMatch`) ⇒ **EASY** (interval × ease × `EASY_BONUS`, ease +0.15).

## DB schema (tools/schema.sql; MySQL)

| Table | Key columns |
| --- | --- |
| `users` | `id` PK, `username` UNIQUE, `password_hash` (argon2id), `failed_logins`, `locked_until`, `is_admin`, `reminder_hour`, `reminder_tz`, `created_at` |
| `app_state` | `user_id` PK/FK, `state` (MEDIUMTEXT JSON blob), `revision`, `updated_at` |
| `sessions` | `token_hash` PK (sha256), `user_id` FK, `created_at`, `expires_at` (90 days) |
| `signup_attempts` | `ip`, `created_at` (per-IP hourly signup throttle) |
| `login_attempts` | `ip`, `created_at` (per-IP login throttle) |
| `push_subscriptions` | `id` PK, `user_id` FK, `endpoint` UNIQUE, `p256dh`, `auth_secret`, `created_at`, `last_success_at`, `last_failure_at`, `failure_count` |

## Feature-code glossary

Codes appear throughout the code/comments. **SR-\*** = the spaced-repetition /
pedagogy roadmap; **R\*** = earlier UI-revision tags.

| Code | What it is |
| --- | --- |
| SR-01 | Two-character **story dialogues** + comprehension quiz (the Duolingo-Stories player). |
| SR-02 | Self-hosted **audio** — ~588 phrase clips + ~233 word-bank clips, ElevenLabs Sano clone, pre-rendered (no runtime TTS). |
| SR-03 | **Listening** exercises — audio-only prompts on ~half of recall reviews. |
| SR-04 | **Speaking** practice — skippable record-and-compare (Web Audio playback). |
| SR-05 | **SM-2-lite scheduler** — per-item ease + interval, auto-graded (replaced Leitner). |
| SR-06 | Communicative **can-do goals** — per-unit objective on the home CTA + complete screen. |
| SR-07 | **Companions** — 10 animal friends: heads in bubbles, full-body decorations along the path. |
| SR-08 | **Pronunciation** drills for sounds romanization hides (aspiration, retroflex, nasal/length). |
| SR-09 | Mindful gamification — streak **freeze** (forgive one missed day; cap 2). |
| SR-10 | **Placement / skip-ahead** — onboarding marks earlier units introduced at recall strength. |
| SR-11 | Optional **Devanagari script track** (planned, not shipped). |
| R22 | The daily-**reminder modal** (Sano's head + a speech bubble in a `<dialog>`). |
| R23 | The **onboarding finish celebration** (Sano pops + wobbles, burst ring + confetti). |
