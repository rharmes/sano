#!/usr/bin/env node
// Render the animated Sano mascot to a seamless looping GIF for the README hero.
//
// Drives ONE headless-Chrome session over the DevTools protocol (no deps — Node's
// global WebSocket/fetch): loads design/sano-idle.html once, then for each frame
// freezes every CSS animation and scrubs it to a chosen time before screenshotting.
// (Chrome's headless virtual-time clock does NOT advance the animation timeline, and
// launching Chrome once per frame is dog-slow when a desktop Chrome holds the profile
// lock — hence one session + JS seek.) Frames are assembled with ffmpeg.
//
// The capture page sets each idle period to a divisor of the loop length, so every
// animation completes a whole number of cycles per loop → the GIF loops seamlessly
// (the real LCM of the 9/22/4/14/10s periods is ~3.85h, far too long to film).
//
// Usage: node tools/make-sano-gif.mjs [out.gif] [size-px] [fps] [seconds]
//   defaults: docs/sano-idle.gif  360  12.5  30   (375 frames @ 80ms → drift-free)
// Output is committed but never deployed (docs/ is not in tools/deploy.sh's allowlist).
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'docs', 'sano-idle.gif');
const SIZE = Number(process.argv[3] || 360);
const FPS = Number(process.argv[4] || 12.5);
const SECS = Number(process.argv[5] || 30);
const N = Math.round(FPS * SECS);
const STEP = (SECS * 1000) / N; // ms between frames
const PAGE = 'file://' + join(ROOT, 'design', 'sano-idle.html');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const work = await mkdtemp(join(tmpdir(), 'sano-gif-'));
const profile = join(work, 'profile');
await mkdir(profile, { recursive: true });

// 1. Launch headless Chrome with an ISOLATED profile (never touches the user's Chrome
//    instance, so no singleton-lock wait) and a random debugging port.
const chrome = spawn(
	CHROME,
	[
		'--headless=new',
		'--disable-gpu',
		'--hide-scrollbars',
		'--no-first-run',
		'--no-default-browser-check',
		'--disable-extensions',
		'--disable-background-networking',
		'--mute-audio',
		`--user-data-dir=${profile}`,
		`--window-size=${SIZE},${SIZE}`,
		'--remote-debugging-port=0',
		'about:blank',
	],
	{ stdio: ['ignore', 'ignore', 'ignore'] },
);

const cleanup = async () => {
	try {
		chrome.kill('SIGKILL');
	} catch {}
	await rm(work, { recursive: true, force: true });
};
process.on('exit', () => {
	try {
		chrome.kill('SIGKILL');
	} catch {}
});

try {
	// 2. Chrome writes the chosen port to DevToolsActivePort once it's listening.
	const portFile = join(profile, 'DevToolsActivePort');
	let port;
	for (let i = 0; i < 300 && !port; i++) {
		if (chrome.exitCode !== null) throw new Error(`Chrome exited early (code ${chrome.exitCode})`);
		if (existsSync(portFile)) port = (await readFile(portFile, 'utf8')).split('\n')[0].trim();
		if (!port) await sleep(100);
	}
	if (!port) throw new Error('Chrome never exposed a debugging port (30s)');

	// 3. Find the page target's WebSocket endpoint.
	let wsUrl;
	for (let i = 0; i < 50 && !wsUrl; i++) {
		const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
		wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
		if (!wsUrl) await sleep(100);
	}
	if (!wsUrl) throw new Error('No page target to attach to');

	// 4. Minimal CDP client over the raw WebSocket.
	const ws = new WebSocket(wsUrl);
	await new Promise((res, rej) => {
		ws.onopen = res;
		ws.onerror = () => rej(new Error('WebSocket failed to open'));
	});
	let nextId = 1;
	const pending = new Map();
	ws.onmessage = (ev) => {
		const msg = JSON.parse(ev.data);
		if (!pending.has(msg.id)) return;
		const { resolve, reject } = pending.get(msg.id);
		pending.delete(msg.id);
		msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
	};
	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			ws.send(JSON.stringify({ id, method, params }));
		});
	const evals = (expression, awaitPromise = false) => send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });

	await send('Page.enable');
	await send('Runtime.enable');
	await send('Emulation.setDeviceMetricsOverride', {
		width: SIZE,
		height: SIZE,
		deviceScaleFactor: 1,
		mobile: false,
	});

	// 5. Load the page and wait until its five CSS animations have registered.
	await send('Page.navigate', { url: PAGE });
	let ready = 0;
	for (let i = 0; i < 50 && ready < 5; i++) {
		ready = (await evals('document.getAnimations().length')).result.value || 0;
		if (ready < 5) await sleep(100);
	}
	if (ready < 5) throw new Error(`Only ${ready}/5 animations registered`);

	// 6. Seek + screenshot every frame in this one session.
	console.log(`Capturing ${N} frames at ${SIZE}x${SIZE} (${FPS}fps, ${SECS}s loop)…`);
	for (let k = 0; k < N; k++) {
		const t = Math.round(k * STEP + STEP / 2); // midpoint of the frame's interval
		await evals(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${t};})`);
		// Let the seeked state paint before grabbing it.
		await evals('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))', true);
		const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
		await writeFile(join(work, `frame_${String(k + 1).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
		if ((k + 1) % 50 === 0 || k + 1 === N) console.log(`  ${k + 1}/${N}`);
	}
	ws.close();
	chrome.kill('SIGKILL');

	// 7. Assemble: a full-stats global palette, then a transdiff-optimized GIF.
	console.log('Building palette + GIF…');
	const run = (cmd, args) =>
		new Promise((res, rej) => {
			const p = spawn(cmd, args, { stdio: 'ignore' });
			p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
			p.on('error', rej);
		});
	const frames = join(work, 'frame_%04d.png');
	const palette = join(work, 'palette.png');
	await run('ffmpeg', ['-y', '-i', frames, '-vf', 'palettegen=stats_mode=full', palette]);
	await run('ffmpeg', [
		'-y',
		'-framerate',
		String(FPS),
		'-i',
		frames,
		'-i',
		palette,
		'-lavfi',
		`fps=${FPS},paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
		'-loop',
		'0',
		OUT,
	]);
	console.log(`Wrote ${OUT}`);
} finally {
	await cleanup();
}
