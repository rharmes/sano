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
			'-wataa attaches straight onto the number for things: duiwataa, tinwataa, dasawataa.',
			'-janaa is the counter for people: ekjanaa (one person), chaar janaa (four people).',
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
		tip: 'When you order or ask for a number of anything, reach for -wataa: duiwataa chiyaa, tinwataa momo. It is rarely wrong for things.',
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
		id: 'postpositions',
		after: 'introductions-origins', // path anchor: this node sits just after this unit
		glyph: '-मा', // short mark for the path node
		title: 'Little words come after',
		sub: '-maa · -baata · -sanga',
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
			'-baata means from: kahaanbaat (from where), and -sanga means with: saathisang (with a friend).',
			'They attach to pronouns too, and the two fuse: ma + sanga → masanga (with me), so masanga das rupaiyaa chha is “I have ten rupees”.',
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
		sub: '-chhu · -chhaun · -chha · -nuhunchha',
		intro: 'A Nepali verb changes its ending to match who is doing it: ma bolchhu (I speak), haami jaanchhaun (we go), pasal khulchha (the shop opens), didi jaanuhunchha (elder sister goes). Learn a verb as a stem plus a set of endings, and one verb gives you every person.',
		legend: [
			{ role: 'who', label: 'who' },
			{ role: 'what', label: 'what' },
			{ role: 'verb', label: 'stem + ending' },
		],
		contrast: [
			{ label: 'I → -chhu', clip: 'ma-nepali-bolchhu-i-speak-nepali' },
			{ label: 'We → -chhaun', clip: 'hami-we-us-f1' },
		],
		points: [
			'ma → -chhu · haami → -chhaun · timi → -chhau · u / yo → -chha · uniharu → -chhan · tapaai / uhaa → -nuhunchha.',
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
		tip: 'When you meet a new verb, say it through the set once: garchhu, garchhaun, garchha, garnuhunchha. The pattern is the same every time.',
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
];
