#!/usr/bin/env node
// Stamp local asset URLs in index.html with a content hash (?v=abc12345) so
// browsers (iOS Safari especially) refetch a file only when it has changed.
//
// Usage: node tools/stamp-version.mjs — run after changing css/js, before
// committing. Idempotent: re-running without changes leaves index.html alone.

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
	const hash = createHash('md5').update(readFileSync(join(ROOT, path))).digest('hex').slice(0, 8);
	return `${pre}${path}?v=${hash}${post}`;
});

if (stamped === html) {
	console.log('index.html already up to date.');
} else {
	writeFileSync(PAGE, stamped);
	for (const [, path, hash] of stamped.matchAll(/(?:href|src)="([^":?]+)\?v=([0-9a-f]+)"/g)) {
		console.log(`  ${path} -> ?v=${hash}`);
	}
}
