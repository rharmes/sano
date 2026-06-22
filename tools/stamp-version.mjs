#!/usr/bin/env node
// Stamp local asset URLs in the HTML pages with a content hash (?v=abc12345) so
// browsers (iOS Safari especially) refetch a file only when it has changed.
//
// Usage:
//   node tools/stamp-version.mjs           rewrite the stamps in place
//   node tools/stamp-version.mjs --check   verify only; exit non-zero if stale
// Idempotent: re-running without changes leaves the pages alone. The --check mode
// (run by tools/check.sh, and thus CI) catches stale stamps before commit, so
// deploy.sh can just ship the committed tree without re-stamping.
//
// Pages: index.html (root-relative asset URLs) and admin/index.html (absolute
// "/css/…" URLs). Both resolve under ROOT, so the same hashing works for each.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', join('admin', 'index.html')];

// Matches href/src values without a scheme (no ':'), i.e. local files only. Skips
// fragment-only URLs like the icon sprite's href="#i-bolt".
const RE = /((?:href|src)=")([^":?#]+)(?:\?v=[0-9a-f]+)?(")/g;

function stamp(html) {
	return html.replace(RE, (whole, pre, path, post) => {
		// Fonts are immutable by filename (a content change means a new filename) and
		// the @font-face url()s in fonts.css are unstamped, so a preloaded font must
		// stay unstamped too — otherwise the URLs mismatch and the preload is wasted.
		if (path.endsWith('.woff2')) return `${pre}${path}${post}`;
		// Both "css/x" (index.html) and "/css/x" (admin) resolve under ROOT. Skip
		// anything that isn't an actual file — e.g. admin's <a href="/"> back-link.
		const rel = path.startsWith('/') ? path.slice(1) : path;
		const abs = join(ROOT, rel);
		if (rel === '' || !existsSync(abs) || statSync(abs).isDirectory()) return whole;
		const hash = createHash('md5').update(readFileSync(abs)).digest('hex').slice(0, 8);
		return `${pre}${path}?v=${hash}${post}`;
	});
}

const check = process.argv.includes('--check');
let stale = false;

for (const rel of PAGES) {
	const file = join(ROOT, rel);
	const html = readFileSync(file, 'utf8');
	const stamped = stamp(html);
	if (stamped === html) {
		console.log(`${rel} already up to date.`);
	} else if (check) {
		console.error(`Stale ?v= stamps in ${rel} — run \`npm run stamp\` and commit the result.`);
		stale = true;
	} else {
		writeFileSync(file, stamped);
		for (const [, path, hash] of stamped.matchAll(/(?:href|src)="([^":?]+)\?v=([0-9a-f]+)"/g)) {
			console.log(`  ${rel}: ${path} -> ?v=${hash}`);
		}
	}
}

if (check && stale) process.exitCode = 1;
