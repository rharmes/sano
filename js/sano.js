// App logic for the Nepali study guide. Course content lives in js/data.js (COURSE).

const STATE_KEY = 'sano.state.v1';
const LESSON_NEW_ITEMS = 5; // items per lesson; each item yields two exercises

let state;
let words = []; // Flat list of phrase items (the #words table) used by flashcards and the quiz.
let wordIndex = 0;
let mode = '';
let soloTopic = '';
let currentQuizItem = null;
let lesson = null;

document.addEventListener('DOMContentLoaded', () => {
	state = loadState();
	renderTables();

	document.getElementById('words').addEventListener('click', toggleWord);
	document.getElementById('submit').addEventListener('click', saveName);
	document.getElementById('open-flashcards').addEventListener('click', openFlashcard);
	document.getElementById('open-quiz').addEventListener('click', openQuiz);
	document.getElementById('flashcard-close').addEventListener('click', close);
	document.getElementById('flashcard-next').addEventListener('click', next);
	document.getElementById('flashcard-prev').addEventListener('click', prev);

	const quizChoiceEls = document.getElementById('quiz-choices').getElementsByTagName('button');
	for (const choiceEl of quizChoiceEls) choiceEl.addEventListener('click', checkChoice);

	document.getElementById('nav-home').addEventListener('click', goHome);
	document.getElementById('home-link').addEventListener('click', goHome);
	document.getElementById('nav-dictionary').addEventListener('click', () => showScreen('dictionary'));
	document.getElementById('dictionary-link').addEventListener('click', () => showScreen('dictionary'));

	document.getElementById('daily-lesson').addEventListener('click', startDailyLesson);
	document.getElementById('lesson-quit').addEventListener('click', goHome);
	document.getElementById('lesson-continue').addEventListener('click', continueLesson);
	document.getElementById('complete-continue').addEventListener('click', goHome);

	const exerciseChoiceEls = document.getElementById('exercise-choices').getElementsByTagName('button');
	for (const choiceEl of exerciseChoiceEls) choiceEl.addEventListener('click', answerExercise);

	refreshHeader();
	renderHome();
});

// State management. All progress lives in a single versioned LocalStorage entry.

function defaultState() {
	return {
		version: 1,
		name: null,
		streak: 0,
		lastActivityDay: null,
		itemsToday: 0,
		itemsTotal: 0,
		items: {}, // item id -> { seen, correct }
		units: {}, // unit id -> { lessonsDone }
	};
}

function loadState() {
	const raw = localStorage.getItem(STATE_KEY);
	if (raw) {
		try {
			return Object.assign(defaultState(), JSON.parse(raw));
		} catch (e) {
			console.error('Could not parse saved state, starting fresh', e);
		}
	}
	return migrateLegacyState() || defaultState();
}

function saveState() {
	localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// Pulls progress out of the original per-key LocalStorage format, then removes those keys.
function migrateLegacyState() {
	if (localStorage.getItem('name') === null) return null;

	const migrated = defaultState();
	migrated.name = localStorage.getItem('name');
	migrated.streak = parseInt(localStorage.getItem('streak'), 10) || 0;
	migrated.itemsToday = parseInt(localStorage.getItem('itemsCompletedToday'), 10) || 0;
	migrated.itemsTotal = parseInt(localStorage.getItem('totalItemsCompleted'), 10) || 0;

	const lastActivity = parseInt(localStorage.getItem('lastActivity'), 10);
	if (lastActivity) migrated.lastActivityDay = dayString(new Date(lastActivity));

	// The old wordRecord was keyed by English meaning; re-key it by item id.
	let legacyRecord = {};
	try {
		legacyRecord = JSON.parse(localStorage.getItem('wordRecord')) || {};
	} catch (e) {}
	for (const unit of COURSE) {
		for (const item of unit.items) {
			if (Object.hasOwn(legacyRecord, item.en)) migrated.items[item.id] = legacyRecord[item.en];
		}
	}

	localStorage.setItem(STATE_KEY, JSON.stringify(migrated));
	for (const key of ['name', 'streak', 'itemsCompletedToday', 'totalItemsCompleted', 'lastActivity', 'wordRecord'])
		localStorage.removeItem(key);

	console.log('Migrated legacy progress to ' + STATE_KEY);
	return migrated;
}

function dayString(date) {
	return (
		date.getFullYear() +
		'-' +
		String(date.getMonth() + 1).padStart(2, '0') +
		'-' +
		String(date.getDate()).padStart(2, '0')
	);
}

// Called on every completed item: maintains the streak and daily counter.
function registerActivity() {
	const today = dayString(new Date());
	if (state.lastActivityDay !== today) {
		const yesterday = dayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
		state.streak = state.lastActivityDay === yesterday ? state.streak + 1 : 1;
		state.itemsToday = 0;
	}
	state.lastActivityDay = today;
}

function itemRecord(id) {
	if (!Object.hasOwn(state.items, id)) state.items[id] = { seen: 0, correct: 0 };
	return state.items[id];
}

// Screens.

function showScreen(name) {
	for (const screen of ['home', 'lesson', 'complete', 'dictionary'])
		document.getElementById('screen-' + screen).classList.toggle('hide', screen !== name);
}

function goHome() {
	lesson = null;
	renderHome();
	showScreen('home');
}

// Home screen: a Duolingo-style path of units.

function unitLessonCount(unit) {
	return Math.ceil(unit.items.length / LESSON_NEW_ITEMS);
}

function unitLessonsDone(unitId) {
	return state.units[unitId] ? state.units[unitId].lessonsDone : 0;
}

function unitIsComplete(unit) {
	return unitLessonsDone(unit.id) >= unitLessonCount(unit);
}

// Units unlock in course order, as each previous unit is finished.
function unitIsUnlocked(index) {
	return index === 0 || unitIsComplete(COURSE[index - 1]);
}

function currentUnit() {
	for (let i = 0; i < COURSE.length; i++) {
		if (unitIsUnlocked(i) && !unitIsComplete(COURSE[i])) return COURSE[i];
	}
	return null;
}

function renderHome() {
	const listEl = document.getElementById('unit-list');
	listEl.textContent = '';

	COURSE.forEach((unit, index) => {
		const complete = unitIsComplete(unit);
		const unlocked = unitIsUnlocked(index);

		const card = document.createElement('div');
		card.className = 'unit-card' + (complete ? ' complete' : unlocked ? ' unlocked' : ' locked');

		const icon = document.createElement('span');
		icon.className = 'material-icons unit-icon';
		icon.textContent = complete ? 'check_circle' : unlocked ? 'play_circle' : 'lock';
		card.appendChild(icon);

		const info = document.createElement('div');
		info.className = 'unit-info';
		const title = document.createElement('div');
		title.className = 'unit-title';
		title.textContent = unit.title;
		const meta = document.createElement('div');
		meta.className = 'unit-meta';
		meta.textContent = complete
			? unit.items.length + ' words · tap to review'
			: unitLessonsDone(unit.id) + ' / ' + unitLessonCount(unit) + ' lessons · ' + unit.items.length + ' words';
		info.appendChild(title);
		info.appendChild(meta);
		card.appendChild(info);

		if (unlocked) card.addEventListener('click', () => startUnitLesson(unit, complete));
		listEl.appendChild(card);
	});

	const dailyButton = document.getElementById('daily-lesson');
	const unit = currentUnit();
	if (unit) {
		dailyButton.textContent = "Start today's lesson · " + unit.title;
		dailyButton.disabled = false;
	} else {
		dailyButton.textContent = 'Course complete! Tap any unit to review';
		dailyButton.disabled = true;
	}
}

// Lesson engine. A lesson is a queue of exercises; missed ones are re-queued at the end.

function startDailyLesson() {
	const unit = currentUnit();
	if (unit) startUnitLesson(unit, false);
}

function startUnitLesson(unit, review) {
	let items;
	if (review) {
		items = shuffleArray(unit.items.slice()).slice(0, LESSON_NEW_ITEMS);
	} else {
		const done = unitLessonsDone(unit.id);
		items = unit.items.slice(done * LESSON_NEW_ITEMS, (done + 1) * LESSON_NEW_ITEMS);
	}

	lesson = {
		unitId: unit.id,
		review: !!review,
		queue: buildExercises(items),
		index: 0,
		answered: false,
		firstTryCorrect: 0,
		baseCount: 0,
	};
	lesson.baseCount = lesson.queue.length;

	showScreen('lesson');
	renderExercise();
}

function buildExercises(items) {
	const exercises = [];
	for (const item of items) {
		exercises.push({ item: item, dir: 'np-en' });
		exercises.push({ item: item, dir: 'en-np' });
	}
	shuffleArray(exercises);

	// Best effort: avoid showing the same item twice in a row.
	for (let i = 1; i < exercises.length; i++) {
		if (exercises[i].item.id === exercises[i - 1].item.id) {
			const j = (i + 1) % exercises.length;
			[exercises[i], exercises[j]] = [exercises[j], exercises[i]];
		}
	}
	return exercises;
}

function promptText(item) {
	return item.emoji ? item.emoji + ' ' + item.en : item.en;
}

function renderExercise() {
	const ex = lesson.queue[lesson.index];
	lesson.answered = false;

	document.getElementById('lesson-progress-fill').style.width =
		Math.round((lesson.index / lesson.queue.length) * 100) + '%';
	document.getElementById('lesson-feedback').classList.add('hide');

	const labelEl = document.getElementById('exercise-label');
	const wordEl = document.getElementById('exercise-word');
	const pronEl = document.getElementById('exercise-pronounce');

	if (ex.dir === 'np-en') {
		labelEl.textContent = 'Select the correct meaning';
		wordEl.textContent = ex.item.np;
		pronEl.textContent = ex.item.pron;
	} else {
		labelEl.textContent = 'Select the Nepali';
		wordEl.textContent = promptText(ex.item);
		pronEl.textContent = '';
	}

	const choiceText = ex.dir === 'np-en' ? (item) => item.en : (item) => item.np;
	const choices = shuffleArray([ex.item].concat(getDistractors(ex.item, choiceText)));

	const choiceEls = document.getElementById('exercise-choices').getElementsByTagName('button');
	let index = 0;
	for (const choiceEl of choiceEls) {
		choiceEl.textContent = choiceText(choices[index]);
		choiceEl.dataset.status = choices[index].id === ex.item.id ? 'correct' : 'incorrect';
		choiceEl.className = '';
		index++;
	}
}

// Three wrong answers: same unit preferred, never with display text matching the
// correct answer (several items share a meaning, e.g. "Very good / Excellent").
function getDistractors(item, choiceText) {
	const unit = COURSE.find((u) => u.items.includes(item));
	const pool = shuffleArray(unit.items.slice())
		.concat(shuffleArray(COURSE.filter((u) => u.kind === unit.kind).flatMap((u) => u.items)))
		.concat(shuffleArray(COURSE.flatMap((u) => u.items)));

	const distractors = [];
	const usedTexts = [choiceText(item).toLowerCase()];
	for (const candidate of pool) {
		if (distractors.length === 3) break;
		const text = choiceText(candidate).toLowerCase();
		if (candidate.id === item.id || usedTexts.includes(text)) continue;
		distractors.push(candidate);
		usedTexts.push(text);
	}
	return distractors;
}

function answerExercise(e) {
	if (lesson.answered) return;
	lesson.answered = true;

	const ex = lesson.queue[lesson.index];
	const correct = e.target.dataset.status === 'correct';

	const choiceEls = document.getElementById('exercise-choices').getElementsByTagName('button');
	for (const choiceEl of choiceEls) {
		if (choiceEl.dataset.status === 'correct') choiceEl.classList.add('correct');
		else if (choiceEl === e.target) choiceEl.classList.add('incorrect');
		else choiceEl.classList.add('unselected');
	}

	// Re-queued exercises were already counted on their first attempt.
	if (!ex.requeued) {
		registerActivity();
		state.itemsToday++;
		state.itemsTotal++;
		const record = itemRecord(ex.item.id);
		record.seen++;
		if (correct) {
			record.correct++;
			lesson.firstTryCorrect++;
		}
	}
	if (!correct && !ex.requeued) lesson.queue.push(Object.assign({}, ex, { requeued: true }));

	const feedbackEl = document.getElementById('lesson-feedback');
	feedbackEl.classList.remove('hide');
	feedbackEl.classList.toggle('correct', correct);
	feedbackEl.classList.toggle('incorrect', !correct);
	document.getElementById('feedback-title').textContent = correct ? 'Correct!' : 'Not quite.';
	document.getElementById('feedback-answer').textContent = correct
		? ''
		: ex.item.np + ' = ' + promptText(ex.item);

	saveState();
	refreshHeader();
}

function continueLesson() {
	lesson.index++;
	if (lesson.index >= lesson.queue.length) finishLesson();
	else renderExercise();
}

function finishLesson() {
	if (!lesson.review) {
		const unit = COURSE.find((u) => u.id === lesson.unitId);
		const done = unitLessonsDone(lesson.unitId);
		state.units[lesson.unitId] = { lessonsDone: Math.min(done + 1, unitLessonCount(unit)) };
		saveState();
	}

	document.getElementById('complete-title').textContent = lesson.review ? 'Review complete!' : 'Lesson complete!';
	document.getElementById('complete-stats').textContent =
		lesson.firstTryCorrect + ' of ' + lesson.baseCount + ' correct on the first try';
	showScreen('complete');
}

// Rendering. Both tables are built from COURSE so the HTML stays a thin shell.

function renderTables() {
	const wordsBody = document.querySelector('#words tbody');
	const vocabBody = document.querySelector('#vocab tbody');

	for (const unit of COURSE) {
		const isPhrases = unit.kind === 'phrases';
		const tbody = isPhrases ? wordsBody : vocabBody;

		const topicRow = document.createElement('tr');
		topicRow.className = 'topic';
		const topicTh = document.createElement('th');
		topicTh.colSpan = 4;
		topicTh.scope = 'rowgroup';
		topicTh.textContent = unit.title;
		topicRow.appendChild(topicTh);
		tbody.appendChild(topicRow);

		for (const item of unit.items) {
			const row = document.createElement('tr');
			const cells = isPhrases
				? [item.np, item.pron, item.en, item.usage]
				: [item.np, item.pron, item.emoji, item.en];
			cells.forEach((text, i) => {
				const cell = document.createElement(i === 0 ? 'th' : 'td');
				cell.textContent = text;
				row.appendChild(cell);
			});
			tbody.appendChild(row);

			if (isPhrases) words.push({ item: item, row: row, topic: unit.title });
		}
	}
}

function refreshHeader() {
	const controlsEl = document.getElementById('controls');
	const progressEl = document.getElementById('progress');

	if (state.name) {
		progressEl.classList.remove('loading');
		controlsEl.classList.add('loading');
		document.getElementById('name').textContent = state.name;
		document.getElementById('streak').textContent = state.streak;
		document.getElementById('words-today').textContent = state.itemsToday;
		document.getElementById('words-all-time').textContent = state.itemsTotal;
	} else {
		controlsEl.classList.remove('loading');
		progressEl.classList.add('loading');
	}
}

function saveName() {
	state.name = document.getElementById('name-field').value;
	saveState();
	refreshHeader();
}

// Word table interactions.

function toggleWord(e) {
	const rowEl = e.target.parentNode;
	if (rowEl.classList.contains('topic')) {
		const rows = document.getElementById('words').getElementsByTagName('tr');
		if (rowEl.classList.contains('solo')) {
			soloTopic = '';
			for (const row of rows) row.classList.remove('solo');
		} else {
			soloTopic = rowEl.children[0].textContent;
			for (const row of rows) row.classList.remove('solo');
			rowEl.classList.add('solo');
		}
		return;
	}
	if (!rowEl.parentNode || rowEl.classList.contains('header')) return;

	const delta = rowEl.classList.contains('complete') ? -1 : 1;
	registerActivity();
	state.itemsToday += delta;
	state.itemsTotal += delta;
	rowEl.classList.toggle('complete');
	saveState();
	refreshHeader();
}

function markWord(word) {
	word.row.classList.add('complete');
	registerActivity();
	state.itemsToday++;
	state.itemsTotal++;
	saveState();
	refreshHeader();
}

// Flashcard logic.

function openFlashcard() {
	mode = 'flashcard';
	checkIndexForTopic();
	loadWord();

	document.getElementById('flashcard').classList.remove('hide');
	document.getElementById('flashcard-content').classList.remove('hide');
	document.getElementById('quiz-content').classList.add('hide');
}

function close() {
	mode = '';
	document.getElementById('flashcard').classList.add('hide');
}

function next() {
	if (mode === 'flashcard') {
		wordIndex++;
		if (wordIndex >= words.length) wordIndex = 0;
		checkIndexForTopic();
		loadWord();
	} else {
		loadQuizWord();
	}
}

function prev() {
	if (mode === 'flashcard') {
		wordIndex--;
		if (wordIndex < 0) wordIndex = words.length - 1;
		checkIndexForTopic(true);
		loadWord();
	} else {
		loadQuizWord();
	}
}

function loadWord() {
	const word = words[wordIndex];
	document.getElementById('flashcard-word').textContent = word.item.np;
	document.getElementById('flashcard-pronounce').textContent = word.item.pron;
	document.getElementById('flashcard-meaning').textContent = word.item.en;
	document.getElementById('flashcard-usage').textContent = word.item.usage;
	markWord(word);
}

// Ensure we're within the range of the selected topic if in solo mode.
function checkIndexForTopic(goToEnd) {
	if (soloTopic === '') return;

	if (words[wordIndex].topic !== soloTopic) {
		if (!goToEnd) {
			for (let i = 0; i < words.length; i++) {
				if (words[i].topic === soloTopic) {
					wordIndex = i;
					break;
				}
			}
		} else {
			for (let i = words.length - 1; i >= 0; i--) {
				if (words[i].topic === soloTopic) {
					wordIndex = i;
					break;
				}
			}
		}
	}
}

// Quiz logic.

function openQuiz() {
	mode = 'quiz';
	loadQuizWord();

	document.getElementById('flashcard').classList.remove('hide');
	document.getElementById('flashcard-content').classList.add('hide');
	document.getElementById('quiz-content').classList.remove('hide');
}

function loadQuizWord() {
	const quizChoiceEls = document.getElementById('quiz-choices').getElementsByTagName('button');

	const word = getRandomWord();
	const choices = [word];
	choices.push(getRandomWord(choices));
	choices.push(getRandomWord(choices));
	choices.push(getRandomWord(choices));
	shuffleArray(choices);

	currentQuizItem = word.item;
	document.getElementById('quiz-word').textContent = word.item.np;
	document.getElementById('quiz-pronounce').textContent = word.item.pron;

	let index = 0;
	for (const choiceEl of quizChoiceEls) {
		choiceEl.textContent = choices[index].item.en;
		choiceEl.dataset.status = word.item.id === choices[index].item.id ? 'correct' : 'incorrect';
		choiceEl.className = '';
		index++;
	}

	markWord(word);
	itemRecord(word.item.id).seen++;
	saveState();
}

function checkChoice(e) {
	const quizChoiceEls = document.getElementById('quiz-choices').getElementsByTagName('button');
	for (const choiceEl of quizChoiceEls) {
		if (choiceEl.dataset.status === 'correct') choiceEl.classList.add('correct');
	}

	if (e.target.classList.contains('correct')) {
		itemRecord(currentQuizItem.id).correct++;
	} else {
		e.target.classList.add('incorrect');
	}
	saveState();
}

function getRandomWord(alreadySelectedWords) {
	let word = words[Math.floor(Math.random() * words.length)];
	// Stay within the topic in solo mode, and avoid words already chosen for this question.
	while ((soloTopic !== '' && word.topic !== soloTopic) || (alreadySelectedWords && alreadySelectedWords.includes(word)))
		word = words[Math.floor(Math.random() * words.length)];

	return word;
}

function shuffleArray(array) {
	let currentIndex = array.length,
		randomIndex;

	while (currentIndex !== 0) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}

	return array;
}
