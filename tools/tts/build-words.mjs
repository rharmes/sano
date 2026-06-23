// Build tools/tts/words.json — the per-word Devanagari map that drives word-bank tile
// audio (audio/words/<slug>.mp3, played by SanoAudio.playWord). Most tile-words derive
// their Devanagari straight from the existing phrase `dev` (1:1 alignment with the
// romanized `np`); the rest — postpositions/verb-fusions that don't split in writing —
// come from the hand-drafted OVERRIDES below. Those drafts are AI-authored and pending
// Ross's review, like every `dev` string (CLAUDE.md).
//
//   node tools/tts/build-words.mjs    # (re)write words.json and print stats
//
// Slug logic mirrors sano.js's playTileWord (normalize → spaces-to-dashes) so the
// filenames here match what the app requests at runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const COURSE = Function(readFileSync(join(ROOT, 'js', 'data.js'), 'utf8') + '; return COURSE;')();

const normalize = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
const slugOf = (w) => normalize(w).replace(/\s+/g, '-');
const stripParens = (s) =>
	s
		.replace(/\([^)]*\)/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
const devClean = (w) => w.replace(/[?।,!.]/g, '').trim();

// Hand-drafted Devanagari for tile-words that only ever appear fused in the phrase `dev`
// (postpositions को/लाई/बाट/सँग attach to their host noun; verbs fuse with हुन्छ/भयो), so
// 1:1 alignment can't recover them. AI drafts — review before rendering audio.
// NOTE: `pariracha` — source pairs "Pani pariracha" with "पानी परिरहेको छ"; the romanization
// and Devanagari diverge, so confirm the intended form.
const OVERRIDES = {
	ko: 'को',
	hajur: 'हजुर',
	lai: 'लाई',
	bata: 'बाट',
	sanga: 'सँग',
	bolnu: 'बोल्नु',
	hunchha: 'हुन्छ',
	basnu: 'बस्नु',
	huncha: 'हुन्छ',
	khanu: 'खानु',
	garnu: 'गर्नु',
	sutnus: 'सुत्नुस्',
	bhetda: 'भेट्दा',
	khushi: 'खुसी',
	lagyo: 'लाग्यो',
	bujhnubhayo: 'बुझ्नुभयो',
	bujyau: 'बुझ्यौ',
	pariracha: 'परिरहेको छ',
};

// Word-bank tiles come from multi-word phrases only (np has ≥ 2 words).
const phrases = COURSE.filter((u) => u.kind === 'phrases')
	.flatMap((u) => u.items)
	.filter((it) => it.np && it.dev && !it.np.includes('_') && it.np.trim().split(/\s+/).length >= 2);

// Distinct tile-words, the romanized display form, and which items they appear in.
const appears = {}; // slug -> Set(itemId)
const romanOf = {}; // slug -> normalized roman
for (const it of phrases) {
	for (const w of stripParens(it.np).split(/\s+/)) {
		const s = slugOf(w);
		if (!s) continue;
		(appears[s] = appears[s] || new Set()).add(it.id);
		romanOf[s] = normalize(w);
	}
}

// Auto-derive dev from phrases whose np and dev split into the same number of words.
const aligned = {}; // slug -> Map(dev -> count)
for (const it of phrases) {
	const rw = stripParens(it.np).split(/\s+/).map(slugOf).filter(Boolean);
	const dw = it.dev.trim().split(/\s+/).map(devClean).filter(Boolean);
	if (rw.length !== dw.length) continue;
	for (let i = 0; i < rw.length; i++) {
		const m = (aligned[rw[i]] = aligned[rw[i]] || new Map());
		m.set(dw[i], (m.get(dw[i]) || 0) + 1);
	}
}

const out = {};
const missing = [];
const conflicts = [];
for (const slug of Object.keys(appears).sort()) {
	let dev, source;
	if (OVERRIDES[slug]) {
		dev = OVERRIDES[slug];
		source = 'override';
	} else if (aligned[slug]) {
		const entries = [...aligned[slug].entries()].sort((a, b) => b[1] - a[1]);
		dev = entries[0][0];
		source = 'aligned';
		if (entries.length > 1) conflicts.push(`${slug} {${entries.map((e) => e[0] + '×' + e[1]).join(', ')}}`);
	} else {
		missing.push(slug);
		continue;
	}
	out[slug] = { roman: romanOf[slug], dev, source, phrases: [...appears[slug]].sort() };
}

writeFileSync(join(HERE, 'words.json'), JSON.stringify(out, null, '\t') + '\n');

const total = Object.keys(appears).length;
const overrides = Object.values(out).filter((w) => w.source === 'override').length;
console.log(`words.json: ${Object.keys(out).length}/${total} tile-words mapped (${total - overrides} aligned, ${overrides} override).`);
if (conflicts.length) console.log(`CONFLICTS (${conflicts.length}): ${conflicts.join('  ')}`);
else console.log('No alignment conflicts.');
if (missing.length) {
	console.error(`MISSING dev (${missing.length}) — add to OVERRIDES: ${missing.join(', ')}`);
	process.exitCode = 1;
} else {
	console.log('Every tile-word has a Devanagari mapping.');
}
