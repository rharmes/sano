// CLAUDE.md ↔ AGENTS.md parity (T62): the repo instructions exist twice — CLAUDE.md for Claude
// Code, AGENTS.md for Codex CLI — and the two must say the same thing. They may differ ONLY by the
// harness-mechanics substitutions in SUBSTITUTIONS below; anything else is drift, and this test
// names the first line that drifted so the author can carry the edit across.
//
// The rules run one way, CLAUDE.md → AGENTS.md, but the check is symmetric in effect: an edit to
// either file fails here until the other carries it too. Adding a harness-specific sentence means
// adding its pair to the table — which is why the table, not the prose, is the list of allowed
// differences.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const CLAUDE = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
const AGENTS = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');

// [as written in CLAUDE.md, as written in AGENTS.md] — every occurrence, both files.
const SUBSTITUTIONS = [
	// The user-level file each harness loads above the repo's own.
	['`~/.claude/CLAUDE.md`', '`~/.codex/AGENTS.md`'],
	// Claude Code's `@path` import pulls a doc into context; Codex has no such syntax, so its copy
	// says "read" and names the plain path.
	['(load with `@` at session start instead of scanning the code)', '(read at session start instead of scanning the code)'],
	['`@docs/', '`docs/'],
];

// Codex reads a repo's AGENTS.md up to `project_doc_max_bytes` (32 KiB by default) and silently
// drops the rest — a bloated file loses its tail, which here is the workflow and the task-list
// rules. CLAUDE.md is the same size, so this is the "keep the always-loaded instructions lean"
// rule with a number on it: past this, push detail into docs/ and link to it.
const CODEX_DOC_BUDGET = 32 * 1024;

const translate = (text) => SUBSTITUTIONS.reduce((s, [from, to]) => s.split(from).join(to), text);

test('AGENTS.md: every substitution rule still applies (no stale rules, no half-applied ones)', () => {
	for (const [from, to] of SUBSTITUTIONS) {
		assert.ok(CLAUDE.includes(from), `CLAUDE.md no longer contains ${JSON.stringify(from)} — drop or update the rule`);
		assert.ok(!AGENTS.includes(from), `AGENTS.md contains the Claude-only form ${JSON.stringify(from)} — it should read ${JSON.stringify(to)}`);
	}
});

test('AGENTS.md: is CLAUDE.md under the harness substitutions, line for line', () => {
	const want = translate(CLAUDE).split('\n');
	const have = AGENTS.split('\n');
	const n = Math.max(want.length, have.length);
	for (let i = 0; i < n; i++) {
		if (want[i] === have[i]) continue;
		assert.fail(
			`CLAUDE.md and AGENTS.md drift at line ${i + 1} — carry the edit across (same commit):\n` +
				`  CLAUDE.md:${i + 1}: ${JSON.stringify(want[i] ?? '<end of file>')}\n` +
				`  AGENTS.md:${i + 1}: ${JSON.stringify(have[i] ?? '<end of file>')}`,
		);
	}
});

test('AGENTS.md: fits inside the Codex instruction budget', () => {
	const bytes = Buffer.byteLength(AGENTS, 'utf8');
	assert.ok(bytes < CODEX_DOC_BUDGET, `AGENTS.md is ${bytes} bytes; Codex stops reading at ${CODEX_DOC_BUDGET} — move detail into docs/`);
});
