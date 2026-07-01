// Two-character (now small-cast) story dialogues with comprehension questions (SR-01),
// woven into the lesson path so each section has a conversation.
//
// SCHEMA v2 — the lines are now original Nepali STORIES (funny fables), not remixes of
// existing course phrases, so each line carries its own text inline:
//   { id, title, goal, section, after, cast:[companionIds], lines:[{who, np, dev, en, gloss}], questions }
// `who` is a speaker id: 'sano' or a companion id (both rendered on the left: head + bubble),
// 'narrator' (full-width scene narration, no bubble), or 'thornbush' (a one-off prop). `cast`
// lists the non-narrator companions (for
// the head art + the persona intro). `after` is the COURSE unit id the node follows in the
// path. The Nepali (`np`/`dev`) is AI-DRAFTED and Ross's to refine; the English (`en`) is the
// subtitle. Each line gets its own audio clip rendered per-voice — see VOICE RULES below and
// tools/tts/synth-app.mjs --dialogues.
//
// AUDIO TAGS — a line's `dev` may carry inline ElevenLabs v3 performance tags in [square
// brackets] (e.g. [whispers], [laughs], [sighs]; elevenlabs.io/blog/v3-audiotags). They are
// voice-acting directions for the audio render ONLY: synth-app.mjs sends `dev` verbatim so the
// TTS hears them. They must NOT appear in `np`/`gloss`/`en` (which drive on-screen display + the
// tap translation) — SanoRomanize.stripTags() removes them anywhere `dev` becomes text, and a
// data test enforces that tags live only in `dev`.
//
// GLOSS — each line may carry a `gloss`: an ordered [{np, en}] segmentation of the romanized
// line into tappable word/phrase chunks. The in-app player (js/sano.js + js/gloss.js) renders
// the romanization FROM these segments, underlining each and revealing its English on tap
// (Devanagari and the line-level English subtitle are hidden in the player). The rule
// gloss.map(g => g.np).join(' ') === np keeps them aligned; a segment with empty en renders as
// plain, non-tappable text (punctuation/connectives), and a line with no gloss falls back to
// plain np. Like np/dev, the gloss English is AI-DRAFTED and Ross's to refine.
//
// VOICE RULES (shared by playback in js/sano.js and the renderer in synth-app.mjs):
//   - narrator   -> Thulo's voice, but Gyani's if Thulo is in the cast (he can't narrate himself)
//   - thornbush  -> Rangin's voice
//   - sano       -> the default clone; every other speaker -> their own voice
// Clips live at audio/<voiceFolder>/<dialogueId>-<NN>.mp3 (NN = zero-padded line index).
const DIALOGUES = [
	{
		id: 'greet-pyaro',
		title: 'Meeting Pyaro',
		goal: 'Greet someone and make small talk',
		section: 'Foundations',
		after: 'introductions',
		cast: ['pyaro'],
		lines: [
			{
				who: 'narrator',
				np: 'Pyaro khochko chheuma cha. Sano tyahaa aaipugchhe.',
				dev: 'प्यारो खोँचको छेउमा छ। सानो त्यहाँ आइपुग्छे।',
				en: 'Pyaro is next to a canyon. Sano comes over.',
				gloss: [
					{ np: 'Pyaro', en: 'Pyaro' },
					{ np: 'khochko', en: 'of the canyon' },
					{ np: 'chheuma', en: 'beside' },
					{ np: 'cha.', en: 'is' },
					{ np: 'Sano', en: 'Sano' },
					{ np: 'tyahaa', en: 'there' },
					{ np: 'aaipugchhe.', en: 'comes over' },
				],
			},
			{
				who: 'sano',
				np: 'Ke bhayo?',
				dev: 'के भयो?',
				en: 'What happened?',
				gloss: [
					{ np: 'Ke', en: 'what' },
					{ np: 'bhayo?', en: 'happened' },
				],
			},
			{
				who: 'pyaro',
				np: 'Tala kasaile mero nakkal gariraheko cha! Sun. Kripayaa, banda gara!',
				dev: '[angry] तल कसैले मेरो नक्कल गरिरहेको छ! सुन्। [shouting] कृपया, बन्द गर!',
				en: 'Someone down there keeps copying me! Listen. Please stop!',
				gloss: [
					{ np: 'Tala', en: 'down there' },
					{ np: 'kasaile', en: 'someone' },
					{ np: 'mero', en: 'my' },
					{ np: 'nakkal', en: 'imitation' },
					{ np: 'gariraheko cha!', en: 'keeps doing' },
					{ np: 'Sun.', en: 'listen' },
					{ np: 'Kripayaa,', en: 'please' },
					{ np: 'banda', en: 'stop' },
					{ np: 'gara!', en: 'do' },
				],
			},
			{
				who: 'narrator',
				np: 'Ek aawaaj bhanchha — kripayaa, banda gara…',
				dev: 'एक आवाज भन्छ — [quietly] कृपया, बन्द गर…',
				en: 'A voice says — please stop…',
				gloss: [
					{ np: 'Ek', en: 'a' },
					{ np: 'aawaaj', en: 'voice' },
					{ np: 'bhanchha', en: 'says' },
					{ np: '—', en: '' },
					{ np: 'kripayaa,', en: 'please' },
					{ np: 'banda', en: 'stop' },
					{ np: 'gara…', en: 'do' },
				],
			},
			{
				who: 'pyaro',
				np: 'Tiniharu malaai gillaa garchhan!',
				dev: '[angry] तिनीहरू मलाई गिल्ला गर्छन्!',
				en: 'They mock me!',
				gloss: [
					{ np: 'Tiniharu', en: 'they' },
					{ np: 'malaai', en: 'me' },
					{ np: 'gillaa', en: 'mockery' },
					{ np: 'garchhan!', en: 'do' },
				],
			},
			{
				who: 'sano',
				np: 'Tyo ta pratidhwani ho. Timile bhaneko khochle dohoryaaunchha. Namaste!',
				dev: 'त्यो त प्रतिध्वनि हो। तिमीले भनेको खोँचले दोहोर्‍याउँछ। [shouting] नमस्ते!',
				en: "That's an echo. The canyon repeats what you say. Hello!",
				gloss: [
					{ np: 'Tyo', en: 'that' },
					{ np: 'ta', en: '(emphasis)' },
					{ np: 'pratidhwani', en: 'echo' },
					{ np: 'ho.', en: 'is' },
					{ np: 'Timile', en: 'you' },
					{ np: 'bhaneko', en: 'what you say' },
					{ np: 'khochle', en: 'the canyon' },
					{ np: 'dohoryaaunchha.', en: 'repeats' },
					{ np: 'Namaste!', en: 'hello' },
				],
			},
			{
				who: 'narrator',
				np: 'Ek aawaaj bhanchha — namaste…',
				dev: 'एक आवाज भन्छ — [quietly] नमस्ते…',
				en: 'A voice says — hello…',
				gloss: [
					{ np: 'Ek', en: 'a' },
					{ np: 'aawaaj', en: 'voice' },
					{ np: 'bhanchha', en: 'says' },
					{ np: '—', en: '' },
					{ np: 'namaste…', en: 'hello' },
				],
			},
			{
				who: 'pyaro',
				np: 'Maile bujhe! Maile bhaneko khochle bhannechha. Pyaro raamro cha!',
				dev: '[excitedly] मैले बुझेँ! मैले भनेको खोँचले भन्नेछ। [shouting] प्यारो राम्रो छ!',
				en: 'I understand! The canyon will say what I say. Pyaro is handsome!',
				gloss: [
					{ np: 'Maile', en: 'I' },
					{ np: 'bujhe!', en: 'understand' },
					{ np: 'Maile', en: 'I' },
					{ np: 'bhaneko', en: 'what I say' },
					{ np: 'khochle', en: 'the canyon' },
					{ np: 'bhannechha.', en: 'will say' },
					{ np: 'Pyaro', en: 'Pyaro' },
					{ np: 'raamro', en: 'handsome' },
					{ np: 'cha!', en: 'is' },
				],
			},
			{
				who: 'narrator',
				np: 'Ek aawaaj bhanchha — hoina, chaina.',
				dev: 'एक आवाज भन्छ — [quietly] होइन, छैन।',
				en: "A voice says — no, he isn't.",
				gloss: [
					{ np: 'Ek', en: 'a' },
					{ np: 'aawaaj', en: 'voice' },
					{ np: 'bhanchha', en: 'says' },
					{ np: '—', en: '' },
					{ np: 'hoina,', en: 'no' },
					{ np: 'chaina.', en: "he isn't" },
				],
			},
			{
				who: 'sano',
				np: 'Timi thik chau. Tiniharu timilaai gillaa garchhan.',
				dev: '[surprised] तिमी ठीक छौ। [gently] तिनीहरू तिमीलाई गिल्ला गर्छन्।',
				en: "You're right. They mock you.",
				gloss: [
					{ np: 'Timi', en: 'you' },
					{ np: 'thik', en: 'right' },
					{ np: 'chau.', en: 'are' },
					{ np: 'Tiniharu', en: 'they' },
					{ np: 'timilaai', en: 'you' },
					{ np: 'gillaa', en: 'mockery' },
					{ np: 'garchhan.', en: 'do' },
				],
			},
		],
		questions: [
			{ q: 'What does Pyaro first shout to the canyon?', choices: ['Please stop', 'Hello', 'How are you?', 'Go away'], answer: 0 },
			{
				q: 'Why is Pyaro upset?',
				choices: [
					'He thinks someone is mocking him',
					"He doesn't understand the voice",
					"He doesn't want to see Sano",
					'He is scared of heights',
				],
				answer: 0,
			},
			{
				q: 'What does Sano first think is happening?',
				choices: ['The sounds are echoing', 'Someone is mocking Pyaro', 'The wind is making the sounds', 'Pyaro hears voices'],
				answer: 0,
			},
		],
	},
];

// Display names for the cast (Sano + the 10 companions + one-off props). Names are Ross's drafts.
const CHARACTER_NAMES = {
	sano: 'Sano',
	pyaro: 'Pyaro',
	bahadur: 'Bahadur',
	gyani: 'Gyani',
	hiun: 'Hiun',
	phurtilo: 'Phurtilo',
	chanchal: 'Chanchal',
	thulo: 'Thulo',
	shanta: 'Shanta',
	rangin: 'Rangin',
	lamo: 'Lamo',
	thornbush: 'Thornbush',
};

// One-line personas, surfaced at the top of a conversation so each companion is memorable.
// Seeded from the per-character voice descriptors in tools/tts/RESEARCH.md §9. AI-drafted.
const CHARACTER_PERSONAS = {
	sano: 'a small, lively mouse from Kathmandu — your guide',
	pyaro: 'a warm red panda who gets thrilled about the littlest things',
	gyani: 'a wise elder elephant — full of advice, and always somewhere to be',
	bahadur: 'an easygoing tiger who runs the corner shop and loves to haggle',
	shanta: 'a calm, soft-spoken yak who means every word',
	rangin: 'a dazzling danphe whose mind flits from one shiny thing to the next',
	hiun: 'a cool, unbothered snow leopard who keeps things short',
	thulo: 'a grand old rhino who narrates ordinary life like an epic',
	chanchal: 'a young langur who cannot sit still and hates waiting',
	lamo: 'a world-weary gharial with a long memory and a longer story',
	phurtilo: 'a nimble tahr, always darting just out of frame',
};

// Per-line voice folder (audio/<folder>/…), shared with tools/tts/synth-app.mjs --dialogues.
// narrator -> Thulo (or Gyani if Thulo is in the cast); thornbush -> Rangin; sano -> default
// clone; any other speaker -> their own folder.
function dialogueVoiceFolder(dialogue, who) {
	if (who === 'narrator') return (dialogue.cast || []).includes('thulo') ? 'gyani' : 'thulo';
	if (who === 'thornbush') return 'rangin';
	if (who === 'sano') return 'default';
	return who;
}

// Stable clip id for a line: "<dialogueId>-<NN>" (NN = zero-padded line index).
function dialogueClipId(dialogue, index) {
	return dialogue.id + '-' + String(index).padStart(2, '0');
}
