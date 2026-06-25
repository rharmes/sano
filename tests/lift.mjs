// Lift pure globals out of the app's classic (non-module) browser scripts so they can
// be unit-tested in plain Node, no browser. Generalizes the sentinel-extraction trick
// pioneered by the old tools/check-scheduler.mjs (see js/sano.js:7 for the precedent).
//
// Two flavors:
//   liftBlock  — pull a self-contained PURE block delimited by `// --- … (pure)` /
//                `// --- end …` sentinels out of a larger file (e.g. js/sano.js), so we
//                don't have to evaluate the DOM-touching parts around it.
//   liftGlobals — evaluate an entire pure DATA file (js/data.js, js/dialogues.js, …,
//                which are just `const X = […]` with no DOM) and hand back named globals.
//
// Both wrap the source in `new Function(... 'return { names }')`, exactly like the
// scheduler check did. Anything not in `names` stays private to the wrapper scope.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const readSrc = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// Extract a sentinel-delimited block and return the listed declarations. `inject` maps
// stub names -> values handed in as function arguments, for blocks that read ambient
// values (a fake `today`, a `localStorage` shim, etc.).
export function liftBlock(rel, startSentinel, endSentinel, names, inject = {}) {
	const src = readSrc(rel);
	const a = src.indexOf(startSentinel);
	const b = src.indexOf(endSentinel);
	if (a === -1 || b === -1) {
		throw new Error(`lift: sentinels not found in ${rel}\n  start: ${startSentinel}\n  end:   ${endSentinel}`);
	}
	const block = src.slice(a, b);
	const argNames = Object.keys(inject);
	const fn = new Function(...argNames, `${block}\nreturn { ${names.join(', ')} };`);
	return fn(...argNames.map((k) => inject[k]));
}

// Evaluate a whole pure data file and return the named top-level declarations.
export function liftGlobals(rel, names) {
	const src = readSrc(rel);
	const fn = new Function(`${src}\nreturn { ${names.join(', ')} };`);
	return fn();
}

// Index just past the closing brace of the first `{ … }` block at/after `from`,
// ignoring braces inside line/block comments and '…' "…" `…` string literals.
// (Template-literal ${} interpolation is NOT handled — none of the lifted functions
// use it; guard with this assumption when choosing what to lift.)
function blockEnd(src, from) {
	let i = src.indexOf('{', from);
	if (i === -1) return -1;
	let depth = 0;
	let mode = 'code'; // 'code' | 'line' | 'block' | "'" | '"' | '`'
	for (; i < src.length; i++) {
		const c = src[i];
		const n = src[i + 1];
		if (mode === 'line') {
			if (c === '\n') mode = 'code';
			continue;
		}
		if (mode === 'block') {
			if (c === '*' && n === '/') {
				mode = 'code';
				i++;
			}
			continue;
		}
		if (mode === "'" || mode === '"' || mode === '`') {
			if (c === '\\')
				i++; // skip the escaped char
			else if (c === mode) mode = 'code';
			continue;
		}
		// mode === 'code'
		if (c === '/' && n === '/') {
			mode = 'line';
			i++;
		} else if (c === '/' && n === '*') {
			mode = 'block';
			i++;
		} else if (c === "'" || c === '"' || c === '`') {
			mode = c;
		} else if (c === '{') {
			depth++;
		} else if (c === '}') {
			if (--depth === 0) return i + 1;
		}
	}
	return -1;
}

// Lift named top-level `function NAME(){…}` declarations by extracting each from the
// source text (comment/string-aware brace matching) — so pure helpers that aren't in a
// sentinel block can be unit-tested WITHOUT editing the app file. `inject` supplies the
// external symbols those functions reference (COURSE, a localStorage stub, a fake Date,
// scheduler constants, …) as function arguments; `preamble` prepends code (e.g. a
// module-level `let` the functions assign to).
export function liftFns(rel, names, { inject = {}, preamble = '' } = {}) {
	const src = readSrc(rel);
	const parts = names.map((name) => {
		const at = src.indexOf(`function ${name}(`);
		if (at === -1) throw new Error(`liftFns: function ${name}() not found in ${rel}`);
		const end = blockEnd(src, at);
		if (end === -1) throw new Error(`liftFns: unbalanced braces extracting ${name}() from ${rel}`);
		return src.slice(at, end);
	});
	const argNames = Object.keys(inject);
	const body = `${preamble}\n${parts.join('\n\n')}\nreturn { ${names.join(', ')} };`;
	return new Function(...argNames, body)(...argNames.map((k) => inject[k]));
}
