// Self-hosted phrase audio for Sano (SR-02). Clips are pre-rendered MP3s under
// audio/<voiceId>/<id>.mp3 and played same-origin — there is NO runtime TTS or any
// other external call, matching the app's offline-first network discipline
// (CLAUDE.md). The service worker caches each file cache-first on first play.
//
// Voice architecture: every clip is namespaced by a voiceId so characters can
// diverge later. Today a single `default` voice — Sano's ElevenLabs clone
// (RESEARCH.md §9), rendered by tools/tts/synth-app.mjs — backs all phrase audio,
// the per-word tile clips, and every character. Giving each character its own voice
// (a planned follow-up) is just: render the new voice folders and widen
// voiceForCharacter() — no caller changes.
const SanoAudio = (() => {
	// Bump when clips are re-rendered (corrected Devanagari, new/retuned voices) so
	// caches and the browser fetch fresh copies. These URLs are built here in JS, so
	// tools/stamp-version.mjs (which only stamps index.html) can't version them.
	const AUDIO_VERSION = '5';
	const DEFAULT_VOICE = 'default';

	// characterId -> voiceId. Empty today: every character resolves to the one
	// default voice. This map is the single seam to widen for per-character voices.
	const CHARACTER_VOICES = {};

	const voiceForCharacter = (characterId) => CHARACTER_VOICES[characterId] || DEFAULT_VOICE;

	const url = (id, voiceId) => `audio/${voiceId || DEFAULT_VOICE}/${id}.mp3?v=${AUDIO_VERSION}`;

	// Per-word clips for the word-bank tiles (one MP3 per distinct romanized word,
	// rendered by tools/tts/words.mjs into audio/words/<slug>.mp3). Separate from the
	// per-phrase clips above; a tile with no clip yet just stays silent (see play()).
	const wordUrl = (slug) => `audio/words/${slug}.mp3?v=${AUDIO_VERSION}`;

	// One reused element: a new clip cancels the previous one, and we never pile up
	// Audio objects over a long session.
	let el = null;
	function playSrc(src) {
		if (!el) el = new Audio();
		el.pause();
		el.src = src;
		// play() is only ever called from a tap handler, so autoplay policy is
		// satisfied; a missing file / decode error rejects — swallow it so a gap in
		// audio coverage never throws into the UI.
		const p = el.play();
		if (p && p.catch) p.catch(() => {});
	}
	function play(id, voiceId) {
		if (!id) return;
		playSrc(url(id, voiceId));
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
