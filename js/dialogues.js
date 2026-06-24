// Two-character (now small-cast) story dialogues with comprehension questions (SR-01),
// woven into the lesson path so each section has a conversation.
//
// SCHEMA v2 — the lines are now original Nepali STORIES (funny fables), not remixes of
// existing course phrases, so each line carries its own text inline:
//   { id, title, goal, section, after, cast:[companionIds], lines:[{who, np, dev, en}], questions }
// `who` is a speaker id: 'sano' (left), a companion id (right), 'narrator' (full-width scene
// narration), or 'thornbush' (a one-off prop). `cast` lists the non-narrator companions (for
// the head art + the persona intro). `after` is the COURSE unit id the node follows in the
// path. The Nepali (`np`/`dev`) is AI-DRAFTED and Ross's to refine; the English (`en`) is the
// subtitle. Each line gets its own audio clip rendered per-voice — see VOICE RULES below and
// tools/tts/synth-app.mjs --dialogues.
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
			},
			{
				who: 'pyaro',
				np: 'Tala kasaile malai jiskyaairaheko cha! Sun — taadhaa jaau!',
				dev: 'तल कसैले मलाई जिस्क्याइरहेको छ! सुन् — टाढा जाऊ!',
				en: 'Someone down there keeps teasing me! Listen — go away!',
			},
			{
				who: 'narrator',
				np: 'Khochle bistaarai jawaaf dinchha: taadhaa jaau… jaau…',
				dev: 'खोँचले बिस्तारै जवाफ दिन्छ: टाढा जाऊ… जाऊ…',
				en: 'The canyon answers quietly: go away… away…',
			},
			{
				who: 'pyaro',
				np: 'Dekhyau? Yasle mero gillaa garchha!',
				dev: 'देख्यौ? यसले मेरो गिल्ला गर्छ!',
				en: 'See? It mocks me!',
			},
			{
				who: 'sano',
				np: 'Tyo ta pratidhwani ho. Khochle timrai aawaaj dohoryaaunchha.',
				dev: 'त्यो त प्रतिध्वनि हो। खोँचले तिम्रै आवाज दोहोर्‍याउँछ।',
				en: "That's an echo. The canyon repeats your own voice.",
			},
			{
				who: 'pyaro',
				np: '…Pratidhwani.',
				dev: '…प्रतिध्वनि।',
				en: '…An echo.',
			},
			{
				who: 'sano',
				np: 'Garera her. Kehi raamro bhan.',
				dev: 'गरेर हेर। केही राम्रो भन।',
				en: 'Try it. Say something nice.',
			},
			{
				who: 'pyaro',
				np: 'Ma adbhut chu!',
				dev: 'म अद्भुत छु!',
				en: 'I am magnificent!',
			},
			{
				who: 'narrator',
				np: 'Khochle ghanti jhain charlanga jawaaf dinchha: hoinau.',
				dev: 'खोँचले घण्टी झैँ छर्लङ्ग जवाफ दिन्छ: होइनौ।',
				en: "The canyon replies, clear as a bell: no you're not.",
			},
			{
				who: 'pyaro',
				np: 'Dekhyau? Timi gar.',
				dev: 'देख्यौ? तिमी गर।',
				en: 'See? You try.',
			},
			{
				who: 'sano',
				np: 'Yo khoch ati raamro cha.',
				dev: 'यो खोँच अति राम्रो छ।',
				en: 'This canyon is great.',
			},
			{
				who: 'narrator',
				np: 'Khochle jawaaf dinchha: yo khoch ati raamro cha… raamro…',
				dev: 'खोँचले जवाफ दिन्छ: यो खोँच अति राम्रो छ… राम्रो…',
				en: 'The canyon replies: this canyon is great… great…',
			},
			{
				who: 'sano',
				np: 'Malai ta thikai cha.',
				dev: 'मलाई त ठीकै छ।',
				en: 'Works for me.',
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
