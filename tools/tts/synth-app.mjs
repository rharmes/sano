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
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --phrases --new   # only clips not yet on disk
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --words --new     # render newly-added words only
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --dialogues       # per-voice story-line clips (js/dialogues.js)
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --units --new     # companion-voice review clips for every mapped unit (T13)
//   ELEVENLABS_API_KEY=sk_… node tools/tts/synth-app.mjs --units basics,meals --new   # …for just these units
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SANO_VOICE = 'bxXWfqokkbsD3S7PPjUx'; // RESEARCH.md §9

// Companion ElevenLabs voice ids (RESEARCH.md §9), keyed by voice folder. Shared by
// --dialogues (story lines) and --units (T13 companion review clips). Hiun / Chanchal /
// Phurtilo / Lamo have no designed voice yet — their path sections stay Sano's default.
const VOICES = {
	default: SANO_VOICE,
	pyaro: 'cTnqh1Daui2JhvWlVQGC',
	gyani: 'vTgg1b2Eauo5efIcWup5',
	shanta: 'Kk1jouQWkqFRzsjKXdUl',
	bahadur: '1adWuJ6CHzVMDg1XyhYS',
	rangin: 'yiYB6wyWboWEOt52vuJ6',
	thulo: 'MW558bGi5hBsE33qo9Rw',
};

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.ELEVENLABS_API_KEY;
const voice = args.voice || SANO_VOICE;
const model = args.model || 'eleven_v3';
const fmt = args.format || 'mp3_44100_128';
const only = args.only ? String(args.only) : null;

if (!apiKey) fail('Set ELEVENLABS_API_KEY in the environment.');

const COURSE = Function(readFileSync(join(ROOT, 'js', 'data.js'), 'utf8') + '; return COURSE;')();
const items = COURSE.flatMap((u) => u.items).filter((it) => it.dev);
// Expand each item into its clips: the item's own `dev` (audio id = item.id) plus any
// depth alternate frames (T28), whose ids are `<id>-f1`, `<id>-f2`, … — matching the
// app's itemFrames() naming. With --new these render only when missing, so adding frames
// costs credits for just the new sentences.
const clips = items.flatMap((it) => [
	{ id: it.id, dev: it.dev },
	...(it.frames || []).map((f, i) => ({ id: it.id + '-f' + (i + 1), dev: f.dev })).filter((c) => c.dev),
]);

// Resolve the job list: { text (Devanagari), out (mp3 path), label }.
let jobs;
let outDir;
if (args.sample) {
	outDir = join(ROOT, 'design', '_bakeoff', 'sano-sample');
	jobs = sampleJobs(outDir);
} else if (args.phrases) {
	outDir = join(ROOT, 'audio', 'default');
	jobs = clips.map((c) => ({ text: c.dev, out: join(outDir, c.id + '.mp3'), label: c.id }));
} else if (args.words) {
	outDir = join(ROOT, 'audio', 'words');
	const words = JSON.parse(readFileSync(join(HERE, 'words.json'), 'utf8'));
	jobs = Object.entries(words).map(([slug, w]) => ({ text: w.dev, out: join(outDir, slug + '.mp3'), label: `${slug} «${w.dev}»` }));
} else if (args.dialogues) {
	// Story dialogues (js/dialogues.js): one clip per line, each in its speaker's voice.
	// Voice rules mirror dialogueVoiceFolder() in dialogues.js: narrator -> Thulo (Gyani if
	// Thulo is in the cast), thornbush -> Rangin, sano -> default clone, else the speaker.
	outDir = join(ROOT, 'audio');
	const DIALOGUES = Function(readFileSync(join(ROOT, 'js', 'dialogues.js'), 'utf8') + '; return DIALOGUES;')();
	const folderOf = (d, who) =>
		who === 'narrator' ? ((d.cast || []).includes('thulo') ? 'gyani' : 'thulo') : who === 'thornbush' ? 'rangin' : who === 'sano' ? 'default' : who;
	jobs = [];
	for (const d of DIALOGUES) {
		d.lines.forEach((ln, i) => {
			const folder = folderOf(d, ln.who);
			const clipId = d.id + '-' + String(i).padStart(2, '0');
			jobs.push({
				text: ln.dev,
				out: join(ROOT, 'audio', folder, clipId + '.mp3'),
				label: `${folder}/${clipId}`,
				voiceId: VOICES[folder] || SANO_VOICE,
			});
		});
	}
} else if (args.units) {
	// T13 companion review clips: each unit's phrase + frame clips re-rendered in the voice
	// of the companion who owns that stretch of the path (UNIT_VOICES, js/data.js), into
	// audio/<companion>/<clipId>.mp3 — the folder js/audio.js resolves for reviewCompanion
	// items. Units whose companion has no designed voice yet are skipped (and counted, so a
	// partial run is visible). `--units` alone covers every mapped unit; a comma list
	// restricts it (the T13 pilot). Pair with --new to render only clips missing on disk.
	outDir = join(ROOT, 'audio');
	const UNIT_VOICES = Function(readFileSync(join(ROOT, 'js', 'data.js'), 'utf8') + '; return UNIT_VOICES;')();
	const wanted = args.units === true ? null : String(args.units).split(',');
	if (wanted) for (const id of wanted) if (!COURSE.some((u) => u.id === id)) fail(`--units: unknown unit "${id}"`);
	jobs = [];
	let unvoiced = 0;
	for (const u of COURSE) {
		if (wanted && !wanted.includes(u.id)) continue;
		const companion = UNIT_VOICES[u.id];
		if (!VOICES[companion] || companion === 'default') {
			unvoiced++;
			continue;
		}
		for (const it of u.items) {
			if (!it.dev) continue;
			const unitClips = [
				{ id: it.id, dev: it.dev },
				...(it.frames || []).map((f, i) => ({ id: it.id + '-f' + (i + 1), dev: f.dev })).filter((c) => c.dev),
			];
			for (const c of unitClips) {
				jobs.push({
					text: c.dev,
					out: join(ROOT, 'audio', companion, c.id + '.mp3'),
					label: `${companion}/${c.id}`,
					voiceId: VOICES[companion],
				});
			}
		}
	}
	if (unvoiced) console.log(`--units: ${unvoiced} unit(s) skipped (companion has no designed voice yet — stays default).`);
} else {
	fail('Pass one of --sample | --phrases | --words | --dialogues | --units.');
}

if (only) {
	jobs = jobs.filter((j) => j.label.split(' ')[0] === only);
	if (!jobs.length) fail(`--only "${only}" matched no job.`);
}

// Incremental render: skip clips already on disk, so adding course content only synthesizes
// the new ids/slugs (no credit spend or git churn re-rendering the existing corpus).
if (args.new) {
	const before = jobs.length;
	jobs = jobs.filter((j) => !existsSync(j.out));
	console.log(`--new: ${before - jobs.length} existing clip(s) skipped, ${jobs.length} to render.`);
	if (!jobs.length) fail('--new: nothing to render (every clip already exists).');
}

mkdirSync(outDir, { recursive: true });
console.log(`Voice ${voice} · model ${model} · ${jobs.length} clip(s) → ${outDir.replace(ROOT + '/', '')}`);

// Each job's text (a phrase/word/dialogue-line `dev`) is sent to ElevenLabs verbatim, so any
// inline [performance tags] in a dialogue line (e.g. [whispers]) are heard by the synth. tagsIn()
// surfaces them in the log so a tagged render is visible at a glance.
let ok = 0;
for (const job of jobs) {
	try {
		const buf = await synth(job.text, job.voiceId);
		if (!buf.length) throw new Error('empty audio');
		mkdirSync(dirname(job.out), { recursive: true });
		writeFileSync(job.out, buf);
		ok++;
		console.log(`  ✓ ${job.label}${tagsIn(job.text)}`);
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

async function synth(text, voiceId) {
	const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || voice}?output_format=${fmt}`;
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
// ElevenLabs v3 performance tags ([whispers], [laughs], …) sent inline; show them in the log.
function tagsIn(text) {
	const t = String(text).match(/\[[^\]\n]*\]/g);
	return t ? `  ${t.join(' ')}` : '';
}
