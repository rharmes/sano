var data = {},
	words = [],
	wordIndex = 0,
	mode,
	soloTopic = '';

document.addEventListener('DOMContentLoaded', (event) => {
	const wordsTableEL = document.getElementById('words');
	wordsTableEL.addEventListener('click', toggleWord);

	const submitButton = document.getElementById('submit');
	submitButton.addEventListener('click', saveName);

	const openFlashcardsEl = document.getElementById('open-flashcards');
	openFlashcardsEl.addEventListener('click', openFlashcard);

	const openQuizEl = document.getElementById('open-quiz');
	openQuizEl.addEventListener('click', openQuiz);

	const closeFlashcardsEl = document.getElementById('flashcard-close');
	closeFlashcardsEl.addEventListener('click', close);

	const nextFlashcardEl = document.getElementById('flashcard-next');
	nextFlashcardEl.addEventListener('click', next);

	const prevFlashcardEl = document.getElementById('flashcard-prev');
	prevFlashcardEl.addEventListener('click', prev);

	const quizChoiceEls = document.getElementById('quiz-choices').getElementsByTagName('button');
	for (const choiceEl of quizChoiceEls) choiceEl.addEventListener('click', checkChoice);

	//	localStorage.setItem('itemsCompletedToday', 51);
	//	localStorage.setItem('totalItemsCompleted', 1351);

	pullDataAndRefresh();
	loadWords();
});

function resetWords(e) {
	const wordEls = document.querySelectorAll('#words tr');
	for (const el of wordEls) el.classList.remove('complete');
}

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
		console.log('Solo topic: ' + soloTopic);
		return;
	}

	if (rowEl.classList.contains('complete')) {
		setKey('itemsCompletedToday', data.itemsCompletedToday - 1);
		setKey('totalItemsCompleted', data.totalItemsCompleted - 1);
	} else {
		setKey('itemsCompletedToday', data.itemsCompletedToday + 1);
		setKey('totalItemsCompleted', data.totalItemsCompleted + 1);
	}
	toggleClass(rowEl, 'complete');
	pullDataAndRefresh();
}

function markWord(rowEl) {
	rowEl.classList.add('complete');
	setKey('itemsCompletedToday', data.itemsCompletedToday + 1);
	setKey('totalItemsCompleted', data.totalItemsCompleted + 1);
	pullDataAndRefresh();
}

function saveName(e) {
	setKey('name', document.getElementById('name-field').value);
	setKey('streak', 0);
	setKey('itemsCompletedToday', 0);
	setKey('totalItemsCompleted', 0);
	pullDataAndRefresh();
}

function toggleClass(el, className) {
	el.classList.contains(className) ? el.classList.remove(className) : el.classList.add(className);
}

function setKey(key, value) {
	if (!localStorage) return;
	localStorage.setItem(key, value);

	const updateTime = new Date();
	checkStreak(updateTime);
	localStorage.setItem('lastActivity', updateTime.getTime());
	data.lastActivity = updateTime;
}

function checkStreak(updateTime) {
	if (!data || !data.lastActivity) return;
	if (updateTime.getDate() !== data.lastActivity.getDate()) {
		// Increment streak count.
		localStorage.setItem('streak', data.streak + 1);
		'Updating streak to ' + (data.streak + 1);

		// Reset daily word count.
		localStorage.setItem('itemsCompletedToday', 0);
	}
}

// Data from localStorage, if the user choses to save their progress.

function pullDataAndRefresh() {
	if (!localStorage) return;

	const controlsEl = document.getElementById('controls');
	const progressEl = document.getElementById('progress');
	const nameEl = document.getElementById('name');
	const streakEl = document.getElementById('streak');
	const wordsTodayEl = document.getElementById('words-today');
	const wordsAllTimeEl = document.getElementById('words-all-time');

	data = {
		name: localStorage.getItem('name'),
		streak: parseInt(localStorage.getItem('streak'), 10),
		itemsCompletedToday: parseInt(localStorage.getItem('itemsCompletedToday'), 10),
		totalItemsCompleted: parseInt(localStorage.getItem('totalItemsCompleted'), 10),
		lastActivity: new Date(parseInt(localStorage.getItem('lastActivity'), 10)),
	};

	data.wordRecord = localStorage.getItem('wordRecord') ? JSON.parse(localStorage.getItem('wordRecord')) : {};

	if (data.name && progressEl && nameEl) {
		progressEl.classList.remove('loading');
		controlsEl.classList.add('loading');
		nameEl.textContent = data.name;
		streakEl.textContent = data.streak;
		wordsTodayEl.textContent = data.itemsCompletedToday;
		wordsAllTimeEl.textContent = data.totalItemsCompleted;
	} else if (controlsEl) {
		controlsEl.classList.remove('loading');
		progressEl.classList.add('loading');
	} else {
		console.log('No elements found');
	}
}

function saveWordRecord() {
	localStorage.setItem('wordRecord', JSON.stringify(data.wordRecord));
}

// Flashcard logic

function loadWords() {
	const tableEl = document.getElementById('words');
	const rows = tableEl.getElementsByTagName('tr');
	let topic = '';

	for (const row of rows) {
		if (row.classList.contains('header')) continue;
		if (row.classList.contains('topic')) {
			topic = row.children[0].textContent;
			continue;
		}
		words.push({
			row: row,
			word: row.children[0].textContent,
			pronounce: row.children[1].textContent,
			meaning: row.children[2].textContent,
			usage: row.children[3].textContent,
			topic: topic,
		});
	}
}

function openFlashcard() {
	mode = 'flashcard';
	checkIndexForTopic();
	loadWord();

	var flashcardEl = document.getElementById('flashcard');
	flashcardEl.classList.remove('hide');

	var flashcardContentEl = document.getElementById('flashcard-content');
	flashcardContentEl.classList.remove('hide');

	var quizContentEl = document.getElementById('quiz-content');
	quizContentEl.classList.add('hide');
}

function close() {
	console.log('close');
	mode = '';

	var flashcardEl = document.getElementById('flashcard');
	flashcardEl.classList.add('hide');
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
	const wordEl = document.getElementById('flashcard-word');
	const pronounceEl = document.getElementById('flashcard-pronounce');
	const meaningEl = document.getElementById('flashcard-meaning');
	const usageEl = document.getElementById('flashcard-usage');
	const word = words[wordIndex];

	wordEl.textContent = word.word;
	pronounceEl.textContent = word.pronounce;
	meaningEl.textContent = word.meaning;
	usageEl.textContent = word.usage;

	markWord(word.row);
}

function checkIndexForTopic(goToEnd) {
	// Ensure we're within the range of a selected topic if in solo mode.
	if (soloTopic === '') return;

	let word = words[wordIndex];
	if (word.topic !== soloTopic) {
		if (!goToEnd) {
			// Jump to the first word of that topic.
			for (let i = 0; i < words.length; i++) {
				if (words[i].topic === soloTopic) {
					wordIndex = i;
					break;
				}
			}
		} else {
			// Jump to the last word of that topic.
			for (let i = words.length - 1; i >= 0; i--) {
				if (words[i].topic === soloTopic) {
					wordIndex = i;
					break;
				}
			}
		}
	}
}

// Quiz logic

function openQuiz() {
	mode = 'quiz';
	loadQuizWord();

	var flashcardEl = document.getElementById('flashcard');
	flashcardEl.classList.remove('hide');

	var flashcardContentEl = document.getElementById('flashcard-content');
	flashcardContentEl.classList.add('hide');

	var quizContentEl = document.getElementById('quiz-content');
	quizContentEl.classList.remove('hide');
}

function loadQuizWord() {
	const quizWordEl = document.getElementById('quiz-word');
	const quizPronounceEl = document.getElementById('quiz-pronounce');
	const quizChoiceEls = document.getElementById('quiz-choices').getElementsByTagName('button');

	const word = getRandomWord();
	const choices = [word];
	choices.push(getRandomWord(choices));
	choices.push(getRandomWord(choices));
	choices.push(getRandomWord(choices));
	shuffleArray(choices);

	quizWordEl.textContent = word.word;
	quizPronounceEl.textContent = word.pronounce;
	let index = 0;
	for (const choiceEl of quizChoiceEls) {
		choiceEl.textContent = choices[index].meaning;
		choiceEl.dataset.status = word.word === choices[index].word ? 'correct' : 'incorrect';
		choiceEl.className = '';
		index++;
	}
	markWord(word.row);
	if (Object.hasOwn(data.wordRecord, word.meaning)) data.wordRecord[word.meaning].seen++;
	else data.wordRecord[word.meaning] = { seen: 1, correct: 0 };
}

function checkChoice(e) {
	const quizChoiceEls = document.getElementById('quiz-choices').getElementsByTagName('button');
	let correctWord;

	for (const choiceEl of quizChoiceEls) {
		if (choiceEl.dataset.status === 'correct') {
			choiceEl.classList.add('correct');
			correctWord = choiceEl.textContent;
		}
	}

	console.log(data.wordRecord);

	if (!e.target.classList.contains('correct')) {
		e.target.classList.add('incorrect');
		console.log(
			'X  Incorrect choice. Correct: ' +
				data.wordRecord[correctWord].correct +
				', seen: ' +
				data.wordRecord[correctWord].seen +
				', %: ' +
				Math.round(data.wordRecord[correctWord].correct / data.wordRecord[correctWord].seen)
		);
	} else {
		data.wordRecord[correctWord].correct++;
		console.log(
			'√  Correct choice. Correct: ' +
				data.wordRecord[correctWord].correct +
				', seen: ' +
				data.wordRecord[correctWord].seen +
				', %: ' +
				Math.round(data.wordRecord[correctWord].correct / data.wordRecord[correctWord].seen)
		);
	}
	saveWordRecord();
}

function getRandomWord(alreadySelectedWords) {
	let word = words[Math.floor(Math.random() * words.length)];
	// Ensure the randomly selected word is within the topic if in solo mode, and not already in the array of chosen words.
	while ((soloTopic !== '' && word.topic !== soloTopic) || (alreadySelectedWords && alreadySelectedWords.includes(word)))
		word = words[Math.floor(Math.random() * words.length)];

	return word;
}

function shuffleArray(array) {
	let currentIndex = array.length,
		randomIndex;

	// While there remain elements to shuffle.
	while (currentIndex !== 0) {
		// Pick a remaining element.
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}

	return array;
}
