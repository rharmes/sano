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
				np: 'Gahiro khochko kinaarma saanghuro baato. Pyaro tala herchha; Sano chheuma aaipugchhe.',
				dev: 'गहिरो खोँचको किनारमा साँघुरो बाटो। प्यारो तल हेर्छ; सानो छेउमा आइपुग्छे।',
				en: 'A narrow road along a deep canyon. Pyaro leans over the edge; Sano walks up beside him.',
				gloss: [
					{ np: 'Gahiro', en: 'deep' },
					{ np: 'khochko', en: 'of the canyon' },
					{ np: 'kinaarma', en: 'on the edge' },
					{ np: 'saanghuro', en: 'narrow' },
					{ np: 'baato.', en: 'road' },
					{ np: 'Pyaro', en: 'Pyaro' },
					{ np: 'tala', en: 'down' },
					{ np: 'herchha;', en: 'looks' },
					{ np: 'Sano', en: 'Sano' },
					{ np: 'chheuma', en: 'beside him' },
					{ np: 'aaipugchhe.', en: 'walks up' },
				],
			},
			{
				who: 'pyaro',
				np: 'Tala kasaile malai jiskyaairaheko cha! Sun — taadhaa jaau!',
				dev: 'तल कसैले मलाई जिस्क्याइरहेको छ! सुन् — टाढा जाऊ!',
				en: 'Someone down there keeps teasing me! Listen — go away!',
				gloss: [
					{ np: 'Tala', en: 'down there' },
					{ np: 'kasaile', en: 'someone' },
					{ np: 'malai', en: 'me' },
					{ np: 'jiskyaairaheko cha!', en: 'keeps teasing' },
					{ np: 'Sun', en: 'listen' },
					{ np: '—', en: '' },
					{ np: 'taadhaa', en: 'far away' },
					{ np: 'jaau!', en: 'go' },
				],
			},
			{
				who: 'narrator',
				np: 'Khochle bistaarai jawaaf dinchha: taadhaa jaau… jaau…',
				dev: 'खोँचले बिस्तारै जवाफ दिन्छ: टाढा जाऊ… जाऊ…',
				en: 'The canyon answers quietly: go away… away…',
				gloss: [
					{ np: 'Khochle', en: 'the canyon' },
					{ np: 'bistaarai', en: 'quietly' },
					{ np: 'jawaaf', en: 'answer' },
					{ np: 'dinchha:', en: 'gives' },
					{ np: 'taadhaa', en: 'far away' },
					{ np: 'jaau…', en: 'go' },
					{ np: 'jaau…', en: 'go' },
				],
			},
			{
				who: 'pyaro',
				np: 'Dekhyau? Yasle mero gillaa garchha!',
				dev: 'देख्यौ? यसले मेरो गिल्ला गर्छ!',
				en: 'See? It mocks me!',
				gloss: [
					{ np: 'Dekhyau?', en: 'see?' },
					{ np: 'Yasle', en: 'it' },
					{ np: 'mero', en: 'my' },
					{ np: 'gillaa', en: 'mockery' },
					{ np: 'garchha!', en: 'does' },
				],
			},
			{
				who: 'sano',
				np: 'Tyo ta pratidhwani ho. Khochle timrai aawaaj dohoryaaunchha.',
				dev: 'त्यो त प्रतिध्वनि हो। खोँचले तिम्रै आवाज दोहोर्‍याउँछ।',
				en: "That's an echo. The canyon repeats your own voice.",
				gloss: [
					{ np: 'Tyo', en: 'that' },
					{ np: 'ta', en: '(emphasis)' },
					{ np: 'pratidhwani', en: 'echo' },
					{ np: 'ho.', en: 'is' },
					{ np: 'Khochle', en: 'the canyon' },
					{ np: 'timrai', en: 'your own' },
					{ np: 'aawaaj', en: 'voice' },
					{ np: 'dohoryaaunchha.', en: 'repeats' },
				],
			},
			{
				who: 'pyaro',
				np: '…Pratidhwani.',
				dev: '…प्रतिध्वनि।',
				en: '…An echo.',
				gloss: [{ np: '…Pratidhwani.', en: 'an echo' }],
			},
			{
				who: 'sano',
				np: 'Garera her. Kehi raamro bhan.',
				dev: 'गरेर हेर। केही राम्रो भन।',
				en: 'Try it. Say something nice.',
				gloss: [
					{ np: 'Garera', en: 'try doing' },
					{ np: 'her.', en: 'and see' },
					{ np: 'Kehi', en: 'something' },
					{ np: 'raamro', en: 'nice' },
					{ np: 'bhan.', en: 'say' },
				],
			},
			{
				who: 'pyaro',
				np: 'Ma adbhut chu!',
				dev: 'म अद्भुत छु!',
				en: 'I am magnificent!',
				gloss: [
					{ np: 'Ma', en: 'I' },
					{ np: 'adbhut', en: 'magnificent' },
					{ np: 'chu!', en: 'am' },
				],
			},
			{
				who: 'narrator',
				np: 'Khochle ghanti jhain charlanga jawaaf dinchha: hoinau.',
				dev: 'खोँचले घण्टी झैँ छर्लङ्ग जवाफ दिन्छ: होइनौ।',
				en: "The canyon replies, clear as a bell: no you're not.",
				gloss: [
					{ np: 'Khochle', en: 'the canyon' },
					{ np: 'ghanti', en: 'a bell' },
					{ np: 'jhain', en: 'like' },
					{ np: 'charlanga', en: 'clearly' },
					{ np: 'jawaaf', en: 'answer' },
					{ np: 'dinchha:', en: 'gives' },
					{ np: 'hoinau.', en: "you're not" },
				],
			},
			{
				who: 'pyaro',
				np: 'Dekhyau? Timi gar.',
				dev: 'देख्यौ? तिमी गर।',
				en: 'See? You try.',
				gloss: [
					{ np: 'Dekhyau?', en: 'see?' },
					{ np: 'Timi', en: 'you' },
					{ np: 'gar.', en: 'do it' },
				],
			},
			{
				who: 'sano',
				np: 'Yo khoch ati raamro cha.',
				dev: 'यो खोँच अति राम्रो छ।',
				en: 'This canyon is great.',
				gloss: [
					{ np: 'Yo', en: 'this' },
					{ np: 'khoch', en: 'canyon' },
					{ np: 'ati', en: 'very' },
					{ np: 'raamro', en: 'great' },
					{ np: 'cha.', en: 'is' },
				],
			},
			{
				who: 'narrator',
				np: 'Khochle jawaaf dinchha: yo khoch ati raamro cha… raamro…',
				dev: 'खोँचले जवाफ दिन्छ: यो खोँच अति राम्रो छ… राम्रो…',
				en: 'The canyon replies: this canyon is great… great…',
				gloss: [
					{ np: 'Khochle', en: 'the canyon' },
					{ np: 'jawaaf', en: 'answer' },
					{ np: 'dinchha:', en: 'gives' },
					{ np: 'yo', en: 'this' },
					{ np: 'khoch', en: 'canyon' },
					{ np: 'ati', en: 'very' },
					{ np: 'raamro', en: 'great' },
					{ np: 'cha…', en: 'is' },
					{ np: 'raamro…', en: 'great' },
				],
			},
			{
				who: 'sano',
				np: 'Malai ta thikai cha.',
				dev: 'मलाई त ठीकै छ।',
				en: 'Works for me.',
				gloss: [
					{ np: 'Malai', en: 'for me' },
					{ np: 'ta', en: '(emphasis)' },
					{ np: 'thikai', en: 'just fine' },
					{ np: 'cha.', en: 'is' },
				],
			},
		],
		questions: [
			{ q: 'What does Pyaro first shout to the canyon?', choices: ['Go away', 'Hello', 'How are you?', 'Echo'], answer: 0 },
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
			{ q: 'What does Sano call the canyon?', choices: ['Great', 'Tired', 'Pretty', 'Small'], answer: 0 },
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
