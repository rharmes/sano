// Build a frequency-ranked Nepali(Devanagari)↔English "ground-truth" dictionary.
//
// LOCAL-ONLY tool (tools/ is outside deploy.sh's allowlist — never ships). Two jobs:
//   1. Ground truth — authoritative glosses for every word the app teaches, flagging (never
//      auto-correcting) COURSE translations that disagree.
//   2. Expansion roadmap — the highest-frequency everyday words the app doesn't yet cover.
//
// Pipeline (incremental + cached, like tools/tts/synth-app.mjs):
//   ACQUIRE  Leipzig freq list + kaikki Wiktionary extract → tools/dict/sources/ (gitignored)
//   LEMMATIZE  Claude collapses inflected tokens → lemmas, drops noise, tags register (everyday/…)
//   GLOSS    Claude glosses each lemma, cross-checked vs Wiktionary → confidence + provenance
//   MERGE    union of (all COURSE words, guaranteed) + (register-weighted top-N freq lemmas)
//   EMIT     tools/dict/dictionary.json + coverage-report.md  (API-free — reads the stage caches)
//
//   ANTHROPIC_API_KEY=… node tools/dict/build-dictionary.mjs            # full pipeline
//   ANTHROPIC_API_KEY=… node tools/dict/build-dictionary.mjs --acquire  # download sources only
//   ANTHROPIC_API_KEY=… node tools/dict/build-dictionary.mjs --lemmatize [--new|--force|--only X]
//   ANTHROPIC_API_KEY=… node tools/dict/build-dictionary.mjs --gloss     [--new|--force|--only X]
//   node tools/dict/build-dictionary.mjs --merge --emit                  # rebuild artifacts, NO API
//   node tools/dict/build-dictionary.mjs --report-only                   # alias for --merge --emit
//   --top <N=2000>  --pool <M>  --model <id>  --sample  --refresh
//   --leipzig-url <url>     paste the exact .tar.gz link from the Leipzig download page if the
//                           default 404s/moves (or just drop the .tar.gz into tools/dict/sources/).
//   --leipzig-corpus <name> override the default corpus name.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWord, tokenize, DEV_RE } from './lib/normalize.mjs';
import { parseLeipzigWords, buildWiktionaryIndex, acquireLeipzig, acquireHfFreq, acquireKaikki, sha256 } from './lib/sources.mjs';
import { callClaude, loadCache, saveCache, hashKey, DEFAULT_MODEL } from './lib/claude.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DICT = HERE;
const SRC = join(DICT, 'sources');
const CACHE = join(DICT, 'cache');

const args = parseArgs(process.argv.slice(2));
const TOP = Number(args.top) || 2000;
const POOL = Number(args.pool) || TOP * 2; // raw Leipzig tokens to lemmatize (margin for drops/dedup)
const MODEL = args.model || DEFAULT_MODEL;
const PROMPT_VERSION = 1; // bump to deliberately re-spend tokens after changing a prompt below
const apiKey = process.env.ANTHROPIC_API_KEY;

// Register weights tilt the ranking toward conversational speech (Leipzig is written/news text).
const REGISTER_WEIGHT = { everyday: 1.0, formal: 0.4, literary: 0.2, rare: 0.1 };

async function main() {
	const stages = pickStages(args);
	const today = new Date().toISOString().slice(0, 10);
	const { COURSE, romanize } = loadCourse();

	if (stages.acquire) {
		log('ACQUIRE: downloading sources…');
		const lock = join(DICT, 'sources.lock.json');
		try {
			if (args['hf-freq']) {
				// Compute the frequency list from a reachable HuggingFace corpus (Leipzig alternative).
				const r = await acquireHfFreq({
					sourcesDir: SRC,
					lockPath: lock,
					today,
					dataset: args['hf-dataset'],
					articles: Number(args['hf-articles']) || undefined,
					onProgress: (n, w) => process.stdout.write(`\r  HF freq: ${n} articles, ${w} unique words…`),
				});
				log(`\n  HF freq: ${r.words} words from ${r.articles} articles → sources/leipzig-words.txt`);
			} else {
				await acquireLeipzig({
					sourcesDir: SRC,
					lockPath: lock,
					refresh: !!args.refresh,
					today,
					url: args['leipzig-url'],
					corpus: args['leipzig-corpus'],
				});
			}
		} catch (e) {
			// Frequency source unreachable → build COURSE-only now; the expansion set can be added
			// later by re-running --acquire --hf-freq (or --acquire --leipzig-url …) once reachable.
			log(`ACQUIRE: frequency list unavailable (${e.message}). Continuing COURSE-only — add it later with --acquire --hf-freq.`);
		}
		await acquireKaikki({ sourcesDir: SRC, lockPath: lock, refresh: !!args.refresh, today });
		log('ACQUIRE: done.');
	}

	if (stages.lemmatize) {
		const freq = computeFreq();
		const courseTokens = courseWordKeys(COURSE).map((w) => w.display);
		const pool = freq.tokens.slice(0, POOL).map((t) => t.display);
		const universe = dedupe([...pool, ...courseTokens]);
		await lemmatizeStage(universe);
	}

	if (stages.gloss) {
		const wiktionary = buildWiktionaryIndex(readSource('kaikki-nepali.jsonl'));
		const selected = selectLemmas(COURSE);
		await glossStage(selected, wiktionary);
	}

	if (stages.emit) {
		const wiktionary = existsSourceFile('kaikki-nepali.jsonl') ? buildWiktionaryIndex(readSource('kaikki-nepali.jsonl')) : new Map();
		const dict = buildDictionary({ COURSE, romanize, wiktionary, today });
		writeArtifacts(dict, romanize);
	}
}

// ---- stage helpers --------------------------------------------------------------------------

function computeFreq() {
	const name = leipzigWordsName();
	if (!existsSourceFile(name)) {
		log(
			'FREQ: no Leipzig word list on disk — building COURSE-only (no frequency expansion). Run --acquire on an unrestricted network to add ranked words.',
		);
		const out = { from: null, total: 0, tokens: [] };
		saveCache(join(CACHE, 'freq.json'), out);
		return out;
	}
	const text = readSource(name);
	const tokens = parseLeipzigWords(text);
	const out = { from: sha256(text), total: tokens.reduce((s, t) => s + t.count, 0), tokens };
	saveCache(join(CACHE, 'freq.json'), out);
	log(`FREQ: ${tokens.length} Devanagari tokens from Leipzig (cache/freq.json).`);
	return out;
}

const LEMMA_SYS = `You are a Nepali lexicographer normalizing a frequency list of Devanagari tokens for a
conversational language-learning app. For each token return its dictionary LEMMA (uninflected base:
verbs → infinitive in -नु, nouns → nominative singular, strip postpositions/case/plural), its part of
speech, whether to DROP it (proper noun, foreign/English-in-Devanagari, fragment, pure number, or
non-word), and its REGISTER for everyday spoken Nepali: "everyday" (common conversation), "formal"
(news/officialese), "literary" (written/poetic), or "rare". Be strict: prefer dropping junk. Examples:
  घरमा → lemma घर, noun, everyday
  गर्छु → lemma गर्नु, verb, everyday
  विद्यार्थीहरूलाई → lemma विद्यार्थी, noun, everyday
  तपाईंलाई → lemma तपाईं, pron, everyday
  सरकारले → lemma सरकार, noun, formal
  रामले → drop (proper noun)
Return JSON matching the schema: a "results" array, one object per input token, in the same order.`;

const LEMMA_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		results: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					token: { type: 'string' },
					lemma: { type: 'string' },
					pos: { type: 'string' },
					drop: { type: 'boolean' },
					dropReason: { type: 'string' },
					register: { type: 'string', enum: ['everyday', 'formal', 'literary', 'rare'] },
				},
				required: ['token', 'lemma', 'pos', 'drop', 'dropReason', 'register'],
			},
		},
	},
	required: ['results'],
};

async function lemmatizeStage(tokens) {
	const path = join(CACHE, 'lemmatize.json');
	const cache = args.force ? {} : loadCache(path);
	let todo = tokens.filter((t) => (!DEV_RE.test(t) ? false : !cache[hashKey(PROMPT_VERSION, MODEL, t)]));
	if (args.only) todo = todo.filter((t) => t === args.only);
	if (!todo.length) return log('LEMMATIZE: nothing new (all cached).');
	requireKey();
	const batches = chunk(todo, 50);
	log(`LEMMATIZE: ${todo.length} tokens in ${batches.length} batches (model ${MODEL})…`);
	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];
		const { parsed } = await callClaude({
			apiKey,
			model: MODEL,
			system: LEMMA_SYS,
			user: JSON.stringify(batch),
			schema: LEMMA_SCHEMA,
			effort: 'medium',
			maxTokens: 8192,
		});
		for (const r of parsed.results) cache[hashKey(PROMPT_VERSION, MODEL, r.token)] = { ...r, _model: MODEL };
		saveCache(path, cache); // checkpoint each batch so a crash doesn't re-spend
		log(`  batch ${i + 1}/${batches.length} done`);
		if (i === 0 && batches.length > 1) continue; // first call warmed the prompt cache; rest read it
	}
	log('LEMMATIZE: done.');
}

const GLOSS_SYS = `You are a Nepali→English lexicographer. For each Devanagari LEMMA, give the best short
English gloss (1–4 words, the primary everyday sense) plus up to 3 alternate senses, and a 0–1
confidence. Keep glosses lowercase unless a proper term. Return JSON: a "results" array, one object
per input lemma, same order. Examples: घर → "house / home"; राम्रो → "good / nice"; हुनु → "to be".`;

const GLOSS_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		results: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					lemma: { type: 'string' },
					gloss: { type: 'string' },
					altGlosses: { type: 'array', items: { type: 'string' } },
					claudeConfidence: { type: 'number' },
				},
				required: ['lemma', 'gloss', 'altGlosses', 'claudeConfidence'],
			},
		},
	},
	required: ['results'],
};

async function glossStage(lemmas, wiktionary) {
	const path = join(CACHE, 'gloss.json');
	const cache = args.force ? {} : loadCache(path);
	let todo = lemmas.filter((l) => !cache[hashKey('g', PROMPT_VERSION, MODEL, l)]);
	if (args.only) todo = todo.filter((l) => l === args.only);
	if (!todo.length) return log('GLOSS: nothing new (all cached).');
	requireKey();
	const batches = chunk(todo, 40);
	log(`GLOSS: ${todo.length} lemmas in ${batches.length} batches…`);
	for (let i = 0; i < batches.length; i++) {
		const { parsed } = await callClaude({
			apiKey,
			model: MODEL,
			system: GLOSS_SYS,
			user: JSON.stringify(batches[i]),
			schema: GLOSS_SCHEMA,
			effort: 'medium',
			maxTokens: 8192,
		});
		for (const r of parsed.results) {
			const key = normalizeWord(r.lemma).key;
			const wikt = wiktionary.get(key);
			cache[hashKey('g', PROMPT_VERSION, MODEL, r.lemma)] = {
				...r,
				agreement: agree(r, wikt),
				wiktGlosses: wikt ? wikt.glosses.slice(0, 4) : null,
				_model: MODEL,
			};
		}
		saveCache(path, cache);
		log(`  batch ${i + 1}/${batches.length} done`);
	}
	log('GLOSS: done.');
}

// ---- selection + merge (API-free) -----------------------------------------------------------

// Roll lemmatize results up to lemmas (keyed, deduped), with summed count + min rank + register.
function rollupLemmas() {
	const lem = loadCache(join(CACHE, 'lemmatize.json'));
	const freq = existsSync(join(CACHE, 'freq.json')) ? JSON.parse(readFileSync(join(CACHE, 'freq.json'), 'utf8')) : { tokens: [] };
	const countByKey = new Map(freq.tokens.map((t) => [t.key, t]));
	const lemmas = new Map();
	for (const rec of Object.values(lem)) {
		if (rec.drop) continue;
		const { key, display } = normalizeWord(rec.lemma);
		if (!key) continue;
		const tok = countByKey.get(normalizeWord(rec.token).key);
		const m = lemmas.get(key) || { key, display, count: 0, minRank: Infinity, register: rec.register, pos: rec.pos, forms: [] };
		m.count += tok ? tok.count : 0;
		if (tok && tok.rank < m.minRank) m.minRank = tok.rank;
		if (REGISTER_WEIGHT[rec.register] > REGISTER_WEIGHT[m.register]) m.register = rec.register; // most-everyday wins
		if (!m.forms.includes(rec.token)) m.forms.push(rec.token);
		lemmas.set(key, m);
	}
	return lemmas;
}

// The lemmas to gloss/emit: every COURSE word (guaranteed) + register-weighted top-N frequency lemmas.
function selectLemmas(COURSE) {
	const lemmas = rollupLemmas();
	const courseKeys = new Set(courseWordKeys(COURSE).map((w) => w.key));
	const scored = [...lemmas.values()].map((m) => ({ ...m, score: m.count * (REGISTER_WEIGHT[m.register] ?? 0.3) }));
	scored.sort((a, b) => b.score - a.score);
	const top = new Set(scored.slice(0, TOP).map((m) => m.key));
	// Display strings to gloss = union of selected freq lemmas + all COURSE words.
	const out = new Map();
	for (const m of scored) if (top.has(m.key)) out.set(m.key, m.display);
	for (const w of courseWordKeys(COURSE)) if (!out.has(w.key)) out.set(w.key, w.display);
	void courseKeys;
	return [...out.values()];
}

function buildDictionary({ COURSE, romanize, wiktionary, today }) {
	const lemmas = rollupLemmas();
	const gloss = loadCache(join(CACHE, 'gloss.json'));
	const glossByKey = new Map();
	for (const g of Object.values(gloss)) glossByKey.set(normalizeWord(g.lemma).key, g);

	// COURSE word → item ids, plus `soloEn`: the English of any item whose `dev` is THIS single word.
	// The gloss-mismatch flag only uses soloEn — comparing a word's gloss to a multi-word phrase's
	// English (खाना "food" vs the phrase "Have you eaten?") would be noise, not a translation error.
	const courseInfo = new Map();
	for (const u of COURSE)
		for (const it of u.items) {
			if (!it.dev) continue;
			const words = tokenize(it.dev);
			for (const w of words) {
				const e = courseInfo.get(w.key) || { ids: [], soloEn: null };
				if (!e.ids.includes(it.id)) e.ids.push(it.id);
				if (words.length === 1 && !e.soloEn) e.soloEn = it.en; // word IS the whole item
				courseInfo.set(w.key, e);
			}
		}

	const selected = new Set(selectLemmasKeys(COURSE, lemmas));
	const freq = existsSync(join(CACHE, 'freq.json')) ? JSON.parse(readFileSync(join(CACHE, 'freq.json'), 'utf8')) : { total: 0 };
	const entries = [];
	for (const key of selected) {
		const m = lemmas.get(key);
		const ci = courseInfo.get(key);
		const g = glossByKey.get(key);
		const wikt = wiktionary.get(key);
		const display = (m && m.display) || (ci && key) || key;
		const en = g ? g.gloss : wikt ? wikt.glosses[0] : '';
		const sources = [];
		if (g) sources.push('claude');
		if (wikt) sources.push('wiktionary');
		if (ci) sources.push('course');
		const agreement = g ? g.agreement : wikt ? 'wiktionary-only' : 'none';
		entries.push({
			key,
			dev: display,
			pos: (m && m.pos) || (wikt && wikt.pos[0]) || '',
			en,
			altEn: g ? g.altGlosses : wikt ? wikt.glosses.slice(1, 4) : [],
			register: (m && m.register) || 'everyday',
			inCourse: !!ci,
			courseItemIds: ci ? ci.ids : [],
			freqRank: m && Number.isFinite(m.minRank) ? m.minRank : null,
			count: m ? m.count : 0,
			confidence: confidenceOf(agreement, g),
			sources,
			agreement,
			review: ci && ci.soloEn && en && disagrees(ci.soloEn, en) ? { type: 'gloss-mismatch', courseEn: ci.soloEn, dictEn: en } : null,
		});
	}
	entries.sort((a, b) => (a.freqRank ?? 1e9) - (b.freqRank ?? 1e9) || a.key.localeCompare(b.key));
	// cumulative coverage over the corpus, by descending count
	let cum = 0;
	const total = freq.total || entries.reduce((s, e) => s + e.count, 0) || 1;
	for (const e of [...entries].sort((a, b) => b.count - a.count)) {
		cum += e.count;
		e.cumPct = Math.round((cum / total) * 1000) / 1000;
	}
	return {
		version: 1,
		generatedAt: today,
		provenance: { model: MODEL, promptVersion: PROMPT_VERSION, top: TOP },
		entries,
	};
}

function selectLemmasKeys(COURSE, lemmas) {
	const scored = [...lemmas.values()].map((m) => ({ key: m.key, score: m.count * (REGISTER_WEIGHT[m.register] ?? 0.3) }));
	scored.sort((a, b) => b.score - a.score);
	const keys = new Set(scored.slice(0, TOP).map((m) => m.key));
	for (const w of courseWordKeys(COURSE)) keys.add(w.key);
	return [...keys];
}

function writeArtifacts(dict, romanize) {
	writeFileSync(join(DICT, 'dictionary.json'), JSON.stringify(dict, null, '\t') + '\n');
	const notInCourse = dict.entries.filter((e) => !e.inCourse && e.freqRank).sort((a, b) => a.freqRank - b.freqRank);
	const flagged = dict.entries.filter((e) => e.review);
	const lines = [];
	lines.push('# Dictionary coverage report', '');
	lines.push(`Generated ${dict.generatedAt} · ${dict.entries.length} entries · model ${dict.provenance.model}`, '');
	lines.push(`- In COURSE: ${dict.entries.filter((e) => e.inCourse).length}`);
	lines.push(`- Expansion candidates (high-freq, not yet in COURSE): ${notInCourse.length}`);
	lines.push(`- COURSE gloss-mismatch flags for review: ${flagged.length}`, '');
	lines.push('## Top expansion candidates (frequency rank · lemma · romanization · gloss)', '');
	for (const e of notInCourse.slice(0, 100)) lines.push(`${e.freqRank}. ${e.dev} · ${romanize(e.dev)} · ${e.en} · ${e.register}`);
	lines.push('', '## COURSE translations to review (dictionary disagrees — flag only, never auto-changed)', '');
	for (const e of flagged) lines.push(`- ${e.dev} (${e.courseItemIds.join(', ')}): COURSE "${e.review.courseEn}" vs dict "${e.review.dictEn}"`);
	writeFileSync(join(DICT, 'coverage-report.md'), lines.join('\n') + '\n');
	log(
		`EMIT: ${dict.entries.length} entries → dictionary.json; ${notInCourse.length} expansion candidates, ${flagged.length} review flags → coverage-report.md`,
	);
}

// ---- small helpers --------------------------------------------------------------------------

function agree(claude, wikt) {
	if (!wikt) return 'wiktionary-absent';
	const norm = (s) =>
		s
			.toLowerCase()
			.replace(/[^a-z\s]/g, ' ')
			.split(/\s+/)
			.filter(Boolean);
	const cw = new Set([...norm(claude.gloss), ...claude.altGlosses.flatMap(norm)]);
	const ww = new Set(wikt.glosses.flatMap(norm));
	const overlap = [...cw].filter((w) => ww.has(w)).length;
	if (overlap >= 1 && cw.size && [...cw].some((w) => ww.has(w))) return overlap >= 2 ? 'agree' : 'partial';
	return 'disagree';
}
function confidenceOf(agreement, g) {
	if (agreement === 'agree') return 'high';
	if (agreement === 'partial' || agreement === 'wiktionary-only') return 'medium';
	if (agreement === 'wiktionary-absent') return g && g.claudeConfidence >= 0.8 ? 'medium' : 'low';
	return 'low';
}
function disagrees(courseEn, dictEn) {
	const norm = (s) =>
		(s || '')
			.toLowerCase()
			.replace(/[^a-z\s/]/g, ' ')
			.split(/[\s/]+/)
			.filter(Boolean);
	const a = new Set(norm(courseEn));
	const b = norm(dictEn);
	return b.length > 0 && !b.some((w) => a.has(w)); // no shared content word ⇒ flag for review
}

function courseWordKeys(COURSE) {
	const seen = new Map();
	for (const u of COURSE) for (const it of u.items) if (it.dev) for (const w of tokenize(it.dev)) if (!seen.has(w.key)) seen.set(w.key, w);
	return [...seen.values()];
}
function pickStages(a) {
	const any = a.acquire || a.lemmatize || a.gloss || a.merge || a.emit || a['report-only'];
	if (a['report-only']) return { acquire: false, lemmatize: false, gloss: false, emit: true };
	if (!any) return { acquire: true, lemmatize: true, gloss: true, emit: true }; // full pipeline
	return { acquire: !!a.acquire, lemmatize: !!a.lemmatize, gloss: !!a.gloss, emit: !!(a.merge || a.emit) };
}
function loadCourse() {
	const COURSE = Function(readFileSync(join(ROOT, 'js', 'data.js'), 'utf8') + '; return COURSE;')();
	const SanoRomanize = Function(readFileSync(join(ROOT, 'js', 'romanize.js'), 'utf8') + '; return SanoRomanize;')();
	return { COURSE, romanize: (d) => SanoRomanize.romanize(d) };
}
function leipzigWordsName() {
	const lock = join(DICT, 'sources.lock.json');
	if (existsSync(lock)) {
		const l = JSON.parse(readFileSync(lock, 'utf8'));
		if (l.leipzig?.file) return l.leipzig.file;
	}
	return 'leipzig-words.txt'; // canonical name written by acquireLeipzig
}
const readSource = (name) => readFileSync(join(SRC, name), 'utf8');
const existsSourceFile = (name) => existsSync(join(SRC, name));
const dedupe = (a) => [...new Set(a)];
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
function requireKey() {
	if (!apiKey) fail('Set ANTHROPIC_API_KEY in the environment to run the Claude stages.');
}
function parseArgs(a) {
	const o = {};
	for (let i = 0; i < a.length; i++) {
		if (!a[i].startsWith('--')) continue;
		const k = a[i].slice(2);
		o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
	}
	return o;
}
function log(m) {
	console.log(m);
}
function fail(m) {
	console.error('Error: ' + m);
	process.exit(1);
}

main().catch((e) => fail(e.stack || e.message));
