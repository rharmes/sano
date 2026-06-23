// Production ElevenLabs synthesis for the app's shipped audio, in a chosen voice
// (default: Sano's clone). Renders phrase clips (audio/default/<id>.mp3, from each COURSE
// item's `dev`) and word-bank tile clips (audio/words/<slug>.mp3, from tools/tts/words.json).
// Unlike eleven.mjs (bake-off → design/_bakeoff/), this writes the REAL shipped audio, so it
// bumps cache via js/audio.js's AUDIO_VERSION when clips change. Cloning is done in the
// ElevenLabs dashboard; this only synthesizes.
//
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --sample    # preview subset → gitignored dir
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --phrases   # all items → audio/default/
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --words     # all words → audio/words/
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --phrases --only <id>   # one clip
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --words --only <slug>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SANO_VOICE = 'bxXWfqokkbsD3S7PPjUx'; // RESEARCH.md §9

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.ELEVENLABS_API_KEY;
const voice = args.voice || SANO_VOICE;
const model = args.model || 'eleven_v3';
const fmt = args.format || 'mp3_44100_128';
const only = args.only ? String(args.only) : null;

if (!apiKey) fail('Set ELEVENLABS_API_KEY in the environment.');

const COURSE = Function(readFileSync(join(ROOT, 'js', 'data.js'), 'utf8') + '; return COURSE;')();
const items = COURSE.flatMap((u) => u.items).filter((it) => it.dev);

// Resolve the job list: { text (Devanagari), out (mp3 path), label }.
let jobs;
let outDir;
if (args.sample) {
	outDir = join(ROOT, 'design', '_bakeoff', 'sano-sample');
	jobs = sampleJobs(outDir);
} else if (args.phrases) {
	outDir = join(ROOT, 'audio', 'default');
	jobs = items.map((it) => ({ text: it.dev, out: join(outDir, it.id + '.mp3'), label: it.id }));
} else if (args.words) {
	outDir = join(ROOT, 'audio', 'words');
	const words = JSON.parse(readFileSync(join(HERE, 'words.json'), 'utf8'));
	jobs = Object.entries(words).map(([slug, w]) => ({ text: w.dev, out: join(outDir, slug + '.mp3'), label: `${slug} «${w.dev}»` }));
} else {
	fail('Pass one of --sample | --phrases | --words.');
}

if (only) {
	jobs = jobs.filter((j) => j.label.split(' ')[0] === only);
	if (!jobs.length) fail(`--only "${only}" matched no job.`);
}

mkdirSync(outDir, { recursive: true });
console.log(`Voice ${voice} · model ${model} · ${jobs.length} clip(s) → ${outDir.replace(ROOT + '/', '')}`);

let ok = 0;
for (const job of jobs) {
	try {
		const buf = await synth(job.text);
		if (!buf.length) throw new Error('empty audio');
		writeFileSync(job.out, buf);
		ok++;
		console.log(`  ✓ ${job.label}`);
	} catch (e) {
		console.error(`  ✗ ${job.label}: ${e.message}`);
	}
	await sleep(350); // gentle on rate limits
}
console.log(`Done: ${ok}/${jobs.length} clips.`);
if (args.sample && ok) writeSampleIndex(outDir, jobs);

// A fixed, representative preview: the tricky fusion phrases + their split words + the
// flagged `pariracha`, so the Sano voice can be judged on both phrases and single words.
function sampleJobs(dir) {
	const words = JSON.parse(readFileSync(join(HERE, 'words.json'), 'utf8'));
	const phraseNps = ['Tapai ko naam ke ho?', 'Tapai lai kasto cha?', 'Tapai kaha bata ho?', 'Ramro sanga sutnus', 'Pani pariracha'];
	const wordSlugs = ['ko', 'lai', 'bata', 'sanga', 'sutnus', 'naam', 'bolnu', 'pariracha'];
	const out = [];
	for (const np of phraseNps) {
		const it = items.find((i) => i.np === np);
		if (it) out.push({ text: it.dev, out: join(dir, 'phrase-' + it.id + '.mp3'), label: `phrase ${it.id} «${it.dev}»` });
		else console.error(`  (sample: no item with np "${np}")`);
	}
	for (const s of wordSlugs) {
		if (words[s]) out.push({ text: words[s].dev, out: join(dir, 'word-' + s + '.mp3'), label: `word ${s} «${words[s].dev}»` });
	}
	return out;
}

function writeSampleIndex(dir, jobs) {
	const rows = jobs
		.map((j) => {
			const file = j.out.split('/').pop();
			return `<figure><figcaption>${j.label.replace(/[<>]/g, '')}</figcaption><audio controls src="${file}"></audio></figure>`;
		})
		.join('\n');
	const html = `<!doctype html><meta charset="utf-8"><title>Sano voice sample</title>
<style>body{font-family:system-ui;max-width:42rem;margin:2rem auto;padding:0 1rem}figure{margin:0 0 1rem}figcaption{font-size:.9rem;color:#555;margin-bottom:.25rem}audio{width:100%}</style>
<h1>Sano voice — sample</h1><p>Phrases (re-voiced) + single word-bank words. Judge naturalness and single-word intelligibility.</p>
${rows}`;
	writeFileSync(join(dir, 'index.html'), html);
	console.log(`Sample page: design/_bakeoff/sano-sample/index.html`);
}

async function synth(text) {
	const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${fmt}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
		body: JSON.stringify({ text, model_id: model }),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
	return Buffer.from(await res.arrayBuffer());
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
function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}
function fail(m) {
	console.error('Error: ' + m);
	process.exit(1);
}
