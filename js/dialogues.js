// Two-character dialogues with comprehension questions (SR-01), woven into the lesson
// path so each section has a conversation (Change 2).
//
// IMPORTANT: every Nepali line is an EXISTING COURSE phrase, referenced by its item id
// (`ref`) — so the romanized strings stay Ross's and each line already has audio. What
// is AI-drafted here, and Ross's to refine, is the *composition*: which phrases form
// the exchange, the cast, the comprehension questions, and the character personas below.
//
// A dialogue: { id, title, goal, section, after, cast:{A,B}, lines:[{who,ref}], questions }.
// `who` 'A' is the left speaker (cast.A), 'B' the right speaker (cast.B). `after` is the
// COURSE unit id the conversation node follows in the path (it unlocks once that unit is
// complete). Each question is { q, choices:[...], answer } (answer indexes the choices).
const DIALOGUES = [
	{
		id: 'greet-pyaro',
		title: 'Meeting Pyaro',
		goal: 'Greet someone and make small talk',
		section: 'Foundations',
		after: 'introductions',
		cast: { A: 'sano', B: 'pyaro' },
		lines: [
			{ who: 'A', ref: 'namaste-hello-goodbye' },
			{ who: 'B', ref: 'namaste-hello-goodbye' },
			{ who: 'A', ref: 'tapai-lai-kasto-cha-how-are-you-formal' },
			{ who: 'B', ref: 'sanchai-chu-i-m-fine' },
			{ who: 'A', ref: 'tapai-nepali-bolnu-hunchha-do-you-speak-nepali' },
			{ who: 'B', ref: 'ma-nepali-bolchhu-i-speak-nepali' },
			{ who: 'A', ref: 'dherai-ramro-very-good-excellent' },
			{ who: 'B', ref: 'pheri-bhetaula-see-you-again-let-s-meet-again' },
			{ who: 'A', ref: 'ramrari-jaanu-go-safely-take-care' },
		],
		questions: [
			{ q: 'How does Pyaro say he is doing?', choices: ['Just fine', 'Heartbroken', 'Starving', 'Furious'], answer: 0 },
			{
				q: 'Pyaro can barely contain himself — how does he react when Sano speaks Nepali?',
				choices: ['He cheers: "excellent!"', 'He pretends not to hear', 'He answers in English', 'He demands payment'],
				answer: 0,
			},
			{
				q: 'How do the two new friends part?',
				choices: ['"See you again — take care!"', 'Good morning', "I'm sorry", 'Without a word'],
				answer: 0,
			},
		],
	},
	{
		id: 'meal-gyani',
		title: 'Tea with Gyani',
		goal: 'Offer food and tea, and react to a meal',
		section: 'Around the table',
		after: 'meals',
		cast: { A: 'sano', B: 'gyani' },
		lines: [
			{ who: 'B', ref: 'khana-khanu-bhayo-have-you-eaten' },
			{ who: 'A', ref: 'khana-khaeko-chhaina-i-haven-t-eaten' },
			{ who: 'B', ref: 'chiya-khaane-will-you-have-tea' },
			{ who: 'A', ref: 'huncha-okay-it-will-be-done' },
			{ who: 'B', ref: 'khana-tayar-bhayo-the-food-is-ready' },
			{ who: 'A', ref: 'mitho-cha-it-s-delicious' },
			{ who: 'B', ref: 'pugyo-enough-that-s-sufficient' },
			{ who: 'A', ref: 'dhanyabad-thank-you' },
			{ who: 'B', ref: 'ramrari-jaanu-go-safely-take-care' },
		],
		questions: [
			{ q: 'Has Sano eaten yet?', choices: ['Not yet', 'Three times already', 'Only dessert', 'Twice'], answer: 0 },
			{
				q: 'Gyani feeds Sano well — and then immediately...',
				choices: [
					'hurries off, she has places to be',
					'settles in for a long nap',
					'asks Sano to stay all night',
					'starts cooking again',
				],
				answer: 0,
			},
			{
				q: 'What does Sano think of the food?',
				choices: ["It's delicious", "It's too spicy", "It's gone cold", 'There was none left'],
				answer: 0,
			},
		],
	},
	{
		id: 'house-shanta',
		title: 'Helping Shanta',
		goal: 'Pitch in around the house',
		section: 'Around the house',
		after: 'household-living',
		cast: { A: 'sano', B: 'shanta' },
		lines: [
			{ who: 'B', ref: 'paahuna-aaudai-chan-guests-are-coming' },
			{ who: 'A', ref: 'ma-kehi-maddat-garna-sakchu-can-i-help-with-anything' },
			{ who: 'B', ref: 'dhoka-banda-garnus-please-close-the-door' },
			{ who: 'A', ref: 'ma-ghar-safaa-garchu-i-will-clean-the-house' },
			{ who: 'B', ref: 'batti-balnus-please-turn-on-the-light' },
			{ who: 'A', ref: 'huncha-okay-it-will-be-done' },
		],
		questions: [
			{
				q: 'Why is Shanta quietly bustling about?',
				choices: ['Guests are coming', 'It is the middle of the night', 'He has lost something', 'He is moving out'],
				answer: 0,
			},
			{
				q: 'Shanta is a yak of few words. What does he ask Sano to close?',
				choices: ['The door', 'The window', 'The book', 'The shop'],
				answer: 0,
			},
			{
				q: 'What does eager Sano offer to do?',
				choices: ['Clean the whole house', 'Cook the dinner', 'Take a nap', 'Invite even more guests'],
				answer: 0,
			},
		],
	},
	{
		id: 'shop-bahadur',
		title: 'At the shop',
		goal: 'Ask the price and bargain',
		section: 'Out and about',
		after: 'purchasing',
		cast: { A: 'sano', B: 'bahadur' },
		lines: [
			{ who: 'B', ref: 'aru-ke-chaahiyo-what-else-do-you-need' },
			{ who: 'A', ref: 'kati-ho-how-much-is-it' },
			{ who: 'B', ref: 'sasto-cha-it-s-cheap' },
			{ who: 'A', ref: 'mahango-cha-it-s-expensive' },
			{ who: 'A', ref: 'kam-garnuhos-please-reduce-make-it-less' },
			{ who: 'B', ref: 'huncha-okay-it-will-be-done' },
			{ who: 'A', ref: 'dhanyabad-thank-you' },
		],
		questions: [
			{ q: 'What does Sano want to know first?', choices: ['How much it costs', "The tiger's name", 'The time', 'The way home'], answer: 0 },
			{
				q: 'Bahadur swears it is cheap. What does Sano insist?',
				choices: ["It's too expensive", "It's too cheap", "It's just right", "It's free"],
				answer: 0,
			},
			{
				q: 'In the end the easygoing tiger agrees to...',
				choices: ['knock the price down', 'double the price', 'close the shop', 'keep the item'],
				answer: 0,
			},
		],
	},
	{
		id: 'feelings-rangin',
		title: 'How are you, Rangin?',
		goal: 'Talk about how you feel',
		section: 'Building vocabulary',
		after: 'emotions-feelings',
		cast: { A: 'sano', B: 'rangin' },
		lines: [
			{ who: 'B', ref: 'tapai-lai-kasto-cha-how-are-you-formal' },
			{ who: 'A', ref: 'thakeko-tired' },
			{ who: 'B', ref: 'kina-why' },
			{ who: 'A', ref: 'dhilo-bhayo-it-is-late-i-am-running-late' },
			{ who: 'B', ref: 'ramrari-jaanu-go-safely-take-care' },
			{ who: 'A', ref: 'dhanyabad-thank-you' },
		],
		questions: [
			{ q: 'How is Sano feeling?', choices: ['Tired', 'Over the moon', 'Furious', 'Famished'], answer: 0 },
			{
				q: 'Rangin is easily dazzled, but does manage to ask...',
				choices: ['"why?"', '"how much?"', '"what colour?"', '"where are the snacks?"'],
				answer: 0,
			},
			{ q: 'How does Rangin say goodbye?', choices: ['Take care', 'Good morning', 'Thank you', "You're welcome"], answer: 0 },
		],
	},
	{
		id: 'recap-thulo',
		title: "Sano's big day",
		goal: 'Tell someone what you did, in the past tense',
		section: 'Looking back',
		after: 'verbs-past',
		cast: { A: 'sano', B: 'thulo' },
		lines: [
			{ who: 'A', ref: 'namaste-hello-goodbye' },
			{ who: 'B', ref: 'tapai-lai-kasto-cha-how-are-you-formal' },
			{ who: 'A', ref: 'ma-gaen-i-went' },
			{ who: 'B', ref: 'dherai-ramro-very-good-excellent' },
			{ who: 'A', ref: 'maile-khaen-i-ate' },
			{ who: 'B', ref: 'ekdum-ramro-very-good-excellent' },
			{ who: 'A', ref: 'maile-padhen-i-read' },
			{ who: 'B', ref: 'sarai-ramro-very-good-really-good' },
			{ who: 'A', ref: 'maile-sunen-i-heard' },
			{ who: 'B', ref: 'dherai-ramro-very-good-excellent' },
			{ who: 'A', ref: 'pheri-bhetaula-see-you-again-let-s-meet-again' },
		],
		questions: [
			{
				q: 'What did Sano actually do today?',
				choices: [
					'Ordinary things — went out, ate, read, listened to music',
					'Climbed a Himalayan peak',
					'Wrestled a tiger',
					'Absolutely nothing',
				],
				answer: 0,
			},
			{
				q: 'How does Thulo the rhino react to each little thing?',
				choices: ['He declares every bit magnificent', 'He is thoroughly bored', 'He keeps correcting Sano', 'He dozes off'],
				answer: 0,
			},
			{
				q: 'Which of these did Sano say they did?',
				choices: ['Listened to music', 'Flew a kite', 'Baked bread', 'Went swimming'],
				answer: 0,
			},
		],
	},
];

// Display names for the cast (Sano + the 10 companions). Names are Ross's drafts.
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
};

// One-line personas, surfaced at the top of a conversation so each companion is memorable.
// Seeded from the per-character voice descriptors in tools/tts/RESEARCH.md §9 (animal +
// Nepali trait-name) — wholesome, gentle comedy. AI-drafted; Ross's to refine. Phurtilo has
// no voice yet, so it stays a path companion and isn't cast in dialogues.
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
