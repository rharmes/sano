// Assemble design/tts-compare.html — a phone-friendly A/B page for the Nepali TTS
// bake-off. One card per phrase (tools/tts/phrases.mjs); inside each card, a play button
// for every voice: the current Piper voice (audio/default) plus every folder generated
// under design/_bakeoff/ (e.g. by tools/tts/eleven.mjs). See TTS.md.
//
//   node tools/tts/build-compare.mjs
//   php -S 127.0.0.1:8000   # from repo root, then open /design/tts-compare.html
//
// The page and the _bakeoff clips are gitignored (regenerate any time, never shipped).
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHRASES } from './phrases.mjs';

const BAKEOFF = join('design', '_bakeoff');
// `href` is resolved by the browser from design/tts-compare.html; `dir` is the on-disk
// folder we probe so we only render a button when the clip actually exists.
const voices = [{ label: 'Piper (current)', href: '../audio/default', dir: join('audio', 'default') }];
if (existsSync(BAKEOFF)) {
	for (const d of readdirSync(BAKEOFF, { withFileTypes: true })) {
		if (d.isDirectory()) voices.push({ label: d.name, href: '_bakeoff/' + d.name, dir: join(BAKEOFF, d.name) });
	}
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cards = PHRASES.map(
	(p) => `      <article class="card">
        <div class="dev" lang="ne">${esc(p.dev)}</div>
        <div class="meta"><span class="np">${esc(p.np)}</span> · <span class="en">${esc(p.en)}</span></div>
        <div class="focus">${esc(p.focus)}</div>
        <div class="voices">
${voices
	.filter((v) => existsSync(join(v.dir, p.id + '.mp3')))
	.map((v) => `          <button type="button" onclick="play('${v.href}/${esc(p.id)}.mp3', this)">▶ ${esc(v.label)}</button>`)
	.join('\n')}
        </div>
      </article>`,
).join('\n');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nepali TTS bake-off</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; background: #faf7f2; color: #1c1b19; }
      @media (prefers-color-scheme: dark) { body { background: #1c1b19; color: #f3efe7; } }
      h1 { font-size: 1.15rem; }
      p.note { opacity: 0.7; font-size: 0.85rem; max-width: 40rem; }
      .card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 12px; padding: 0.9rem 1rem; margin: 0.75rem 0; }
      .dev { font-size: 1.7rem; line-height: 1.3; }
      .meta { margin-top: 0.15rem; font-size: 0.95rem; }
      .meta .en { opacity: 0.7; }
      .focus { margin-top: 0.2rem; font-size: 0.78rem; opacity: 0.6; }
      .voices { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.7rem; }
      button { font: inherit; padding: 0.45rem 0.8rem; border-radius: 999px; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); background: transparent; color: inherit; cursor: pointer; }
      button.playing { background: color-mix(in srgb, currentColor 15%, transparent); }
    </style>
  </head>
  <body>
    <h1>Nepali TTS bake-off</h1>
    <p class="note">
      Tap a voice on each card to hear the same phrase. Voices: ${voices.map((v) => esc(v.label)).join(', ')}.
      Listen for the hard sounds in the focus line — retroflex ठ/ट, aspirated ध/घ/छ, and nasalization (हुँ, पाँच).
    </p>
${cards}
    <script>
      let cur = null;
      function play(src, btn) {
        if (cur) { cur.audio.pause(); cur.btn.classList.remove('playing'); }
        const audio = new Audio(src);
        cur = { audio, btn };
        btn.classList.add('playing');
        audio.onended = audio.onerror = () => btn.classList.remove('playing');
        audio.play().catch((e) => { btn.classList.remove('playing'); btn.textContent = '⚠ ' + (e && e.name || 'error'); });
      }
    </script>
  </body>
</html>
`;

const outPath = join('design', 'tts-compare.html');
writeFileSync(outPath, html);
console.log(`Wrote ${outPath} — ${PHRASES.length} phrases × ${voices.length} voices (${voices.map((v) => v.label).join(', ')}).`);
console.log('Serve from repo root (php -S 127.0.0.1:8000) and open /design/tts-compare.html.');
