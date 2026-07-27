# sano — Tasks

The project backlog. Claude keeps this current: every task Ross asks for — plus any suggestion Ross
agrees to, and anything discovered mid-work — is added here as an unchecked box with a unique `T<n>`
ID, and the box is ticked in place once the task is delivered. It's plain Markdown grouped by area,
so read or edit it by hand anytime. The items below wait on Ross (a review, a decision, or a
native-speaker check) — they aren't derivable from the code, so they're easy to lose if they leave
this list. Refer to any task by its ID (e.g. "T3").

## Backlog tooling

- [ ] **T34 · Lightweight query structure for the backlog** — add a small, greppable tag convention
      to this file so tasks can be filtered without moving to an external tracker: a `waiting-on:`
      marker (`ross` / `native-speaker` / `none`) and an area/status tag where useful, plus a one-line
      `grep` recipe documented here in the header and mirrored into CLAUDE.md's **Task list** section.
      Goal: get the one thing GitHub Issues would buy us — filter/query at scale ("everything waiting
      on me", "all content-review tasks") — while keeping the backlog's strengths: co-authored and
      updated **in the same commit** that ships the code, versioned in lockstep with the tree, offline,
      and reviewable in the diff. **Decision (2026-07-20):** chose in-file structure over GitHub Issues
      — a solo, agent-co-maintained, code-lockstep backlog doesn't benefit from Issues' collaboration
      features (assignees, notifications, cross-team visibility) but would pay their costs (a split,
      networked, non-atomic update loop). Revisit Issues only if a collaborator joins or public bug
      intake is wanted.

## Dialogues & audio

- [ ] **T1 · Add voice tags to the conversations** — review `tools/tts/dialogue-scripts.md`, add
      ElevenLabs `[performance tags]` (list + pipeline: `tools/tts/voice-tags.md`), re-map changed
      lines into `js/dialogues.js`, and re-render their audio.
- [x] **T2 · Re-render the reconciled greet-pyaro audio** — `greet-pyaro-01/-07/-10` lag the text
      after the `[shouting]`/"copying" edits in `bbe8024`; re-render (`synth-app.mjs --dialogues --only greet-pyaro-01` …)
      + bump `AUDIO_VERSION` once the edits settle. First confirm line-1 नक्कल गरिरहेको ("copying")
      with a native speaker.

- [x] **T35 · Word clips for standalone single-word items** — `build-words.mjs` built its tile-word
      inventory from **phrases-unit** sentences only, so (a) a single-word item whose word appears in
      no phrase had no `audio/words/<slug>.mp3` (the e2e-log 404 for `hajaar.mp3` — हजार tiles in its
      own SR-05 word-bank recall among distractors) and (b) vocab-unit frames (word-bankable since
      T32) had no clips for their new words. **Fixed 2026-07-20** with the T29 batch 7–9 merge: the
      inventory is now every word of every canonical + frame sentence across all units (719 → 1050
      tile-words; the 331 missing clips rendered in the same pass). CLAUDE.md + architecture.md
      updated.

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
- [ ] **T12 · Reorder companions along the path + section-appropriate art** — the decorative
      companions currently sit in a fixed order in the path pockets (`buddyOrder` in `renderPath`,
      `js/sano.js`). Reorder them so each companion lands near the section it fits, and generate
      companion art that makes sense for that section (regenerate from `design/characters.html` via
      `tools/build-character-heads.mjs` → `js/characters.js`). **Order half delivered by T13
      (2026-07-21):** `buddyOrder` now mirrors the `UNIT_VOICES` path sections (drift-guarded by
      `tests/data/unit-voices.test.mjs` — change the two together). Still open: the
      section-appropriate **art**.
- [ ] **T13 · Give the companions their own voices in lessons** — each path companion voices their
      own section's **reviews** (Sano always introduces new words and voices the word tiles / sounds
      drill), with the companion's head chip above the prompt and a play-time fallback to the default
      clip wherever a companion clip isn't rendered. Map: `UNIT_VOICES` (`js/data.js`, ten contiguous
      sections mirroring `buddyOrder`); routing: `reviewCompanion`/`ex.companion` (`js/sano.js`) +
      `CHARACTER_VOICES` (`js/audio.js`); render: `synth-app.mjs --units [ids] --new`.
  - [x] **Mechanism + 6-unit pilot (2026-07-21)** — full seam + head chip + fallback; pilot units
        rendered in the six dialogue voices (149 clips ≈ 1.7k credits): basics → Thulo,
        family-people → Pyaro, meals → Shanta, verbs-present → Gyani, colors → Rangin,
        animals-wild → Bahadur. `AUDIO_VERSION` 27; unit + data tests; dev-seed 0g. **Ross to judge
        each voice on short course phrases before the full render.** (Per Ross 2026-07-21: bundled
        match / listen-match grids stay all-Sano — a round mixes sections, and every pill on a page
        must share one voice; companion voices are single-item exercises + their feedback replays.)
  - [x] **Full render for the voiced six (2026-07-21)** — pilot voices passed Ross's review; the
        remaining 771 clips of the six companions' sections rendered (`--units --new`, ~9k credits;
        920 companion clips total across 49 units), `AUDIO_VERSION` 28. The 53 units owned by the
        un-voiced four still review in Sano's voice until T36 designs their voices.
- [ ] **T36 · Design voices for Hiun, Chanchal, Phurtilo, Lamo** — the four companions without an
      ElevenLabs voice (snow leopard, langur, tahr, gharial). Design/pick voices in the dashboard
      (persona notes: `CHARACTER_PERSONAS`, `js/dialogues.js`; process: RESEARCH.md §9), add ids to
      `VOICES` (`tools/tts/synth-app.mjs`) + `CHARACTER_VOICES` (`js/audio.js`), then render their
      `UNIT_VOICES` sections (`--units --new`). Until then their sections review in Sano's voice.

## Server & admin

- [x] **T40 · Traffic numbers in the admin dashboard** — surface real usage from the Apache access
      logs: distinct visitors, repeat sessions, and countries, plus a daily trend chart, a
      device/browser split, top referrers, and 4xx/5xx errors. **Constraint:** Dreamhost keeps only
      ~7 days of `~/logs/namastesano.com/https/access.log*`, so anything not captured is lost —
      history has to accumulate server-side. **Decisions (Ross, 2026-07-26):** nightly cron ingest
      into MySQL (dashboard reads the DB; today's numbers land tomorrow) · a visitor is a salted
      `sha256(ip + UA)` hash, never a raw IP · countries from a free CC0 IP→country table kept on the
      server (no third party ever sees a visitor IP, no runtime external calls) · Users | Traffic
      tabs on `/admin/` · aggressive multi-signal bot filtering (≈45% of the log is DreamHost
      SiteMonitor + crawlers + wp-admin scanners) with the excluded count shown · sessions split on a
      30-minute idle gap, a repeat session is any session after a visitor's first-ever · store only
      hashes + aggregates · Ross's own visits auto-detected (any visitor whose session touched
      `/admin/`) and excluded by default behind a toggle · selectable 7 / 30 / 90 / all-time range.
  - [x] **Delivered (2026-07-26)** — `tools/ingest-traffic.php` (nightly cron in `~/sano-tools/`;
        `--update-geo` compiles the CC0 CSVs into a fixed-width binary index searched by fseek, since
        Dreamhost's PHP CLI caps at 128MB) → the four `traffic_*` tables
        (`tools/migrate-2026-07-traffic.php`, folded into `schema.sql`) → `api/admin-traffic.php` →
        the Traffic tab (`js/admin-traffic.js` + `.tr-*` in `css/admin.css`; chart series colors are
        the brand crimson/indigo snapped to the nearest step that clears the dataviz chroma floor in
        both themes). Tests: `tests/data/traffic-parse.test.mjs` drives the script's DB-free `--json`
        mode over `tests/fixtures/traffic-access.log`, plus three API guard specs. Dev-seed scenario
        added. **Known limit:** an AI crawler that fetches only app paths still counts as a visitor —
        the UA / app-path / crawler-path signals catch the rest. Requiring an audio fetch ("actually
        did a lesson") is the stricter option if the numbers ever look inflated.

## Security

Findings from the full security review of 2026-07-26 (six parallel reviews: auth/session, API
injection & authz, frontend XSS, Apache/exposure, server-side scripts & privacy, secrets/supply
chain). **Nothing Critical or High was found, and no credential has ever been committed** — the
auth design (CSPRNG tokens hashed at rest, argon2id, bound parameters throughout, no
`X-Forwarded-For` trust, no client-settable `is_admin`) held up under scrutiny. The items below are
the real defects plus the hardening worth doing. Each was confirmed by reading the code path unless
marked otherwise.

- [x] **T41 · Turn off Apache directory listing** — `/api/`, `/js/`, `/css/`, `/fonts/` and
      `/audio/` all serve a full `Index of /…` autoindex (confirmed live: `GET /api/` lists all 11
      endpoint filenames). `.htaccess` has no `Options -Indexes`, so this is one line at the top of
      the root file, inherited by every subdirectory. No secret is exposed today — the value is that
      any future stray file dropped into a synced directory would otherwise be advertised.
  - [x] **Delivered (2026-07-27)** — `Options -Indexes` at the top of `.htaccess`. Verified against a
        real Apache 2.4 (macOS `httpd`, serving a copy outside `~/Documents`, which TCC blocks Apache
        from reading at all): with the file honored, `/js/`, `/css/` and `/api/` return 403 and leak
        zero filenames, while `/` and `/index.html` still return 200 with all three security headers
        intact. The `AllowOverride None` control run reproduces the live bug exactly (200 + 14 `.js`
        filenames), so the check discriminates rather than passing vacuously. Regression guard added
        to `tools/check.sh`: no other tier can see Apache config — `php -S` ignores `.htaccess` — so
        the static tier now asserts the security-critical directives in both `.htaccess` files. It
        strips comments before matching (the first version passed a commented-out directive), and was
        confirmed to fail when the line is commented out *and* when it's deleted.
        **Live re-check required immediately after the next deploy:** `Options` needs `AllowOverride
        Options`/`All` in the vhost, and if Dreamhost disallowed it every request would 500. Confirm
        `curl -sI https://namastesano.com/` is 200 and `curl -o /dev/null -w '%{http_code}'
        https://namastesano.com/js/` is 403; if the site 500s, revert this one line and redeploy.
- [x] **T42 · Validate and scope push subscriptions** — `api/push-subscribe.php` accepts any
      non-empty string ≤500 bytes as `endpoint`, and `tools/send-reminders.php` POSTs to it hourly,
      so any self-registered user turns the server into a blind SSRF client (loopback/LAN probing;
      the attacker never sees the response, so this is request-forgery, not exfiltration). Require
      `https` + a host allowlist of the real push services. Same file, same fix session: the
      `UNIQUE KEY` is on `endpoint` alone and the upsert does `user_id = VALUES(user_id)`, so
      anyone holding another user's endpoint string can **reassign that device to their own
      account** — scope the update to the owner instead. Also validate `p256dh` (65 bytes,
      leading `0x04`) / `auth` (16 bytes) as base64url, and cap rows per user.
  - [x] **Delivered (2026-07-27)** — `push_endpoint_ok()` / `push_key_ok()` in `api/lib.php`, applied
        in `push-subscribe.php` **before** `require_user()` so the whole surface stays DB-free
        testable. Endpoint must be `https`, no userinfo, no explicit port, host in `PUSH_HOSTS`
        (Apple / FCM / Mozilla) or under `.notify.windows.com`. An **allowlist, not a private-IP
        blocklist** — the endpoint is a hostname, so it can resolve anywhere and re-resolve
        elsewhere before the cron runs an hour later. Ownership: insert first and let
        `UNIQUE(endpoint)` decide (no SELECT-then-INSERT race, no gap lock), then allow the update
        only if the caller owns the row **or** presents that subscription's own keys
        (`hash_equals`) — which keeps the legitimate "same phone, different account" re-attach
        working while blocking a device takeover by anyone who read an endpoint out of an ops log
        (the very leak T51 describes); otherwise `403 endpoint_taken`. Cap of 20 rows per user,
        oldest pruned. `tools/send-reminders.php` re-checks both on read, since existing rows
        predate this — it **skips and reports**, never deletes, so a legitimate row rejected by a
        stale allowlist stays visible and fixable. Verified the one live subscription first
        (`web.push.apple.com`, `p256dh` 87 chars, `auth` 22) so the rules can't strand Ross's own
        iPhone. Tests: 24 assertions in `tests/api/helpers.test.php` (loopback, cloud metadata,
        userinfo trick `https://web.push.apple.com@evil.test/`, lookalike host, undotted suffix,
        every key shape), 6 HTTP guard specs including one asserting a **valid** Apple subscription
        reaches 401 rather than being rejected, a DB-backed rebind test in `integration.spec.mjs`
        (CI only — no local MySQL), and `tests/data/push-allowlist.test.mjs` diffing the two copies
        of the allowlist (confirmed to fail on both host drift and logic drift). **The per-user cap
        is not covered by a test** — there's no read endpoint to observe row counts through, so it
        rests on review. **Adding a browser means editing two files** (see CLAUDE.md).
        Unblocks T52, whose remaining work is now just the `try`/`catch` around `flush()` and
        pruning on repeated failure.
- [x] **T43 · Fix `api/state.php` write handling** — the file lacks `declare(strict_types=1)` (it's
      file-scoped, so `lib.php`'s doesn't cover it), and `json_encode()`'s return is unchecked.
      Verified: a state containing `1e999` decodes to `INF`, re-encodes to `false`, and
      `strlen(false)` coerces to `0` — so the 1 MiB cap passes and a **non-JSON value is stored**.
      `tools/send-reminders.php:84` then runs `JSON_UNQUOTE(JSON_EXTRACT(s.state, …))` across every
      reminder-enabled user in one statement; MySQL aborts the whole SELECT on the invalid row, the
      uncaught exception kills the cron, and **nobody gets reminders** until it's cleaned up. Use
      `JSON_THROW_ON_ERROR` (or check `=== false` → 400), add the strict_types declaration, and
      consider a `JSON` column type so MySQL rejects it at write time. While here: the PUT commits
      and *then* re-reads the row, so two devices racing can hand the client a revision it didn't
      produce — collapse it into one atomic `UPDATE … WHERE revision = ?` using `rowCount()` as the
      conflict signal, which also fixes the deadlock on two concurrent first-ever PUTs.
  - [x] **Delivered (2026-07-27)** — `declare(strict_types=1)` plus an explicit
        `json_encode(...) === false` → **400 `bad_state`**. Chose the explicit check over
        `JSON_THROW_ON_ERROR`, which would surface through the generic exception handler as a 500;
        this is a bad request, and the client should be told so. The write path is now one atomic
        statement: the revision check rides inside `UPDATE … WHERE user_id = ? AND revision = ?`
        with `rowCount()` as the conflict signal, so there is no read-then-write window, and the
        `SELECT … FOR UPDATE` that gap-locked a missing row is gone. `rowCount() === 0` falls
        through to an `INSERT` and lets the primary key say which case it was — duplicate key
        (23000) means the row existed, so a genuine conflict; a deadlock (40001) from two racing
        first-ever PUTs resolves to the same 409, since the loser should reconcile either way.
        The revision is now read **inside** the open transaction, so it is the value this request
        produced rather than one a racing device wrote between commit and read.
        Defence in depth in `tools/send-reminders.php`: the query wraps the extract in
        `IF(JSON_VALID(s.state), s.state, '{}')`, because `state.php` can no longer write a bad row
        but one stored before this fix still could exist — checked the live DB, 2 rows, **0
        invalid**, so this is precaution rather than repair. Test: a guard spec PUTs the raw string
        `{"state":{"x":1e999},"baseRevision":0}` (JSON.stringify would turn `Infinity` into `null`
        and never reproduce it), confirmed to **fail against the pre-fix file and pass against the
        fixed one**. Revision/conflict/force behaviour stays covered by the CI integration spec.
        **Not done:** switching `state` to a `JSON` column — that is a live-DB migration for
        belt-and-braces on a path PHP now guards, so it is not worth the schema change.
- [x] **T44 · Bound request bodies before decode, and catch fatals** — `read_json_body()`
      (`api/lib.php:57`) and `api/state.php:24` both do `file_get_contents('php://input')` with no
      limit, *before* the size cap and *before* auth. `post_max_size` doesn't bound a PUT read this
      way, so an unauthenticated request can drive PHP to a memory-exhaustion **fatal** — which
      `set_exception_handler` does not catch, so the client gets a bodiless response with no JSON
      content type. Pre-check `Content-Length`, read with `stream_get_contents($fh, CAP + 1)`, use a
      much smaller cap (~16 KB) for the credential/reminder/push endpoints, and add a
      `register_shutdown_function` fatal handler so no path can return an empty body.
  - [x] **Delivered (2026-07-27)** — new `read_body($maxBytes, $tooLarge)` in `api/lib.php`: rejects
        cheaply on `Content-Length` first, then still bounds the actual read with
        `stream_get_contents($fh, $max + 1)`, because a chunked request carries no Content-Length
        and the header is a hint rather than a promise. Reading one byte past the cap is enough to
        know it was too big without holding it all. `read_json_body()` now defaults to
        `MAX_BODY_BYTES` (16 KiB) — every endpoint but `state.php` carries a handful of short
        fields — and `state.php` passes `MAX_STATE_BODY_BYTES` (the 1 MiB blob plus an 8 KiB
        envelope allowance) and keeps its `state_too_large` error string so the client contract is
        unchanged. Plus a `register_shutdown_function` emitting the same JSON 500 on
        `E_ERROR`/`E_PARSE`/`E_CORE_ERROR`/`E_COMPILE_ERROR`/`E_USER_ERROR`, which
        `set_exception_handler` cannot see.
        Verified the fatal handler by forcing real memory exhaustion, not by inspection: without
        `lib.php` an OOM yields an empty body (what the client used to get); with it,
        `{"error":"server"}` — at memory limits down to 2M, under both a single failed allocation
        and many retained ones — while a clean request still emits nothing extra. **Dropped a
        64 KiB "memory reserve" I had first written for the handler:** testing showed it made no
        difference at any limit, because PHP frees the request's allocations before shutdown
        functions run, so it was pure per-request cost with a comment that overstated its value.
        Tests: 7 guard specs — oversized bodies 413 on five endpoints, a 15 KiB body still parsed
        normally (so the cap can't be quietly tightened into breaking real requests), and
        `state.php` bounding at its own larger limit.
- [ ] **T45 · Stop `api/admin-users.php` loading every user's full state blob** — it `fetchAll()`s
      `a.state` (MEDIUMTEXT, up to 1 MiB each) for *every* account, `json_decode`s each, and
      accumulates every graduated item id — where the ids are attacker-chosen keys inside their own
      blob, with no length or count limit. A few self-registered accounts each PUTting a padded 1 MiB
      state can push the admin request to a fatal OOM and persistently deny Ross the Users tab.
      Extract `streak` / counts in SQL (`JSON_EXTRACT`, `JSON_LENGTH`) instead of shipping blobs;
      `js/admin.js` only intersects the id list against `COURSE`, so a server-side count works.
- [ ] **T46 · Revoke sessions on the CLI password reset** — `tools/make-user.php:69`
      `--reset-password` rewrites the hash and clears the lockout but never deletes the user's
      sessions, unlike `api/admin-reset-password.php:37`, which does (and whose UI even says "signed
      out on all devices"). So the most likely reason to run it — "this account was compromised" —
      leaves the attacker's 90-day cookie valid, with continued read/write access to the victim's
      synced state. One line. Same file: it applies no username validation at all, unlike
      `register.php`'s `^[a-z0-9_]{3,32}$` — reuse the regex so a CLI-made account can't hold
      characters self-service signup rejects.
- [ ] **T47 · Close the login account-existence oracles** — `api/login.php` leaks membership two
      ways. (a) The `429 {error:"locked"}` branch at line 40 is only reachable for a username that
      exists, **and it returns before the `login_attempts` insert at line 46** — so once an account
      is locked an attacker can poll it forever without consuming any of their 30-failures-per-15-min
      IP budget. (b) `!$user || !password_verify(…)` short-circuits, so a real username costs a full
      argon2id verify (~tens–hundreds of ms) and a fake one returns immediately — one request per
      candidate, measurable over the internet. Fix: verify against a fixed dummy argon2id hash on the
      miss path so the cost is identical, and either fold "locked" into the generic 401 or record an
      attempt row on that path so polling is metered.
- [ ] **T48 · Harden the session cookie and HTTPS enforcement** — `api/lib.php:94` derives `secure`
      from `$_SERVER['HTTPS']`, which is correct on Dreamhost today but silently mints a **non-Secure
      90-day cookie** if TLS ever terminates upstream (a CDN, a proxy tier) — no error, no test
      failure. Make it unconditional except for the `cli-server` dev SAPI. The `http://` → `https://`
      301 does work live, but it comes from the hosting panel and isn't in the repo — codify it in
      `.htaccess` so it survives a host migration. Also rename the cookie to `__Host-sano_session`
      (all its current attributes already satisfy the prefix rules; costs one forced logout) so a
      future sibling subdomain can't toss a same-named cookie and pin a victim onto an attacker's
      session.
- [ ] **T49 · Bound the traffic ingest against a log flooder** — `tools/ingest-traffic.php` slurps
      the whole day into memory before filtering: one bucket per distinct (ip, UA) pair, one int per
      request, bot lines allocated too since the filter runs after the parse. An attacker rotating
      the User-Agent mints a fresh bucket per request; ~100k requests (≈1.2/sec) exhausts the 128 MB
      CLI limit, the day fails to ingest, and because Dreamhost keeps only ~7 days of logs **that
      history is permanently lost** if it goes unnoticed. Below that threshold the same flood writes
      unbounded rows — `traffic_errors` is keyed by distinct path, so requesting
      `/audio/<random>.mp3` repeatedly is one row each. Cap the per-visitor error/referrer maps,
      cap distinct visitors per day (overflow into `bot_requests`), apply the bot-UA test at parse
      time, and store min/max/session-count incrementally instead of the full `times[]`. Two related
      fixes in the same file: the `mine` flag at line 203 is set on *any* request to `/admin` or
      `/api/admin-*` **without checking the status**, so any visitor can hit `/admin/` once and
      permanently hide themselves from the dashboard's default view — require a 2xx. And sanitize
      log-derived strings at ingest (`parse_url` happily yields a host of `<script>alert(1)<`), so
      the admin dashboard's XSS-safety doesn't rest entirely on one `textContent` line.
- [ ] **T50 · Harden `--update-geo`** — the two CC0 CSV URLs are unpinned jsDelivr `latest` paths
      with no checksum, and a truncated download or an HTML error page silently produces a corrupt
      or empty index that `rename()` writes over the good one — after which every country reads
      `NULL` and the only signal is a `geo v4: 0 ranges` line. Pin the package version, require a
      plausible minimum range count before the rename, check the `fopen`/`rename` return values, and
      add `ctype_alpha($cc)` next to the existing `strlen` check (two arbitrary bytes into a
      `CHAR(2)` on a utf8mb4 connection throws inside the write transaction, which with no exception
      handler kills the nightly run every night until someone notices). TLS verification itself is
      fine — PHP's https wrapper verifies peer and hostname by default.
- [ ] **T51 · Keep secrets and device IDs out of the cron logs** — none of the four CLI scripts
      installs a `set_exception_handler` (unlike `api/lib.php`), so an uncaught `PDOException` prints
      a full stack trace into `~/sano-traffic.log` / `~/sano-reminders.log`; PHP includes call
      arguments in traces unless `zend.exception_ignore_args` is on, which would put the **DB
      password** in a 0644 file on a shared host. Log the message and file:line only, set
      `zend.exception_ignore_args`, `chmod 600` both logs, and add `umask 077` to the cron lines.
      ~~Same pass: `send-reminders.php` echoes every subscriber's full push endpoint … strip
      non-printables from the reason.~~ **Done as part of T52 (2026-07-27)** — the rewritten dispatch
      logs `sub <id> (<username>)` instead of the endpoint, and pushes every reason through
      `preg_replace('/[^\x20-\x7E]/', '')` + a 120-char truncation. Still open here:
      `api/lib.php:24` logs the whole
      `$e` object for the same trace reason. And the `--json` debug mode uses a **hardcoded salt
      published in this repo**, so its printed hashes are trivially reversible to raw IPs if that
      output is ever shared — generate a random per-invocation salt for non-fixture input (the tests
      only compare hashes within one process, so they keep passing).
- [x] **T52 · Make the reminder cron fault-tolerant** — `tools/send-reminders.php:166` `foreach`es
      `$webPush->flush()` with no `try`/`catch`, and `p256dh`/`auth` are stored unvalidated, so one
      malformed key (a wedged browser, or deliberate) raises out of the batch prepare and terminates
      the script — dropping **every other user's** reminder for that hour, persistently, until the
      row is removed by hand. Wrap the per-report body so a failure increments `failure_count`
      instead of aborting, and prune at `failure_count > N` (today only 404/410 ever prunes).
      Depends on the shape validation in T42.
  - [x] **Delivered (2026-07-27)** — a `try`/`catch` around the existing loop would have stopped the
        crash but silently dropped everyone queued behind the bad row: `flush()` is a **generator**
        that calls `prepare()` (the encryption step) from inside itself, so a throw there kills the
        generator and everything still queued, and the library's default `batchSize` of 1000 means
        the whole run is always one batch. So each subscription now gets its own
        `queueNotification` + `flush()` inside a `try`/`catch`. DB work sits **outside** the catch,
        so a database error can't be mistaken for a push failure and quietly inflate
        `failure_count`. Added `MAX_PUSH_FAILURES = 10`: a subscription failing that many times
        consecutively is deleted rather than retried hourly forever (404/410 still deletes at once,
        success still resets to 0), plus a `sent · failed · dropped` summary line.
        **Why T42's validation wasn't enough:** shape validation can't prove a 65-byte `0x04`-tagged
        blob is a point actually *on* the P-256 curve, so a well-formed-but-invalid key still throws
        in the encryption step. Verified on the server with a throwaway user and three
        subscriptions — two with valid-shaped off-curve keys, one with a genuine `openssl`-generated
        P-256 point. **Control (old code): `RuntimeException: Unable to compute the agreement key`
        out of `WebPush->prepare()`, exit 255, 0 of 3 processed.** New code: all 3 processed, exit 0
        — the second bad row proving the loop survives the first throw, and the real-point row
        taking the normal delivery path (clean 400 from Apple). Priming one row to `failure_count=9`
        then re-running retired it (`DROP … after 10 failures`) while the other two incremented to
        2/10 and survived. Fixture and both staged script copies removed afterwards; the live table
        is back to its single real subscription and `--dry-run --force` still reports
        `would notify ross (sub 2)`. Cost: sequential HTTP instead of Guzzle's parallel pool —
        revisit only in the hundreds of subscribers. **Trade-off accepted:** no local test coverage;
        this script needs the server's vendor tree + MySQL, so the verification above is the record.
- [ ] **T53 · Same-origin guard on the service-worker notification URL** — `sw.js:85` takes
      `data.url` straight from the push payload and passes it to `c.navigate(target)`, which
      **retargets the user's already-open Sano window**, and to `openWindow()`. Not reachable today
      (the sender hard-codes `/`, and payloads are VAPID-signed and encrypted), but it means a VAPID
      key leak or a bug in the reminder script escalates from "wrong message" to "every subscriber's
      app window redirected to a phishing page." Resolve against `location.origin` and fall back
      to `/`.
- [ ] **T54 · Security hardening bundle** — small independent items, none individually urgent:
      per-IP throttles key on the full IPv6 address so anyone with a routed /64 has 2^64 buckets and
      bypasses both the login and signup limits (truncate to /64 — `login.php:26`, `register.php:38`)
      · no `password_needs_rehash()` on successful login, so hashes never upgrade
      · `Object.assign(defaultState(), parsed)` (`js/sano.js:232`) lets a `__proto__` key in a state
      blob replace the state object's prototype (self-inflicted only, one-line fix)
      · `showNotice(html)` (`js/admin.js:210`) is an `innerHTML` sink with an HTML-typed parameter —
      all six callers pass literals today, but the signature invites a username; and `esc()` doesn't
      escape `'`, so it's element-safe but not attribute-safe · add `declare(strict_types=1)` to the
      seven `api/` files missing it · set `PDO::ATTR_EMULATE_PREPARES => false` (not an injection
      risk under utf8mb4, but packed binary IPs currently travel as string literals, and a mangled
      one makes the throttle **fail open** silently) · index `sessions.expires_at` and
      `login_attempts.created_at`, and move the housekeeping DELETEs to *after* the throttle check so
      a 429'd attacker can't force two full table scans per request · `Header always set` in
      `api/.htaccess` · add `X-Frame-Options`, `Permissions-Policy: microphone=(self), camera=(),
      geolocation=()`, COOP and CORP · add `--delete-after` to the deploy rsync so a renamed or
      deleted file can't linger live forever · add `permissions: { contents: read }` to the CI
      workflow.
- [ ] **T55 · Traffic retention and salt rotation** — the T40 design is sound (no raw IP reaches
      disk or DB on any path — verified across every write and error path) but two GDPR-shaped gaps
      remain: nothing ever prunes `traffic_visitor_days`, so pseudonymous rows accumulate forever,
      and one permanent salt means one lifetime-linkable identifier. Purge visitor-day rows older
      than ~13 months and rotate the salt yearly (accepting that `is_new` resets at each rotation).
      Also document explicitly in `@docs/data-model.md` that the salt is a credential of the same
      class as the DB password — the current wording ("can't be walked back to a person") is true
      only for someone holding the DB *alone*; with both, the IPv4 space is small enough to invert
      cheaply.

## Testing

- [x] **T56 · Fix the flaky `no horizontal overflow across mobile widths` e2e** — the 9-width
      viewport sweep (`tests/e2e/home.spec.mjs:27`) failed all three attempts on the T40 commit's CI
      run (30228655062, Chromium), each hitting the **60 s test timeout** exactly — `page.waitForFunction`
      timed out, then the retries reported "Target page, context or browser has been closed", which is
      the timeout tearing the context down rather than a second distinct fault. It passed on the T41
      and T42 runs, so it isn't a real overflow regression: the test is simply sitting near the
      timeout boundary (~20 s locally, but it re-navigates and re-boots per width while CI runs
      Chromium and WebKit projects concurrently against a single-threaded `php -S`). Per the
      no-flaky-tests rule this is a defect, not noise. Fix the cost rather than raising the timeout —
      resize within one page context instead of a fresh navigation per width, or split the sweep so
      each width is its own short test. Found during the T42 CI check (2026-07-27). **It went on to
      fail the T43 run too — 2 of 4 runs, i.e. ~50%**, which is why it was taken before T45.
  - [x] **Fixed (2026-07-27)** — measured the cost before changing anything: **14.5 s in Chromium
        alone**, because the sweep called `boundingBox()` once per matched element and a mid-course
        path renders **107 `.path-node` + 107 `.path-label`** — 216 elements × 9 widths ≈ **1,900 IPC
        round trips**, on top of 9 full navigations. Two changes: every element for a width is now
        measured in a **single in-page `evaluate`**, and the sweep **resizes in place** instead of
        navigating. Resizing is faithful because the app re-renders the path on resize; rather than
        wait out that 150 ms debounce (a fixed sleep being exactly the wrong fix here) the test calls
        `window.Sano.renderHome()` — the same function the debounced handler calls — so the
        re-render is synchronous and there is no race to lose. The evaluate now also asserts
        `#screen-home` is showing and path nodes exist, so an empty render can't pass vacuously, and
        it returns **all** violations for a width instead of stopping at the first. A separate short
        test keeps cold-load coverage at the narrowest width, which the in-place sweep would
        otherwise lose. **14.5 s → ~1 s** (whole suite 38 tests/35 s → 40 tests/26 s); `home.spec.mjs`
        across both browsers runs in 2.4 s, stable over three consecutive runs. Verified it still
        catches a real regression by injecting `#progress { min-width: 900px }` — it failed with
        `#progress[0] right edge at 975.9, past 320`. Worth noting the page-level `scrollWidth` check
        did **not** fire on that injection while the element-bounds check did, which is why both are
        kept.

- [x] **T17 · Fix the flaky WebKit match-lesson e2e** — `tests/e2e/lesson.spec.mjs` match rounds
      intermittently time out under WebKit: `stepLesson` (`tests/e2e/_helpers.mjs`) clicks match tiles
      with normal (non-force) clicks and relies on `boot()`'s inline animation-freeze, but that can't
      kill **pseudo-element** (`::before`/`::after`) animations — so a tile stays "unstable" and the
      click times out. Pre-existing (reproduces on clean `main`, both before and after T16). A blanket
      `*::before { animation: none !important }` loses specificity to the app's class-scoped animation
      rules, so the fix needs either a targeted freeze stylesheet or a stability-tolerant match click.
      **Fixed 2026-07-20** — took the stability-tolerant-click route: `stepLesson` now force-clicks
      each pair (past WebKit's actionability "stable" gate) and verifies both tiles reached `.matched`,
      retrying the pair, then waits for + force-clicks `#lesson-continue`. Corrected root cause: the
      destabilizer is the `tile-pop`/`tile-shake` keyframe on the tile **element** (not a pseudo-element);
      the inline freeze suppresses it, but under WebKit + parallel-load render churn the stability gate
      still intermittently timed out. Test-only change (`tests/e2e/_helpers.mjs`); verified match tests
      30× green under WebKit and full e2e (38) green.

- [x] **T39 · Watch: webkit type-recall e2e retried once under full-suite load (2026-07-22)** —
      `tests/e2e/lesson.spec.mjs` "a type-what-you-know (recall) exercise renders and can be
      completed" flaked (passed on retry) in one full-suite run during T37/T38 work, then passed
      38/38 on an isolated `--ui` re-run. **Recurred 2026-07-23 → root-caused and fixed:** not
      timing at all — `buildExercises` randomly bundles up to 5 single-word recall-strength reviews
      into the listen-match grid (`shuffleArray(listenable).slice(0, 5)`), and a bundled item gets
      no card of its own, so whenever the shuffle absorbed the seeded graduated word the lesson
      genuinely contained no `type` card (the failing run saw only wordbank + listenMatch). Fix:
      `boot()` (tests/e2e/_helpers.mjs) now stubs `Math.random` with a seeded PRNG (mulberry32),
      so every e2e run draws the identical lesson in every browser/retry — freezing nondeterminism
      like the animation freeze, instead of loosening assertions. Verified: two consecutive
      full-suite runs 38/38, zero flaky.

## Romanization

- [x] **T19 · Handle visarga (ः, U+0903) in the romanizer** — `tokenize()` now maps visarga to a coda
      "h" (प्रायः → Praayah, अतः → Atah, दुःख → Duhkha); `VISARGA` is exported in `_tables` and added to
      the romanize-coverage known-set. The प्रायः `WORD_OVERRIDE` was dropped (tokenizer handles it); a
      `PRON_OVERRIDE` remains only to polish its pron to *praa-yah*. Minor cosmetic left: word-final
      visarga after an inherent vowel doubles the h in pron (अतः → uh-tuhh); harmless, none in-corpus.

- [x] **T22 · Generalize व→b for व्य- words in the romanizer** — Nepali realizes व as "b" in the
      common व्य- cluster (व्यस्त→byasta, व्यक्ति→byakti, व्यापार→byaapaar, व्यवसाय, व्यवहार), but the
      rules default व→w so these read "wy-". व्यस्त is patched via `VA_AS_B`; व्यक्ति already shipped as
      "wyakti" (batch 3). Extend `VA_AS_B` (or add a व्य→by rule) to cover the cluster, re-render the
      affected word slugs (wyakti→byakti, etc.), and bump `AUDIO_VERSION`. Then future व्य- words (e.g.
      व्यापार, deferred out of batch 6 for this reason) can be added cleanly.
      **Done 2026-07-20** — a positional व्य→"b" rule in the shared tokenizer (`js/romanize.js`),
      kept on the halant path so the final-schwa cluster guard still applies (भव्य→Bhabya); व्यस्त
      dropped from `VA_AS_B` (rule covers it); व्यक्ति pron polished (`byak-tee`, like `byas-ta`).
      The only affected clip was **renamed** (`git mv wyakti.mp3 → byakti.mp3` — the TTS input व्यक्ति
      is unchanged, so no re-render / no credits), words.json regenerated, `AUDIO_VERSION` 22. Golden
      tests added (incl. unlisted व्यापार + word-final भव्य). व्यापार is now cleanly addable (T29+).

## Learning engine — SR-05 relaunch (Phase 1)

Restructures the learning plan for mastery-based, high-repetition progression (interviewed +
planned 2026-07-01; reviewed and shipped 2026-07-01). Green across all test tiers. The re-cut
sub-unit **titles + goals are AI-drafted — still Ross's to refine** (T9).

- [x] **T6 · Learning-steps scheduler + softened intervals** — new words climb a gentle ladder
      (1 → 2 → 4) and only graduate after being *recalled* ~2×; intervals softened (was
      1 → 2 → 5 → 16 → 55); each new word gets an in-session tap-based word-bank recall. (`js/sano.js`
      SR-05 block, `tests/unit/scheduler.test.mjs`.)
- [x] **T7 · Mastery gate + in-progress path UX** — a unit unlocks the next only when every word has
      graduated (not merely introduced); the current node's ring now fills by *mastery*; tapping an
      all-introduced-but-unmastered unit drills its weakest words. (`unitIsComplete`, `renderPath`,
      `startUnitLesson`, `placeBefore`.)
- [x] **T24 · Two-tone ring so early progress shows** — the T7 mastery-only ring sat at 0% for a
      unit's first ~4 days (nothing graduates that fast), reading as "no progress" after a couple of
      lessons (Ross-reported). `renderPath` now layers a faint `--accent-soft` "introduced" arc under
      the solid `--accent` "mastered" arc, so the ring moves the moment you practice yet still fills
      only at unlock. New `--accent-soft` token (both themes); dev-seed `earlyring` scenario (0e).
      (`js/sano.js` ring block, `css/sano.css`, `tools/dev-seed.html`.)
- [x] **T8 · Adaptive, review-dominant daily loop** — `dailyPlan()` throttles new words by review
      debt and sizes reviews to a ~18–20 exercise session, carrying the backlog. (`startDailyLesson`,
      `renderHome`.)
- [x] **T9 · Split units >14 items** — 44 → 58 units (~8–12 words each), item ids untouched, anchor
      ids preserved on chunk 1. **New sub-unit titles/goals are AI-drafted → Ross's review.**
      (`js/data.js`.)
- [x] **T10 · Schema v3 migration (fresh start)** — `migrateV2State` keeps name/streak/lifetime
      tally, resets learning progress, restarts at unit 1. (`tests/unit/migration.test.mjs`.)
- [ ] **T11 · Phase 2 — grow vocabulary toward ~1,550 words (the everyday tier)** — source the
      highest-frequency missing words from the `tools/dict` frequency ranking (ties to **T3**), add as
      new ~8–12-word mastery-gated units by frequency + situation; regenerate audio for the new items
      only and bump `AUDIO_VERSION`. Nepali `dev` AI-drafted → Ross's review. Multi-batch — driven by
      the pipeline below (T14); each batch = select → draft → review → merge → audio. **Target
      ~1,550** — the everyday-register candidates the dictionary surfaces (873 remaining as of batch 3
      start, atop 683 taught); reaching the older ~2,000 goal would mean dipping into the formal
      register. Done: batch 1 (verbs, T15), batch 2 (adjectives, T16). Next: nouns (batch 3+, ~557
      candidates — the biggest well), then adverbs (~84) and function words (~40).
- [x] **T14 · Build the expansion pipeline** (reusable across all T11 batches) —
      `tools/dict/select-candidates.mjs` (mechanical: ranks the everyday, not-yet-covered words of a
      given part of speech from `dictionary.json`), a Claude drafting pass (wraps each word in a
      usable frame → `design/expansion-draft.json`), and a localhost review tool
      `design/expansion.html` + `expansion-save.php` (edit / approve / reject → the gitignored
      `expansion-approved.json`; never touches `js/data.js`). Approved rows are merged by hand, then
      audio rendered (`build-words.mjs` → `synth-app.mjs --new --words --new`, bump `AUDIO_VERSION`).
- [x] **T15 · Batch 1 — everyday verbs (~50)** — 50 high-frequency everyday verbs, curated (dropped
      verbs already taught + advanced passives/causatives) and wrapped in short natural frames.
      Reviewed + approved, then merged into `js/data.js` as 5 units after `verbs-past` (Reactions &
      Opinions, Asking for Help, Getting Around, Making & Doing, Everyday Actions); `tools/dict`
      coverage refreshed, audio rendered (50 phrase + 57 word clips, `AUDIO_VERSION` 7), dev-seed
      scenario added. Committed 620a0bd, shipped ea07f30. **Still open:** the 5 unit titles + goals are
      AI-drafted → Ross's refinement.
- [x] **T18 · Batch 3 — everyday nouns (~46)** — 46 high-frequency everyday nouns, curated from the
      top-90 `--pos noun` pool (concrete nouns are already taught, so this is the abstract/everyday-life
      gap: reasons, decisions, plans, money, relationships). Taught as short frames (they don't emoji);
      merged as 5 units **appended at the end of the path** (Time & Events, Ideas & Conversation,
      Problems & Solutions, Money & Business, People & Places) — 73 units / 729 items. Coverage
      refreshed, audio rendered (46 phrase + 63 word clips, `AUDIO_VERSION` 9), dev-seed scenario
      added. Unit titles/goals AI-drafted → Ross's refinement. **Shipped** — verified live on namastesano.com
      2026-07-20 (units present, `AUDIO_VERSION` 21). Unit titles/goals still AI-drafted → Ross's refinement.
- [x] **T20 · Batch 4 — everyday adverbs (~44)** — 44 high-frequency everyday adverbs (only 1 of the
      top-70 was already taught), taught as short frames; merged as 5 units **appended at the end of
      the path** (How Much, Before & After, How Often, How & Where, Linking & Certainty) — 78 units /
      773 items. Dropped near-duplicate demonstratives. Coverage refreshed, audio rendered (44 phrase +
      55 word clips, `AUDIO_VERSION` 10), dev-seed scenario added. Also fixed visarga in the romanizer
      (T19) so प्रायः works. Unit titles/goals AI-drafted → Ross's refinement. **Shipped** — verified live on namastesano.com
      2026-07-20 (units present, `AUDIO_VERSION` 21). Unit titles/goals still AI-drafted → Ross's refinement.
- [x] **T21 · Batch 5 — essential function words (~27)** — 27 high-leverage function words
      (pronouns, conjunctions, counters, big numbers, particles/postpositions) — the grammatical glue.
      Only genuinely untaught items (course already has basic pronouns, connectors, numbers to 1000);
      taught as short frames; merged as 5 units **appended at the end of the path** (Pronouns & Self,
      If/When & Because, Counting Things, Big Numbers, Little Connecting Words) — 83 units / 800 items.
      Coverage refreshed, audio rendered (27 phrase + 30 word clips, `AUDIO_VERSION` 11), dev-seed
      scenario added. Smaller batch — function words are inherently fewer. Unit titles/goals AI-drafted
      → Ross's refinement. **Shipped** (commit e7194aa).
- [x] **T23 · Batch 6 — everyday-life nouns, part 2 (~45)** — a second nouns pass, deeper in the pool
      with hard curation for genuinely everyday domains (skipping civic/news terms): 45 nouns as short
      frames, merged as 5 units **appended at the end of the path** (Travel & Transport, City &
      Country, Money & Commerce, School & Mind, Health & Life) — 88 units / 845 items. Coverage
      refreshed, audio rendered (45 phrase + 58 word clips, `AUDIO_VERSION` 12), dev-seed scenario
      added. व्यापार deferred pending T22 (व→b). Unit titles/goals AI-drafted → Ross's refinement.
      **Shipped** (commit f0f5e94).
- [x] **T25 · Batch 7 — feelings & everyday things (~33)** — raw-frequency everyday pool exhausted
      (remaining top words are civic/news nouns or already-taught verbs), so a **hand-curated themed
      pocket** of verified gaps: emotions, body parts, clothes, food/kitchen — 33 frames merged as
      **4 units appended at the end of the path** (Feelings & States, More Body Parts, Clothes &
      Accessories, More Groceries) — 92 units / 878 items. Dropped the sentence-final danda (।) to
      match the course's no-terminal-punctuation frame convention. Coverage refreshed, audio rendered
      (33 phrase + 52 word clips, `AUDIO_VERSION` 13), dev-seed scenario added. Unit titles/goals +
      the `मलाई ___ लाग्यो` frame repetition AI-drafted → Ross's refinement.
- [x] **T26 · Batch 8 — calendar, festivals & directions (~27)** — second hand-curated themed pocket:
      the 12 Bikram Sambat months (colloquial spellings — बैशाख not वैशाख, साउन not श्रावण), major
      festivals, and cardinal directions (`-तिर` pattern) — all verified 0-coverage gaps. 27 frames
      merged as **3 units appended at the end of the path** (Nepali Calendar, Festivals & Celebrations,
      Directions & Places) — 95 units / 905 items. **दशैं forced to "Dashain"** (whole-word
      WORD_OVERRIDE + PRON_OVERRIDE in `js/romanize.js`, keeping the word-final nasal the Lite scheme
      drops) — Ross-requested. व्रत dropped (romanizes "Wrat" not "Brat"; see T22) → used पूजा. Coverage
      refreshed, audio rendered (27 phrase + 28 word clips, `AUDIO_VERSION` 14), dev-seed scenario
      added. Unit titles/goals AI-drafted → Ross's refinement.
- [x] **T27 · Batch 9 — linking words, more verbs & odds (~22) — FINAL breadth batch** — an honest
      assessment (verified spot-checks: ~all top "everyday not covered" dictionary rows are false gaps
      already taught in a conjugated/spelling variant, plus news-register noise) found the everyday pool
      effectively picked clean. So a last hand-curated pass of the highest-value genuine gaps: linking
      words (शायद, तैपनि, अवश्य, जहाँ, जसरी, जबसम्म, जस्तो, अलिकति), more everyday verbs (माग्नु, सम्झनु,
      बिर्सनु, रोज्नु, पढाउनु, हाँस्नु, रुनु, नाच्नु, छुनु), and odds & ends (छेउ, वारि, पारि, आधुनिक, साझा) —
      22 frames merged as **3 units appended at the end of the path** (Linking Words, More Everyday Verbs,
      Odds & Ends) — 98 units / 927 items. **Five drafted frames dropped mid-merge as spelling-variant
      dups** the initial grep missed (अरू≈अरु "else", कम्तिमा≈कम्तीमा "at least", and सोध्नु/फर्कनु/फाल्नु
      already taught as म सोध्छु / म फर्किन्छु / म फोहोर फाल्छु). Coverage refreshed, audio rendered (22
      phrase + 27 word clips, `AUDIO_VERSION` 15), dev-seed scenario added. Unit titles/goals AI-drafted
      → Ross's refinement. **After this, T11 pivots from breadth to depth** — more frames/phrases around
      words already known (a new task when Ross starts it).
- [x] **T16 · Batch 2 — everyday adjectives (~45)** — 45 high-frequency everyday adjectives, curated
      from the top-80 `--pos adj` pool (dropped semantic dupes already taught + news/formal terms) and
      wrapped in short natural frames (phrases-style). Reviewed + approved, then merged into
      `js/data.js` as 5 units after `comparing-things` (Size & Feel, Good/Bad & Right, Order &
      Sequence, Same or Different, States & Conditions); aligned अरू→अरु to the course's spelling;
      `tools/dict` coverage refreshed, audio rendered (45 phrase + 58 word clips, `AUDIO_VERSION` 8),
      dev-seed scenario added. **Still open:** the 5 unit titles + goals are AI-drafted → Ross's
      refinement; **push/deploy pending Ross's go.**

## Learning engine — T11 depth pivot (Phase 3)

The breadth expansion (T11 batches 1–9) picked the everyday-frequency pool clean, so T11 pivots from
**breadth → depth**: more frames/phrases around words already known, rather than new vocabulary.
Direction chosen with Ross 2026-07-02 — **Both** structures, emphasis on **real expressions** +
**everyday contexts**.

- [x] **T28 · Rotating-frames mechanism** — an item may carry optional `frames: [{dev,en}]`; reviews
      rotate through them so a known word is practiced in varied contexts **without adding path
      units** (the SR record stays keyed by item id — one record, many sentences). Frame 0 is the
      item's own `dev`/`en` (audio id `<id>`); extras get `<id>-f1`, `<id>-f2`, … `js/romanize.js`
      derives `np`/`pron` per frame; `itemFrames`/`frameForSeen`/`pickFrame` + `ex.frame` threaded
      through the render/grade sites (`js/sano.js`); `synth-app.mjs` + `build-words.mjs` expand frames
      so `--new` renders only the new clips. Unit test + data validation + dev-seed scenario (0f).
      Committed `3fea017`; 3 pilot items (maagnu/samjhanu/chheu) got demo frames, audio rendered
      (6 phrase + 5 word clips, `AUDIO_VERSION` 16). **Still open:** the pilot frame `dev` is
      AI-drafted → Ross's review; **push/deploy pending Ross's go.** Bulk content is T29/T30.
- [x] **T29 · Depth content — everyday-context alternate frames** — populate `frames` on a curated
      set of already-taught items with everyday-context variety, so each word stops being tied to one
      memorized sentence. Nepali `dev` AI-drafted → Ross's review; audio rendered for the new frame
      clips only, bump `AUDIO_VERSION`. Multi-batch, by part of speech.
  - [x] **Batch 1 — core present-tense verbs (10 items · 20 frames)** — everyday-context + real-expression
        frames on the `verbs-present` unit (herchu → "I watch a movie," dinchu → "Please give me water,"
        padhchu → "I read the news," …). Approved by Ross; audio rendered (20 phrase + 8 word clips,
        `AUDIO_VERSION` 17); dev-seed 0f extended.
  - [x] **Batch 2 — core past-tense verbs (12 items · 24 frames)** — everyday-context frames on the
        `verbs-past` unit (khaen → "I ate rice," gaen → "I went to the market," heren → "I watched a
        movie," …). Drafted into the T31 tool, approved by Ross, merged; audio rendered (24 phrase +
        5 word clips, `AUDIO_VERSION` 18); dev-seed 0f extended.
        (The पिउनु-for-tea quirk was fixed 2026-07-20, Ross-approved: f1 is now "मैले चिया खाएँ"
        "I had tea" — the colloquial खानु the item's own usage note teaches; clip re-rendered,
        `AUDIO_VERSION` bump folds into the next batch merge.)
  - [x] **Batch 3 — descriptive adjectives (20 items · 40 frames)** — attributive + fresh-predicate
        frames on the `adj-*` units (lamo/chiso/baliyo/khali/khula/sajilo/gahro/kharab/sundar/byasta/
        jaruri/surakshit/halka/bhari/sahi/galat/kada/pakka/bahadur/niko): "my hair is long," "a busy
        road," "this road is safe." Drafted into the T31 tool, approved by Ross, merged; audio rendered
        (40 phrase + 8 word clips, `AUDIO_VERSION` 19); dev-seed 0f now derives its framed set from
        COURSE. (Merge caught a scanner bug — double-quoted `en` strings; fixed + re-verified all 20
        match the draft exactly.)
  - [x] **Batch 4 — position + time/frequency (14 items · 28 frames)** — everyday-context frames on
        `place-position` + `duration-frequency` bare words (माथि/मुनि/अगाडि/पछाडि/भित्र/बाहिर,
        हप्ता/महिना/वर्ष/सधैं/कहिलेकाहीं/पछि/अघि/मिनेट): "next week," "I always get up in the morning,"
        "an hour ago." Approved by Ross, merged; audio in the combined render below.
  - [x] **Batch 5 — modal patterns (6 items · 12 frames)** — the can/want/must constructions
        (`modals-can-want-must`) with a different **known verb** swapped in (म पढ्न सक्छु "I can read,"
        मलाई सुत्न मन लाग्छ "I want to sleep," मलाई पढ्नु पर्छ "I have to study"), so the pattern
        generalizes. Approved by Ross, merged.
  - [x] **Batch 6 — common nouns (20 items · 40 frames)** — first depth batch on single-word `vocab`
        items (family/places/food/body/animals: आमा/बुवा/दिदी/छोरा, हस्पिटल/स्कुल/पसल/बस,
        खाना/भात/दाल/दूध/माछा, टाउको/आँखा/हात/पेट, कुकुर/बिरालो/गाई): "the dog is at home," "my eye is
        red," "the cow gives milk." Needed the **T32 routing tweak** (below) so a noun shown as a
        multi-word frame becomes a word-bank, not a type-the-sentence. Approved by Ross, merged.
        Batches 4–6 rendered together: 80 phrase + 22 word clips, `AUDIO_VERSION` 20.
  - [x] **Batches 7–9 — food & kitchen · household objects · weather, nature & animals (60 items ·
        120 frames)** — first depth batches on the object-noun pools (kitchen/pantry/fruit/veg,
        bedroom→personal items, weather/animals/colors); 2 frames per item, everyday-context +
        real-expression mix (बत्ती गयो/आयो, दसवटा मोमो दिनुस्, वाइफाइ पासवर्ड के हो?, जुत्ता बाहिर
        राख्नुस्). Every dev dup-checked against all 1,129 existing course sentences and
        romanize-verified at draft time; blanket-approved by Ross 2026-07-20, merged (145 items now
        framed). Rendering the frames surfaced the T35 root cause (below) — `build-words.mjs` now
        covers all units, so this render was 120 phrase + 331 word clips, `AUDIO_VERSION` 23.
        Dev-seed 0f derives from COURSE, no change needed. (Minor: the words build now flags 8
        cosmetic slug conflicts — the 3 known ones plus गोलभेंडा/गोलभेँडा, फूल/फुल, राति/राती,
        स्कुल/स्कूल, घमण्ड/घमन्ड — all pre-existing course spelling variants, audibly identical.)
  - [x] **Batches 10–12 — emotions & people · pronouns & connectors · numbers & weekdays (60 items ·
        120 frames)** — batch 10: all core emotions + बोर/आशा + family remainder + साथी/बच्चा/मान्छे/
        छिमेकी (चिन्ता नगर्नुस्, म तिमीलाई माया गर्छु, दाइ, नमस्ते); batch 11: 9 pronouns — म/यो/त्यो/मेरो
        skipped as already-varied — + all 11 connectors with two-clause frames per Ross (म जान्छु तर ऊ
        आउँदैन, चिया कि कफी?, अनि तपाईं?), agreement-teaching pronoun frames (उहाँ…हुनुहुन्छ,
        उनीहरू…छन्/हुन्); batch 12: numbers एक–दस sans छ/नौ + बीस/पचास/सय/हजार/आधा with shop/time frames
        (पचास प्रतिशत छुट, पाँच बज्यो) + all 7 weekdays (शनिबार बिदा हो). Dup-checked against all 1,249
        course sentences; some frames deliberately introduce transparent new forms (-दै progressives,
        आउँदैन/लाग्दैन, आउनुहुन्छ, बिदा). Blanket-approved by Ross 2026-07-20, merged (205 items now
        framed); audio 120 phrase + 20 word clips, `AUDIO_VERSION` 24. Shipped with the `VA_AS_B`
        **prefix-match** romanizer fix (वर्षको→Barsako, वनमा→Banamaa; golden tests; no existing slug
        affected). Remaining unframed pools for future batches: हजुरबुवा/हजुरआमा/बुढा/बुढी, छ/नौ, the
        formal emotions-more words, core communication units, ~135 object-noun leftovers.
  - [x] **Batch 13 — odds & ends: grandparents & spouses, छ/नौ, time-of-day, colors (20 items ·
        40 frames)** — हजुरबुवा/हजुरआमा/बुढा/बुढी with honorific frames (मेरो बुढा बजार जानुभयो, मेरी
        बुढी नेपाली सिक्दै हुनुहुन्छ), छ/नौ clock frames (नौ बजे पसल बन्द हुन्छ), the 8 time-of-day
        words (आज मेरो जन्मदिन हो, हिजो राति जाडो थियो), and 6 colors (यो निलो हो कि कालो?, मेरो कपाल
        सेतो भयो; गुलाबी/प्याजी left for the nature-leftovers batch). Approved by Ross 2026-07-21,
        merged (225 items framed), audio rendered (40 phrase + 7 word clips), `AUDIO_VERSION` 25.
        Shipped commit 5260261. Plan after this: ~2 batches core communication, ~2 batches best
        object-noun leftovers, then close T29's frame coverage (~300 items framed).
  - [x] **Batches 14–17 — the four closing batches (80 items · 160 frames)** — drafted 2026-07-21,
        blanket-approved by Ross 2026-07-21, merged in one pass (305/959 items framed), audio
        rendered, `AUDIO_VERSION` 26. **T29 frame coverage is now closed** — every high-frequency
        single-word item carries rotating everyday frames; the remaining unframed pool is the
        low-value tail + multi-word phrases that already carry context. (Minor: new cosmetic slug
        conflict chhau छौं×3/छौ×1 — informal छौ shares a slug with plural छौं under nasal-dropping;
        audibly near-identical, same class as the 8 known ones.) **14 · everyday communication & getting around:** politeness
        words नमस्ते/हजुर/होला/कृपया/धन्यवाद, question words कसरी/किन/कुन (बसपार्क कसरी जाने?),
        बिस्तारी/छिटो + informal आइज/जाऊ, the 4 comparison words (चिया कफी भन्दा सस्तो छ, अलि कम
        गर्नुस्), transport बैंक/एयरपोर्ट/बसपार्क/ट्याक्सी. **15 · places, positions & replies:**
        होटल-as-eatery, अफिस, त्यहाँ/नजिक/तिर/बायाँ/दायाँ/रोक्नुस्/बीचमा/सम्म, तिमी (introduces
        informal छौ/हौ), होइन tag-question, नमस्कार, नराम्रो, हुन्छ/हुँदैन reply pairs, the 4 -तिर
        directions with true-geography frames (हिमाल उत्तरतिर छ; introduces भारत + पोखरा). **16 ·
        food & kitchen leftovers:** पुग्यो/पर्दैन usage, तेल/मसला/फल/अचार/मह/लसुन/धनिया/काँक्रो +
        सुन्तला/आँप/कागती + चिउरा/सेलरोटी/समोसा/मिठाई/रक्सी/लस्सी/जुस; introduces the missing taste
        words गुलियो (मह गुलियो हुन्छ) and अमिलो (कागती अमिलो हुन्छ); culture frames (तिहारमा सेलरोटी
        बनाउँछौं, दहीसँग चिउरा). **17 · household & nature leftovers:** लुगा/चप्पल/चश्मा/चर्पी/सिरानी/
        ऐना/ताला/रिमोट/कम्प्युटर/मोमबत्ती/बाल्टी (बत्ती गयो, मोमबत्ती बाल्नुस्) + चन्द्रमा/ताल/खोला/
        झरना/भूकम्प/साँप/भालु (वनमा भालु छ — exercises the VA_AS_B prefix fix) + गुलाबी/प्याजी.
        Saturated words skipped throughout (हो/छ/छैन, राम्रो/ठूलो/धेरै, कहाँ/यहाँ, बजार, घरमा…).
        All 160 devs dup-checked + romanize-verified (validator caught "चर्पी कहाँ छ?" as an existing
        item → swapped). After approval: merge → render → `AUDIO_VERSION` 26 → **T29 frame coverage
        closes at ~305/959 items** (remaining unframed = the low-value tail + multi-word phrases that
        already carry context).
- [x] **T32 · Depth mechanism — route by the shown frame, not the canonical word** — `buildExercises`
      (`js/sano.js`) now computes `multiWord` from `pickFrame(item).np`, so a single-word `vocab` item
      whose review lands on a multi-word alternate frame is drilled as a word-bank (assemble the
      phrase) instead of free-typing the whole sentence. No-op for items whose canonical is already
      multi-word (all prior batches). Verified headlessly (एक → type at its word, word-bank with a
      multi-word frame); full suite green. Unlocks the large single-word noun pool for depth (T29 batch 6+).
- [x] **T30 · Depth content — new "real expression" units** — via the existing expansion pipeline
      (T14), add a few new mastery-gated units of short, high-utility whole utterances built from
      already-known vocabulary. Appended at the path's end; Nepali `dev` AI-drafted → Ross's review;
      audio rendered for the new items only, bump `AUDIO_VERSION`.
  - [x] **Batch 1 — four themed units (32 utterances)** — drafted into the T14 expansion tool
        (`design/expansion.html`), blanket-approved by Ross, merged as four new `kind:'phrases'` units
        appended at the path's end (`COURSE` now 102 units / 959 items): **Sounding Natural** (saanchai
        "really?!", chhodnus "never mind", ke garne "oh well"), **On the Move** (yahin roknus "stop
        here", kati taadha cha "how far?", baayaa/daayaa jaanus "turn left/right"), **Being a Guest**
        (ma aghaaen "I'm full", piro nahaalnus "no spice", ma shaakaahaari hu "I'm vegetarian",
        khanako lagi dhanyabaad "thanks for the food"), **At the Shop** (dherai mahango bhayo "too
        expensive", chhut dinus "give a discount", sabai kati bhayo "how much for everything?"). Every
        `dev` dedup-checked against the course; one guest phrase swapped off an eyelash-ra (ZWJ) spelling
        for a clean one. Audio rendered (32 phrase + 19 word clips, `AUDIO_VERSION` 21); dev-seed card
        added (four `seed('unit:…')` buttons). (Minor: words.json flags 3 cosmetic slug conflicts —
        `mitho` मिठो/मीठो, `sidhaa` सिधा/सीधा, pre-existing `bhane` भने/भनेँ — audibly identical, tile
        clip plays a correct pronunciation either way; easy to align spelling later if wanted.)
- [x] **T31 · Frames-review tool** — `design/frames.html` + `design/frames-save.php` (mirrors the
      `expansion.html` pipeline): groups candidate frames under their target item (English + canonical
      `dev`/romanization), live-romanizes the editable frame `dev`, and lets Ross edit / approve /
      reject; POSTs decisions to `frames-save.php` → gitignored `design/frames-approved.json` (never
      touches `js/data.js`). Draft format `design/frames-draft.json` (gitignored) = `[{ id, item,
      itemEn, itemDev, dev, en }]`; approved frames merged into the items' `frames: []` by hand, then
      audio rendered (`<id>-fN`, bump `AUDIO_VERSION`). Seeded with the next batch — **24 past-tense
      verb frames awaiting Ross's review** (T29 batch 2). Not deployed (`design/` never ships).
- [ ] **T33 · Accept either gloss for multi-English phrases** — many items carry two English
      glosses in `en` (`"Excuse me / I'm sorry"`, `"Enough / That's sufficient"`, …). Where the
      **English is the graded answer**, only the full both-glosses string is accepted today, so
      producing one gloss grades wrong. Concretely: the **`wordbank` np-en** direction
      (`js/sano.js` `renderWordbank`, target `f.en`) forces the user to assemble *all* the words of
      *both* glosses; **`choice` np-en** shows the whole `"A / B"` as a single option (works but
      clunky). The **en-np** directions are fine (one Nepali answer) but display both glosses in the
      prompt. Fix: split `en` on ` / ` and accept **any one** alternative when grading an
      English answer (and only tile/offer one gloss's words in np-en word-bank), leaving the
      display/prompt choice to review. **149 candidate items** enumerated for Ross in
      `docs/multi-english-review.md` (grouped by unit, checkbox-per-item) — a few are pronoun/register
      slashes ("He / She (informal)") that are one meaning, not accept-either; the review sorts true
      alternates from near-synonyms ("Vegetables / Curry") from those better trimmed to one gloss.
      Regenerate the list with the T33 script if data changes. Needs a dev-seed scenario + a unit test
      on the split-and-accept-either grader.
  - [x] **Mechanism (grader + data model)** — `acceptedEnglish(ex)` in `js/sano.js` returns the
        accepted glosses for a "build/type the English" (np-en) exercise: an item opts in with
        `enEither: true` (split its `en` on ` / `) or an explicit `enAlt: [...]` (for a slash that
        sits mid-phrase, e.g. `ऊ गीत सुन्छ`). `checkExercise` accepts the answer if it matches ANY
        gloss; the np-en word-bank tiles only the FIRST gloss (so it's buildable). Unflagged items
        are byte-identical to before. Unit test `tests/unit/accept-english.test.mjs` (10 cases);
        full suite green.
  - [x] **Batch 1 — top-of-course through *Places & Getting Around*** (69 items). Ross's per-item
        call is encoded in the review doc: **kept the slash → accept-either** (22 items: `enEither`,
        or `enAlt` for the one mid-phrase `ऊ गीत सुन्छ`); **trimmed to one gloss → single `en`, no
        flag** (47 items, e.g. रोटी `Bread / Flatbread`→`Flatbread`, होटल `Restaurant / eatery`→`Hotel`,
        हजुर→`Yes (polite)`). English-only edits → no audio re-render. Those sections removed from
        `docs/multi-english-review.md` (80 items remain). हजुर/हुन्छ/हुँदैन keep their trimmed display
        `en` but gained `enAlt` for the extra senses Ross noted (hajur `['Yes','You','Pardon']`, huncha
        `['Yes','Okay','It will be done']`, hudaina `['No',"It won't work"]`).
  - [ ] **Remaining batches** — 80 items still to review (Place & Position → At the Shop) + a
        dev-seed scenario once the review settles.
- [x] **T37 · Tap-a-word glosses in lesson exercises** — every word of a Nepali sentence shown as an
      exercise **prompt** gets the Duolingo-style tap-to-reveal treatment (dotted underline; reuses
      the dialogues' `SanoGloss` popover, now with an `onWordTap` hook that plays the word's tile
      clip): tapping a word shows its English. **Delivered 2026-07-22** per Ross's decisions (all
      prompts — select-meaning, listen-and-build, speak — incl. introductions; choices and word-bank
      tiles are answers, so they stay un-glossed). Backed by the **generated** `js/glosses.js`
      (`WORD_GLOSSES`, 1,130 entries; `tools/build-glosses.mjs`): single-word item `en` (389) →
      ground-truth dictionary (559) → hand-drafted surface-form FILLS (182 — inflected verbs,
      case-suffixed nouns, and the template-item words words.json skips) + 2 mid-sentence
      SENSE_OVERRIDES (ho, hoina). Coverage enforced by `tests/data/glosses.test.mjs` + a loud build
      failure on any new un-glossed word. **Review round 1 (2026-07-23):** homograph slugs now merge
      the senses of every course item sharing them (`en` + `enAlt`, deduped — chha "Yes / Is / Has /
      Six", paani "Water / Rain", hajur/hunchha/hundaina pick up their enAlt senses) plus 2
      EXTRA_SENSES from the dictionary (budhaa "old man", budhi "old woman"); dotted underline
      raised closer to the word (`text-underline-offset` 0.28em → 0.14em, mirrored in the style
      guide). **Open: the 182 FILLS + 2 overrides + 2 extra senses are AI-drafted → Ross's review**
      (in the build script, greppable). Dev-seed 0h.
- [x] **T38 · Gate alternate frames by learner knowledge — fix the early-overwhelm** —
      `frameForSeen` rotated frames by raw seen-count with no gating, so a barely-introduced item
      could land on an alternate frame made of never-seen words (Ross hit "Chaar kothaa chhan" while
      still learning Numbers 1–10), and `renderChoice` showed that frame sentence against
      single-word canonical distractors — the long option was obviously correct. **Delivered
      2026-07-22** per Ross's decisions: an alternate frame is eligible only once the item has
      **graduated** AND the frame introduces **≤ 2 never-seen words** (`FRAME_MAX_NEW_WORDS`;
      "known" = any word of an introduced item's canonical sentence, `knownWordSet`); ineligible
      frames are skipped (rotation runs over the eligible list), and `choice` exercises ALWAYS show
      the canonical sentence. The complex frames aren't lost — they surface later, once graduation
      lands and their words are known. `eligibleFrames`/`rotateFrame`/`pickFrame` (js/sano.js),
      unit-tested in `tests/unit/frames.test.mjs`; dev-seed 0h reproduces the Numbers case.
