// Backlog tag integrity (docs/todo.md, T34): every open top-level task carries a `waiting-on:`
// and an `area:` tag on its title line, ticked tasks and sub-items carry none, and `blocked-by:`
// points at a task that is actually still open.
//
// The two vocabularies are PARSED OUT OF the todo.md "Tags" header rather than hardcoded here, so
// the docs cannot drift from what's in use: adding a new area means documenting it first, and a
// typo (`area:contnet`) fails because it isn't in the header's list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lift.mjs';

const LINES = readFileSync(join(ROOT, 'docs', 'todo.md'), 'utf8').split('\n');

// The "## Tags" section documents the convention using the tag syntax itself, so every check below
// skips it — otherwise the prose and the `grep` recipe would read as malformed tasks.
const tagsStart = LINES.findIndex((l) => /^## Tags\b/.test(l));
const tagsEnd = LINES.findIndex((l, i) => i > tagsStart && /^## /.test(l));
assert.ok(tagsStart >= 0 && tagsEnd > tagsStart, 'docs/todo.md: no "## Tags" section to read the vocabulary from');
const inHeader = (i) => i >= tagsStart && i < tagsEnd;

// One bullet of the Tags section, joined across its continuation lines: `- **`area:`** — ... **`content`** ...
function vocabulary(name) {
	const start = LINES.findIndex((l, i) => inHeader(i) && l.startsWith(`- **\`${name}:\`**`));
	assert.ok(start >= 0, `docs/todo.md: the Tags header documents no \`${name}:\` bullet`);
	let bullet = LINES[start];
	for (let i = start + 1; i < tagsEnd && !/^- \*\*/.test(LINES[i]) && LINES[i].trim(); i++) bullet += ` ${LINES[i]}`;
	// The bullet's own name is `${name}:` — the trailing colon keeps it out of these matches.
	return [...bullet.matchAll(/\*\*`([a-z-]+)`\*\*/g)].map((m) => m[1]);
}

const WAITING_ON = vocabulary('waiting-on');
const AREAS = vocabulary('area');

const OPEN = /^- \[ \] \*\*(T\d+) · /;
const DONE = /^- \[x\] \*\*(T\d+) · /;
const openIds = new Set(LINES.filter((l) => OPEN.test(l)).map((l) => l.match(OPEN)[1]));

const tagsOn = (line, name) => [...line.matchAll(new RegExp('`' + name + ':([a-zA-Z0-9-]+)`', 'g'))].map((m) => m[1]);

test('todo.md: the Tags header documents both vocabularies', () => {
	assert.ok(WAITING_ON.length >= 2, `waiting-on vocabulary looks empty: ${JSON.stringify(WAITING_ON)}`);
	assert.ok(WAITING_ON.includes('none'), 'waiting-on must offer `none`, or nothing can be marked unblocked');
	assert.ok(AREAS.length >= 2, `area vocabulary looks empty: ${JSON.stringify(AREAS)}`);

	// A bullet's prose sits in the same block as its enumeration, so a **`bolded`** word in the
	// explanation joins the vocabulary — which silently makes it a legal tag. Re-bolding a value
	// that's already enumerated shows up here as a duplicate; the header tells writers to keep
	// prose in plain ticks. (A bolded word that is *new* still slips through — the reason the
	// convention is written down rather than only enforced.)
	for (const [name, vocab] of [
		['waiting-on', WAITING_ON],
		['area', AREAS],
	]) {
		const dupes = vocab.filter((v, i) => vocab.indexOf(v) !== i);
		assert.deepEqual(dupes, [], `docs/todo.md: the \`${name}:\` bullet bolds ${dupes.join(', ')} twice — keep prose in plain code ticks`);
	}
});

test('todo.md: every open task has exactly one waiting-on: and one area:, from the documented vocabulary', () => {
	assert.ok(openIds.size > 0, 'no open tasks found — the OPEN pattern is probably stale');
	for (const [i, line] of LINES.entries()) {
		if (inHeader(i) || !OPEN.test(line)) continue;
		const id = line.match(OPEN)[1];
		const waiting = tagsOn(line, 'waiting-on');
		const areas = tagsOn(line, 'area');
		assert.equal(waiting.length, 1, `${id}: expected exactly one \`waiting-on:\` on its title line, found ${waiting.length}`);
		assert.equal(areas.length, 1, `${id}: expected exactly one \`area:\` on its title line, found ${areas.length}`);
		assert.ok(WAITING_ON.includes(waiting[0]), `${id}: waiting-on:${waiting[0]} is not one of ${WAITING_ON.join(' / ')}`);
		assert.ok(AREAS.includes(areas[0]), `${id}: area:${areas[0]} is not one of ${AREAS.join(' / ')}`);
	}
});

test('todo.md: blocked-by: points at a task that is still open', () => {
	for (const [i, line] of LINES.entries()) {
		if (inHeader(i)) continue;
		for (const target of tagsOn(line, 'blocked-by')) {
			assert.ok(/^T\d+$/.test(target), `blocked-by:${target} is not a task id`);
			assert.ok(openIds.has(target), `blocked-by:${target} points at a task that is delivered or missing — the block is stale`);
		}
	}
});

test('todo.md: tags appear only on open top-level task lines', () => {
	for (const [i, line] of LINES.entries()) {
		if (inHeader(i) || OPEN.test(line)) continue;
		for (const name of ['waiting-on', 'area', 'blocked-by']) {
			const found = tagsOn(line, name);
			const where = DONE.test(line) ? `delivered task ${line.match(DONE)[1]}` : `docs/todo.md:${i + 1}`;
			assert.equal(
				found.length,
				0,
				`${where}: carries \`${name}:${found[0]}\` — tags belong only on open top-level tasks, all on the title line`,
			);
		}
	}
});
