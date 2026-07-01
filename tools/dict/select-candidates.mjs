// Select expansion candidates for a themed vocabulary batch (T11 — grow toward ~2,000 words).
//
// LOCAL-ONLY tool (tools/ is outside deploy.sh's allowlist — never ships). Reads the committed
// ground-truth dictionary (tools/dict/dictionary.json, built by build-dictionary.mjs) and emits
// the highest-frequency EVERYDAY words the course does not yet cover, filtered to one part of
// speech, as a reviewable candidate POOL for the next batch. Deterministic — no network, no API.
//
// It is stage 1 of the expansion pipeline:
//   1. select      → design/expansion-candidates.json   (this file; mechanical)
//   2. draft       → design/expansion-draft.json         (Claude wraps each word in a usable frame)
//   3. review      → design/expansion.html               (Ross approves/edits → expansion-approved.json)
//   4. merge       → js/data.js                           (approved rows become new units)
//   5. audio       → synth-app.mjs --new --words --new    (render only the new clips; bump AUDIO_VERSION)
//
//   node tools/dict/select-candidates.mjs                     # top 70 everyday verbs (default)
//   node tools/dict/select-candidates.mjs --pos noun --n 60   # a noun batch
//   node tools/dict/select-candidates.mjs --out /tmp/foo.json --quiet
//
// Flags: --pos <verb|noun|adj|adv|pron|…>  --register <everyday|formal|…>  --n <count>
//        --out <path>  --quiet
//
// NOTE — this is a POOL, not the final batch. The dictionary marks coverage by *surface form*, so a
// verb already taught in a conjugated frame (म भन्छु "I say") still shows its infinitive lemma भन्नु
// as "not in course". Semantic de-duplication (dropping words whose action is already taught) and
// the frame wording are a stage-2 judgement — the AI-drafts-are-Ross's rule — so emit generously (n
// larger than the batch) and curate when drafting.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

// Same register weighting the builder ranks with (build-dictionary.mjs) — tilts toward
// conversational speech, since the frequency corpus is news/web text.
export const REGISTER_WEIGHT = { everyday: 1.0, formal: 0.4, literary: 0.2, rare: 0.1 };

// Function words / bare particles / copulas that are never taught as standalone vocab items —
// dropped regardless of frequency or part of speech. (Mostly matters for non-verb batches; verbs
// rarely collide with these.)
export const STOP = new Set([
	'को',
	'का',
	'की',
	'मा',
	'ले',
	'लाई',
	'बाट',
	'सँग',
	'नै',
	'त',
	'नि',
	'पनि',
	'र',
	'तथा',
	'वा',
	'अनि',
	'लागि',
	'अनुसार',
	'हो',
	'छ',
	'आदि',
	'हरू',
	'यो',
	'त्यो',
]);

// Pure selector — filter the dictionary entries to a ranked candidate pool. Kept side-effect free
// so tests/data/dictionary.test.mjs can exercise it against a fixture.
export function selectCandidates(entries, { pos = 'verb', register = 'everyday', n = 70, stop = STOP } = {}) {
	const weight = (e) => (e.count || 0) * (REGISTER_WEIGHT[e.register] ?? 0);
	const pool = entries
		.filter((e) => !e.inCourse && Number.isInteger(e.freqRank) && e.pos === pos && e.register === register && !stop.has(e.dev))
		.sort((a, b) => weight(b) - weight(a));
	return pool.slice(0, n).map((e) => ({
		key: e.key,
		dev: e.dev,
		pos: e.pos,
		en: e.en,
		altEn: e.altEn || [],
		register: e.register,
		freqRank: e.freqRank,
		count: e.count,
	}));
}

function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) continue;
		const key = a.slice(2);
		const next = argv[i + 1];
		if (next === undefined || next.startsWith('--')) out[key] = true;
		else out[key] = argv[++i];
	}
	return out;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const dictPath = join(HERE, 'dictionary.json');
	if (!existsSync(dictPath)) {
		console.error('dictionary.json not found — run `node tools/dict/build-dictionary.mjs` first.');
		process.exit(1);
	}
	const dict = JSON.parse(readFileSync(dictPath, 'utf8'));
	const pos = args.pos || 'verb';
	const register = args.register || 'everyday';
	const n = Number(args.n) || 70;
	const candidates = selectCandidates(dict.entries, { pos, register, n });

	const outPath = args.out ? String(args.out) : join(ROOT, 'design', 'expansion-candidates.json');
	const payload = {
		generatedFrom: 'tools/dict/dictionary.json',
		dictGeneratedAt: dict.generatedAt || null,
		pos,
		register,
		requested: n,
		count: candidates.length,
		candidates,
	};
	writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');

	if (!args.quiet) {
		console.log(`\n${candidates.length} ${register} ${pos} candidate(s) not yet in the course (ranked by weighted frequency):\n`);
		console.log('rank  dev            en');
		for (const c of candidates) {
			console.log(String(c.freqRank).padStart(4), (c.dev || '').padEnd(14), c.en || '');
		}
		console.log(`\n→ wrote ${outPath.replace(ROOT + '/', '')}`);
		console.log('  (a POOL — curate semantically + wrap in frames when drafting stage 2)');
	}
}

// Run as a CLI only when invoked directly (so the test can import selectCandidates cleanly).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main();
}
