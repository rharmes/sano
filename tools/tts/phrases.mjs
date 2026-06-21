// Bake-off phrase set for evaluating Nepali TTS quality (see TTS.md).
//
// Twelve short utterances drawn from js/data.js (plus one counting line), deliberately
// weighted toward the sounds romanization hides and that TTS most often botches in
// Nepali: retroflex ठ/ट, aspirated ध/घ/छ, chandrabindu nasalization (हुँ, खाँदिनँ, पाँच),
// the ञ ligature, halant-final polite imperatives, question intonation, and one long
// comma-list sentence for connected speech. The `dev` strings are snapshotted from
// data.js (AI-drafted, pending Ross's review) so this file is self-contained.
//
// `id` matches the course item id where there is one, so the current Piper clip at
// audio/default/<id>.mp3 lines up as the A/B baseline. `numbers-count` is synthetic.
export const PHRASES = [
	{ id: 'namaste-hello-goodbye', np: 'Namaste', dev: 'नमस्ते', en: 'Hello / Goodbye', focus: 'baseline greeting' },
	{ id: 'dhanyabad-thank-you', np: 'Dhanyabad', dev: 'धन्यवाद', en: 'Thank you', focus: 'aspirated dh' },
	{
		id: 'maaf-garnuhos-excuse-me-i-m-sorry',
		np: 'Maaf garnuhos',
		dev: 'माफ गर्नुहोस्',
		en: "Excuse me / I'm sorry",
		focus: 'polite imperative, halant-final',
	},
	{
		id: 'tapai-lai-kasto-cha-how-are-you-formal',
		np: 'Tapai lai kasto cha?',
		dev: 'तपाईंलाई कस्तो छ?',
		en: 'How are you? (formal)',
		focus: 'question intonation, nasal vowel',
	},
	{ id: 'sanchai-chu-i-m-fine', np: 'Sanchai chu', dev: 'सञ्चै छु', en: "I'm fine", focus: 'ञ ligature' },
	{ id: 'thik-cha-it-s-okay-it-s-fine', np: 'Thik cha', dev: 'ठीक छ', en: "It's okay / It's fine", focus: 'retroflex ठ (ṭh)' },
	{
		id: 'kehi-chhaina-nothing-it-s-nothing',
		np: 'Kehi chhaina',
		dev: 'केही छैन',
		en: "Nothing / It's nothing",
		focus: 'aspirated छ + ai diphthong',
	},
	{ id: 'hudaina-not-okay-it-won-t-work', np: 'Hudaina', dev: 'हुँदैन', en: "Not okay / It won't work", focus: 'chandrabindu nasalization हुँ' },
	{
		id: 'ma-dudh-dahi-ra-ghue-khadina-i-don-t-eat-milk-and-milk-prod',
		np: 'Ma dudh, dahi ra ghue khadina',
		dev: 'म दूध, दही र घ्यू खाँदिनँ',
		en: "I don't eat milk and milk products",
		focus: 'long sentence: dental d/dh, aspirated घ्य, nasal, comma list',
	},
	{
		id: 'tapai-nepali-bolnu-hunchha-do-you-speak-nepali',
		np: 'Tapai Nepali bolnu hunchha?',
		dev: 'तपाईं नेपाली बोल्नुहुन्छ?',
		en: 'Do you speak Nepali?',
		focus: 'polite verb conjugation, question',
	},
	{
		id: 'ali-bistari-bolnuhos-please-speak-slowly',
		np: 'Ali bistari bolnuhos',
		dev: 'अलि बिस्तारी बोल्नुहोस्',
		en: 'Please speak slowly',
		focus: 'imperative, retroflex ट',
	},
	{ id: 'numbers-count', np: 'Ek, dui, tin, paanch', dev: 'एक, दुई, तीन, पाँच', en: 'One, two, three, five', focus: 'counting prosody, nasal पाँच' },
];
