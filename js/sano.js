// App logic for the Nepali study guide. Course content lives in js/data.js (COURSE).

const STATE_KEY = 'sano.state.v1';
const LESSON_NEW_ITEMS = 5; // Items per unit lesson; each new item yields two exercises
const DAILY_NEW_ITEMS = 4;
const DAILY_REVIEW_ITEMS = 6;
const MAX_LEVEL = 4;
const REVIEW_INTERVALS = [1, 1, 3, 7, 14]; // Days until an item at this level is due for review

let state;
let words = []; // Flat list of phrase items (the #words table) used by flashcards and the quiz.
let wordIndex = 0;
let mode = '';
let soloTopic = '';
let currentQuizItem = null;
let lesson = null;
let matchState = null;
let pathRevealed = false;

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
	document.getElementById('flashcard-card').addEventListener('click', flipCard);

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

	document.getElementById('exercise-check').addEventListener('click', checkExercise);
	const typeInput = document.getElementById('type-answer');
	typeInput.addEventListener('input', () => {
		document.getElementById('exercise-check').disabled = typeInput.value.trim() === '';
	});
	typeInput.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter' || !lesson) return;
		if (lesson.answered) continueLesson();
		else if (typeInput.value.trim() !== '') checkExercise();
	});

	refreshHeader();
	renderHome();
	SanoSync.init();
	SanoPush.init();

	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW register failed:', err));
	}

	let resizeTimer;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			if (!document.getElementById('screen-home').classList.contains('hide')) renderPath();
		}, 150);
	});
});

// State management. All progress lives in a single versioned LocalStorage entry.

function defaultState() {
	return {
		version: 2,
		name: null,
		streak: 0,
		lastActivityDay: null,
		itemsToday: 0,
		itemsTotal: 0,
		items: {}, // item id -> { seen, correct, level, lastSeen, intro }
	};
}

function loadState() {
	let parsed = null;
	const raw = localStorage.getItem(STATE_KEY);
	if (raw) {
		try {
			parsed = JSON.parse(raw);
		} catch (e) {
			console.error('Could not parse saved state, starting fresh', e);
		}
	}
	if (!parsed) parsed = migrateLegacyState();
	if (!parsed) return defaultState();
	return normalizeState(parsed);
}

// Fills in any missing fields (also used on state blobs arriving from the server).
function normalizeState(parsed) {
	if (parsed.version === 1) parsed = migrateV1State(parsed);
	const loaded = Object.assign(defaultState(), parsed);
	for (const id in loaded.items) loaded.items[id] = Object.assign({ seen: 0, correct: 0, level: 0, lastSeen: null, intro: false }, loaded.items[id]);
	return loaded;
}

// Adopt the server's copy (called by sync.js). Mid-session this only happens
// after a conflict with another device; refresh whatever is on screen.
function applyServerState(serverState) {
	state = normalizeState(serverState);
	localStorage.setItem(STATE_KEY, JSON.stringify(state)); // not saveState(): must not re-mark dirty
	refreshHeader();
	if (!document.getElementById('screen-home').classList.contains('hide')) renderHome();
}

// v1 tracked unit progress as a count of completed 5-item lessons; v2 marks each
// introduced item directly on its record instead.
function migrateV1State(old) {
	old.version = 2;
	old.items = old.items || {};
	for (const unitId in old.units || {}) {
		const unit = COURSE.find((u) => u.id === unitId);
		if (!unit) continue;
		const introduced = unit.items.slice(0, (old.units[unitId].lessonsDone || 0) * LESSON_NEW_ITEMS);
		for (const item of introduced) {
			const record = Object.assign({ seen: 0, correct: 0, level: 0, lastSeen: null }, old.items[item.id]);
			record.intro = true;
			record.level = Math.max(record.level, 1);
			record.lastSeen = record.lastSeen || old.lastActivityDay;
			old.items[item.id] = record;
		}
	}
	delete old.units;
	localStorage.setItem(STATE_KEY, JSON.stringify(old));
	console.log('Migrated state to version 2');
	return old;
}

function saveState() {
	localStorage.setItem(STATE_KEY, JSON.stringify(state));
	SanoSync.markDirty();
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
	for (const key of ['name', 'streak', 'itemsCompletedToday', 'totalItemsCompleted', 'lastActivity', 'wordRecord']) localStorage.removeItem(key);

	console.log('Migrated legacy progress to ' + STATE_KEY);
	return migrated;
}

function dayString(date) {
	return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
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
	if (!Object.hasOwn(state.items, id)) state.items[id] = { seen: 0, correct: 0, level: 0, lastSeen: null, intro: false };
	return state.items[id];
}

// Spaced repetition (Leitner). Items climb a level when answered correctly in a
// lesson and drop a level when missed; each level has a longer review interval.

function daysSince(day) {
	if (!day) return Infinity;
	const now = new Date();
	const [y, m, d] = day.split('-').map(Number);
	return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000);
}

function isDue(record) {
	return record.intro && daysSince(record.lastSeen) >= REVIEW_INTERVALS[record.level];
}

function overdueDays(item) {
	const record = state.items[item.id];
	return daysSince(record.lastSeen) - REVIEW_INTERVALS[record.level];
}

function dueItems() {
	const due = [];
	for (const unit of COURSE) {
		for (const item of unit.items) {
			const record = state.items[item.id];
			if (record && isDue(record)) due.push(item);
		}
	}
	return due.sort((a, b) => overdueDays(b) - overdueDays(a));
}

function unitNewItems(unit) {
	return unit.items.filter((item) => !(state.items[item.id] && state.items[item.id].intro));
}

function unitDueCount(unit) {
	return unit.items.filter((item) => state.items[item.id] && isDue(state.items[item.id])).length;
}

// Screens.

function showScreen(name) {
	for (const screen of ['home', 'lesson', 'complete', 'dictionary'])
		document.getElementById('screen-' + screen).classList.toggle('hide', screen !== name);
}

function goHome() {
	lesson = null;
	// Show the screen first so the path can measure its real width.
	showScreen('home');
	renderHome();
}

// Home screen: a Duolingo-style path of units.

function unitIsComplete(unit) {
	return unitNewItems(unit).length === 0;
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

const PATH_SECTIONS = {
	basics: 'Foundations',
	meals: 'Around the table',
	'household-living': 'Around the house',
	purchasing: 'Out and about',
	'bedroom-items': 'Building vocabulary',
};

function renderHome() {
	renderPath();

	const dailyButton = document.getElementById('daily-lesson');
	const unit = currentUnit();
	const newCount = unit ? Math.min(unitNewItems(unit).length, DAILY_NEW_ITEMS) : 0;
	const reviewCount = Math.min(dueItems().length, DAILY_REVIEW_ITEMS);
	if (newCount + reviewCount > 0) {
		const parts = [];
		if (newCount > 0) parts.push(newCount + ' new');
		if (reviewCount > 0) parts.push(reviewCount + ' review');
		dailyButton.textContent = "Start today's lesson · " + parts.join(' + ');
		dailyButton.disabled = false;
	} else {
		dailyButton.textContent = 'All caught up! Come back tomorrow';
		dailyButton.disabled = true;
	}
}

// The Duolingo-style winding path. All geometry is computed here so it can
// adapt to the container width; CSS handles colors and type.
function renderPath() {
	const wrap = document.getElementById('path');
	wrap.textContent = '';

	const width = wrap.clientWidth || 560;
	// Match the CSS breakpoint exactly so geometry and styling switch together.
	const compact = window.matchMedia('(max-width: 520px)').matches;
	const nodeSize = compact ? 64 : 76;
	const step = compact ? 108 : 124;
	const labelGap = 22;
	// Labels may spill outside the path column into page margins, but must stay
	// inside the viewport: shrink the curve, then the labels, when space is tight.
	const halfSpan = window.innerWidth / 2 - 12;
	let amplitude, labelWidth;
	if (compact) {
		amplitude = Math.min(140, width * 0.27 + 10);
		labelWidth = Math.max(86, width / 2 - amplitude - nodeSize / 2 - labelGap - 2);
	} else {
		amplitude = Math.min(140, width * 0.27 + 10, Math.max(72, halfSpan - nodeSize / 2 - labelGap - 150));
		labelWidth = Math.min(150, Math.max(86, halfSpan - amplitude - nodeSize / 2 - labelGap));
	}
	const center = width / 2;
	const current = currentUnit();

	// ~5 nodes per sine cycle keeps the road flowing rather than zigzagging;
	// phase-shifted so the path starts at the left edge.
	const WAVE = 1.2;
	const xAt = (i) => center + Math.sin(i * WAVE - Math.PI / 2) * amplitude;

	let y = 30;
	const centers = [];

	COURSE.forEach((unit, index) => {
		const complete = unitIsComplete(unit);
		const isCurrent = unit === current;
		const angle = index * WAVE - Math.PI / 2;

		if (PATH_SECTIONS[unit.id]) {
			const section = document.createElement('div');
			section.className = 'path-section';
			section.textContent = PATH_SECTIONS[unit.id];
			section.style.top = y + 'px';
			wrap.appendChild(section);
			y += compact ? 56 : 64;
			// The START bubble extends above the current node; keep it clear of the banner.
			if (isCurrent) y += 34;
		}
		const status = complete ? 'complete' : isCurrent ? 'current' : 'locked';
		const x = xAt(index);
		centers.push({ y: y + nodeSize / 2, complete: complete });

		if (isCurrent) {
			const ringSize = nodeSize + 20;
			const introduced = unit.items.length - unitNewItems(unit).length;
			const ring = document.createElement('div');
			ring.className = 'path-ring';
			ring.style.width = ringSize + 'px';
			ring.style.height = ringSize + 'px';
			ring.style.left = x - ringSize / 2 + 'px';
			ring.style.top = y + nodeSize / 2 - ringSize / 2 + 'px';
			ring.style.background =
				'conic-gradient(var(--accent) ' + Math.round((introduced / unit.items.length) * 100) + '%, var(--border-color) 0)';
			const mask = 'radial-gradient(circle, transparent ' + (nodeSize / 2 + 4) + 'px, black ' + (nodeSize / 2 + 5) + 'px)';
			ring.style.webkitMask = mask;
			ring.style.mask = mask;
			wrap.appendChild(ring);

			const start = document.createElement('div');
			start.className = 'path-start';
			start.textContent = 'START';
			start.style.left = x + 'px';
			start.style.top = y - (compact ? 48 : 54) + 'px';
			wrap.appendChild(start);
		}

		const node = document.createElement('button');
		node.type = 'button';
		node.className = 'path-node ' + status;
		node.style.width = nodeSize + 'px';
		node.style.height = nodeSize + 'px';
		node.style.left = x - nodeSize / 2 + 'px';
		node.style.top = y + 'px';
		node.title = unit.title;
		const icon = document.createElement('span');
		icon.className = 'icon';
		const svgNS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(svgNS, 'svg');
		const use = document.createElementNS(svgNS, 'use');
		use.setAttribute('href', '#i-' + (complete ? 'check' : isCurrent ? 'play_arrow' : 'lock'));
		svg.appendChild(use);
		icon.appendChild(svg);
		node.appendChild(icon);

		const due = complete ? unitDueCount(unit) : 0;
		if (due > 0) {
			const badge = document.createElement('span');
			badge.className = 'path-badge';
			badge.textContent = due;
			node.appendChild(badge);
		}
		if (complete || isCurrent) node.addEventListener('click', () => startUnitLesson(unit, complete));
		wrap.appendChild(node);

		const onLeft = Math.sin(angle) > 0;
		const label = document.createElement('div');
		label.className = 'path-label ' + (onLeft ? 'left' : 'right') + (status === 'locked' ? ' locked-label' : '');
		label.style.width = labelWidth + 'px';
		label.style.top = y + (compact ? 10 : 16) + 'px';
		label.style.left = (onLeft ? x - nodeSize / 2 - labelWidth - labelGap : x + nodeSize / 2 + labelGap) + 'px';

		const title = document.createElement('div');
		title.textContent = unit.title;
		const meta = document.createElement('small');
		meta.textContent = complete
			? unit.items.length + ' words'
			: unit.items.length - unitNewItems(unit).length + ' / ' + unit.items.length + ' words';
		label.appendChild(title);
		label.appendChild(meta);
		wrap.appendChild(label);

		y += step;
	});

	wrap.style.height = y + 30 + 'px';

	// Stagger a top-to-bottom reveal, but only on the very first render:
	// returning home or resizing rebuilds the path and shouldn't replay it.
	if (!pathRevealed) {
		pathRevealed = true;
		wrap.classList.add('reveal');
		for (const el of wrap.children) el.style.animationDelay = Math.max(0, Math.min(parseFloat(el.style.top) * 0.55, 700)) + 'ms';
	} else {
		wrap.classList.remove('reveal');
	}
}

// Lesson engine. A lesson is a queue of exercises; missed ones are re-queued at the end.

// The daily lesson mixes a few new items from the current unit with the most
// overdue review items from anywhere in the course.
function startDailyLesson() {
	const unit = currentUnit();
	const newItems = unit ? unitNewItems(unit).slice(0, DAILY_NEW_ITEMS) : [];
	const reviewItems = dueItems().slice(0, DAILY_REVIEW_ITEMS);
	if (newItems.length + reviewItems.length === 0) return;
	startLesson(buildExercises(newItems, reviewItems));
}

function startUnitLesson(unit, review) {
	const items = review ? shuffleArray(unit.items.slice()).slice(0, LESSON_NEW_ITEMS) : unitNewItems(unit).slice(0, LESSON_NEW_ITEMS);
	startLesson(buildExercises(items, []));
}

function startLesson(queue) {
	lesson = {
		queue: queue,
		index: 0,
		answered: false,
		firstTryCorrect: 0,
		// A matching exercise covers several items, so stats count items rather than exercises.
		statTotal: queue.reduce((n, ex) => n + (ex.items ? ex.items.length : 1), 0),
		levelAdjusted: {},
		leveledUp: 0,
		firstOfDay: state.lastActivityDay !== dayString(new Date()),
	};
	showScreen('lesson');
	renderExercise();
}

// New items are drilled with multiple choice in both directions. Review items get
// harder types as they level up: multiple choice at low levels, then word bank
// (multi-word phrases) or typing (single words). Low-level vocab reviews are
// bundled into a single matching exercise when there are enough of them.
function buildExercises(newItems, reviewItems) {
	const exercises = [];
	for (const item of newItems) {
		exercises.push({ item: item, type: 'choice', dir: 'np-en' });
		exercises.push({ item: item, type: 'choice', dir: 'en-np' });
	}

	const matchable = reviewItems.filter((item) => item.emoji && itemRecord(item.id).level <= 1);
	const matchItems = matchable.length >= 4 ? matchable.slice(0, 5) : [];

	for (const item of reviewItems) {
		if (matchItems.includes(item)) continue;
		if (itemRecord(item.id).level >= 2) {
			if (item.np.split(/\s+/).length >= 2) exercises.push({ item: item, type: 'wordbank' });
			else exercises.push({ item: item, type: 'type' });
		} else {
			exercises.push({ item: item, type: 'choice', dir: Math.random() < 0.5 ? 'np-en' : 'en-np' });
		}
	}
	shuffleArray(exercises);

	// Best effort: avoid showing the same item twice in a row.
	for (let i = 1; i < exercises.length; i++) {
		if (exercises[i].item && exercises[i - 1].item && exercises[i].item.id === exercises[i - 1].item.id) {
			const j = (i + 1) % exercises.length;
			[exercises[i], exercises[j]] = [exercises[j], exercises[i]];
		}
	}

	if (matchItems.length > 0) exercises.splice(Math.floor(Math.random() * (exercises.length + 1)), 0, { type: 'match', items: matchItems });
	return exercises;
}

function promptText(item) {
	return item.emoji ? item.emoji + ' ' + item.en : item.en;
}

function renderExercise() {
	const ex = lesson.queue[lesson.index];
	lesson.answered = false;

	document.getElementById('lesson-progress-fill').style.width = Math.round((lesson.index / lesson.queue.length) * 100) + '%';
	document.getElementById('lesson-feedback').classList.add('hide');

	// Restart the slide-in animation for each new exercise.
	const bodyEl = document.getElementById('exercise-body');
	bodyEl.classList.remove('slide-in');
	void bodyEl.offsetWidth;
	bodyEl.classList.add('slide-in');

	document.getElementById('exercise-choices').classList.toggle('hide', ex.type !== 'choice');
	document.getElementById('exercise-wordbank').classList.toggle('hide', ex.type !== 'wordbank');
	document.getElementById('exercise-type').classList.toggle('hide', ex.type !== 'type');
	document.getElementById('exercise-match').classList.toggle('hide', ex.type !== 'match');
	document.getElementById('exercise-check').classList.toggle('hide', ex.type !== 'wordbank' && ex.type !== 'type');

	if (ex.type === 'choice') renderChoice(ex);
	else if (ex.type === 'wordbank') renderWordbank(ex);
	else if (ex.type === 'type') renderType(ex);
	else renderMatch(ex);
}

function setPrompt(label, word, pron) {
	document.getElementById('exercise-label').textContent = label;
	document.getElementById('exercise-word').textContent = word;
	document.getElementById('exercise-pronounce').textContent = pron;
}

function renderChoice(ex) {
	if (ex.dir === 'np-en') setPrompt('Select the correct meaning', ex.item.np, ex.item.pron);
	else setPrompt('Select the Nepali', promptText(ex.item), '');

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

function renderWordbank(ex) {
	setPrompt('Build the Nepali from the tiles', promptText(ex.item), '');

	const answerEl = document.getElementById('wordbank-answer');
	const poolEl = document.getElementById('wordbank-pool');
	answerEl.textContent = '';
	poolEl.textContent = '';

	const tiles = shuffleArray(ex.item.np.split(/\s+/).concat(wordbankDistractors(ex.item)));
	for (const word of tiles) {
		const tile = document.createElement('button');
		tile.type = 'button';
		tile.className = 'wordbank-tile';
		tile.textContent = word;
		tile.addEventListener('click', () => {
			(tile.parentNode === poolEl ? answerEl : poolEl).appendChild(tile);
			document.getElementById('exercise-check').disabled = answerEl.children.length === 0;
		});
		poolEl.appendChild(tile);
	}
	document.getElementById('exercise-check').disabled = true;
}

// A few extra Nepali words from other phrases, so the answer isn't just "use every tile".
function wordbankDistractors(item) {
	const targetWords = item.np.toLowerCase().split(/\s+/);
	const pool = shuffleArray(COURSE.filter((u) => u.kind === 'phrases').flatMap((u) => u.items));

	const distractors = [];
	for (const candidate of pool) {
		if (distractors.length === 3) break;
		for (const word of candidate.np.split(/\s+/)) {
			if (distractors.length === 3) break;
			const cleaned = word.replace(/[?,.!]/g, '');
			if (cleaned === '' || cleaned === '___' || cleaned === '...') continue;
			const lower = cleaned.toLowerCase();
			if (targetWords.includes(lower) || distractors.some((w) => w.toLowerCase() === lower)) continue;
			distractors.push(cleaned);
		}
	}
	return distractors;
}

function renderType(ex) {
	setPrompt('Type the Nepali', promptText(ex.item), '');
	const input = document.getElementById('type-answer');
	input.value = '';
	document.getElementById('exercise-check').disabled = true;
	input.focus();
}

function renderMatch(ex) {
	setPrompt('Match the pairs', '', '');
	matchState = { remaining: ex.items.length, missed: {}, selected: { left: null, right: null } };

	const leftEl = document.getElementById('match-left');
	const rightEl = document.getElementById('match-right');
	leftEl.textContent = '';
	rightEl.textContent = '';
	for (const item of shuffleArray(ex.items.slice())) leftEl.appendChild(matchTile(item, 'left', item.np));
	for (const item of shuffleArray(ex.items.slice())) rightEl.appendChild(matchTile(item, 'right', item.en));
}

function matchTile(item, side, text) {
	const tile = document.createElement('button');
	tile.type = 'button';
	tile.className = 'match-tile';
	tile.textContent = text;
	tile.dataset.id = item.id;
	tile.addEventListener('click', () => selectMatchTile(tile, side));
	return tile;
}

function selectMatchTile(tile, side) {
	if (lesson.answered || tile.classList.contains('matched')) return;

	const selected = matchState.selected;
	if (selected[side] === tile) {
		tile.classList.remove('selected');
		selected[side] = null;
		return;
	}
	if (selected[side]) selected[side].classList.remove('selected');
	selected[side] = tile;
	tile.classList.add('selected');
	if (!selected.left || !selected.right) return;

	const left = selected.left;
	const right = selected.right;
	selected.left = selected.right = null;
	left.classList.remove('selected');
	right.classList.remove('selected');

	if (left.dataset.id === right.dataset.id) {
		left.classList.add('matched');
		right.classList.add('matched');
		matchState.remaining--;
		if (matchState.remaining === 0) finishMatch();
	} else {
		matchState.missed[left.dataset.id] = true;
		matchState.missed[right.dataset.id] = true;
		left.classList.add('miss');
		right.classList.add('miss');
		setTimeout(() => {
			left.classList.remove('miss');
			right.classList.remove('miss');
		}, 600);
	}
}

function finishMatch() {
	const ex = lesson.queue[lesson.index];
	lesson.answered = true;
	registerActivity();

	let clean = 0;
	for (const item of ex.items) {
		state.itemsToday++;
		state.itemsTotal++;
		const record = itemRecord(item.id);
		record.seen++;
		record.intro = true;
		record.lastSeen = dayString(new Date());
		const correct = !matchState.missed[item.id];
		if (correct) {
			record.correct++;
			clean++;
			lesson.firstTryCorrect++;
		}
		if (!lesson.levelAdjusted[item.id]) {
			lesson.levelAdjusted[item.id] = true;
			if (correct) {
				record.level = Math.min(record.level + 1, MAX_LEVEL);
				lesson.leveledUp++;
			} else {
				record.level = Math.max(record.level - 1, 0);
			}
		}
	}

	const allClean = clean === ex.items.length;
	showFeedback(allClean, allClean ? 'Correct!' : clean + ' of ' + ex.items.length + ' matched without a miss', '');
	saveState();
	refreshHeader();
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

	const ex = lesson.queue[lesson.index];
	const correct = e.target.dataset.status === 'correct';

	const choiceEls = document.getElementById('exercise-choices').getElementsByTagName('button');
	for (const choiceEl of choiceEls) {
		if (choiceEl.dataset.status === 'correct') choiceEl.classList.add('correct');
		else if (choiceEl === e.target) choiceEl.classList.add('incorrect');
		else choiceEl.classList.add('unselected');
	}

	applyAnswer(ex, correct);
}

function checkExercise() {
	if (lesson.answered) return;

	const ex = lesson.queue[lesson.index];
	let given;
	if (ex.type === 'wordbank') {
		given = Array.from(document.getElementById('wordbank-answer').children)
			.map((tile) => tile.textContent)
			.join(' ');
	} else {
		given = document.getElementById('type-answer').value;
	}
	applyAnswer(ex, lenientEquals(given, ex.item.np, ex.type === 'type'));
}

function applyAnswer(ex, correct) {
	lesson.answered = true;

	// Re-queued exercises were already counted on their first attempt.
	if (!ex.requeued) {
		registerActivity();
		state.itemsToday++;
		state.itemsTotal++;
		const record = itemRecord(ex.item.id);
		record.seen++;
		record.intro = true;
		record.lastSeen = dayString(new Date());
		if (correct) {
			record.correct++;
			lesson.firstTryCorrect++;
		}
		// Move the item one Leitner level per lesson, based on its first exercise.
		if (!lesson.levelAdjusted[ex.item.id]) {
			lesson.levelAdjusted[ex.item.id] = true;
			if (correct) {
				record.level = Math.min(record.level + 1, MAX_LEVEL);
				lesson.leveledUp++;
			} else {
				record.level = Math.max(record.level - 1, 0);
			}
		}
	}
	if (!correct && !ex.requeued) lesson.queue.push(Object.assign({}, ex, { requeued: true }));

	// Always show the full answer for recall exercises; for multiple choice only on a miss.
	const showAnswer = !correct || ex.type === 'wordbank' || ex.type === 'type';
	showFeedback(correct, correct ? 'Correct!' : 'Not quite.', showAnswer ? ex.item.np + ' = ' + promptText(ex.item) : '');

	saveState();
	refreshHeader();
}

function showFeedback(correct, title, answerText) {
	const feedbackEl = document.getElementById('lesson-feedback');
	feedbackEl.classList.remove('hide');
	feedbackEl.classList.toggle('correct', correct);
	feedbackEl.classList.toggle('incorrect', !correct);
	document.getElementById('feedback-title').textContent = title;
	document.getElementById('feedback-answer').textContent = answerText;
}

function normalize(s) {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

// Romanized Nepali spelling varies, so typed answers tolerate small differences.
function lenientEquals(given, expected, allowTypos) {
	const a = normalize(given);
	const b = normalize(expected);
	if (a === b) return true;
	if (!allowTypos) return false;
	const tolerance = b.length > 10 ? 2 : b.length > 4 ? 1 : 0;
	return editDistance(a, b) <= tolerance;
}

function editDistance(a, b) {
	const dp = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(new Array(b.length).fill(0)));
	for (let j = 1; j <= b.length; j++) dp[0][j] = j;
	for (let i = 1; i <= a.length; i++)
		for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
	return dp[a.length][b.length];
}

function continueLesson() {
	lesson.index++;
	if (lesson.index >= lesson.queue.length) finishLesson();
	else renderExercise();
}

function finishLesson() {
	saveState();
	document.getElementById('complete-stats').textContent = lesson.firstTryCorrect + ' of ' + lesson.statTotal + ' correct on the first try';

	const streakEl = document.getElementById('complete-streak');
	streakEl.classList.toggle('hide', !lesson.firstOfDay);
	if (lesson.firstOfDay)
		document.getElementById('complete-streak-text').textContent = state.streak === 1 ? 'Streak started!' : state.streak + ' day streak!';

	const strengthenedEl = document.getElementById('complete-strengthened');
	strengthenedEl.classList.toggle('hide', lesson.leveledUp === 0);
	strengthenedEl.textContent = lesson.leveledUp + (lesson.leveledUp === 1 ? ' word' : ' words') + ' strengthened';

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
			const cells = isPhrases ? [item.np, item.pron, item.en, item.usage] : [item.np, item.pron, item.emoji, item.en];
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

function flipCard() {
	document.getElementById('flashcard-card').classList.toggle('flipped');
}

// Show the front face without animating the flip back.
function snapToFront() {
	const card = document.getElementById('flashcard-card');
	card.classList.add('snap');
	card.classList.remove('flipped');
	void card.offsetWidth; // flush styles so the un-flip isn't transitioned
	card.classList.remove('snap');
}

function loadWord() {
	const word = words[wordIndex];
	snapToFront();
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
