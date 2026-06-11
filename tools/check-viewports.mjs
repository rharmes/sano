#!/usr/bin/env node
// Layout regression check for key mobile viewport widths.
//
// Headless Chrome cannot open a window narrower than 500px, so each width is
// tested inside a same-origin iframe, which gets its own viewport (media
// queries, matchMedia, innerWidth, and position:fixed all follow the iframe).
//
// Usage: node tools/check-viewports.mjs
// Exits non-zero on failure and writes /tmp/sano-viewports.png for inspection.

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

const iframeTags = WIDTHS.map((w) => `<iframe width="${w}" src="/"></iframe>`).join('\n');

const harness = `<!doctype html>
<html><head><meta charset="utf-8"><style>
body { background: #111; margin: 0; display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
iframe { border: 1px solid #555; height: 740px; flex-shrink: 0; }
</style><script src="/js/data.js"><\/script>
<script>
// Seed a representative state before the iframes load: completed unit with due
// reviews (badge), current unit mid-progress (ring + START), long name (ellipsis).
const day = (n) => {
	const d = new Date(Date.now() - n * 864e5);
	return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const items = {};
for (const item of COURSE[0].items) items[item.id] = { seen: 2, correct: 2, level: 1, lastSeen: day(2), intro: true };
for (const item of COURSE[1].items.slice(0, 8)) items[item.id] = { seen: 1, correct: 1, level: 1, lastSeen: day(0), intro: true };
localStorage.setItem('sano.state.v1', JSON.stringify({
	version: 2, name: 'Rosalind Wilder', streak: 5, lastActivityDay: day(0),
	itemsToday: 8, itemsTotal: 220, items: items,
}));
<\/script></head><body>
${iframeTags}
<script>
const WIDTHS = ${JSON.stringify(WIDTHS)};
window.addEventListener('load', () => setTimeout(run, 800));

function run() {
	const results = [];
	const frames = document.getElementsByTagName('iframe');
	WIDTHS.forEach((expected, i) => {
		const win = frames[i].contentWindow;
		const doc = win.document;
		const vw = win.innerWidth;
		const fails = [];

		if (vw !== expected) fails.push('viewport=' + vw);
		if (doc.documentElement.scrollWidth > vw + 1) fails.push('pageOverflow=' + doc.documentElement.scrollWidth);

		for (const [selector, name] of [
			['#progress', 'header'],
			['#daily-lesson', 'button'],
			['.path-node', 'node'],
			['.path-label', 'label'],
			['.path-start', 'start'],
		]) {
			for (const el of doc.querySelectorAll(selector)) {
				const r = el.getBoundingClientRect();
				if (r.left < -1 || r.right > vw + 1) {
					fails.push(name + '@' + Math.round(r.left) + '..' + Math.round(r.right));
					break; // one failure per selector keeps the report short
				}
			}
		}
		results.push(expected + ':' + (fails.length === 0 ? 'OK' : 'FAIL ' + fails.join(',')));
	});
	document.title = 'VPCHECK::' + results.join('|');
}
<\/script></body></html>`;

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
writeFileSync(harnessPath, harness);
const server = await serve();
const url = `http://127.0.0.1:${server.address().port}/${HARNESS}`;

let title = '';
try {
	// Map external font hosts to the local server so those requests fail fast —
	// keeps the check deterministic and offline-friendly (fonts don't affect geometry checks).
	const resolverRules = '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1';
	const { stdout: dom } = await run(
		CHROME,
		['--headless=new', '--disable-gpu', resolverRules, '--virtual-time-budget=12000', '--window-size=1600,800', '--dump-dom', url],
		{ maxBuffer: 64 * 1024 * 1024, timeout: 90000 }
	);
	title = (dom.match(/<title>VPCHECK::([^<]*)<\/title>/) || [])[1] || '';

	if (!title) {
		console.error('Could not read results from the harness — did the app fail to load?');
		process.exitCode = 1;
	} else {
		const results = title.replace(/&amp;/g, '&').split('|');
		let failed = false;
		for (const line of results) {
			const ok = line.includes(':OK');
			if (!ok) failed = true;
			console.log((ok ? '  PASS  ' : '  FAIL  ') + line.replace(':OK', 'px').replace(':FAIL', 'px —'));
		}
		if (failed) {
			await run(CHROME, [
				'--headless=new', '--disable-gpu', resolverRules, '--virtual-time-budget=12000',
				'--window-size=1600,1600', '--screenshot=/tmp/sano-viewports.png', url,
			], { timeout: 90000 });
			console.error('\nFailures found — screenshot at /tmp/sano-viewports.png');
			process.exitCode = 1;
		} else {
			console.log('\nAll ' + WIDTHS.length + ' viewport widths pass.');
		}
	}
} finally {
	unlinkSync(harnessPath);
	server.close();
}
