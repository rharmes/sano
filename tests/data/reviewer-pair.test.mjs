// The PR-gauntlet reviewer exists twice (T70): `.claude/agents/pr-antagonist.md` for Claude Code,
// `.codex/agents/pr-antagonist.toml` for Codex CLI — the same brief stated for two harnesses, like
// CLAUDE.md ↔ AGENTS.md (agents-md.test.mjs). The two may differ ONLY by the substitutions below
// (plus each file's own header: YAML frontmatter vs TOML keys, which pin different models by
// design); anything else is drift, and this test names the first line that drifted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const CLAUDE = readFileSync(join(ROOT, '.claude/agents/pr-antagonist.md'), 'utf8');
const CODEX = readFileSync(join(ROOT, '.codex/agents/pr-antagonist.toml'), 'utf8');

// [as written in the Claude definition, as written in the Codex role] — every occurrence.
const SUBSTITUTIONS = [
	// "ultrathink" is a Claude Code keyword; Codex takes its effort from the spawn.
	['Think as hard as you can; ultrathink.', 'Think as hard as you can.'],
	// The instruction file each harness loads.
	['Read `CLAUDE.md` first.', 'Read `AGENTS.md` first.'],
	// Claude's reviewer has Read/Grep tools; Codex's has a shell.
	['(Read tool)', '(`cat` / `sed -n`)'],
	['(Grep for symbols)', '(`grep` for symbols)'],
	// Where each harness reports the model a session is really running — the model law's self-report.
	['harness metadata reports you are running', 'session metadata reports it resolved to'],
	['(the environment\'s "powered by" line)', '(the model your turns are actually served by)'],
	['NOT what the spawn prompt claims about you', 'NOT what the spawn prompt or this role file claims about you'],
];

// The brief itself: everything after the YAML frontmatter / inside developer_instructions.
const claudeBody = () => {
	const m = /^---\n([\s\S]*?)\n---\n+([\s\S]*)$/.exec(CLAUDE);
	assert.ok(m, 'pr-antagonist.md: no YAML frontmatter');
	return { front: m[1], body: m[2] };
};
const codexBody = () => {
	const m = /\ndeveloper_instructions = '''\n([\s\S]*?)'''\n$/.exec(CODEX);
	assert.ok(m, "pr-antagonist.toml: no developer_instructions = ''' … ''' block closing the file");
	return m[1];
};

test('reviewer pair: every substitution rule still applies', () => {
	const { body } = claudeBody();
	const codex = codexBody();
	for (const [from, to] of SUBSTITUTIONS) {
		assert.ok(body.includes(from), `pr-antagonist.md no longer contains ${JSON.stringify(from)} — drop or update the rule`);
		assert.ok(
			!codex.includes(from),
			`pr-antagonist.toml contains the Claude-only form ${JSON.stringify(from)} — it should read ${JSON.stringify(to)}`,
		);
	}
});

test('reviewer pair: the Codex brief is the Claude brief under the substitutions, line for line', () => {
	const want = SUBSTITUTIONS.reduce((s, [from, to]) => s.split(from).join(to), claudeBody().body).split('\n');
	const have = codexBody().split('\n');
	const n = Math.max(want.length, have.length);
	for (let i = 0; i < n; i++) {
		if (want[i] === have[i]) continue;
		assert.fail(
			`the reviewer definitions drift at brief line ${i + 1} — carry the edit across (same commit):\n` +
				`  pr-antagonist.md:   ${JSON.stringify(want[i] ?? '<end>')}\n` +
				`  pr-antagonist.toml: ${JSON.stringify(have[i] ?? '<end>')}`,
		);
	}
});

// The model law's pins (docs/pr-review.md). The spawn restates them — a definition's default is
// never the guarantee — but a definition that names the wrong model is how a lazy spawn goes wrong.
test('reviewer pair: each definition pins its harness’s reviewer model at xhigh', () => {
	const { front } = claudeBody();
	assert.match(front, /^model: opus$/m, 'pr-antagonist.md must pin model: opus');
	assert.match(front, /^effort: xhigh$/m, 'pr-antagonist.md must pin effort: xhigh');
	// The toml's keys only — everything above the brief, so a line inside it can't satisfy the pin.
	const at = CODEX.indexOf("\ndeveloper_instructions = '''");
	assert.ok(at > 0, 'pr-antagonist.toml: no developer_instructions key to read the pins above'); // -1 would slice the whole file back in
	const keys = CODEX.slice(0, at);
	assert.match(keys, /^model = "gpt-5\.6-sol"$/m, 'pr-antagonist.toml must pin model = "gpt-5.6-sol"');
	assert.match(keys, /^model_reasoning_effort = "xhigh"$/m, 'pr-antagonist.toml must pin model_reasoning_effort = "xhigh"');
});
