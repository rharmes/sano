// Assemble design/tts-compare.html — the character-voice matrix (see RESEARCH.md §9).
// Rows = the 20 sample phrases (tools/tts/phrases.mjs). Columns = the 10 characters
// (section 9 order, Phurtilo excluded as unused), headed by their head-only art from
// js/characters.js. Each cell is a speaker button that plays that character's clip of
// that phrase; cells are left blank when there's no clip yet (no voice ID assigned, so
// tools/tts/eleven.mjs hasn't generated design/_bakeoff/<char>/).
//
//   node tools/tts/build-compare.mjs
//   php -S 0.0.0.0:8000   # from repo root, open /design/tts-compare.html
//
// The page and the _bakeoff clips are gitignored (regenerate any time, never shipped).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHRASES } from './phrases.mjs';

// Head art (SVG strings) lifted from js/characters.js without a browser.
const CHARACTER_HEADS = Function(readFileSync(join('js', 'characters.js'), 'utf8') + '; return CHARACTER_HEADS;')();

// Column order from RESEARCH.md §9 — every character except the unused Phurtilo.
const CHARACTERS = ['sano', 'pyaro', 'rangin', 'bahadur', 'gyani', 'thulo', 'hiun', 'shanta', 'chanchal', 'lamo'];
const BAKEOFF = join('design', '_bakeoff');

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clipPath = (char, id) => join(BAKEOFF, char, id + '.mp3');
const SPK =
	'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4 4 0 010 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const voiced = CHARACTERS.filter((c) => existsSync(join(BAKEOFF, c)));
const pending = CHARACTERS.filter((c) => !voiced.includes(c));

const headRow = CHARACTERS.map(
	(c) => `          <th class="char"><span class="head" title="${esc(cap(c))}">${CHARACTER_HEADS[c] || esc(cap(c))}</span></th>`,
).join('\n');

const bodyRows = PHRASES.map((p) => {
	const cells = CHARACTERS.map((c) =>
		existsSync(clipPath(c, p.id))
			? `          <td><button type="button" title="${esc(cap(c))}" onclick="play('_bakeoff/${c}/${esc(p.id)}.mp3', this)">${SPK}</button></td>`
			: '          <td></td>',
	).join('\n');
	return `        <tr>
          <th class="ph"><div class="dev" lang="ne">${esc(p.dev)}</div><div class="rom">${esc(p.np)}</div><div class="en">${esc(p.en)}</div></th>
${cells}
        </tr>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nepali character-voice matrix</title>
    <style>
      /* Head-art palette, mirrored from css/sano.css (.f-* fills + the tokens they use). */
      :root {
        color-scheme: light dark;
        --hbg: #faf7f2;
        --path-complete-color: #56629e; --accent: #dd6470; --paper-petal: #f3c7cd;
        --paper-cream: #f1e8d6; --paper-cream-deep: #e8ddc6; --paper-ink: #37323c; --paper-whisker: #a59a86;
        --f-rust: #c66a38; --f-rust-deep: #a9522a; --f-orange: #d98a43; --f-slate: #a4abb8; --f-slate-deep: #717a8d;
        --f-ele: #ad9ca7; --f-ele-deep: #6f5f6a; --f-rhino: #8e8b72; --f-rhino-deep: #5d5b46; --f-brown: #8c6a45;
        --f-brown-deep: #674a2e; --f-olive: #7f8a52; --f-olive-deep: #5d6740; --f-teal: #3f8f8a; --f-copper: #c0703f;
        --f-green: #708f4a; --f-snow: #f6efe2; --f-charcoal: #3a3540; --f-horn: #c2b48f; --f-bill: #5e6474; --f-tooth: #d6ccad;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --hbg: #1c1b19;
          --path-complete-color: #7384c4; --accent: #e0697a; --paper-petal: #f0bfc7;
          --paper-cream: #e6dac4; --paper-cream-deep: #d6c9ae; --paper-ink: #2e2935; --paper-whisker: #8d8474;
        }
      }
      .f-indigo { fill: var(--path-complete-color); } .f-crimson { fill: var(--accent); } .f-petal { fill: var(--paper-petal); }
      .f-cream { fill: var(--paper-cream); } .f-cream-deep { fill: var(--paper-cream-deep); } .f-ink { fill: var(--paper-ink); }
      .s-whisker { fill: none; stroke: var(--paper-whisker); stroke-width: 2; stroke-linecap: round; }
      .f-rust { fill: var(--f-rust); } .f-rust-deep { fill: var(--f-rust-deep); } .f-orange { fill: var(--f-orange); }
      .f-slate { fill: var(--f-slate); } .f-slate-deep { fill: var(--f-slate-deep); } .f-ele { fill: var(--f-ele); }
      .f-ele-deep { fill: var(--f-ele-deep); } .f-rhino { fill: var(--f-rhino); } .f-rhino-deep { fill: var(--f-rhino-deep); }
      .f-brown { fill: var(--f-brown); } .f-brown-deep { fill: var(--f-brown-deep); } .f-olive { fill: var(--f-olive); }
      .f-olive-deep { fill: var(--f-olive-deep); } .f-teal { fill: var(--f-teal); } .f-copper { fill: var(--f-copper); }
      .f-green { fill: var(--f-green); } .f-snow { fill: var(--f-snow); } .f-charcoal { fill: var(--f-charcoal); }
      .f-horn { fill: var(--f-horn); } .f-bill { fill: var(--f-bill); } .f-tooth { fill: var(--f-tooth); }

      body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; background: var(--hbg); color: #1c1b19; }
      @media (prefers-color-scheme: dark) { body { color: #f3efe7; } }
      h1 { font-size: 1.15rem; margin: 0 0 0.2rem; }
      p.note { opacity: 0.72; font-size: 0.82rem; max-width: 48rem; margin: 0.2rem 0 0.8rem; }
      .wrap { overflow: auto; max-height: 86vh; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 10px; }
      table { border-collapse: separate; border-spacing: 0; font-size: 0.9rem; }
      th, td { border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-right: 1px solid color-mix(in srgb, currentColor 7%, transparent); padding: 0.4rem 0.5rem; text-align: center; vertical-align: middle; }
      thead th { position: sticky; top: 0; background: var(--hbg); z-index: 2; }
      .ph { position: sticky; left: 0; background: var(--hbg); text-align: left; min-width: 11rem; max-width: 13rem; z-index: 1; }
      thead .ph { z-index: 3; }
      .dev { font-size: 1.2rem; line-height: 1.25; }
      .rom { opacity: 0.62; font-size: 0.72rem; }
      .en { opacity: 0.5; font-size: 0.72rem; }
      .char { min-width: 58px; }
      .head svg { width: 46px; height: 46px; display: block; margin: 0 auto; }
      button { font: inherit; color: inherit; background: transparent; border: 1px solid color-mix(in srgb, currentColor 28%, transparent); border-radius: 8px; padding: 0.3rem 0.45rem; cursor: pointer; line-height: 0; }
      button.playing { background: color-mix(in srgb, currentColor 20%, transparent); }
    </style>
  </head>
  <body>
    <h1>Nepali character-voice matrix</h1>
    <p class="note">
      Tap a speaker to hear that character say the phrase. Voiced: ${voiced.map(cap).join(', ') || 'none yet'}.${pending.length ? ' Blank columns have no voice ID assigned yet (' + pending.map(cap).join(', ') + ').' : ''}
      Scroll sideways for more characters; the phrase column stays pinned.
    </p>
    <div class="wrap">
      <table>
        <thead>
          <tr>
            <th class="ph">Phrase</th>
${headRow}
          </tr>
        </thead>
        <tbody>
${bodyRows}
        </tbody>
      </table>
    </div>
    <script>
      let cur = null;
      function play(src, btn) {
        if (cur) { cur.audio.pause(); cur.btn.classList.remove('playing'); }
        const audio = new Audio(src);
        cur = { audio, btn };
        btn.classList.add('playing');
        audio.onended = audio.onerror = () => btn.classList.remove('playing');
        audio.play().catch(() => btn.classList.remove('playing'));
      }
    </script>
  </body>
</html>
`;

writeFileSync(join('design', 'tts-compare.html'), html);
console.log(`Wrote design/tts-compare.html — ${PHRASES.length} phrases × ${CHARACTERS.length} characters.`);
console.log(`Voiced: ${voiced.map(cap).join(', ') || '(none)'}`);
console.log(`Blank (no voice ID yet): ${pending.map(cap).join(', ') || '(none)'}`);
console.log('Serve from repo root (php -S 0.0.0.0:8000) and open /design/tts-compare.html.');
