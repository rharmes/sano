// Self-hosted phrase audio for Sano (SR-02). Clips are pre-rendered MP3s under
// audio/<voiceId>/<id>.mp3 and played same-origin — there is NO runtime TTS or any
// other external call, matching the app's offline-first network discipline
// (CLAUDE.md). The service worker caches each file cache-first on first play.
//
// Voice architecture: every clip is namespaced by a voiceId (the folder under audio/).
// Sano's ElevenLabs clone (RESEARCH.md §9) is the `default` voice behind all teaching
// audio and the per-word tile clips. Companions with a designed voice (T13) get their own
// folder of phrase clips — audio/<companion>/<id>.mp3, rendered per path section by
// tools/tts/synth-app.mjs --units — used when they quiz reviews (reviewCompanion,
// js/sano.js). Coverage is allowed to be partial: play() falls back to the default clip
// when a companion clip is missing, so rendering more sections later is purely additive.
const SanoAudio = (() => {
	// Bump when clips are re-rendered (corrected Devanagari, new/retuned voices) so
	// caches and the browser fetch fresh copies. These URLs are built here in JS, so
	// tools/stamp-version.mjs (which only stamps index.html) can't version them.
	const AUDIO_VERSION = '27';
	const DEFAULT_VOICE = 'default';

	// characterId -> voiceId (folder under audio/, named after the companion). Only
	// companions with a designed ElevenLabs voice appear; everyone else — including the
	// not-yet-voiced Hiun / Chanchal / Phurtilo / Lamo — resolves to the default clone.
	const CHARACTER_VOICES = {
		pyaro: 'pyaro',
		gyani: 'gyani',
		shanta: 'shanta',
		bahadur: 'bahadur',
		rangin: 'rangin',
		thulo: 'thulo',
	};

	const voiceForCharacter = (characterId) => CHARACTER_VOICES[characterId] || DEFAULT_VOICE;

	const url = (id, voiceId) => `audio/${voiceId || DEFAULT_VOICE}/${id}.mp3?v=${AUDIO_VERSION}`;

	// Per-word clips for the word-bank tiles (one MP3 per distinct romanized word,
	// rendered by tools/tts/words.mjs into audio/words/<slug>.mp3). Separate from the
	// per-phrase clips above; a tile with no clip yet just stays silent (see play()).
	const wordUrl = (slug) => `audio/words/${slug}.mp3?v=${AUDIO_VERSION}`;

	// One reused element: a new clip cancels the previous one, and we never pile up
	// Audio objects over a long session.
	let el = null;
	function playSrc(src, fallbackSrc) {
		if (!el) el = new Audio();
		el.pause();
		// A companion voice folder may not cover this clip yet (T13 renders per path
		// section) — on a load error, fall back to the default-voice clip once instead
		// of going silent. The handler is reset on every call so a stale fallback never
		// fires for a later clip.
		el.onerror = fallbackSrc ? () => playSrc(fallbackSrc) : null;
		el.src = src;
		// play() is only ever called from a tap handler, so autoplay policy is
		// satisfied; a missing file / decode error rejects — swallow it so a gap in
		// audio coverage never throws into the UI.
		const p = el.play();
		if (p && p.catch) p.catch(() => {});
	}
	function play(id, voiceId) {
		if (!id) return;
		const v = voiceId || DEFAULT_VOICE;
		playSrc(url(id, v), v !== DEFAULT_VOICE ? url(id, DEFAULT_VOICE) : null);
	}
	// Play a per-word tile clip by slug; a missing clip is a silent no-op.
	function playWord(slug) {
		if (!slug) return;
		playSrc(wordUrl(slug));
	}

	// A tap-to-play speaker button for phrase `id` (optionally in a character's
	// voice). Used by the dictionary, lesson prompts, and answer reveals. Stops click
	// propagation so it never trips a parent row/tile handler (e.g. the dictionary's
	// mark-complete toggle).
	function button(id, opts = {}) {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'audio-btn' + (opts.className ? ' ' + opts.className : '');
		b.setAttribute('aria-label', 'Play pronunciation');
		b.innerHTML = '<svg aria-hidden="true"><use href="#i-volume-up" /></svg>';
		b.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			play(id, opts.voiceId);
		});
		return b;
	}

	return { DEFAULT_VOICE, voiceForCharacter, url, play, playWord, button };
})();
