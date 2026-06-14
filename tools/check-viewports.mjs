#!/usr/bin/env node
// Layout regression check across key mobile widths and several app screens.
//
// Headless Chrome can't open a window narrower than 500px, so each width is
// tested inside a same-origin iframe (which gets its own viewport: media
// queries, matchMedia, innerWidth, position:fixed all follow the iframe). Each
// "scenario" seeds localStorage, optionally drives the iframe to a screen, then
// asserts no horizontal overflow and that key elements stay inside the viewport.
//
// Usage: node tools/check-viewports.mjs
// Exits non-zero on failure and writes /tmp/sano-viewports-<scenario>.png.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: must stay async (execFileSync would block the event loop and deadlock
// the in-process HTTP server that Chrome is loading the app from).
const run = promisify(execFile);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [320, 360, 375, 390, 412, 429, 430, 519, 521];
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HARNESS = '.viewport-harness.html';
const TYPES = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.ico': 'image/x-icon',
	'.png': 'image/png',
	'.webp': 'image/webp',
};

// Each scenario: a localStorage seed (a JS expression evaluated where `day()` and
// `COURSE` exist; `null` clears state), an optional in-iframe driver (runs with
// `win`/`doc` plus `setInput`/`click` helpers), and the selectors that must stay
// within the viewport.
const SCENARIOS = [
	{
		name: 'home',
		// Completed unit with due reviews (badge), current unit mid-progress (ring +
		// START), long name (ellipsis).
		seed: `(() => {
			const items = {};
			for (const it of COURSE[0].items) items[it.id] = { seen: 2, correct: 2, level: 1, lastSeen: day(2), intro: true };
			for (const it of COURSE[1].items.slice(0, 8)) items[it.id] = { seen: 1, correct: 1, level: 1, lastSeen: day(0), intro: true };
			return { version: 2, name: 'Rosalind Wilder', streak: 5, lastActivityDay: day(0), itemsToday: 8, itemsTotal: 220, items };
		})()`,
		drive: ``,
		selectors: ['#progress', '#daily-lesson', '.path-node', '.path-label', '.path-start'],
	},
	{
		name: 'onboarding',
		seed: `null`, // no saved name -> the first-run flow runs
		// Advance to the account step (most bubbles + the choice buttons = widest).
		drive: `setInput('#onboard-thread .onboard-input', 'Aastha'); click('ENTER');`,
		selectors: ['#onboard-thread .bubble', '.onboard-choices', '.onboard-scene .mascot'],
	},
	{
		name: 'modal',
		seed: `({ version: 2, name: 'Aastha', onboarded: true, streak: 3, lastActivityDay: day(0), itemsToday: 0, itemsTotal: 0, items: {} })`,
		// Force the reminder modal open (it only auto-shows inside an installed PWA).
		drive: `
			const hs = doc.getElementById('reminder-hour');
			for (let h = 0; h < 24; h++) { const o = doc.createElement('option'); o.value = h; o.textContent = h + ':00'; hs.appendChild(o); }
			const ts = doc.getElementById('reminder-tz'); const o = doc.createElement('option'); o.value = 'Asia/Kathmandu'; o.textContent = 'Asia/Kathmandu'; ts.appendChild(o);
			doc.getElementById('reminder-modal').classList.remove('hide');
		`,
		selectors: ['.reminder-card', '.reminder-field select', '.reminder-actions'],
	},
];

function harnessHtml(scenario) {
	const iframeTags = WIDTHS.map((w) => `<iframe width="${w}" src="/"></iframe>`).join('\n');
	return `<!doctype html>
<html><head><meta charset="utf-8"><style>
body { background: #111; margin: 0; display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
iframe { border: 1px solid #555; height: 760px; flex-shrink: 0; }
</style><script src="/js/data.js"><\/script>
<script>
const day = (n) => {
	const d = new Date(Date.now() - n * 864e5);
	return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const seed = ${scenario.seed};
if (seed === null) localStorage.removeItem('sano.state.v1');
else localStorage.setItem('sano.state.v1', JSON.stringify(seed));
<\/script></head><body>
${iframeTags}
<script>
const WIDTHS = ${JSON.stringify(WIDTHS)};
const SELECTORS = ${JSON.stringify(scenario.selectors)};
window.addEventListener('load', () => setTimeout(boot, 600));

function drive(win, doc) {
	const setInput = (sel, v) => { const i = doc.querySelector(sel); i.value = v; i.dispatchEvent(new win.Event('input', { bubbles: true })); };
	const click = (txt) => {
		for (const b of doc.querySelectorAll('#onboard-controls button')) {
			const n = b.querySelector('.np');
			if ((n ? n.textContent : b.textContent).trim().indexOf(txt) === 0) { b.click(); return; }
		}
	};
	${scenario.drive}
}

function boot() {
	const frames = document.getElementsByTagName('iframe');
	for (let i = 0; i < WIDTHS.length; i++) {
		try { drive(frames[i].contentWindow, frames[i].contentDocument); } catch (e) {}
	}
	setTimeout(check, 250);
}

function check() {
	const results = [];
	const frames = document.getElementsByTagName('iframe');
	WIDTHS.forEach((expected, i) => {
		const win = frames[i].contentWindow, doc = win.document, vw = win.innerWidth;
		const fails = [];
		if (vw !== expected) fails.push('viewport=' + vw);
		if (doc.documentElement.scrollWidth > vw + 1) fails.push('pageOverflow=' + doc.documentElement.scrollWidth);
		for (const sel of SELECTORS) {
			for (const el of doc.querySelectorAll(sel)) {
				const r = el.getBoundingClientRect();
				if (r.width > 0 && (r.left < -1 || r.right > vw + 1)) {
					fails.push(sel.replace(/[^a-z-]/gi, '') + '@' + Math.round(r.left) + '..' + Math.round(r.right));
					break; // one failure per selector keeps the report short
				}
			}
		}
		results.push(expected + ':' + (fails.length === 0 ? 'OK' : 'FAIL ' + fails.join(',')));
	});
	document.title = 'VPCHECK::' + results.join('|');
}
<\/script></body></html>`;
}

function serve() {
	const server = createServer((req, res) => {
		const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
		try {
			const body = readFileSync(join(ROOT, path));
			res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
			res.end(body);
		} catch (e) {
			res.writeHead(404);
			res.end();
		}
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const harnessPath = join(ROOT, HARNESS);
const server = await serve();
const port = server.address().port;
// Map external font hosts to the local server so those requests fail fast —
// deterministic + offline-friendly (fonts don't affect geometry checks).
const resolverRules = '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1';

let anyFail = false;
try {
	for (const scenario of SCENARIOS) {
		writeFileSync(harnessPath, harnessHtml(scenario));
		const url = `http://127.0.0.1:${port}/${HARNESS}`;
		const { stdout: dom } = await run(
			CHROME,
			['--headless=new', '--disable-gpu', resolverRules, '--virtual-time-budget=12000', '--window-size=1600,900', '--dump-dom', url],
			{ maxBuffer: 64 * 1024 * 1024, timeout: 90000 },
		);
		const title = (dom.match(/<title>VPCHECK::([^<]*)<\/title>/) || [])[1] || '';
		console.log('\n' + scenario.name + ':');
		if (!title) {
			console.error('  Could not read results — did the app fail to load?');
			anyFail = true;
			continue;
		}
		const results = title.replace(/&amp;/g, '&').split('|');
		let scenarioFailed = false;
		for (const line of results) {
			const ok = line.includes(':OK');
			if (!ok) {
				anyFail = true;
				scenarioFailed = true;
			}
			console.log((ok ? '  PASS  ' : '  FAIL  ') + line.replace(':OK', 'px').replace(':FAIL', 'px —'));
		}
		if (scenarioFailed) {
			await run(
				CHROME,
				[
					'--headless=new',
					'--disable-gpu',
					resolverRules,
					'--virtual-time-budget=12000',
					'--window-size=1600,1600',
					`--screenshot=/tmp/sano-viewports-${scenario.name}.png`,
					url,
				],
				{ timeout: 90000 },
			);
			console.error(`  Failures — screenshot at /tmp/sano-viewports-${scenario.name}.png`);
		}
	}
	if (anyFail) process.exitCode = 1;
	else console.log('\nAll ' + SCENARIOS.length + ' scenarios pass across ' + WIDTHS.length + ' widths.');
} finally {
	unlinkSync(harnessPath);
	server.close();
}
