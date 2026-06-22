// Synthesize the bake-off phrases (tools/tts/phrases.mjs) through one ElevenLabs voice,
// writing one MP3 per phrase. See tools/tts/README.md and RESEARCH.md.
//
// Cloning is done in the ElevenLabs dashboard (drag a native sample in → copy its
// voice_id); this script only SYNTHESIZES, so we never touch the cloning API.
//
//   ELEVENLABS_API_KEY=sk_… node tools/tts/eleven.mjs --voice <voice_id> --label anita
//
// Nepali needs the Eleven v3 model — multilingual_v2 does not list Nepali. Output goes to
// design/_bakeoff/<label>/<id>.mp3 (design/ is committed but never deployed, and
// design/_bakeoff/ is gitignored, so bake-off clips never ship). Then run
// `node tools/tts/build-compare.mjs` to assemble the A/B page.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHRASES } from './phrases.mjs';

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.ELEVENLABS_API_KEY;
const voice = args.voice;
const label = args.label || voice;
const model = args.model || 'eleven_v3';
const fmt = args.format || 'mp3_44100_128';
const outDir = args.out || join('design', '_bakeoff', String(label));
const only = args.only ? String(args.only) : null; // regenerate just one phrase id
const phrases = only ? PHRASES.filter((p) => p.id === only) : PHRASES;

if (!apiKey) fail('Set ELEVENLABS_API_KEY in the environment.');
if (!voice) fail('Pass --voice <voice_id> — create the clone in the ElevenLabs dashboard first.');
if (only && !phrases.length) fail('No phrase with id "' + only + '" in phrases.mjs.');

mkdirSync(outDir, { recursive: true });
console.log(`Voice ${voice} (${label}) · model ${model} · ${phrases.length} phrase(s) → ${outDir}`);

let ok = 0;
for (const p of phrases) {
	try {
		writeFileSync(join(outDir, p.id + '.mp3'), await synth(p.dev));
		ok++;
		console.log(`  ✓ ${p.id}  «${p.dev}»`);
	} catch (e) {
		console.error(`  ✗ ${p.id}: ${e.message}`);
	}
	await sleep(350); // gentle on rate limits
}
console.log(`Done: ${ok}/${phrases.length} clips in ${outDir}`);

async function synth(text) {
	const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${fmt}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
		body: JSON.stringify({ text, model_id: model }),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
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
