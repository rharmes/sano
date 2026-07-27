# Data model + glossary — sano

> The data **shapes**, storage keys, DB tables, scheduler constants, and the
> feature-code glossary — so a session can skip reading `js/data.js` / `js/sano.js`.
> Load with `@docs/data-model.md`. File/function map is in `@docs/architecture.md`.
> Internal-only (not deployed).
>
> **AI-drafted strings are Ross's drafts:** every `dev`/`gloss en` and per-unit `goal` is AI-drafted
> and under Ross's review — flag questions, never silently "correct" them. (`np`/`pron` are derived.)

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
{ id, dev, en, usage, frames?, enEither?, enAlt? }
// dev = Devanagari (source of truth), en = English, usage = dictionary note.
// NOTE: `np` (romanized) AND `pron` (pronunciation) are DERIVED at load from `dev` by
// js/romanize.js (romanize / pronounce; spec: docs/romanization.md). Both were removed from the
// data — items now store only English + Devanagari (+ usage/emoji).
// frames? = optional depth (T28): extra example sentences [{ dev, en }] (np/pron derived like
//   the item's own). Reviews ROTATE through them over the SAME spaced-repetition record (keyed
//   by item id — one record, many sentences), so a known word is practiced in varied contexts
//   without adding path units. Frame 0 is the item's own dev/en (clip id = item.id); each extra
//   frame's clip is `<id>-f1`, `<id>-f2`, … GATED (T38): an alternate frame only rotates in once
//   the item has GRADUATED and the frame introduces ≤ FRAME_MAX_NEW_WORDS (2) words that appear
//   in no introduced item's canonical sentence (knownWordSet) — a still-learning word keeps its
//   one stable sentence, and `choice` exercises ALWAYS show the canonical (a long alternate among
//   short distractors would be the obvious answer). The runtime frame model (itemFrames /
//   eligibleFrames / rotateFrame / pickFrame → ex.frame) lives in js/sano.js. dev is AI-drafted →
//   Ross's review, like every dev.
// enEither? / enAlt? = optional multi-gloss accept (T33). When `en` carries two interchangeable
//   meanings ("Excuse me / I'm sorry"), the np-en "build/type the English" grader accepts EITHER:
//   enEither:true splits `en` on " / "; enAlt:[…] lists the accepted glosses explicitly (for a slash
//   that sits mid-phrase). Resolved by acceptedEnglish(ex) in js/sano.js; applies to any item
//   (phrases or vocab); unflagged items grade exactly as before.
```

`UNIT_VOICES` (T13, same file): `{ [unitId]: companionId }` — every unit belongs to one of the ten
companions' **contiguous path sections** (order mirrored by `buddyOrder` in `renderPath`; enforced by
`tests/data/unit-voices.test.mjs`). Reviews of a unit's items are voiced by its companion **once that
companion has a designed voice** (`CHARACTER_VOICES` in js/audio.js — currently the 6 dialogue
voices); `reviewCompanion` (js/sano.js) resolves item → companion-or-null, `buildExercises` tags
**single-item** review exercises with `ex.companion` (never new-word introductions), and the head
chip + clip routing (`audio/<companion>/<clipId>.mp3`, rendered by `synth-app.mjs --units`, fallback
to `default`) read that tag. Bundled match/listen-match grids always play the default voice — a
round mixes items from different sections, and all pills on one page must share one voice (Ross).

`WORD_GLOSSES` (T37, js/glosses.js — **generated** by `tools/build-glosses.mjs`, do not hand-edit):
`{ [slug]: en }` — one short English gloss per word that can appear in a Nepali exercise prompt,
keyed by the same romanized slug as the word's tile clip (`audio/words/<slug>.mp3`). Behind the
tap-a-word prompt glosses (`glossedPrompt`/`setPrompt` in js/sano.js → `SanoGloss.renderLine`):
every prompt word is dotted-underlined; tapping pops its English and plays its clip. Sources, in
priority order: the merged senses of **every** single-word course item sharing the slug (`en` +
`enAlt`, course order, deduped — a homograph like छ chha lists "Yes / Is / Has / Six", never just
the first unit's meaning) → the ground-truth dictionary (tools/dict) → hand-drafted surface-form
fills in the build script (AI-drafted → Ross's review). Coverage and the homograph merge are
enforced by `tests/data/glosses.test.mjs` and the build fails on any un-glossed word.

An item (`kind: 'vocab'`) — carries an `emoji`, no `usage`:

```js
{ id, dev, en, emoji } // np + pron derived at load (see the note above)
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
// dev MAY carry inline ElevenLabs v3 performance tags in [brackets] (e.g. [whispers], [laughs];
//   elevenlabs.io/blog/v3-audiotags) — sent to the TTS render verbatim, stripped everywhere `dev`
//   becomes text (SanoRomanize.stripTags). Tags must NOT appear in np/gloss/en (display + tap
//   translation); a data test enforces this.
```

A gloss segment — the player renders romanization from these (each = one underlined,
tappable chunk); **`gloss.map(g => g.np).join(' ')` must equal `np`**:

```js
{ np, en }   // en: '' => plain, non-tappable text (e.g. an em-dash). No gloss => plain np (back-compat).
```

Only `greet-pyaro` is live; its `gloss` English is AI-drafted and awaits review. Per-line
audio is voiced per character; a head comes from `CHARACTER_HEADS[who]`. The English (story /
lines / questions) is authored in `tools/tts/dialogue-scripts.md` — the **source of truth** —
and `DIALOGUES` is hand-built from it (adding the Nepali + clip routing), synced by hand.

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

## Progress state — localStorage `sano.state.v1` (schema version 3)

The working copy; the app stays usable offline/logged-out, and `SanoSync` mirrors it to the
server. Written via the `STATE_KEY` constant.

```js
{
  version: 3,                       // v3 = SR-05 relaunch; a v2 blob is fresh-started on load
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
{ seen, correct, ease, interval, lastSeen, intro, recalls, graduated }
// ease: starts 2.0, clamped [1.3, 2.5]   interval: days (0 = not introduced)
// lastSeen: 'YYYY-MM-DD'                  intro: true once seen
// recalls: correct recall (type/word-bank/listen) answers, spaced across sessions
// graduated: true once recalled GRADUATE_RECALLS× (mastery gate); a lapse never un-graduates it
```

Legacy Leitner `level` records migrate to `interval`/`ease` on load (`migrateLegacyState`,
`migrateV1State`). **v2 → v3 (`migrateV2State`) is the SR-05 fresh start:** keeps name / streak /
lifetime tally, resets all learning progress (everyone relearns from unit 1 on the new engine).

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
| `DAILY_NEW_ITEMS` | 4 | Max new items in a daily lesson (only when fully caught up). |
| `SESSION_REVIEW_TARGET` | 16 | Max overdue reviews served in one daily lesson (rest carried). |
| `DEBT_PER_NEW_DROP` | 5 | Drop one new word per this-many due reviews (adaptive throttle). |
| `DEFAULT_EASE` | 2.0 | New-item ease (gentler than SM-2's 2.5). |
| `MIN_EASE` / `MAX_EASE` | 1.3 / 2.5 | Ease clamp. |
| `EASY_BONUS` | 1.15 | Extra interval stretch on a recall/listen hit (graduated phase). |
| `RECALL_INTERVAL` | 2 | Interval ≥ 2 ⇒ "recall strength" ⇒ escalate to word bank (still learning) / type (graduated). |
| `LEARNING_STEPS` | [2, 4] | Gentle pre-graduation interval ladder: 1 → 2 → 4, then capped. |
| `GRADUATE_RECALLS` | 2 | Correct recalls needed to graduate (leave the learning ladder). |
| `GRADUATE_MIN_INTERVAL` | 4 | …and the word must have reached this interval (spacing gate). |
| `LISTEN_PROBABILITY` | 0.5 | Share of recall reviews made audio-only. |
| `WARMUP_SIZE` | 5 | New-word warm-up padding. |

Grades (`exerciseGrade` → `scheduleReview`): miss ⇒ **LAPSE** (interval→1, ease −0.2, stays graduated);
recognition hit (`choice`/`match`) ⇒ **GOOD**; recall/typed/listening hit (`type`/`wordbank`/`listenMatch`)
⇒ **EASY** (counts a recall, ease +0.15). **Learning phase** (`!graduated`): climb `LEARNING_STEPS`;
graduate at `GRADUATE_RECALLS` recalls + interval ≥ `GRADUATE_MIN_INTERVAL`. **Graduated phase:** SM-2
multiply (`interval × ease [× EASY_BONUS]`). A unit is **complete** (unlocks the next) only when every
word has graduated — the **mastery gate** (`unitIsComplete`); the daily loop (`dailyPlan`) throttles new
words by review debt and is review-dominant.

## DB schema (tools/schema.sql; MySQL)

| Table | Key columns |
| --- | --- |
| `users` | `id` PK, `username` UNIQUE, `password_hash` (argon2id), `failed_logins`, `locked_until`, `is_admin`, `reminder_hour`, `reminder_tz`, `created_at` |
| `app_state` | `user_id` PK/FK, `state` (MEDIUMTEXT JSON blob), `revision`, `updated_at` |
| `sessions` | `token_hash` PK (sha256), `user_id` FK, `created_at`, `expires_at` (90 days) |
| `signup_attempts` | `ip`, `created_at` (per-IP hourly signup throttle) |
| `login_attempts` | `ip`, `created_at` (per-IP login throttle) |

`ip` in both is what `throttle_ip()` (api/lib.php) returns, **not** the raw address: IPv4 whole
(4 bytes), IPv6 truncated to its **/64** (8 bytes). One end site is routinely handed a whole /64,
so keying on the full address gives an attacker 2^64 buckets — no limit at all (T57). IPv4-mapped
`::ffff:a.b.c.d` is unmapped to its 4-byte address first; truncating it instead would put every
IPv4 client behind a dual-stack proxy in one shared bucket and lock the site out globally.

| `push_subscriptions` | `id` PK, `user_id` FK, `endpoint` UNIQUE, `p256dh`, `auth_secret`, `created_at`, `last_success_at`, `last_failure_at`, `failure_count` — see the ownership rule below |
| `traffic_days` | `day` PK, `requests` (human), `bot_requests`, `bytes`, `errors_4xx`, `errors_5xx`, `ingested_at` — also the ingest ledger: a row exists only for a parsed day |
| `traffic_visitor_days` | `(day, visitor)` PK, `sessions`, `requests`, `is_new`, `is_mine`, `country`, `device`, `browser` — the grain every traffic number derives from |
| `traffic_referrers` | `(day, mine, host)` PK, `hits` (page arrivals only) |
| `traffic_errors` | `(day, mine, status, path)` PK, `hits` (human visitors only) |

### Push subscriptions (T42) — what may be stored, and who owns a row

A subscription `endpoint` is a URL **the server itself POSTs to**, hourly, from
`tools/send-reminders.php` — so it is validated on write, not merely stored.
`push_endpoint_ok()` (`api/lib.php`) requires `https`, no userinfo, no explicit port, and a
host in `PUSH_HOSTS` (`web.push.apple.com`, `fcm.googleapis.com`,
`updates.push.services.mozilla.com`) or under `PUSH_HOST_SUFFIXES` (`.notify.windows.com`).
An allowlist rather than a private-IP blocklist, because the endpoint is a *hostname*: it can
resolve anywhere, and resolve somewhere else by the time the cron runs. **Adding a browser
means adding its host in two places** — `api/lib.php` and `tools/send-reminders.php`, which
carries its own copy because it runs from `~/sano-tools/` and can't require the docroot
(`tests/data/push-allowlist.test.mjs` fails if they drift). `push_key_ok()` requires `p256dh`
to be base64url of a 65-byte uncompressed P-256 point (leading `0x04`) and `auth` of 16 bytes;
a malformed key would otherwise throw inside the cron's encryption step and take down that
hour's whole run.

Because `endpoint` is UNIQUE, re-subscribing has to decide who owns the row. Re-attaching a
device to a **different** account is legitimate — one phone, sign out, sign in as someone else
— but the endpoint string alone must not be enough to do it, or anyone who reads one out of an
ops log can move that device onto their own account. So the update is allowed when the caller
already owns the row **or** presents that subscription's own `p256dh` + `auth` (`hash_equals`);
otherwise `403 endpoint_taken`. Each account keeps at most `MAX_PUSH_SUBS_PER_USER` (20) rows,
oldest pruned first.

### Traffic aggregates (T40) — the definitions behind the numbers

Filled nightly by `tools/ingest-traffic.php` from the Apache access logs (Dreamhost keeps
only ~7 days, so the tables are the history), read by `api/admin-traffic.php`.

- **Visitor** — salted `sha256(ip + "\n" + user-agent)`, truncated to 16 bytes; the salt is
  `traffic_salt` in `~/sano-config.php`. No raw address is stored, so the rows can't be
  walked back to a person. One human on two networks counts twice; a household behind one
  router can count as one.
- **Session** — a visitor's requests split on a 30-minute idle gap. A session crossing
  midnight is counted in both days (ingest, and the dashboard, are per-day).
- **Repeat session** — every session after a visitor's first ever, computed as
  `SUM(sessions) - SUM(is_new)`; `is_new` marks a visitor's first day. **Returned** is the
  narrower "seen on 2+ separate days".
- **Bot** — a visitor-day is excluded (and its requests counted as `bot_requests`) when the
  UA is bot-shaped, OR it never successfully fetched a real app path, OR it asked for
  something only a crawler asks for (`/robots.txt`, `/llms.txt`, `/wp-*`, …). The third
  test is what catches AI crawlers that fetch the page and assets like a browser.
- **Mine** — a visitor who ever got a **2xx from an `/api/admin-*` endpoint**, i.e. Ross.
  Sticky across days and excluded from the dashboard by default. It deliberately does *not*
  count a request for `/admin/` itself: that page is a static shell served 200 to anyone, so
  counting it let any visitor mark themselves "mine" with a single request and vanish from
  the default view for good (T49). Only a real admin session earns a 2xx from the API.
- **is_new / is_mine** are recomputed across the whole table after each ingest, so
  backfilling an older day is self-correcting and re-ingesting a day is idempotent.
- **Flood bounds (T49)** — a day is parsed into memory before anything can be classified, so
  the ingest caps distinct visitors per day (20,000), timestamps kept per visitor (2,000,
  used only to find session gaps), distinct error paths / referrer hosts per visitor (50),
  and stored referrer/error rows per day (500). Every ceiling is far above a real day —
  roughly 99 visitors — and anything dropped is reported on stderr rather than silently
  discarded. Attacker-supplied text (request path, `Referer` host) is stripped to printable
  ASCII without markup characters on the way in; a `Referer` whose host isn't a plausible
  hostname is dropped rather than stored.

## Feature-code glossary

Codes appear throughout the code/comments. **SR-\*** = the spaced-repetition /
pedagogy roadmap; **R\*** = earlier UI-revision tags.

| Code | What it is |
| --- | --- |
| SR-01 | Two-character **story dialogues** + comprehension quiz (the Duolingo-Stories player). |
| SR-02 | Self-hosted **audio** — pre-rendered phrase + word-bank clips, ElevenLabs (no runtime TTS): Sano's clone teaches; since **T13** each path companion voices their own section's **reviews** (`UNIT_VOICES` → `ex.companion` → `audio/<companion>/…`, head chip, fallback to default). |
| SR-03 | **Listening** exercises — audio-only prompts on ~half of recall reviews. |
| SR-04 | **Speaking** practice — skippable record-and-compare (Web Audio playback). |
| SR-05 | **SM-2-lite scheduler + learning steps** — per-item ease/interval, auto-graded; new words climb a gentle ladder and only **graduate** once recalled ~2×; a **mastery gate** (`unitIsComplete`) requires every word graduated before the next unit unlocks; the daily loop (`dailyPlan`) is review-dominant + adaptive. Units >14 items are split into ~8–12-word chunks. **Depth (T28):** an item may carry `frames` (alternate example sentences); reviews rotate through them over the same record so known words are practiced in varied contexts without growing the path — **gated (T38)** behind graduation + a ≤2 never-seen-word budget, with `choice` exercises always canonical. |
| SR-06 | Communicative **can-do goals** — per-unit objective on the home CTA + complete screen. |
| SR-07 | **Companions** — 10 animal friends: heads in bubbles, full-body decorations along the path. |
| SR-08 | **Pronunciation** drills for sounds romanization hides (aspiration, retroflex, nasal/length). |
| SR-09 | Mindful gamification — streak **freeze** (forgive one missed day; cap 2). |
| SR-10 | **Placement / skip-ahead** — onboarding marks earlier units introduced at recall strength. |
| SR-11 | Optional **Devanagari script track** (planned, not shipped). |
| R22 | The daily-**reminder modal** (Sano's head + a speech bubble in a `<dialog>`). |
| R23 | The **onboarding finish celebration** (Sano pops + wobbles, burst ring + confetti). |
