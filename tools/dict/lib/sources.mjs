// Source acquisition + parsing for the dictionary tool.
//
// Two external sources (both build-time only — never a runtime call):
//   • Leipzig Corpora Collection (Nepali) — word⇥frequency list, CC-BY-4.0.
//   • kaikki.org Wiktionary (Nepali) extract — authoritative English glosses, CC-BY-SA.
//
// Downloads land in the gitignored tools/dict/sources/ cache and are sha256-verified against the
// committed sources.lock.json so ranks/glosses are reproducible. The pure parsers
// (parseLeipzigWords, buildWiktionaryIndex) take strings and are unit-testable offline.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { normalizeWord, DEV_RE, splitWords } from './normalize.mjs';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Recursively list files under a dir (small trees; avoids a Node-version dependency on readdir recursive).
function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}
const findWordsFile = (dir) => walk(dir).find((p) => p.endsWith('-words.txt')) || null;

// Leipzig publishes per-corpus/size tar.gz archives; the words file inside is `*-words.txt`.
// Default corpus: news 2020, 100K-sentence tier (a good size/quality balance for Nepali).
export const LEIPZIG = {
	corpus: 'nep_news_2020_100K',
	url: 'https://downloads.wortschatz-leipzig.de/corpora/nep_news_2020_100K.tar.gz',
	license: 'CC-BY-4.0',
};
export const KAIKKI = {
	url: 'https://kaikki.org/dictionary/Nepali/kaikki.org-dictionary-Nepali.jsonl',
	license: 'CC-BY-SA-4.0',
};

// --- download + verify ----------------------------------------------------------------------

async function download(url, destFile) {
	const res = await fetch(url, { redirect: 'follow' });
	if (!res.ok) throw new Error(`download ${url} → HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	mkdirSync(dirname(destFile), { recursive: true });
	writeFileSync(destFile, buf);
	return buf;
}

function readLock(lockPath) {
	return existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {};
}
function writeLock(lockPath, lock) {
	writeFileSync(lockPath, JSON.stringify(lock, null, '\t') + '\n');
}

// Acquire the kaikki JSONL. Verifies sha256 against the lock unless --refresh; on a fresh checkout
// (no cached file) it downloads and, if the lock has a sha, enforces it (else records it).
export async function acquireKaikki({ sourcesDir, lockPath, refresh, today }) {
	const file = join(sourcesDir, 'kaikki-nepali.jsonl');
	const lock = readLock(lockPath);
	if (existsSync(file) && !refresh) {
		verifySha(file, lock.wiktionary, 'kaikki');
		return file;
	}
	const buf = await download(KAIKKI.url, file);
	const hash = sha256(buf);
	if (lock.wiktionary?.sha256 && lock.wiktionary.sha256 !== hash && !refresh) {
		throw new Error(`kaikki sha256 mismatch vs lock — pass --refresh to update`);
	}
	const senses = buf.toString('utf8').split('\n').filter(Boolean).length;
	lock.wiktionary = { url: KAIKKI.url, file: 'kaikki-nepali.jsonl', sha256: hash, senses, downloaded: today, license: KAIKKI.license };
	writeLock(lockPath, lock);
	return file;
}

// Acquire the Leipzig words file → canonical `sources/leipzig-words.txt`. Robust to corpus-name
// variation and offline placement:
//   • if `sources/leipzig-words.txt` is already there (manually extracted), use it;
//   • else if any `*.tar.gz` is already in `sources/` (manually downloaded from the Leipzig page),
//     extract that;
//   • else download `url` (override the default with --leipzig-url to paste the exact link).
// After extraction the `*-words.txt` is located anywhere inside the archive (folder name varies).
// Extraction shells out to `tar` (universally present on macOS/Linux) — no tar dependency.
export async function acquireLeipzig({ sourcesDir, lockPath, refresh, today, url, corpus }) {
	const wordsFile = join(sourcesDir, 'leipzig-words.txt');
	const lock = readLock(lockPath);
	if (existsSync(wordsFile) && !refresh) {
		verifySha(wordsFile, lock.leipzig, 'leipzig');
		return wordsFile;
	}
	const name = corpus || LEIPZIG.corpus;
	const src = url || LEIPZIG.url;
	mkdirSync(sourcesDir, { recursive: true });
	const preArchive = readdirSync(sourcesDir)
		.filter((f) => f.endsWith('.tar.gz'))
		.map((f) => join(sourcesDir, f))[0];
	let archive = preArchive && !refresh ? preArchive : join(sourcesDir, `${name}.tar.gz`);
	if (!existsSync(archive)) await download(src, archive);
	const tmp = join(sourcesDir, '_leipzig');
	mkdirSync(tmp, { recursive: true });
	execFileSync('tar', ['-xzf', archive, '-C', tmp], { stdio: 'pipe' });
	const extracted = findWordsFile(tmp);
	if (!extracted) throw new Error('Leipzig archive contained no *-words.txt — check the download / --leipzig-url');
	writeFileSync(wordsFile, readFileSync(extracted));
	const hash = sha256(readFileSync(wordsFile));
	if (lock.leipzig?.sha256 && lock.leipzig.sha256 !== hash && !refresh) {
		throw new Error(`Leipzig sha256 mismatch vs lock — pass --refresh to update`);
	}
	lock.leipzig = { corpus: name, url: src, file: 'leipzig-words.txt', sha256: hash, downloaded: today, license: LEIPZIG.license };
	writeLock(lockPath, lock);
	return wordsFile;
}

function verifySha(file, entry, name) {
	if (!entry?.sha256) return; // nothing pinned yet (first acquire wrote no sha) — tolerate
	const hash = sha256(readFileSync(file));
	if (hash !== entry.sha256) throw new Error(`${name} sha256 mismatch vs sources.lock.json — re-run --acquire --refresh`);
}

// Alternative frequency source when Leipzig is unavailable: compute a Devanagari word-frequency
// list from a reachable HuggingFace text corpus via the datasets-server /rows API (JSON over HTTP,
// no parquet/deps). Writes the same canonical `sources/leipzig-words.txt` (3-col id⇥word⇥count) that
// computeFreq reads, so the rest of the pipeline is unchanged. Default corpus is Nepali news.
const HF_DATASET = 'IRIIS-RESEARCH/Nepali-Text-Corpus';
export async function acquireHfFreq({ sourcesDir, lockPath, today, dataset, articles, onProgress }) {
	const ds = dataset || HF_DATASET;
	const want = articles || 3000;
	const counts = new Map();
	let fetched = 0;
	for (let offset = 0; offset < want; offset += 100) {
		const len = Math.min(100, want - offset);
		const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(ds)}&config=default&split=train&offset=${offset}&length=${len}`;
		let data;
		for (let attempt = 0; ; attempt++) {
			try {
				const res = await fetch(url);
				if (!res.ok) throw new Error(`HF rows → HTTP ${res.status}`);
				data = await res.json();
				break;
			} catch (e) {
				if (attempt >= 3) throw e;
				await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
			}
		}
		const rows = data.rows || [];
		if (!rows.length) break;
		for (const r of rows) {
			const row = r.row || {};
			const text = row.Article || row.text || Object.values(row).find((v) => typeof v === 'string') || '';
			for (const piece of splitWords(text)) {
				const { key, display } = normalizeWord(piece);
				if (!key) continue;
				const m = counts.get(key);
				if (m) m.count++;
				else counts.set(key, { display, count: 1 });
			}
		}
		fetched += rows.length;
		if (onProgress) onProgress(fetched, counts.size);
	}
	const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
	const wordsFile = join(sourcesDir, 'leipzig-words.txt');
	mkdirSync(sourcesDir, { recursive: true });
	writeFileSync(wordsFile, ranked.map((r, i) => `${i + 1}\t${r.display}\t${r.count}`).join('\n') + '\n');
	const lock = readLock(lockPath);
	lock.leipzig = {
		corpus: ds,
		url: 'https://datasets-server.huggingface.co (rows API)',
		file: 'leipzig-words.txt',
		sha256: sha256(readFileSync(wordsFile)),
		articles: fetched,
		words: ranked.length,
		downloaded: today,
		license: 'see dataset card',
	};
	writeLock(lockPath, lock);
	return { wordsFile, words: ranked.length, articles: fetched };
}

// --- pure parsers ---------------------------------------------------------------------------

// Leipzig *-words.txt: three tab-separated columns — id, word, frequency. Returns rows normalized
// and frequency-ranked (descending), keeping only Devanagari-bearing words, deduped by match key
// (summing counts of surface variants that collapse to the same key).
export function parseLeipzigWords(text) {
	const byKey = new Map();
	for (const line of text.split('\n')) {
		if (!line) continue;
		const cols = line.split('\t');
		if (cols.length < 3) continue;
		if (!DEV_RE.test(cols[1])) continue; // keep only Devanagari-bearing words (drop Latin/numerals)
		const { display, key } = normalizeWord(cols[1]);
		const count = parseInt(cols[2], 10);
		if (!key || !Number.isFinite(count)) continue;
		const prev = byKey.get(key);
		if (prev) prev.count += count;
		else byKey.set(key, { key, display, count });
	}
	const rows = [...byKey.values()].sort((a, b) => b.count - a.count);
	rows.forEach((r, i) => (r.rank = i + 1));
	return rows;
}

// Build a Wiktionary index: normalized headword key → { glosses[], pos[] }. Multiple kaikki
// entries per word (different POS/etymologies) merge. `pos:'character'` (single letters) and
// `pos:'name'` (proper nouns) are tagged so the cross-check can treat them accordingly.
export function buildWiktionaryIndex(jsonl) {
	const index = new Map();
	for (const line of jsonl.split('\n')) {
		if (!line) continue;
		let o;
		try {
			o = JSON.parse(line);
		} catch {
			continue;
		}
		if (!o.word) continue;
		const { key } = normalizeWord(o.word);
		if (!key) continue;
		const glosses = (o.senses || []).flatMap((s) => s.glosses || []);
		if (!glosses.length) continue;
		const entry = index.get(key) || { glosses: [], pos: [] };
		for (const g of glosses) if (!entry.glosses.includes(g)) entry.glosses.push(g);
		if (o.pos && !entry.pos.includes(o.pos)) entry.pos.push(o.pos);
		index.set(key, entry);
	}
	return index;
}
