// T64: grammar notes — one-page explainers woven into the path like the SR-08 pronunciation
// drills (js/sounds.js), each anchored `after` a unit and unlocking when that unit is
// complete. A note has no exercises and no per-word SRS record: read it, hear the examples,
// tap "Got it", and it ticks off (state.grammarDone) and counts toward the streak like any
// other lesson. One note per anchor unit (the path takes the first match).
//
// Every example is a REAL course sentence — an item id, or `<itemId>-fN` for one of that
// item's alternate frames — so the Devanagari, the romanization and the audio are the ones
// already shipped (no new content to render, no runtime TTS). `parts` splits that sentence's
// `dev` word by word, each with a ROLE and a literal English gloss, so the note can colour the
// words by role and line the word-for-word order up under them. `tests/data/grammar.test.mjs`
// checks the parts join back to the sentence's `dev` exactly — the same invariant the
// dialogue glosses keep.
//
// `contrast` is the note's headline comparison: two (or more) labelled rows of chips. A row
// with `chips` is written out (the English side); a row with `clip` shows that example's
// Nepali, coloured the same way (a row may carry its own `parts` for a sentence that isn't one
// of the examples — held to the same checks). `legend` names the roles the note uses, in
// order, with the label each should carry on this note (a `mark` is "the thing this note is
// about").
//
// The prose (`title`/`sub`/`intro`/`points`/`tip`), the contrast rows, the legend labels and
// the literal glosses are AI-drafted and Ross's to correct, like the rest of the
// Nepali-facing copy.
const GRAMMAR_ROLES = {
	who: 'who', // the subject
	what: 'what', // the object — or where / when: everything that isn't the doer or the verb
	verb: 'does', // the verb, including "is" / "are"
	mark: 'mark', // the piece of grammar the note is about (a counter, a postposition, a question word …)
};

const GRAMMAR_TOPICS = [
	{
		id: 'counting-words',
		after: 'numbers', // path anchor: this node sits just after this unit
		glyph: '१२३', // short mark for the path node
		title: 'Counting needs a helper word',
		sub: '-wataa for things · -janaa for people',
		intro: 'A number rarely stands next to a noun on its own. Nepali slips in a small counting word: -wataa for things (duiwataa samosaa, “two samosas”) and -janaa for people (chaar janaa, “four people”). The noun itself stays exactly as it is — no plural ending.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'mark', label: 'number + counter' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'two', role: 'mark' },
					{ en: 'samosas', role: 'what' },
				],
			},
			{ label: 'Nepali', clip: 'fn-duiwataa-twoitems' },
		],
		points: [
			'-wataa attaches straight onto the number for things: duiwataa, tinawataa, dasawataa.',
			'-janaa is the counter for people: ekajanaa (one person), chaar janaa (four people).',
			'The noun stays singular. “Two pens” is duiwataa kalam — kalam does not change.',
		],
		examples: [
			{
				clip: 'fn-duiwataa-twoitems',
				parts: [
					{ dev: 'दुईवटा', en: 'two (things)', role: 'mark' },
					{ dev: 'कलम', en: 'pen', role: 'what' },
				],
			},
			{
				clip: 'dui-two-f2',
				parts: [
					{ dev: 'दुईवटा', en: 'two (things)', role: 'mark' },
					{ dev: 'समोसा', en: 'samosa', role: 'what' },
					{ dev: 'दिनुस्', en: 'please give', role: 'verb' },
				],
			},
			{
				clip: 'fn-ekjana-oneperson',
				parts: [
					{ dev: 'एकजना', en: 'one (person)', role: 'mark' },
					{ dev: 'मान्छे', en: 'person', role: 'what' },
				],
			},
			{
				clip: 'chaar-four-f1',
				parts: [
					{ dev: 'हामी', en: 'we', role: 'who' },
					{ dev: 'चार', en: 'four', role: 'mark' },
					{ dev: 'जना', en: '(people)', role: 'mark' },
					{ dev: 'छौं', en: 'are', role: 'verb' },
				],
			},
		],
		tip: 'When you order or ask for a number of anything, reach for -wataa: duiwataa chiyaa, tinawataa momo. It is rarely wrong for things.',
	},
	// T68: the numerals note (`kind: 'numerals'`) — the one note with BOTH a contrast (place value
	// works as in English) and a table. Its rows carry a `glyph`, drawn large ahead of the label;
	// a `dev` cell plays that word's clip like a verb card's, and the zero row's `plain` word is
	// shown without a button (the course doesn't teach it, so there is no clip). The two units
	// that drill the glyphs follow it on the path (`numerals`, `numerals-reading`, js/data.js).
	{
		id: 'numerals',
		kind: 'numerals',
		after: 'numbers-big', // path anchor: this node sits just after this unit
		glyph: '०–९', // short mark for the path node
		title: 'Nepali numerals',
		sub: '० to ९ · same system, new shapes',
		intro: 'Nepali writes numbers with its own ten digits. You can already say them — ek, dui, tin — and this is what they look like on a price tag, a banknote or the front of a bus. Tap a word to hear it.',
		legend: [
			{ role: 'mark', label: 'the number' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: '1', role: 'mark' },
					{ en: '5', role: 'mark' },
					{ en: '0', role: 'mark' },
					{ en: '0', role: 'mark' },
				],
			},
			{
				label: 'Nepali',
				chips: [
					{ en: '१', role: 'mark' },
					{ en: '५', role: 'mark' },
					{ en: '०', role: 'mark' },
					{ en: '०', role: 'mark' },
				],
			},
		],
		table: [
			{ glyph: '०', label: '0', plain: 'शून्य' },
			{ glyph: '१', label: '1', dev: 'एक' },
			{ glyph: '२', label: '2', dev: 'दुई' },
			{ glyph: '३', label: '3', dev: 'तीन' },
			{ glyph: '४', label: '4', dev: 'चार' },
			{ glyph: '५', label: '5', dev: 'पाँच' },
			{ glyph: '६', label: '6', dev: 'छ' },
			{ glyph: '७', label: '7', dev: 'सात' },
			{ glyph: '८', label: '8', dev: 'आठ' },
			{ glyph: '९', label: '9', dev: 'नौ' },
		],
		points: [
			'The system is the one you know: ten digits, place value, read left to right. १० is 10, २५ is 25, १५०० is 1500.',
			'Three are false friends: १ (1) looks like a 9, ४ (4) like an 8, and ७ (7) like a 6. ०, २ and ३ sit close to the digits you know.',
			'You will meet them on price tags, banknotes, number plates, calendars and phone numbers — often side by side with 1 2 3.',
		],
		examples: [
			{
				clip: 'paanch-five-f2',
				parts: [
					{ dev: 'पाँच', en: 'five · ५', role: 'mark' },
					{ dev: 'रुपैयाँ', en: 'rupees', role: 'what' },
					{ dev: 'मात्र', en: 'only', role: 'what' },
				],
			},
			{
				clip: 'bis-twenty-f2',
				parts: [
					{ dev: 'बीस', en: 'twenty · २०', role: 'mark' },
					{ dev: 'रुपैयाँ', en: 'rupees', role: 'what' },
					{ dev: 'भयो', en: 'came to', role: 'verb' },
				],
			},
			{
				clip: 'hajaar-thousand-f1',
				parts: [
					{ dev: 'एक', en: 'one', role: 'mark' },
					{ dev: 'हजार', en: 'thousand · १०००', role: 'mark' },
					{ dev: 'रुपैयाँ', en: 'rupees', role: 'what' },
				],
			},
			{
				clip: 'tin-three-f1',
				parts: [
					{ dev: 'तीन', en: 'three · ३', role: 'mark' },
					{ dev: 'बजे', en: 'o’clock', role: 'what' },
					{ dev: 'आउनुस्', en: 'please come', role: 'verb' },
				],
			},
		],
		tip: 'Read every price tag and number plate you pass. A week of that and the shapes stop needing translation.',
	},
	{
		id: 'word-order',
		after: 'pronouns', // path anchor: this node sits just after this unit
		glyph: 'SOV', // short mark for the path node (subject · object · verb)
		title: 'The verb goes last',
		sub: 'who · what · does',
		intro: 'English puts the action in the middle: “I speak Nepali.” Nepali saves it for the end: ma Nepali bolchhu — “I Nepali speak.” Once you expect the verb last, every sentence in this course reads more easily.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'I', role: 'who' },
					{ en: 'speak', role: 'verb' },
					{ en: 'Nepali', role: 'what' },
				],
			},
			{ label: 'Nepali', clip: 'ma-nepali-bolchhu-i-speak-nepali' },
		],
		points: [
			'The verb — the doing or being word — comes at the very end, after everything else.',
			'“Is” and “are” are verbs too, so they go last as well: uhaa daaktar hunuhunchha, “she a-doctor is.”',
			'Questions keep the same order. A question word like kahile (“when”) sits where its answer would go, and the verb still comes last.',
		],
		examples: [
			{
				clip: 'ma-nepali-bolchhu-i-speak-nepali',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'नेपाली', en: 'Nepali', role: 'what' },
					{ dev: 'बोल्छु', en: 'speak', role: 'verb' },
				],
			},
			{
				clip: 'ma-ghar-jaanchu-i-am-going-home',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'घर', en: 'home', role: 'what' },
					{ dev: 'जान्छु', en: 'go', role: 'verb' },
				],
			},
			{
				clip: 'uhaa-he-she-polite-f2',
				parts: [
					{ dev: 'उहाँ', en: 'she', role: 'who' },
					{ dev: 'डाक्टर', en: 'doctor', role: 'what' },
					{ dev: 'हुनुहुन्छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'tapai-you-formal-f1',
				parts: [
					{ dev: 'तपाईं', en: 'you', role: 'who' },
					{ dev: 'कहिले', en: 'when', role: 'what' },
					{ dev: 'आउनुहुन्छ?', en: 'come?', role: 'verb' },
				],
			},
		],
		tip: 'Building a sentence? Say who first, then what, and hold the verb for the end. The English order is the habit to unlearn.',
	},
	{
		id: 'politeness',
		after: 'family-people', // path anchor: this node sits just after this unit
		glyph: 'तपाईं', // short mark for the path node
		title: 'Pick a level: timi or tapaai',
		sub: 'timi … -chhau · tapaai … -nuhunchha',
		intro: 'Nepali has more than one “you”, and each one drags its own verb ending along. timi is for friends, family your age and children, and its verbs end in -chhau. tapaai is for almost everyone else, and its verbs end in -nuhunchha. The same split runs through “he” and “she”: u takes -chha, the respectful uhaa takes -nuhunchha.',
		legend: [
			{ role: 'who', label: 'the person' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'the matching ending' },
		],
		contrast: [
			{ label: 'Casual', clip: 'timi-you-informal-f1' },
			{ label: 'Polite', clip: 'tapai-you-formal-f1' },
		],
		points: [
			'timi and u are casual: their verbs end in -chhau (you) and -chha (he / she).',
			'tapaai and uhaa are respectful: their verbs end in -nuhunchha, whoever the person is.',
			'Not sure? Use tapaai. Being a little too polite is never rude; being too casual can be.',
		],
		examples: [
			{
				clip: 'timi-you-informal-f1',
				parts: [
					{ dev: 'तिमी', en: 'you (casual)', role: 'who' },
					{ dev: 'कहाँ', en: 'where', role: 'what' },
					{ dev: 'छौ?', en: 'are?', role: 'verb' },
				],
			},
			{
				clip: 'tapai-you-formal-f1',
				parts: [
					{ dev: 'तपाईं', en: 'you (polite)', role: 'who' },
					{ dev: 'कहिले', en: 'when', role: 'what' },
					{ dev: 'आउनुहुन्छ?', en: 'come?', role: 'verb' },
				],
			},
			{
				clip: 'u-he-she-informal-f2',
				parts: [
					{ dev: 'ऊ', en: 'he (casual)', role: 'who' },
					{ dev: 'कहाँ', en: 'where', role: 'what' },
					{ dev: 'छ?', en: 'is?', role: 'verb' },
				],
			},
			{
				clip: 'uhaa-he-she-polite-f1',
				parts: [
					{ dev: 'उहाँ', en: 'he (polite)', role: 'who' },
					{ dev: 'मेरो', en: 'my', role: 'what' },
					{ dev: 'बुवा', en: 'father', role: 'what' },
					{ dev: 'हुनुहुन्छ', en: 'is', role: 'verb' },
				],
			},
		],
		tip: 'Family members you respect — parents, grandparents, older siblings — are uhaa, and they take -nuhunchha: mero buwaa kaam garnuhunchha.',
	},
	{
		id: 'ho-vs-chha',
		after: 'people-others', // path anchor: this node sits just after this unit
		glyph: 'हो · छ', // short mark for the path node
		title: 'Two ways to say “is”',
		sub: 'ho names it · chha describes it',
		intro: 'English has one “is”; Nepali has two. ho says what something is — a name, a job, a relationship, whose it is. chha says how or where something is, or that it exists at all. Pick by the question you are answering: “what is it?” → ho; “what is it like, where is it?” → chha.',
		legend: [
			{ role: 'who', label: 'who / what' },
			{ role: 'what', label: 'the rest' },
			{ role: 'verb', label: 'ho or chha' },
		],
		contrast: [
			{ label: 'What it is → ho', clip: 'u-he-she-informal-f1' },
			{ label: 'How it is → chha', clip: 'hamro-our-ours-f1' },
		],
		points: [
			'ho = identity: u mero bhaai ho (he is my brother), yo mero ho (this is mine), haamro desh Nepal ho.',
			'chha = a state, a place, or existence: ghar saano chha (the house is small), uniharu gharamaa chhan (they are at home), paani chha (there is water).',
			'For someone you speak of respectfully, both become hunuhunchha: uhaa daaktar hunuhunchha, aamaa gharamaa hunuhunchha.',
		],
		examples: [
			{
				clip: 'u-he-she-informal-f1',
				parts: [
					{ dev: 'ऊ', en: 'he', role: 'who' },
					{ dev: 'मेरो', en: 'my', role: 'what' },
					{ dev: 'भाइ', en: 'brother', role: 'what' },
					{ dev: 'हो', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'hamro-our-ours-f2',
				parts: [
					{ dev: 'हाम्रो', en: 'our', role: 'who' },
					{ dev: 'देश', en: 'country', role: 'who' },
					{ dev: 'नेपाल', en: 'Nepal', role: 'what' },
					{ dev: 'हो', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'hamro-our-ours-f1',
				parts: [
					{ dev: 'हाम्रो', en: 'our', role: 'who' },
					{ dev: 'घर', en: 'house', role: 'who' },
					{ dev: 'सानो', en: 'small', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'uniharu-they-f2',
				parts: [
					{ dev: 'उनीहरू', en: 'they', role: 'who' },
					{ dev: 'घरमा', en: 'at home', role: 'what' },
					{ dev: 'छन्', en: 'are', role: 'verb' },
				],
			},
		],
		tip: 'A quick test: if you could swap “is” for “equals”, it is ho. If you could swap it for “is located” or “is feeling”, it is chha.',
	},
	{
		id: 'ko',
		after: 'introductions', // path anchor: this node sits just after this unit (T69)
		glyph: '-को',
		title: '-ko: whose it is',
		sub: 'owner + -ko, then the thing owned',
		intro: 'English adds ’s or says “of”. Nepali hangs -ko on the owner: aamaako maayaa (a mother’s love), Nepaalako pahaad (Nepal’s hills). The owner always comes first and the thing owned follows straight after.',
		legend: [
			{ role: 'mark', label: 'owner + -ko' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'Nepal’s', role: 'mark' },
					{ en: 'hills', role: 'what' },
					{ en: 'are', role: 'verb' },
					{ en: 'green', role: 'what' },
				],
			},
			{ label: 'Nepali', clip: 'hariyo-green-f2' },
		],
		points: [
			'-ko goes on the owner, and the owner comes first: hajuraaamaako khaanaa (grandmother’s cooking), usako naam (his name), tapaaiko ghar (your house).',
			'Three everyday owners have fused forms, which you already know: ma → mero, haami → haamro, timi → timro. Everyone else simply takes -ko: tapaaiko, usako, uhaanko.',
			'It also covers “of”: kukhuraako maasu (chicken meat), aanpako jus (mango juice), aajako kaaryakram (today’s programme). And -ko laagi means “for”: khaanaako laagi dhanyabaad.',
		],
		examples: [
			{
				clip: 'tapai-ko-naam-ke-ho-what-is-your-name-formal',
				parts: [
					{ dev: 'तपाईंको', en: 'your', role: 'mark' },
					{ dev: 'नाम', en: 'name', role: 'what' },
					{ dev: 'के', en: 'what', role: 'what' },
					{ dev: 'हो?', en: 'is?', role: 'verb' },
				],
			},
			{
				clip: 'hajuraamaa-grandmother-f1',
				parts: [
					{ dev: 'हजुरआमाको', en: 'grandmother’s', role: 'mark' },
					{ dev: 'खाना', en: 'food', role: 'what' },
					{ dev: 'मिठो', en: 'delicious', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'hariyo-green-f2',
				parts: [
					{ dev: 'नेपालको', en: 'Nepal’s', role: 'mark' },
					{ dev: 'पहाड', en: 'hills', role: 'what' },
					{ dev: 'हरियो', en: 'green', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'khanako-lagi-dhanyabaad-thank-you-for-the-food',
				parts: [
					{ dev: 'खानाको', en: 'of the food', role: 'mark' },
					{ dev: 'लागि', en: 'for the sake', role: 'mark' },
					{ dev: 'धन्यवाद', en: 'thanks', role: 'what' },
				],
			},
		],
		tip: 'Say the owner, add -ko, then name the thing — the reverse of English “the X of Y”.',
	},
	{
		id: 'postpositions',
		after: 'introductions-origins', // path anchor: this node sits just after this unit
		glyph: '-मा', // short mark for the path node
		title: 'Little words come after',
		sub: '-maa · -baata · -sang',
		intro: 'Where English puts “in”, “from” and “with” before a word, Nepali hangs them on the end of it: gharamaa (house-in), kahaanbaat (where-from), saathisang (friend-with). They are called postpositions, and they glue straight onto the noun — there is no “the” or “a” to get in the way.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'mark', label: 'noun + postposition' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'we', role: 'who' },
					{ en: 'are', role: 'verb' },
					{ en: 'at', role: 'mark' },
					{ en: 'home', role: 'mark' },
				],
			},
			{ label: 'Nepali', clip: 'hami-we-us-f2' },
		],
		points: [
			'-maa means in, at or on: gharamaa (at home), thaalamaa (on the plate), gilaasamaa (in the glass).',
			'-baata means from: kahaanbaat (from where), and -sang means with: saathisang (with a friend).',
			'They attach to pronouns too, and the two fuse: ma + sang → masang (with me), so masang das rupaiyaa chha is “I have ten rupees”.',
		],
		examples: [
			{
				clip: 'hami-we-us-f2',
				parts: [
					{ dev: 'हामी', en: 'we', role: 'who' },
					{ dev: 'घरमा', en: 'home-at', role: 'mark' },
					{ dev: 'छौं', en: 'are', role: 'verb' },
				],
			},
			{
				clip: 'tapai-kaha-bata-ho-where-are-you-from',
				parts: [
					{ dev: 'तपाईं', en: 'you', role: 'who' },
					{ dev: 'कहाँबाट', en: 'where-from', role: 'mark' },
					{ dev: 'हो?', en: 'are?', role: 'verb' },
				],
			},
			{
				clip: 'saathi-friend-f2',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'साथीसँग', en: 'friend-with', role: 'mark' },
					{ dev: 'बजार', en: 'market', role: 'what' },
					{ dev: 'जान्छु', en: 'go', role: 'verb' },
				],
			},
			{
				clip: 'das-ten-f2',
				parts: [
					{ dev: 'मसँग', en: 'me-with', role: 'mark' },
					{ dev: 'दस', en: 'ten', role: 'what' },
					{ dev: 'रुपैयाँ', en: 'rupees', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
		],
		tip: 'You already know one postposition: the -ko of tapaaiko and usko is the possessive “’s”, hung on the end the same way.',
	},
	{
		id: 'laai',
		after: 'comprehension', // path anchor: this node sits just after this unit
		glyph: '-लाई', // short mark for the path node
		title: '-laai points at the receiver',
		sub: 'malaai · tapaailaai · bachchaalaai',
		intro: 'Add -laai to a person and it means “to” or “for” them: malaai (to me), tapaailaai (to you). Nepali uses it far more than English uses “to”, because feelings, needs and even knowing are things that happen to you: malaai thaahaa chha is literally “to-me knowledge is” — “I know”.',
		legend: [
			{ role: 'mark', label: 'the receiver + -laai' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'I', role: 'mark' },
					{ en: 'know', role: 'verb' },
				],
			},
			{ label: 'Nepali', clip: 'malai-thaaha-cha-i-know' },
		],
		points: [
			'Knowing, needing, liking and feeling all start with malaai: malaai thaahaa chha (I know), malaai chiyaa chaahiyo (I need tea), malaai bhaat man parchha (I like rice).',
			'“How are you?” is tapaailaai kasto chha — “to you, how is it?”',
			'-laai also marks the person something is given or said to: bachchaalaai dudh dinus (give the baby milk).',
		],
		examples: [
			{
				clip: 'malai-thaaha-cha-i-know',
				parts: [
					{ dev: 'मलाई', en: 'to me', role: 'mark' },
					{ dev: 'थाहा', en: 'knowledge', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'tapai-lai-kasto-cha-how-are-you-formal',
				parts: [
					{ dev: 'तपाईंलाई', en: 'to you', role: 'mark' },
					{ dev: 'कस्तो', en: 'how', role: 'what' },
					{ dev: 'छ?', en: 'is?', role: 'verb' },
				],
			},
			{
				clip: 'malai-chiya-chaahiyo-i-need-tea',
				parts: [
					{ dev: 'मलाई', en: 'to me', role: 'mark' },
					{ dev: 'चिया', en: 'tea', role: 'what' },
					{ dev: 'चाहियो', en: 'is needed', role: 'verb' },
				],
			},
			{
				clip: 'bachcha-child-baby-f2',
				parts: [
					{ dev: 'बच्चालाई', en: 'to the baby', role: 'mark' },
					{ dev: 'दूध', en: 'milk', role: 'what' },
					{ dev: 'दिनुस्', en: 'please give', role: 'verb' },
				],
			},
		],
		tip: 'If the English sentence starts with “I” but is really about something you feel, want or know, start the Nepali with malaai.',
	},
	{
		id: 'questions',
		after: 'comprehension-clarify', // path anchor: this node sits just after this unit
		glyph: 'के?', // short mark for the path node
		title: 'A question keeps the order',
		sub: 'ke · kahaa · kahile — right where the answer goes',
		intro: 'English rearranges a sentence to ask a question (“you speak” → “do you speak?”). Nepali does not move a thing. A yes-or-no question is the statement said with a rising voice, and a question word such as ke (what), kahaa (where) or kahile (when) simply sits in the slot where its answer would be.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'mark', label: 'question word' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'Statement',
				clip: 'ma-nepali-bolchhu-i-speak-nepali',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'नेपाली', en: 'Nepali', role: 'what' },
					{ dev: 'बोल्छु', en: 'speak', role: 'verb' },
				],
			},
			{ label: 'Question', clip: 'tapai-nepali-bolnu-hunchha-do-you-speak-nepali' },
		],
		points: [
			'No “do”, no swapping: tapaai Nepali bolnuhunchha? is “you Nepali speak?” — the tone makes it a question.',
			'The question word goes where the answer will go: usako naam ke ho? (his name what is?) — the answer, a name, fits in the same place.',
			'The verb still comes last, question or not.',
		],
		examples: [
			{
				clip: 'tapai-nepali-bolnu-hunchha-do-you-speak-nepali',
				parts: [
					{ dev: 'तपाईं', en: 'you', role: 'who' },
					{ dev: 'नेपाली', en: 'Nepali', role: 'what' },
					{ dev: 'बोल्नुहुन्छ?', en: 'speak?', role: 'verb' },
				],
			},
			{
				clip: 'tapaiko-your-formal-f1',
				parts: [
					{ dev: 'यो', en: 'this', role: 'who' },
					{ dev: 'तपाईंको', en: 'your', role: 'what' },
					{ dev: 'झोला', en: 'bag', role: 'what' },
					{ dev: 'हो?', en: 'is?', role: 'verb' },
				],
			},
			{
				clip: 'usko-his-her-informal-f1',
				parts: [
					{ dev: 'उसको', en: 'his', role: 'who' },
					{ dev: 'नाम', en: 'name', role: 'who' },
					{ dev: 'के', en: 'what', role: 'mark' },
					{ dev: 'हो?', en: 'is?', role: 'verb' },
				],
			},
			{
				clip: 'timro-your-informal-f1',
				parts: [
					{ dev: 'तिम्रो', en: 'your', role: 'who' },
					{ dev: 'घर', en: 'house', role: 'who' },
					{ dev: 'कहाँ', en: 'where', role: 'mark' },
					{ dev: 'छ?', en: 'is?', role: 'verb' },
				],
			},
		],
		tip: 'To turn any sentence you know into a question, just say it with your voice rising at the end. To ask “what / where / when”, drop the question word into the answer’s seat.',
	},
	{
		id: 'verb-endings',
		after: 'verbs-present', // path anchor: this node sits just after this unit
		glyph: '-छु', // short mark for the path node
		title: 'The ending says who',
		sub: '-chhu · -chhau · -chha · -nuhunchha',
		intro: 'A Nepali verb changes its ending to match who is doing it: ma bolchhu (I speak), haami jaanchhau (we go), pasal khulchha (the shop opens), didi jaanuhunchha (elder sister goes). Learn a verb as a stem plus a set of endings, and one verb gives you every person.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'stem + ending' },
		],
		contrast: [
			{ label: 'I → -chhu', clip: 'ma-nepali-bolchhu-i-speak-nepali' },
			{ label: 'We → -chhau', clip: 'hami-we-us-f1' },
		],
		points: [
			'ma → -chhu · haami → -chhau (with a nasal hum on the end that the romanization leaves out) · timi → -chhau · u / yo → -chha · uniharu → -chhan · tapaai / uhaa → -nuhunchha.',
			'Because the ending already says who, the pronoun is often dropped: Nepali bolchhu is a complete “I speak Nepali”.',
			'The stem stays put: bol- (speak), jaa- (go), khaa- (eat), gar- (do) — swap only the ending.',
		],
		examples: [
			{
				clip: 'ma-nepali-bolchhu-i-speak-nepali',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'नेपाली', en: 'Nepali', role: 'what' },
					{ dev: 'बोल्छु', en: 'speak (I)', role: 'verb' },
				],
			},
			{
				clip: 'hami-we-us-f1',
				parts: [
					{ dev: 'हामी', en: 'we', role: 'who' },
					{ dev: 'सँगै', en: 'together', role: 'what' },
					{ dev: 'जान्छौं', en: 'go (we)', role: 'verb' },
				],
			},
			{
				clip: 'das-ten-f1',
				parts: [
					{ dev: 'दस', en: 'ten', role: 'what' },
					{ dev: 'बजे', en: "o'clock", role: 'what' },
					{ dev: 'पसल', en: 'shop', role: 'who' },
					{ dev: 'खुल्छ', en: 'opens (it)', role: 'verb' },
				],
			},
			{
				clip: 'didi-older-sister-f1',
				parts: [
					{ dev: 'मेरी', en: 'my', role: 'who' },
					{ dev: 'दिदी', en: 'elder sister', role: 'who' },
					{ dev: 'बजार', en: 'market', role: 'what' },
					{ dev: 'जानुहुन्छ', en: 'goes (polite)', role: 'verb' },
				],
			},
		],
		tip: 'When you meet a new verb, say it through the set once: garchhu, garchhau, garchha, garnuhunchha. The pattern is the same every time.',
	},
	{
		id: 'negation',
		after: 'daily-routine', // path anchor: this node sits just after this unit
		glyph: 'छैन', // short mark for the path node
		title: 'Saying no',
		sub: 'ho → hoina · chha → chhaina · -chha → -daina',
		intro: 'Nepali has no separate “not”. The verb itself turns negative, and it still sits at the end: ho becomes hoina, chha becomes chhaina, and an ordinary verb swaps its -chha ending for -daina (hunchha → hundaina, “it works” → “it doesn’t”).',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'mark', label: 'the negative verb' },
			{ role: 'verb', label: 'the positive verb' },
		],
		contrast: [
			{ label: 'ho → hoina', clip: 'hoina-no-informal-f1' },
			{ label: 'chha → chhaina', clip: 'chamcha-spoon-f2' },
		],
		points: [
			'hoina denies what something is: yo mero hoina (this isn’t mine). On its own it is simply “no”.',
			'chhaina denies a state, a place, or existence: thaahaa chhaina (I don’t know), samay chhaina (there’s no time).',
			'Other verbs go negative in the ending: -chha → -daina, and for “I”, -chhu → -dina: ma jaandina (I’m not going).',
		],
		examples: [
			{
				clip: 'hoina-no-informal-f1',
				parts: [
					{ dev: 'यो', en: 'this', role: 'who' },
					{ dev: 'मेरो', en: 'mine', role: 'what' },
					{ dev: 'होइन', en: 'is not', role: 'mark' },
				],
			},
			{
				clip: 'thaha-chhaina-i-don-t-know',
				parts: [
					{ dev: 'थाहा', en: 'knowledge', role: 'what' },
					{ dev: 'छैन', en: 'is not', role: 'mark' },
				],
			},
			{
				clip: 'chamcha-spoon-f2',
				parts: [
					{ dev: 'चम्चा', en: 'spoon', role: 'who' },
					{ dev: 'सफा', en: 'clean', role: 'what' },
					{ dev: 'छैन', en: 'is not', role: 'mark' },
				],
			},
			{
				clip: 'hudaina-not-okay-it-won-t-work-f2',
				parts: [
					{ dev: 'आज', en: 'today', role: 'what' },
					{ dev: 'हुँदैन,', en: 'doesn’t work,', role: 'mark' },
					{ dev: 'भोलि', en: 'tomorrow', role: 'what' },
					{ dev: 'हुन्छ', en: 'works', role: 'verb' },
				],
			},
		],
		tip: 'Two words carry most of your everyday “no”: hoina for “that’s not it” and chhaina for “there isn’t / it isn’t”. Both still go last.',
	},
	// ---- T66: the verb situations, then the verb cards (`kind: 'verb'`, with a conjugation `table`) ----
	{
		id: 'progressive',
		after: 'patterns-doing',
		glyph: '-दै',
		title: 'Right now: -dai chhu',
		sub: '-dai + chhu · chha · chhan · hunuhunchha',
		intro: 'ma kaam garchhu means “I work” in general, or “I’ll do it”. For something happening at this moment Nepali adds -dai to the stem and then says “am / is / are”: ma khaanaa pakaaundai chhu, “I am cooking food”.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'am / is / are' },
			{ role: 'mark', label: '-dai' },
		],
		contrast: [
			{
				label: 'In general → -chhu',
				clip: 'ma-kaam-garchu-i-am-working-i-will-do-the-work',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'काम', en: 'work', role: 'what' },
					{ dev: 'गर्छु', en: 'do', role: 'verb' },
				],
			},
			{ label: 'Right now → -dai chhu', clip: 'ma-khana-pakaudai-chu-i-am-cooking-food' },
		],
		points: [
			'Take the stem, add -dai, then the “to be” word that matches who: ma … -dai chhu, u … -dai chha, uniharu … -dai chhan, tapaai … -dai hunuhunchha.',
			'The -dai word never changes; only the “to be” word after it does — the same chhu · chha · chhan · hunuhunchha you use for “I am at home”.',
			'Keep the plain -chhu form for habits and plans (ma kaam garchhu — I work, I’ll work) and -dai chhu for what is going on right now.',
		],
		examples: [
			{
				clip: 'ma-khana-pakaudai-chu-i-am-cooking-food',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'खाना', en: 'food', role: 'what' },
					{ dev: 'पकाउँदै', en: 'cooking', role: 'mark' },
					{ dev: 'छु', en: 'am', role: 'verb' },
				],
			},
			{
				clip: 'bahini-younger-sister-f2',
				parts: [
					{ dev: 'बहिनी', en: 'little sister', role: 'who' },
					{ dev: 'पढ्दै', en: 'studying', role: 'mark' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'paahuna-aaudai-chan-guests-are-coming',
				parts: [
					{ dev: 'पाहुना', en: 'guests', role: 'who' },
					{ dev: 'आउँदै', en: 'coming', role: 'mark' },
					{ dev: 'छन्', en: 'are', role: 'verb' },
				],
			},
			{
				clip: 'tapai-ke-gardai-hunuhunchha-what-are-you-doing-polite',
				parts: [
					{ dev: 'तपाईं', en: 'you', role: 'who' },
					{ dev: 'के', en: 'what', role: 'what' },
					{ dev: 'गर्दै', en: 'doing', role: 'mark' },
					{ dev: 'हुनुहुन्छ?', en: 'are (polite)', role: 'verb' },
				],
			},
		],
		tip: 'You will use this most when answering tapaai ke gardai hunuhunchha? (what are you doing?): ma … -dai chhu, with the thing you are doing in the middle.',
	},
	{
		id: 'perfect',
		after: 'meals',
		glyph: '-एको',
		title: 'Have you eaten? -eko chhu',
		sub: '-eko + chhu · chha · chhaina',
		intro: 'khaanaa khaanubhayo? — “have you eaten?” — is how Nepali says hello. The answer uses the -eko form: khaanaa khaaeko chhu, “I have eaten”, or khaaeko chhaina, “I haven’t”. The same shape describes a state you are in: thakeko chhu, “I am tired”.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'am / is' },
			{ role: 'mark', label: '-eko' },
		],
		contrast: [
			{ label: 'Have → -eko chhu', clip: 'khana-khaeko-chu-i-ve-eaten-i-have-eaten' },
			{ label: 'Haven’t → -eko chhaina', clip: 'khana-khaeko-chhaina-i-haven-t-eaten' },
		],
		points: [
			'-eko turns a verb into a “done” word: khaaeko (eaten), thakeko (tired out), paakeko (ripened). Then add chhu / chha / hunuhunchha for who.',
			'For “not yet”, swap chhu for chhaina: khaaeko chhaina (I haven’t eaten). Nothing else moves.',
			'Because it describes a state, -eko chhu also covers “I am tired”, “he is angry”, “this fruit is ripe” — a result, not an action.',
		],
		examples: [
			{
				clip: 'khana-khaeko-chu-i-ve-eaten-i-have-eaten',
				parts: [
					{ dev: 'खाना', en: 'food', role: 'what' },
					{ dev: 'खाएको', en: 'eaten', role: 'mark' },
					{ dev: 'छु', en: 'have (I)', role: 'verb' },
				],
			},
			{
				clip: 'khana-khaeko-chhaina-i-haven-t-eaten',
				parts: [
					{ dev: 'खाना', en: 'food', role: 'what' },
					{ dev: 'खाएको', en: 'eaten', role: 'mark' },
					{ dev: 'छैन', en: 'have not', role: 'verb' },
				],
			},
			{
				clip: 'phal-fruit-f2',
				parts: [
					{ dev: 'यो', en: 'this', role: 'who' },
					{ dev: 'फल', en: 'fruit', role: 'who' },
					{ dev: 'पाकेको', en: 'ripened', role: 'mark' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'ma-thakeko-chu-i-am-tired',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'थकेको', en: 'tired', role: 'mark' },
					{ dev: 'छु', en: 'am', role: 'verb' },
				],
			},
		],
		tip: 'Someone asking khaanaa khaanubhayo? is being friendly, not offering a meal. khaaeko chhu, dhanyabaad — and asking it back — is the whole exchange.',
	},
	{
		id: 'ne-form',
		after: 'household-living',
		glyph: '-ने',
		title: 'The -ne form',
		sub: 'kahaa jaane? · chiyaa khaane? · sutne belaa',
		intro: 'Stem + -ne is the most relaxed verb form in Nepali. On its own it asks or announces a plan — kahaa jaane? (where are you off to?), chiyaa khaane? (tea?), ma nuhaaun jaane (I’m going to bathe) — and in front of a noun it means “for …-ing”: sutne belaa, bedtime.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
			{ role: 'mark', label: '-ne' },
		],
		contrast: [
			{
				label: 'Statement → -chhu',
				clip: 'ma-ghar-jaanchu-i-am-going-home',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'घर', en: 'home', role: 'what' },
					{ dev: 'जान्छु', en: 'go', role: 'verb' },
				],
			},
			{ label: 'Casual plan → -ne', clip: 'kaha-jane-where-are-you-going' },
		],
		points: [
			'No ending for who: jaane is the same for me, you and them. The person comes from context, which is what makes it sound casual.',
			'As a question it is an invitation or a quick check: chiyaa khaane? (will you have tea?), aba ke garne? (what now?).',
			'Before a noun it says what the noun is for: sutne belaa (sleeping time), khaane kuraa (things to eat).',
		],
		examples: [
			{
				clip: 'kaha-jane-where-are-you-going',
				parts: [
					{ dev: 'कहाँ', en: 'where', role: 'what' },
					{ dev: 'जाने?', en: 'going?', role: 'mark' },
				],
			},
			{
				clip: 'chiya-khaane-will-you-have-tea',
				parts: [
					{ dev: 'चिया', en: 'tea', role: 'what' },
					{ dev: 'खाने?', en: 'having?', role: 'mark' },
				],
			},
			{
				clip: 'aba-now-next-f1',
				parts: [
					{ dev: 'अब', en: 'now', role: 'what' },
					{ dev: 'के', en: 'what', role: 'what' },
					{ dev: 'गर्ने?', en: 'to do?', role: 'mark' },
				],
			},
			{
				clip: 'ma-nuhaauna-jane-i-m-going-to-bathe',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'नुहाउन', en: 'to bathe', role: 'what' },
					{ dev: 'जाने', en: 'going', role: 'mark' },
				],
			},
		],
		tip: 'You will hear kahaa jaane? called across the street. It is friendly small talk, and a one-word answer — bajaar (the market) — is plenty.',
	},
	{
		id: 'past',
		after: 'verbs-past',
		glyph: '-यो',
		title: 'Yesterday: the past',
		sub: '-e · -yo · -nubhayo — and ma becomes maile',
		intro: 'The past swaps the -chh- endings for a short set of its own: ma gae (I went), chaabi haraayo (the key got lost), khaanaa khaanubhayo? (did you eat?). Same stems, new endings — and one small change to “I”.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'did' },
			{ role: 'mark', label: '-le' },
		],
		contrast: [
			{
				label: 'Now → -chhu',
				clip: 'ma-kaam-garchu-i-am-working-i-will-do-the-work',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'काम', en: 'work', role: 'what' },
					{ dev: 'गर्छु', en: 'do', role: 'verb' },
				],
			},
			{ label: 'Past → -e', clip: 'maile-garen-i-did-f1' },
		],
		points: [
			'ma → -e: gae (went), aae (came), gare (did), khaae (ate). u / yo → -yo: gayo, bhayo, haraayo. tapaai / uhaa → -nubhayo: jaanubhayo, khaanubhayo.',
			'When the verb has an object, “I” becomes maile in the past: maile kaam gare (I did the work), maile bhaat khaae (I ate rice). Going and coming take no object, so it stays ma gae, ma aae.',
			'A question is the same sentence with a rise: khaanaa khaanubhayo? — the everyday “have you eaten?” greeting.',
		],
		examples: [
			{
				clip: 'ma-gaen-i-went-f1',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'बजार', en: 'market', role: 'what' },
					{ dev: 'गएँ', en: 'went', role: 'verb' },
				],
			},
			{
				clip: 'maile-garen-i-did-f1',
				parts: [
					{ dev: 'मैले', en: 'I (-le)', role: 'mark' },
					{ dev: 'काम', en: 'work', role: 'what' },
					{ dev: 'गरेँ', en: 'did', role: 'verb' },
				],
			},
			{
				clip: 'chaabi-haraayo-i-lost-the-key',
				parts: [
					{ dev: 'चाबी', en: 'key', role: 'what' },
					{ dev: 'हरायो', en: 'got lost', role: 'verb' },
				],
			},
			{
				clip: 'khana-khanu-bhayo-have-you-eaten',
				parts: [
					{ dev: 'खाना', en: 'food', role: 'what' },
					{ dev: 'खानुभयो?', en: 'ate? (you, polite)', role: 'verb' },
				],
			},
		],
		tip: 'Listen for the -le on ma. It only appears in the past, and only with a verb that does something to something — a tell that the thing already happened.',
	},
	{
		id: 'bhayo',
		after: 'verbs-reactions',
		glyph: 'भयो',
		title: 'bhayo: it happened',
		sub: 'chha → bhayo',
		intro: 'bhayo is the past of hunu (to be, to become) and Nepali leans on it constantly: ke bhayo? (what happened?), khaanaa tayaar bhayo (the food is ready — it became ready), dhilo bhayo (it’s late), ramaailo bhayo (that was fun).',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'is' },
			{ role: 'mark', label: 'bhayo' },
		],
		contrast: [
			{
				label: 'Is → chha',
				clip: 'yo-piro-cha-is-this-spicy',
				parts: [
					{ dev: 'यो', en: 'this', role: 'who' },
					{ dev: 'पिरो', en: 'spicy', role: 'what' },
					{ dev: 'छ?', en: 'is?', role: 'verb' },
				],
			},
			{ label: 'Became → bhayo', clip: 'khana-tayar-bhayo-the-food-is-ready' },
		],
		points: [
			'Where English says “is”, Nepali often says “became”: tayaar bhayo — ready now, when it wasn’t before. chha is a state; bhayo is the moment it changed.',
			'With a time or an amount it means “it has come to”: tin din bhayo (it’s been three days), kati bhayo? (how much did it come to?).',
			'ke bhayo? is the all-purpose “what happened? / what’s wrong?”, and bhayo on its own means “done”, “that’s enough”.',
		],
		examples: [
			{
				clip: 'ke-bhayo-what-happened',
				parts: [
					{ dev: 'के', en: 'what', role: 'what' },
					{ dev: 'भयो?', en: 'happened?', role: 'mark' },
				],
			},
			{
				clip: 'khana-tayar-bhayo-the-food-is-ready',
				parts: [
					{ dev: 'खाना', en: 'food', role: 'who' },
					{ dev: 'तयार', en: 'ready', role: 'what' },
					{ dev: 'भयो', en: 'became', role: 'mark' },
				],
			},
			{
				clip: 'ramailo-bhayo-it-was-fun',
				parts: [
					{ dev: 'रमाइलो', en: 'fun', role: 'what' },
					{ dev: 'भयो', en: 'was', role: 'mark' },
				],
			},
			{
				clip: 'tin-three-f2',
				parts: [
					{ dev: 'तीन', en: 'three', role: 'what' },
					{ dev: 'दिन', en: 'days', role: 'what' },
					{ dev: 'भयो', en: 'has been', role: 'mark' },
				],
			},
		],
		tip: 'When someone keeps serving you more — food, tea, change — bhayo with a small wave of the hand means “that’s enough, thank you”.',
	},
	{
		id: 'requests',
		after: 'verbs-requests',
		glyph: '-नुस्',
		title: 'Please: -nus',
		sub: '-nus · -nuhos · na- for “don’t”',
		intro: 'Stem + -nus is the everyday polite “please …”: basnus (please sit), aaunus (come in), paani lyaaunus (bring water). It is a request, not an order — the tapaai form of the verb. -nuhos is the same thing a shade more formal, and na- on the front turns it into “please don’t”.',
		legend: [
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'please …' },
			{ role: 'mark', label: 'na-' },
		],
		contrast: [
			{ label: 'Please → -nus', clip: 'pani-lyaaunus-please-bring-water' },
			{ label: 'Please don’t → na- + -nus', clip: 'tyaha-there-f2' },
		],
		points: [
			'The ending carries the politeness, so you rarely need a “please” word: dinus is already “please give”. kripayaa (please) adds extra weight.',
			'-nuhos is slightly more formal than -nus and just as common: maaph garnuhos (excuse me), basnuhos (do sit).',
			'For “don’t”, put na- on the front: najaanus (don’t go), nakhaanus (don’t eat). With friends and children the verb drops to a bare form — jaau (go), aaija (come here) — which you will hear, but should not use with elders.',
		],
		examples: [
			{
				clip: 'ma-bhanchu-i-say-f1',
				parts: [
					{ dev: 'बिस्तारै', en: 'slowly', role: 'what' },
					{ dev: 'भन्नुस्', en: 'please say', role: 'verb' },
				],
			},
			{
				clip: 'pani-lyaaunus-please-bring-water',
				parts: [
					{ dev: 'पानी', en: 'water', role: 'what' },
					{ dev: 'ल्याउनुस्', en: 'please bring', role: 'verb' },
				],
			},
			{
				clip: 'maaf-garnuhos-excuse-me-i-m-sorry',
				parts: [
					{ dev: 'माफ', en: 'forgiveness', role: 'what' },
					{ dev: 'गर्नुहोस्', en: 'please do', role: 'verb' },
				],
			},
			{
				clip: 'tyaha-there-f2',
				parts: [
					{ dev: 'त्यहाँ', en: 'there', role: 'what' },
					{ dev: 'नजानुस्', en: 'please don’t go', role: 'mark' },
				],
			},
		],
		tip: 'When in doubt, use -nus. It is polite to everyone, and a polite request in Nepali never sounds stiff.',
	},
	{
		id: 'modals',
		after: 'modals-can-want-must',
		glyph: 'सक्छु',
		title: 'Can, want, must',
		sub: '-na sakchhu · man laagchha · -nu parchha',
		intro: 'Three patterns cover “can”, “want to” and “have to”, and all three keep the main verb in a “to …” form while a helper carries the ending: garna sakchhu (I can do), jaan man laagchha (I want to go), jaanu parchha (I have to go).',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'helper' },
			{ role: 'mark', label: 'to …' },
		],
		contrast: [
			{ label: 'Can → -na sakchhu', clip: 'ma-garna-sakchu-i-can-do' },
			{ label: 'Must → -nu parchha', clip: 'malai-jaanu-parcha-i-have-to-go' },
		],
		points: [
			'“Can”: the short “to” form + sakchhu, with the usual who-endings on sakchhu: ma garna sakchhu, tapaai garna saknuhunchha?, ma garna sakdina (I can’t).',
			'“Want to”: malaai + short form + man laagchha — literally “to me, going feels right”. It never changes for who; only malaai / tapaailaai does.',
			'“Have to”: malaai + the full -nu form + parchha: malaai jaanu parchha. The negative is pardaina (I don’t have to).',
		],
		examples: [
			{
				clip: 'ma-garna-sakchu-i-can-do',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'गर्न', en: 'to do', role: 'mark' },
					{ dev: 'सक्छु', en: 'can', role: 'verb' },
				],
			},
			{
				clip: 'malai-jana-man-laagcha-i-want-to-go',
				parts: [
					{ dev: 'मलाई', en: 'to me', role: 'who' },
					{ dev: 'जान', en: 'to go', role: 'mark' },
					{ dev: 'मन', en: 'mind', role: 'what' },
					{ dev: 'लाग्छ', en: 'feels', role: 'verb' },
				],
			},
			{
				clip: 'malai-jaanu-parcha-i-have-to-go',
				parts: [
					{ dev: 'मलाई', en: 'to me', role: 'who' },
					{ dev: 'जानु', en: 'to go', role: 'mark' },
					{ dev: 'पर्छ', en: 'must', role: 'verb' },
				],
			},
			{
				clip: 'ma-garna-sakdina-i-cannot-do',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'गर्न', en: 'to do', role: 'mark' },
					{ dev: 'सक्दिनँ', en: 'cannot', role: 'verb' },
				],
			},
		],
		tip: 'The short “to” form (jaan, garna, khaan) pairs with sakchhu and man laagchha; the full -nu form (jaanu, garnu) pairs with parchha. Hear both enough and the pairing sticks.',
	},
	{
		id: 'thiyo',
		after: 'time', // path anchor: this node sits just after this unit (T69)
		glyph: 'थियो',
		title: 'thiyo: it was',
		sub: 'chha is now · thiyo was then',
		intro: 'chha says how something is; thiyo says how it was. Swap one for the other and the sentence moves into the past: jaado chha (it’s cold) → jaado thiyo (it was cold). Nothing else in the sentence changes.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
			{ role: 'mark', label: 'was' },
		],
		contrast: [
			{
				label: 'Now → chha',
				clip: 'jado-cha-it-s-cold',
				parts: [
					{ dev: 'जाडो', en: 'cold', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{ label: 'Then → thiyo', clip: 'hijo-yesterday-f2' },
		],
		points: [
			'thiyo is the form for u / yo and for things. “I was” is thie (ma gharamaa thie — I was at home), haami and timi take thiyau, uniharu take thie, and tapaai / uhaa take the respectful hunuhunthyo.',
			'The negative is thiena: khaanaa piro thiena (the food wasn’t spicy).',
			'thiyo or bhayo? thiyo describes how things were — a state. bhayo says something happened or changed: khaanaa mitho thiyo (the food was delicious), but khaanaa tayaar bhayo (the food became ready).',
		],
		examples: [
			{
				clip: 'hijo-yesterday-f2',
				parts: [
					{ dev: 'हिजो', en: 'yesterday', role: 'what' },
					{ dev: 'राति', en: 'at night', role: 'what' },
					{ dev: 'जाडो', en: 'cold', role: 'what' },
					{ dev: 'थियो', en: 'was', role: 'mark' },
				],
			},
			{
				clip: 'khana-mitho-thiyo-food-was-delicious',
				parts: [
					{ dev: 'खाना', en: 'food', role: 'who' },
					{ dev: 'मीठो', en: 'delicious', role: 'what' },
					{ dev: 'थियो', en: 'was', role: 'mark' },
				],
			},
			{
				clip: 'khana-tayar-bhayo-the-food-is-ready',
				parts: [
					{ dev: 'खाना', en: 'food', role: 'who' },
					{ dev: 'तयार', en: 'ready', role: 'what' },
					{ dev: 'भयो', en: 'became', role: 'verb' },
				],
			},
		],
		tip: 'Telling someone about yesterday, a trip or a meal? Describe it exactly as you would today, and end with thiyo.',
	},
	{
		id: 'laagnu',
		after: 'weather', // path anchor: this node sits just after this unit (T69)
		glyph: 'लाग्यो',
		title: 'laagyo: it strikes you',
		sub: 'weather · feelings · wanting · time',
		intro: 'Nepali does not say “I am hungry” or “it is sunny”. Hunger, cold, fear and sunshine are things that strike: malaai bhok laagyo is “to-me hunger struck”, ghaam laagyo is “sun struck”. One verb, laagnu, carries all of them — and the person it happens to takes -laai.',
		legend: [
			{ role: 'mark', label: 'to whom' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'I', role: 'mark' },
					{ en: 'am', role: 'verb' },
					{ en: 'hungry', role: 'what' },
				],
			},
			{ label: 'Nepali', clip: 'feel-bhok-hunger' },
		],
		points: [
			'Weather just happens, so there is no person: ghaam laagyo (it’s sunny), baadal laagyo (it’s cloudy), hussu laagyo (it’s foggy).',
			'Feelings happen to someone, so they start with malaai or tapaailaai: malaai jaado laagyo (I feel cold), malaai dar laagyo (I got scared), tapaailaai bhetdaa khusi laagyo (nice to meet you).',
			'laagyo is the past — it has struck, so you feel it now. laagchha is the general version: saanpadekhi dar laagchha (I’m scared of snakes), malaai jaan man laagchha (I feel like going), bis minet laagchha (it takes twenty minutes). The negative is laagdaina.',
		],
		examples: [
			{
				clip: 'ghaam-laagyo-it-s-sunny',
				parts: [
					{ dev: 'घाम', en: 'sun', role: 'what' },
					{ dev: 'लाग्यो', en: 'struck', role: 'verb' },
				],
			},
			{
				clip: 'feel-bhok-hunger',
				parts: [
					{ dev: 'मलाई', en: 'to me', role: 'mark' },
					{ dev: 'भोक', en: 'hunger', role: 'what' },
					{ dev: 'लाग्यो', en: 'struck', role: 'verb' },
				],
			},
			{
				clip: 'tapai-lai-bhetda-khushi-lagyo-nice-to-meet-you',
				parts: [
					{ dev: 'तपाईंलाई', en: 'you', role: 'what' },
					{ dev: 'भेट्दा', en: 'on meeting', role: 'what' },
					{ dev: 'खुसी', en: 'happiness', role: 'what' },
					{ dev: 'लाग्यो', en: 'struck', role: 'verb' },
				],
			},
			{
				clip: 'bis-twenty-f1',
				parts: [
					{ dev: 'बीस', en: 'twenty', role: 'what' },
					{ dev: 'मिनेट', en: 'minutes', role: 'what' },
					{ dev: 'लाग्छ', en: 'it takes', role: 'verb' },
				],
			},
		],
		tip: 'When English says “I am” plus a feeling, try malaai + the feeling + laagyo first.',
	},
	{
		id: 'bhandaa',
		after: 'comparing-things', // path anchor: this node sits just after this unit (T69)
		glyph: 'भन्दा',
		title: 'bhandaa: than',
		sub: 'no “-er”, no “more” — just bhandaa',
		intro: 'English changes the adjective: big → bigger. Nepali leaves it alone and puts bhandaa (“than”) after the thing you are comparing against: yo tyo bhandaa thulo chha — “this, that than, big is”.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'mark', label: 'than what' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'this', role: 'who' },
					{ en: 'is', role: 'verb' },
					{ en: 'bigger', role: 'what' },
					{ en: 'than', role: 'mark' },
					{ en: 'that', role: 'mark' },
				],
			},
			{ label: 'Nepali', clip: 'yo-tyo-bhanda-thulo-bigger' },
		],
		points: [
			'The order is: the thing · what it beats + bhandaa · the quality · chha. chiyaa kaphi bhandaa sasto chha — “tea, coffee than, cheap is”.',
			'The adjective never changes. thulo is both “big” and “bigger”; bhandaa does all the work.',
			'sabai bhandaa — “than all” — makes the “-est”: sabai bhandaa raamro (the best), sabai bhandaa thulo (the biggest). You will also see it written as one word, sabaibhandaa.',
		],
		examples: [
			{
				clip: 'yo-tyo-bhanda-thulo-bigger',
				parts: [
					{ dev: 'यो', en: 'this', role: 'who' },
					{ dev: 'त्यो', en: 'that', role: 'mark' },
					{ dev: 'भन्दा', en: 'than', role: 'mark' },
					{ dev: 'ठूलो', en: 'big', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'bhanda-than-f1',
				parts: [
					{ dev: 'चिया', en: 'tea', role: 'who' },
					{ dev: 'कफी', en: 'coffee', role: 'mark' },
					{ dev: 'भन्दा', en: 'than', role: 'mark' },
					{ dev: 'सस्तो', en: 'cheap', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'bhanda-than-f2',
				parts: [
					{ dev: 'हिजो', en: 'yesterday', role: 'mark' },
					{ dev: 'भन्दा', en: 'than', role: 'mark' },
					{ dev: 'आज', en: 'today', role: 'who' },
					{ dev: 'गर्मी', en: 'hot', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'sabai-bhanda-ramro-the-best',
				parts: [
					{ dev: 'सबै', en: 'all', role: 'mark' },
					{ dev: 'भन्दा', en: 'than', role: 'mark' },
					{ dev: 'राम्रो', en: 'good', role: 'what' },
				],
			},
		],
		tip: 'Build it backwards from English: say what you are comparing against, add bhandaa, then the plain adjective.',
	},
	{
		id: 'if-bhane',
		after: 'fn-conjunctions', // path anchor: this node sits just after this unit (T69)
		glyph: 'भने',
		title: 'yadi … bhane: if',
		sub: 'the “if” closes its clause',
		intro: 'English opens with “if”. Nepali closes with it: the condition comes first and bhane ends it — sambhaw chha bhane, “possible is, if”. yadi at the front is an optional extra flag; everyday speech often drops it and keeps only bhane.',
		legend: [
			{ role: 'mark', label: 'joining word' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'if', role: 'mark' },
					{ en: 'it’s', role: 'verb' },
					{ en: 'possible', role: 'what' },
				],
			},
			{ label: 'Nepali', clip: 'fn-yadi-if' },
		],
		points: [
			'bhane is the part you cannot leave out. The condition is an ordinary sentence with bhane added: samay chha bhane … (if there’s time …).',
			'The result follows the condition, verb last as always: samay chha bhane ma aaunchhu — if there’s time, I’ll come.',
			'Its relatives each open their clause instead: kinabhane (“because”) opens the reason, natra (“otherwise”) opens the consequence, and jab (“when”) opens a time clause.',
		],
		examples: [
			{
				clip: 'fn-yadi-if',
				parts: [
					{ dev: 'यदि', en: 'if', role: 'mark' },
					{ dev: 'सम्भव', en: 'possible', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
					{ dev: 'भने', en: 'if (closing)', role: 'mark' },
				],
			},
			{
				clip: 'fn-kinabhane-because',
				parts: [
					{ dev: 'किनभने', en: 'because', role: 'mark' },
					{ dev: 'गाह्रो', en: 'hard', role: 'what' },
					{ dev: 'छ', en: 'is', role: 'verb' },
				],
			},
			{
				clip: 'fn-natra-otherwise',
				parts: [
					{ dev: 'नत्र', en: 'otherwise', role: 'mark' },
					{ dev: 'गाह्रो', en: 'hard', role: 'what' },
					{ dev: 'हुन्छ', en: 'will be', role: 'verb' },
				],
			},
			{
				clip: 'fn-jaba-when',
				parts: [
					{ dev: 'जब', en: 'when', role: 'mark' },
					{ dev: 'समय', en: 'time', role: 'what' },
					{ dev: 'हुन्छ', en: 'there is', role: 'verb' },
				],
			},
		],
		tip: 'Say the condition as a plain statement, then add bhane. That alone is a correct “if”.',
	},
	{
		id: 'pairs',
		after: 'linking-words', // path anchor: this node sits just after this unit (T69)
		glyph: 'जहाँ',
		title: 'jahaa … tyahaa: matched pairs',
		sub: 'a j- word opens, a ty- word answers',
		intro: 'For “wherever”, “the way that” and “as long as”, Nepali uses two words that rhyme: a j- word opens the first half and its ty- twin answers in the second. jahaa man laagchha, tyahaa jaanus — “where you feel like, there go”.',
		legend: [
			{ role: 'mark', label: 'j- / ty- pair' },
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		contrast: [
			{
				label: 'English',
				chips: [
					{ en: 'go', role: 'verb' },
					{ en: 'wherever', role: 'mark' },
					{ en: 'you like', role: 'what' },
				],
			},
			{ label: 'Nepali', clip: 'link-jahaan' },
		],
		points: [
			'The pairs mirror the question words you know: kahaa (where?) → jahaa … tyahaa (where … there); kasari (how?) → jasari … tyasari (the way … that way); kati (how much?) → jati … tyati (as much … that much).',
			'The j- half comes first and ends in its own verb; the ty- half follows with the main verb last: jasari ma garchhu, tyasari garnus.',
			'In short sentences the ty- twin is often left unsaid: jab samay hunchha (when there’s time), jabasamma paani parchha, ma baschhu (as long as it rains, I’ll stay), jati sakchha (as much as possible).',
		],
		examples: [
			{
				clip: 'link-jahaan',
				parts: [
					{ dev: 'जहाँ', en: 'where', role: 'mark' },
					{ dev: 'मन', en: 'mind', role: 'what' },
					{ dev: 'लाग्छ,', en: 'strikes', role: 'verb' },
					{ dev: 'त्यहाँ', en: 'there', role: 'mark' },
					{ dev: 'जानुस्', en: 'please go', role: 'verb' },
				],
			},
			{
				clip: 'link-jasari',
				parts: [
					{ dev: 'जसरी', en: 'the way', role: 'mark' },
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'गर्छु,', en: 'do', role: 'verb' },
					{ dev: 'त्यसरी', en: 'that way', role: 'mark' },
					{ dev: 'गर्नुस्', en: 'please do', role: 'verb' },
				],
			},
			{
				clip: 'link-jabasamma',
				parts: [
					{ dev: 'जबसम्म', en: 'as long as', role: 'mark' },
					{ dev: 'पानी', en: 'rain', role: 'what' },
					{ dev: 'पर्छ,', en: 'falls', role: 'verb' },
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'बस्छु', en: 'stay', role: 'verb' },
				],
			},
			{
				clip: 'adv-jati-asmuchas',
				parts: [
					{ dev: 'जति', en: 'as much as', role: 'mark' },
					{ dev: 'सक्छ', en: 'is possible', role: 'verb' },
				],
			},
		],
		tip: 'Hear a word starting with j-? Expect its ty- twin — spoken or not — to finish the thought.',
	},
	{
		id: 'card-garnu',
		kind: 'verb',
		after: 'verbs-making-doing',
		glyph: 'गर्नु',
		title: 'garnu — to do',
		sub: 'stem gar-',
		intro: 'The verb behind “work”, “help”, “clean” and half of everyday Nepali: gar- plus an ending. Every form below is one the course uses; tap a form to hear it on its own.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		table: [
			{ label: 'I do · will do', dev: 'म गर्छु', word: 'गर्छु' },
			{ label: 'we do', dev: 'हामी गर्छौं', word: 'गर्छौं' },
			{ label: 'he / she / it does', dev: 'ऊ गर्छ', word: 'गर्छ' },
			{ label: 'you (polite) do', dev: 'तपाईं गर्नुहुन्छ', word: 'गर्नुहुन्छ' },
			{ label: 'I did', dev: 'मैले गरेँ', word: 'गरेँ' },
			{ label: 'did you? (polite)', dev: 'गर्नुभयो?' },
			{ label: 'doing, right now', dev: 'गर्दै छु', word: 'गर्दै' },
			{ label: 'please do', dev: 'गर्नुस्' },
			{ label: 'please don’t', dev: 'नगर्नुस्' },
			{ label: 'I can do', dev: 'गर्न सक्छु', word: 'गर्न' },
			{ label: 'I have to do', dev: 'गर्नु पर्छ', word: 'गर्नु' },
			{ label: 'I don’t do', dev: 'गर्दिनँ' },
		],
		points: [
			'Any noun + garnu makes a verb: kaam garnu (work), maddat garnu (help), saphaa garnu (clean).',
			'The endings are the same set every verb uses (The ending says who, earlier on the path), so once gar- is yours, so is every other stem.',
		],
		examples: [
			{
				clip: 'ma-kaam-garchu-i-am-working-i-will-do-the-work',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'काम', en: 'work', role: 'what' },
					{ dev: 'गर्छु', en: 'do', role: 'verb' },
				],
			},
			{
				clip: 'maile-garen-i-did-f1',
				parts: [
					{ dev: 'मैले', en: 'I (-le)', role: 'who' },
					{ dev: 'काम', en: 'work', role: 'what' },
					{ dev: 'गरेँ', en: 'did', role: 'verb' },
				],
			},
			{
				clip: 'tapai-ke-gardai-hunuhunchha-what-are-you-doing-polite',
				parts: [
					{ dev: 'तपाईं', en: 'you', role: 'who' },
					{ dev: 'के', en: 'what', role: 'what' },
					{ dev: 'गर्दै', en: 'doing', role: 'verb' },
					{ dev: 'हुनुहुन्छ?', en: 'are (polite)', role: 'verb' },
				],
			},
			{
				clip: 'dhoka-banda-garnus-please-close-the-door',
				parts: [
					{ dev: 'ढोका', en: 'door', role: 'what' },
					{ dev: 'बन्द', en: 'closed', role: 'what' },
					{ dev: 'गर्नुस्', en: 'please do', role: 'verb' },
				],
			},
		],
		tip: 'Say the set aloud once a day: garchhu, garchhau, garchha, garnuhunchha — gare, garnubhayo — garnus. A minute of that and gar- runs on its own.',
	},
	{
		id: 'card-jaanu',
		kind: 'verb',
		after: 'verbs-getting-around',
		glyph: 'जानु',
		title: 'jaanu · aaunu — to go, to come',
		sub: 'stems jaa- · aau-',
		intro: 'Going and coming: the two verbs you will use every day on the street. Both take the usual endings; the past of jaanu changes its stem (gae, gayo), and “I” stays ma with both, since neither takes an object.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		table: [
			{ heading: 'jaanu — to go' },
			{ label: 'I go · will go', dev: 'म जान्छु', word: 'जान्छु' },
			{ label: 'we go', dev: 'हामी जान्छौं', word: 'जान्छौं' },
			{ label: 'he / she / it goes', dev: 'ऊ जान्छ', word: 'जान्छ' },
			{ label: 'you (polite) go', dev: 'तपाईं जानुहुन्छ', word: 'जानुहुन्छ' },
			{ label: 'I went', dev: 'म गएँ', word: 'गएँ' },
			{ label: 'it went', dev: 'गयो' },
			{ label: 'you (polite) went', dev: 'जानुभयो' },
			{ label: 'going, right now', dev: 'जाँदै छु', word: 'जाँदै' },
			{ label: 'please go', dev: 'जानुस्' },
			{ label: 'please don’t go', dev: 'नजानुस्' },
			{ label: 'going? (casual)', dev: 'जाने?' },
			{ label: 'I can go', dev: 'जान सक्छु', word: 'जान' },
			{ label: 'I don’t go', dev: 'जाँदिनँ' },
			{ heading: 'aaunu — to come' },
			{ label: 'I come · will come', dev: 'म आउँछु', word: 'आउँछु' },
			{ label: 'we come', dev: 'हामी आउँछौं', word: 'आउँछौं' },
			{ label: 'he / she / it comes', dev: 'ऊ आउँछ', word: 'आउँछ' },
			{ label: 'you (polite) come', dev: 'तपाईं आउनुहुन्छ', word: 'आउनुहुन्छ' },
			{ label: 'I came', dev: 'म आएँ', word: 'आएँ' },
			{ label: 'it came', dev: 'आयो' },
			{ label: 'coming, right now', dev: 'आउँदै छु', word: 'आउँदै' },
			{ label: 'please come', dev: 'आउनुस्' },
			{ label: 'he / she isn’t coming', dev: 'आउँदैन' },
			{ label: 'I don’t come', dev: 'आउँदिनँ' },
		],
		points: [
			'jaanu is the main action verb whose past changes stem: gae, gayo, jaanubhayo — jaa- becomes ga- (hunu → bhayo is the other). aaunu keeps its stem: aae, aayo.',
			'Both take a destination with no “to”: ma ghar jaanchhu, ma bajaar gae. The place sits where an object would.',
		],
		examples: [
			{
				clip: 'ma-ghar-jaanchu-i-am-going-home',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'घर', en: 'home', role: 'what' },
					{ dev: 'जान्छु', en: 'go', role: 'verb' },
				],
			},
			{
				clip: 'ma-gaen-i-went-f1',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'बजार', en: 'market', role: 'what' },
					{ dev: 'गएँ', en: 'went', role: 'verb' },
				],
			},
			{
				clip: 'tapai-you-formal-f1',
				parts: [
					{ dev: 'तपाईं', en: 'you', role: 'who' },
					{ dev: 'कहिले', en: 'when', role: 'what' },
					{ dev: 'आउनुहुन्छ?', en: 'come? (polite)', role: 'verb' },
				],
			},
			{
				clip: 'tara-but-f1',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'जान्छु', en: 'go', role: 'verb' },
					{ dev: 'तर', en: 'but', role: 'what' },
					{ dev: 'ऊ', en: 'he', role: 'who' },
					{ dev: 'आउँदैन', en: 'isn’t coming', role: 'verb' },
				],
			},
		],
		tip: 'ma ahile aaunchhu (I’ll be right back) and ma jaanchhu (I’m off) are said on every exit. Have both ready.',
	},
	{
		id: 'card-khaanu',
		kind: 'verb',
		after: 'verbs-everyday-actions',
		glyph: 'खानु',
		title: 'khaanu — to eat, drink, take',
		sub: 'stem khaa-',
		intro: 'khaanu covers more than eating: tea, water and medicine are all “eaten” in Nepali (chiyaa khaanus — have some tea). It takes an object, so in the past “I” becomes maile.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		table: [
			{ label: 'I eat · will eat', dev: 'म खान्छु', word: 'खान्छु' },
			{ label: 'we eat', dev: 'हामी खान्छौं', word: 'खान्छौं' },
			{ label: 'he / she / it eats', dev: 'ऊ खान्छ', word: 'खान्छ' },
			{ label: 'you (polite) eat', dev: 'तपाईं खानुहुन्छ', word: 'खानुहुन्छ' },
			{ label: 'I ate', dev: 'मैले खाएँ', word: 'खाएँ' },
			{ label: 'did you eat? (polite)', dev: 'खानुभयो?' },
			{ label: 'eating, right now', dev: 'खाँदै छु', word: 'खाँदै' },
			{ label: 'I have eaten', dev: 'खाएको छु', word: 'खाएको' },
			{ label: 'please eat', dev: 'खानुस्' },
			{ label: 'please don’t eat', dev: 'नखानुस्' },
			{ label: 'eat? (casual)', dev: 'खाने?' },
			{ label: 'I can eat', dev: 'खान सक्छु', word: 'खान' },
			{ label: 'I don’t eat', dev: 'खाँदिनँ' },
		],
		points: [
			'Drinks are eaten too: chiyaa khaanchhu, paani khaanus. piunu (to drink) exists, but khaanu is what people say.',
			'ma maachhaamaasu khaandina — “I don’t eat meat” — is the khaandina form doing real work at the table.',
		],
		examples: [
			{
				clip: 'khana-food-f1',
				parts: [
					{ dev: 'म', en: 'I', role: 'who' },
					{ dev: 'खाना', en: 'food', role: 'what' },
					{ dev: 'खान्छु', en: 'eat', role: 'verb' },
				],
			},
			{
				clip: 'maile-khaen-i-ate-f1',
				parts: [
					{ dev: 'मैले', en: 'I (-le)', role: 'who' },
					{ dev: 'भात', en: 'rice', role: 'what' },
					{ dev: 'खाएँ', en: 'ate', role: 'verb' },
				],
			},
			{
				clip: 'chiya-tea-f1',
				parts: [
					{ dev: 'चिया', en: 'tea', role: 'what' },
					{ dev: 'खानुहुन्छ?', en: 'will you have? (polite)', role: 'verb' },
				],
			},
			{
				clip: 'khana-khaeko-chu-i-ve-eaten-i-have-eaten',
				parts: [
					{ dev: 'खाना', en: 'food', role: 'what' },
					{ dev: 'खाएको', en: 'eaten', role: 'verb' },
					{ dev: 'छु', en: 'have (I)', role: 'verb' },
				],
			},
		],
		tip: 'khaanaa khaanubhayo? is a greeting. Reply khaae (I ate) or khaaeko chhu, and ask it back.',
	},
	{
		id: 'card-hunu',
		kind: 'verb',
		after: 'time-week',
		glyph: 'हुनु',
		title: 'hunu — to be',
		sub: 'ho · chha · hunchha · bhayo · thiyo',
		intro: 'The one verb with several presents: ho names what something is, chha says where or how it is, hunchha is what generally happens — and each has its own negative. The past is bhayo (became) or thiyo (was).',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'does' },
		],
		table: [
			{ label: 'it is (what it is)', dev: 'हो' },
			{ label: 'it is not', dev: 'होइन' },
			{ label: 'I am', dev: 'म छु', word: 'छु' },
			{ label: 'we are', dev: 'हामी छौं', word: 'छौं' },
			{ label: 'he / she / it is (where, how)', dev: 'ऊ छ', word: 'छ' },
			{ label: 'they are', dev: 'उनीहरू छन्', word: 'छन्' },
			{ label: 'you (polite) are', dev: 'तपाईं हुनुहुन्छ', word: 'हुनुहुन्छ' },
			{ label: 'there isn’t · it isn’t', dev: 'छैन' },
			{ label: 'it is (generally) · okay', dev: 'हुन्छ' },
			{ label: 'it isn’t · won’t do', dev: 'हुँदैन' },
			{ label: 'it became · happened', dev: 'भयो' },
			{ label: 'it was', dev: 'थियो' },
			{ label: 'to be', dev: 'हुनु' },
		],
		points: [
			'ho vs chha: ho for what something is (yo mero ho — this is mine), chha for place, state and having (ma gharamaa chhu, malaai thaahaa chha). See ho vs chha, earlier on the path.',
			'hunchha is for what is generally so — and for “okay”: maha guliyo hunchha (honey is sweet), hunchha! (fine, will do). thiyo and bhayo split the past into “was” and “became”.',
		],
		examples: [
			{
				clip: 'uhaa-he-she-polite-f2',
				parts: [
					{ dev: 'उहाँ', en: 'she', role: 'who' },
					{ dev: 'डाक्टर', en: 'doctor', role: 'what' },
					{ dev: 'हुनुहुन्छ', en: 'is (polite)', role: 'verb' },
				],
			},
			{
				clip: 'hami-we-us-f2',
				parts: [
					{ dev: 'हामी', en: 'we', role: 'who' },
					{ dev: 'घरमा', en: 'at home', role: 'what' },
					{ dev: 'छौं', en: 'are', role: 'verb' },
				],
			},
			{
				clip: 'maha-honey-f1',
				parts: [
					{ dev: 'मह', en: 'honey', role: 'who' },
					{ dev: 'गुलियो', en: 'sweet', role: 'what' },
					{ dev: 'हुन्छ', en: 'is (always)', role: 'verb' },
				],
			},
			{
				clip: 'hijo-yesterday-f2',
				parts: [
					{ dev: 'हिजो', en: 'yesterday', role: 'what' },
					{ dev: 'राति', en: 'night', role: 'what' },
					{ dev: 'जाडो', en: 'cold', role: 'what' },
					{ dev: 'थियो', en: 'was', role: 'verb' },
				],
			},
		],
		tip: 'Not sure which present to use? A noun after it wants ho; a place or a feeling wants chha; a general truth wants hunchha.',
	},
];
