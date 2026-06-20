// Two-character dialogues with comprehension questions (SR-01).
//
// IMPORTANT: every Nepali line is an EXISTING COURSE phrase, referenced by its item
// id (`ref`) — so the romanized strings stay Ross's and each line already has audio.
// What is AI-drafted here, and Ross's to refine, is the *composition*: which phrases
// form the exchange, the cast, and the comprehension questions.
//
// A dialogue: { id, title, goal, cast:{A,B}, lines:[{who:'A'|'B', ref}], questions }.
// `who` 'A' is the left speaker (cast.A), 'B' the right speaker (cast.B). Each
// question is { q, choices:[...], answer } where `answer` indexes the correct choice.
const DIALOGUES = [
	{
		id: 'greet-pyaro',
		title: 'Meeting Pyaro',
		goal: 'Greet someone and make small talk',
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
