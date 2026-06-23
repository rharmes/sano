// Sample phrase set for the character-voice matrix (design/tts-compare.html — see
// RESEARCH.md). Twenty short utterances drawn from js/data.js (plus one counting line),
// spanning greetings, questions, and statements, and still weighted toward the sounds
// romanization hides and that TTS most often botches in Nepali: retroflex ठ/ट, aspirated
// ध/घ/छ, chandrabindu nasalization (हुँ, खाँदिनँ, पाँच), the ञ ligature, and one long
// comma-list sentence. The `dev` strings are snapshotted from data.js (AI-drafted, pending
// review) so this file is self-contained. `id` matches the course item id where there is
// one; `numbers-count` is synthetic.
export const PHRASES = [
	{ id: 'namaste-hello-goodbye', np: 'Namaste', dev: 'नमस्ते', en: 'Hello / Goodbye' },
	{ id: 'subha-prabhat-good-morning', np: 'Subha prabhat', dev: 'शुभ प्रभात', en: 'Good morning' },
	{ id: 'dhanyabad-thank-you', np: 'Dhanyabad', dev: 'धन्यवाद', en: 'Thank you' },
	{ id: 'maaf-garnuhos-excuse-me-i-m-sorry', np: 'Maaf garnuhos', dev: 'माफ गर्नुहोस्', en: "Excuse me / I'm sorry" },
	{
		id: 'hajur-ko-naam-ke-ho-what-is-your-name-very-polite',
		np: 'Hajur ko naam ke ho?',
		dev: 'हजुरको नाम के हो?',
		en: 'What is your name? (very polite)',
	},
	{ id: 'tapai-kaha-bata-ho-where-are-you-from', np: 'Tapai kaha bata ho?', dev: 'तपाईं कहाँबाट हो?', en: 'Where are you from?' },
	{ id: 'tapai-lai-kasto-cha-how-are-you-formal', np: 'Tapai lai kasto cha?', dev: 'तपाईंलाई कस्तो छ?', en: 'How are you? (formal)' },
	{ id: 'sanchai-chu-i-m-fine', np: 'Sanchai chu', dev: 'सञ्चै छु', en: "I'm fine" },
	{ id: 'kasto-chha-hawa-how-s-the-weather', np: 'Kasto chha hawa?', dev: 'कस्तो छ हावा?', en: "How's the weather?" },
	{ id: 'thik-cha-it-s-okay-it-s-fine', np: 'Thik cha', dev: 'ठीक छ', en: "It's okay / It's fine" },
	{ id: 'kehi-chhaina-nothing-it-s-nothing', np: 'Kehi chhaina', dev: 'केही छैन', en: "Nothing / It's nothing" },
	{ id: 'hudaina-not-okay-it-won-t-work', np: 'Hudaina', dev: 'हुँदैन', en: "Not okay / It won't work" },
	{
		id: 'tapai-nepali-bolnu-hunchha-do-you-speak-nepali',
		np: 'Tapai Nepali bolnu hunchha?',
		dev: 'तपाईं नेपाली बोल्नुहुन्छ?',
		en: 'Do you speak Nepali?',
	},
	{ id: 'ma-bolchhu-i-speak-english', np: 'Ma Angreji bolchhu', dev: 'म अङ्ग्रेजी बोल्छु', en: 'I speak English' },
	{ id: 'maile-bujhina-i-don-t-understand', np: 'Maile bujhina', dev: 'मैले बुझिनँ', en: "I don't understand" },
	{ id: 'ali-bistari-bolnuhos-please-speak-slowly', np: 'Ali bistarai bolnuhos', dev: 'अलि बिस्तारै बोल्नुहोस्', en: 'Please speak slowly' },
	{ id: 'ek-chhin-parkhanus-wait-a-moment-please', np: 'Ek chhin parkhanus', dev: 'एक छिन पर्खनुस्', en: 'Wait a moment, please' },
	{ id: 'ma-ghar-jaanchu-i-am-going-home', np: 'Ma ghar jaanchu', dev: 'म घर जान्छु', en: 'I am going home' },
	{
		id: 'ma-dudh-dahi-ra-ghue-khadina-i-don-t-eat-milk-and-milk-prod',
		np: 'Ma dudh, dahi ra ghue khadina',
		dev: 'म दूध, दही र घ्यू खाँदिनँ',
		en: "I don't eat milk and milk products",
	},
	{ id: 'numbers-count', np: 'Ek, dui, tin, chaar, paanch', dev: 'एक, दुई, तीन, चार, पाँच', en: 'One, two, three, four, five' },
];
