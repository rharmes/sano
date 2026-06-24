// Shared renderer for "glossed" dialogue lines. The in-app story player (js/sano.js) and the
// design/dialogue.html mockup use the SAME code here, so they can't drift.
//
// A dialogue line (js/dialogues.js) may carry `gloss`: an ordered [{np, en}] segmentation of
// its romanized text. SanoGloss.renderLine() turns that into the visible romanization with each
// word/phrase underlined and tappable; tapping one pops just that chunk's English (the popover
// below). Devanagari and the line-level English subtitle are intentionally NOT shown — the
// learner taps to reveal meaning. A segment with empty `en` renders as plain, non-tappable text
// (punctuation / connectives like an em dash). A line with no `gloss` falls back to its plain
// `np` (no underlines), so older / not-yet-glossed dialogues still render. Pure DOM, no calls.
const SanoGloss = (() => {
	// --- the popover: one open at a time, anchored under the tapped word ---
	// position: fixed (viewport coords) keeps the math simple; any scroll dismisses it.
	let pop = null; // the floating element, or null when nothing is open
	let anchor = null; // the .gloss-word button currently open (for toggle + cleanup)

	function close() {
		if (pop) {
			pop.remove();
			pop = null;
		}
		if (anchor) {
			anchor.classList.remove('gloss-open');
			anchor.removeAttribute('aria-expanded');
			anchor = null;
		}
		document.removeEventListener('pointerdown', onDocDown, true);
		window.removeEventListener('scroll', close, true);
		window.removeEventListener('resize', close);
		document.removeEventListener('keydown', onKey, true);
	}

	function onDocDown(e) {
		if (pop && !pop.contains(e.target) && e.target !== anchor) close();
	}
	function onKey(e) {
		if (e.key === 'Escape') close();
	}

	function open(el, text) {
		if (anchor === el) {
			close();
			return;
		} // tapping the open word again dismisses it
		close();
		anchor = el;

		pop = document.createElement('div');
		pop.className = 'gloss-pop';
		pop.setAttribute('role', 'tooltip');
		const arrow = document.createElement('span');
		arrow.className = 'gloss-pop-arrow';
		const label = document.createElement('span');
		label.className = 'gloss-pop-text';
		label.textContent = text;
		pop.append(arrow, label);
		document.body.appendChild(pop);

		// Measure, then center under the word and clamp to the viewport so it never overflows.
		const r = el.getBoundingClientRect();
		const margin = 8;
		const pw = pop.offsetWidth;
		const wordCenter = r.left + r.width / 2;
		let left = wordCenter - pw / 2;
		left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
		pop.style.left = left + 'px';
		pop.style.top = r.bottom + 8 + 'px';
		// Point the arrow up at the word even when the bubble is clamped sideways.
		let ax = wordCenter - left;
		ax = Math.max(14, Math.min(ax, pw - 14));
		arrow.style.left = ax + 'px';

		el.classList.add('gloss-open');
		el.setAttribute('aria-expanded', 'true');
		document.addEventListener('pointerdown', onDocDown, true);
		window.addEventListener('scroll', close, true);
		window.addEventListener('resize', close);
		document.addEventListener('keydown', onKey, true);
	}

	// Build the inline content of one line: underlined <button>s for tappable segments, plain
	// text for empty-en segments, single spaces between segments (so the result reads as the
	// original `np`). Returns a DocumentFragment the caller drops into its bubble / narration.
	function renderLine(line) {
		const frag = document.createDocumentFragment();
		const segs = line && line.gloss;
		if (!segs || !segs.length) {
			frag.appendChild(document.createTextNode(line ? line.np || '' : ''));
			return frag;
		}
		segs.forEach((seg, i) => {
			if (i) frag.appendChild(document.createTextNode(' '));
			if (seg.en) {
				// An inline <span>, not a <button>: it flows and wraps like text and is immune to
				// the global button styles (e.g. barebones' white-space:nowrap / button height).
				// role+tabindex+keydown keep it operable from the keyboard.
				const b = document.createElement('span');
				b.className = 'gloss-word';
				b.setAttribute('role', 'button');
				b.setAttribute('tabindex', '0');
				b.textContent = seg.np;
				b.setAttribute('aria-label', seg.np + ' — ' + seg.en);
				b.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					open(b, seg.en);
				});
				b.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						e.stopPropagation();
						open(b, seg.en);
					}
				});
				frag.appendChild(b);
			} else {
				frag.appendChild(document.createTextNode(seg.np));
			}
		});
		return frag;
	}

	return { renderLine, closePop: close };
})();
