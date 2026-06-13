#!/usr/bin/env node
// WebKit/Safari smoke test for the Sano idle animations.
//
// Headless Chrome (tools/check-viewports.mjs) can't catch WebKit-only
// rendering bugs, so this drives REAL Safari via safaridriver (the WebDriver
// server built into macOS) and asserts that every idle animation is applied,
// running, and actually moving the SVG.
//
// One-time setup (per machine):
//   sudo safaridriver --enable
//   Safari > Settings > Advanced > "Show features for web developers"
//   Safari > Develop > "Allow Remote Automation"
//
// Usage: node tools/check-webkit.mjs
// Opens a Safari window briefly. Exits non-zero on failure.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAFARIDRIVER = process.env.SAFARIDRIVER || 'safaridriver';
const DRIVER_PORT = 7799;
const TYPES = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
};

// Each idle group and the keyframe it must be running. The full mascot (.scene,
// .sano-idle) runs all five; the footer head crop (.sano-idle-head) runs the
// three that read at thumbnail size (blink, ear, nose).
const GROUPS = [
	['.scene .sano-idle .sano-tail', 'sano-idle-tail-wag'],
	['.scene .sano-idle .sano-head', 'sano-idle-head-tilt'],
	['.scene .sano-idle .sano-eyes', 'sano-idle-blink'],
	['.scene .sano-idle .sano-ear-left', 'sano-idle-ear-wiggle'],
	['.scene .sano-idle .sano-nose', 'sano-idle-nose-wiggle'],
	['.footer .sano-idle-head .sano-eyes', 'sano-idle-blink'],
	['.footer .sano-idle-head .sano-ear-left', 'sano-idle-ear-wiggle'],
	['.footer .sano-idle-head .sano-nose', 'sano-idle-nose-wiggle'],
];

// Serve the repo so Safari loads the real app + assets over http.
function serve() {
	const server = createServer((req, res) => {
		const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
		try {
			res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
			res.end(readFileSync(join(ROOT, path)));
		} catch {
			res.writeHead(404);
			res.end();
		}
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const BASE = `http://127.0.0.1:${DRIVER_PORT}`;

async function wd(method, path, body) {
	const res = await fetch(BASE + path, {
		method,
		headers: { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		const v = json.value || {};
		throw new Error(`${method} ${path} -> ${res.status} ${v.error || ''} ${v.message || ''}`.trim());
	}
	return json.value;
}

// safaridriver takes a moment to accept connections; retry session creation.
async function newSession() {
	for (let i = 0; i < 20; i++) {
		try {
			const v = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
			return v.sessionId;
		} catch (e) {
			if (i === 19) throw e;
			await new Promise((r) => setTimeout(r, 300));
		}
	}
}

const driver = spawn(SAFARIDRIVER, ['-p', String(DRIVER_PORT)], { stdio: 'inherit' });
const server = await serve();
const url = `http://127.0.0.1:${server.address().port}/index.html`;
let sessionId;
let failed = false;

try {
	sessionId = await newSession();
	await wd('POST', `/session/${sessionId}/timeouts`, { script: 15000 });
	await wd('POST', `/session/${sessionId}/url`, { url });

	// Wait for the stylesheet to apply so animationName resolves.
	for (let i = 0; i < 20; i++) {
		const ready = await wd('POST', `/session/${sessionId}/execute/sync`, {
			script: "var e=document.querySelector('.scene .sano-idle .sano-eyes');return !!e&&getComputedStyle(e).animationName!=='none';",
			args: [],
		});
		if (ready) break;
		await new Promise((r) => setTimeout(r, 250));
	}

	// 1) Config check: every group has the right keyframe, running.
	const rows = await wd('POST', `/session/${sessionId}/execute/sync`, {
		script:
			'return JSON.parse(arguments[0]).map(function(g){var el=document.querySelector(g[0]);' +
			'if(!el)return{sel:g[0],ok:false,why:"missing"};var cs=getComputedStyle(el);' +
			'var ok=cs.animationName===g[1]&&cs.animationPlayState==="running";' +
			'return{sel:g[0],ok:ok,name:cs.animationName,play:cs.animationPlayState,want:g[1]};});',
		args: [JSON.stringify(GROUPS)],
	});
	for (const r of rows) {
		if (!r.ok) failed = true;
		console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.sel} — ${r.why || r.name + '/' + r.play + (r.ok ? '' : ' (want ' + r.want + '/running)')}`);
	}

	// 2) Movement check: sample the blink for one full 4s cycle and confirm the
	//    eyes' transform actually changes (proves WebKit animates SVG transforms,
	//    not just that the animation is "running" on paper).
	const samples = await wd('POST', `/session/${sessionId}/execute/async`, {
		script:
			'var cb=arguments[arguments.length-1];var el=document.querySelector(".scene .sano-idle .sano-eyes");' +
			'if(!el)return cb([]);var seen=[];var t0=Date.now();var iv=setInterval(function(){' +
			'seen.push(getComputedStyle(el).transform);if(Date.now()-t0>4400){clearInterval(iv);cb(seen);}},80);',
		args: [],
	});
	const distinct = new Set(samples).size;
	const moves = distinct >= 2;
	if (!moves) failed = true;
	console.log(`  ${moves ? 'PASS' : 'FAIL'}  eye blink moves — ${distinct} distinct transform(s) over 4.4s${moves ? '' : ' (expected >= 2)'}`);

	console.log(failed ? '\nWebKit animation check FAILED.' : '\nAll WebKit animation checks pass.');
} catch (e) {
	failed = true;
	console.error('\nError: ' + e.message);
	console.error('If this is a session error, run the one-time setup at the top of this file.');
} finally {
	if (sessionId) await wd('DELETE', `/session/${sessionId}`).catch(() => {});
	driver.kill();
	server.close();
}

process.exitCode = failed ? 1 : 0;
