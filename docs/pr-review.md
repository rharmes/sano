# The PR gauntlet (T70)

Every PR is adversarially reviewed by a **second agent** before Ross merges it, and the review
lives ON the pull request as real comments (Ross, 2026-09-21 — the pattern his other repos run,
fitted to this one). This file's existence is what makes sano "a repo with a PR gauntlet" in the
sense of the global instruction file, so its **reviewer model law applies here**. This doc is the
operating procedure; the reviewer itself is `.claude/agents/pr-antagonist.md` (Claude Code) /
`.codex/agents/pr-antagonist.toml` (Codex CLI) — a mirrored pair that change together in the same
commit; `tests/data/reviewer-pair.test.mjs` fails when they drift.

## The flow

1. **Build.** Work the task on its branch as usual (CLAUDE.md workflow steps 1–6): format, stamp,
   `tools/test.sh`, dev-seed scenario, localhost review with Ross, commit and push as you go.
2. **Self-review, then "Open the PR."** Only Ross triggers the PR. Before opening it, re-read the
   full diff for the author blind spots reviews keep catching: **assertions that cannot fail**
   (would this still pass with the fix reverted? — mutate and see) and **comments or docs
   invalidated by nearby edits** in the same change. Open the PR (body: what / tests / docs, citing
   the `T##`), state its URL — never `open` it — then immediately spawn the antagonist. CI and the
   review run side by side.
3. **Antagonist review.** Spawn the `pr-antagonist` agent (Agent tool,
   `subagent_type: "pr-antagonist"`) with the PR number and a one-line claim summary.
   - **Model law (fail-closed, both halves required):** the reviewer always runs on **Opus — the
     newest, via the `opus` alias — at `xhigh`**, regardless of which model authored the work;
     same-model review is fine. Never rely on the definition's `model:` default: pass
     `model: "opus"` and `effort: "xhigh"` explicitly on every Agent call, AND require the reviewer
     to state the model its own harness metadata reports, in its return and in the review header.
     Before acting on any verdict, verify that self-report is an Opus; a round whose model can't be
     confirmed is **void** — respawn with the model forced, don't trust it. An older Opus than
     expected (alias lag) still satisfies the pin; note it to Ross.
   - **Effort:** if the harness's Agent call takes no `effort` parameter, say so to Ross in the
     round's report rather than papering over it; the frontmatter pin and the brief's "ultrathink"
     are then what carries it.
   - **One checkout.** sano uses no worktrees, so the reviewer works in the author's checkout, on
     the PR head. It never commits, pushes or switches branches, reverts any mutation it makes, and
     leaves `git status` clean. **Don't edit files while a round is running** — the reviewer would be
     reading a tree that isn't the PR.
   - The agent posts one GitHub review: inline comments on the diff lines plus a summary body
     naming the head SHA and ending `VERDICT: APPROVE` or `VERDICT: REQUEST CHANGES`. Author and
     reviewer share one GitHub account, so the event is always `COMMENT` — the **verdict line is
     the outcome**; don't expect a green "Approved" state.
4. **On REQUEST CHANGES:** report the actionable items to Ross **and start fixing immediately** —
   don't wait for a go-ahead. Push the fixes to the same branch, reply on the PR with what changed,
   then send the SAME reviewer agent a re-review request (SendMessage keeps its context): "fixes
   pushed — re-review round N". If the reviewer can no longer be reached, spawn a fresh one under
   the same model law and say so. Loop until APPROVE. If the antagonist demands something that
   contradicts Ross's own rulings or seems wrong, don't silently obey — surface the conflict and
   let Ross arbitrate.
5. **On APPROVE:** confirm CI is green **on the PR head SHA**, then report to Ross with a
   `result:` line — the verdict, the head SHA it sits on, and every non-blocking note. **Ross
   merges.** This is the one place sano departs from his other repos, where an APPROVE is standing
   authorization to merge: here a merge is the go-ahead for a **production deploy** (workflow
   step 8), so that call stays with Ross.
   - **The approval must describe what merges.** Fixing a nit after an APPROVE is fine without
     another round only when the follow-up touches nothing but what the review named (a comment, a
     doc line, a prose bullet). Say in the report that the approval predates that commit and what
     it changed. Anything that changes behaviour or a test goes back for a re-review round.
6. **Nits and questions** follow the global filing bar: a non-blocking nit from an approving review
   becomes a `T##` only when it changes behaviour or documentation truth, and a filed nit rides
   along in the next PR touching the same area — no dedicated PR. Pure phrasing dies in the thread.
   **Questions about the Nepali itself** are never the reviewer's to rule on; relay them to Ross,
   who takes them to the native speaker.

## What the reviewer may not do

The brief says it; it's repeated here because it's the part that protects the live site and Ross's
money. The reviewer never deploys or touches the server, never uses an API key (`with-key`,
`apikey`, `synth-app.mjs`, `build-dictionary.mjs`), never merges, and never edits the PR. A finding
that would need one of those is reported as a question.

## Standing permissions

Spawning `pr-antagonist` at PR time (and its re-review rounds) is standing authorization from Ross
— it does not violate the instruction files' "no subagents unless Ross explicitly asks" rule, which
otherwise remains in force. **Merging is not** standing authorization (step 5).

## Running the gauntlet from Codex CLI

The flow is the same; only the mechanisms differ (`AGENTS.md` is the Codex counterpart of
`CLAUDE.md`). The reviewer is the `pr-antagonist` role in `.codex/agents/pr-antagonist.toml`.

- **Spawn:** `spawn_agent` with the role, setting `model = "gpt-5.6-sol"`,
  `reasoning_effort = "xhigh"`, **and** `fork_turns = "none"`. A full-history fork (`fork_turns`
  omitted) inherits the author's model and refuses overrides, so leaving it out silently runs the
  reviewer on the author's model — the fail-open the model law exists to prevent. The role file
  pins the same pair, but the spawn is what guarantees them.
- **Model law, Codex form:** GPT-5.6-Sol at xhigh regardless of author (`~/.codex/AGENTS.md`). The
  void rule is unchanged: the reviewer states the model its session actually resolved to in the
  review header, and a round that can't be confirmed as GPT-5.6-Sol is respawned, not trusted.
- **Re-review:** send the SAME reviewer its next round with `followup_task`, so its context
  carries over.

## History

PR #15 (T69) was the dry run, before any of this was defined: an ad-hoc Opus reviewer briefed from
another repo's definition approved it with eight findings — one proven by mutation (a seed comment
that named the wrong safety net), one prose-versus-colouring contradiction in a grammar note, and
four questions about the Nepali. Two things from that round are now rules above: the approval
predated the follow-up commit (step 5), and the language questions went to Ross rather than into
the verdict (step 6).
