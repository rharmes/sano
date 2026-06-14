#!/usr/bin/env node
// Stamp local asset URLs in index.html with a content hash (?v=abc12345) so
// browsers (iOS Safari especially) refetch a file only when it has changed.
//
// Usage:
//   node tools/stamp-version.mjs           rewrite the stamps in place
//   node tools/stamp-version.mjs --check   verify only; exit non-zero if stale
// Idempotent: re-running without changes leaves index.html alone. The --check
// mode (run by tools/check.sh, and thus CI) catches stale stamps before commit,
// so deploy.sh can just ship the committed tree without re-stamping.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'index.html');

const html = readFileSync(PAGE, 'utf8');

// Matches href/src values without a scheme (no ':'), i.e. local files only.
// Skips fragment-only URLs like the icon sprite's href="#i-bolt".
const stamped = html.replace(/((?:href|src)=")([^":?#]+)(?:\?v=[0-9a-f]+)?(")/g, (_, pre, path, post) => {
	// Fonts are immutable by filename (a content change means a new filename) and
	// the @font-face url()s in fonts.css are unstamped, so a preloaded font must
	// stay unstamped too — otherwise the URLs mismatch and the preload is wasted.
	if (path.endsWith('.woff2')) return `${pre}${path}${post}`;
	const hash = createHash('md5')
		.update(readFileSync(join(ROOT, path)))
		.digest('hex')
		.slice(0, 8);
	return `${pre}${path}?v=${hash}${post}`;
});

const check = process.argv.includes('--check');

if (stamped === html) {
	console.log('index.html already up to date.');
} else if (check) {
	console.error('Stale ?v= stamps in index.html — run `npm run stamp` and commit the result.');
	process.exitCode = 1;
} else {
	writeFileSync(PAGE, stamped);
	for (const [, path, hash] of stamped.matchAll(/(?:href|src)="([^":?]+)\?v=([0-9a-f]+)"/g)) {
		console.log(`  ${path} -> ?v=${hash}`);
	}
}
