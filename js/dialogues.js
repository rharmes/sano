// Two-character dialogues with comprehension questions (SR-01), woven into the lesson
// path so each section has a conversation (Change 2).
//
// IMPORTANT: every Nepali line is an EXISTING COURSE phrase, referenced by its item id
// (`ref`) — so the romanized strings stay Ross's and each line already has audio. What
// is AI-drafted here, and Ross's to refine, is the *composition*: which phrases form
// the exchange, the cast, and the comprehension questions.
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
			{ q: 'How does Pyaro say he is doing?', choices: ['Fine', 'Tired', 'Hungry', 'Busy'], answer: 0 },
			{ q: 'What does Pyaro say he speaks?', choices: ['Nepali', 'Hindi', 'English', 'Newari'], answer: 0 },
			{ q: 'How do Sano and Pyaro part?', choices: ['See you again / take care', 'Good morning', "I'm sorry", 'Thank you'], answer: 0 },
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
		],
		questions: [
			{ q: 'Has Sano eaten yet?', choices: ['Not yet', 'Yes, already', 'Only tea', 'Twice'], answer: 0 },
			{ q: 'What does Gyani offer to drink?', choices: ['Tea', 'Water', 'Milk', 'Coffee'], answer: 0 },
			{
				q: 'What does Sano think of the food?',
				choices: ["It's delicious", "It's too spicy", "It's cold", 'There is not enough'],
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
			{ q: 'Why is Shanta busy?', choices: ['Guests are coming', "It's bedtime", 'The food is ready', 'She is sick'], answer: 0 },
			{ q: 'What does Shanta ask Sano to close?', choices: ['The door', 'The window', 'The book', 'The shop'], answer: 0 },
			{ q: 'What does Sano offer to do?', choices: ['Clean the house', 'Cook dinner', 'Wash the clothes', 'Leave'], answer: 0 },
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
			{ q: 'What does Sano ask the shopkeeper?', choices: ['How much it costs', 'Where it is', 'What time it is', 'His name'], answer: 0 },
			{
				q: 'What does Sano say about the price?',
				choices: ["It's too expensive", "It's too cheap", "It's just right", "It's free"],
				answer: 0,
			},
			{ q: 'What does Sano ask Bahadur to do?', choices: ['Lower the price', 'Wrap it up', 'Wait a moment', 'Say it again'], answer: 0 },
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
			{ q: 'How does Sano feel?', choices: ['Tired', 'Happy', 'Angry', 'Hungry'], answer: 0 },
			{ q: 'What does Rangin ask?', choices: ['Why', 'Where', 'When', 'How much'], answer: 0 },
			{ q: 'How does Rangin say goodbye?', choices: ['Take care', 'Good morning', 'Thank you', 'Welcome'], answer: 0 },
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
