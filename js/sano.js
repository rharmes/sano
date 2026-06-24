// App logic for the Nepali study guide. Course content lives in js/data.js (COURSE).

const STATE_KEY = 'sano.state.v1';
const LESSON_NEW_ITEMS = 5; // Items per unit lesson; each new item yields two exercises
const DAILY_NEW_ITEMS = 4;
const DAILY_REVIEW_ITEMS = 6;
// --- SR-05 spaced-repetition scheduler (SM-2-lite, pure) -----------------------
// Each item carries its own review interval (days) and ease factor rather than a
// shared Leitner table, so well-known items stretch out while weak ones come back
// sooner. Reviews are graded automatically from how the answer was given: a miss is
// a lapse, a recognition hit is "good", and recalling the word under a harder drill
// (typing, word bank, or listening) is "easy". The block is pure (no DOM or shared
// state) so tools/check-scheduler.mjs can extract and unit-test it.
const MAX_LEVEL = 4; // only clamps a legacy Leitner level when migrating old records
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 2.7;
const EASY_BONUS = 1.3; // extra interval stretch when recalled the hard way
const RECALL_INTERVAL = 3; // at/above this many days, drill by recall not recognition
const GRADE = { LAPSE: 0, GOOD: 1, EASY: 2 };
// Fresh interval ladder; also seeds `interval` from a pre-SR-05 Leitner level.
const LEGACY_LEVEL_INTERVALS = [1, 1, 3, 7, 14];

// An introduced item with no interval yet is due after one day.
function reviewInterval(record) {
	return record.interval > 0 ? record.interval : 1;
}

// Difficulty escalation: a short interval means the item is still being learned
// (recognition / matching); a longer one means it's known well enough for recall.
function isRecallStrength(record) {
	return reviewInterval(record) >= RECALL_INTERVAL;
}

// Advance an item's schedule by a graded review, mutating interval + ease in place.
function scheduleReview(record, grade) {
	if (grade === GRADE.LAPSE) {
		record.ease = Math.max(MIN_EASE, record.ease - 0.2);
		record.interval = 1; // back to daily until it sticks again
		return;
	}
	const iv = reviewInterval(record);
	if (grade === GRADE.EASY) {
		record.ease = Math.min(MAX_EASE, record.ease + 0.15);
		record.interval = iv <= 1 ? 4 : Math.round(iv * record.ease * EASY_BONUS);
	} else {
		record.interval = iv <= 1 ? 2 : Math.round(iv * record.ease); // GOOD
	}
}

// Grade an answered exercise: a miss always lapses; a correct answer scores higher
// the more retrieval it demanded (recall and listening over plain recognition).
function exerciseGrade(ex, correct) {
	if (!correct) return GRADE.LAPSE;
	if (ex.type === 'type' || ex.type === 'wordbank' || ex.listen) return GRADE.EASY;
	return GRADE.GOOD;
}

// Seed an interval from a legacy Leitner level (pre-SR-05 records and dev seeds).
function legacyLevelToInterval(level, intro) {
	return intro ? LEGACY_LEVEL_INTERVALS[Math.min(level || 0, MAX_LEVEL)] : 0;
}
// --- end SR-05 scheduler -------------------------------------------------------

let state;
let lesson = null;
let matchState = null;
let pathRevealed = false;
let speakRecorder = null; // SR-04 lesson speaking step; created in setup
let soundsRecorder = null; // SR-08 sounds drill; shares createRecorder with speak
let soundDrill = null; // SR-08 active drill: { topic, examples, index }

document.addEventListener('DOMContentLoaded', () => {
	state = loadState();

	document.getElementById('words').addEventListener('click', toggleWord);
	document.getElementById('name-form').addEventListener('submit', saveName);

	document.getElementById('nav-home').addEventListener('click', goHome);
	document.getElementById('home-link').addEventListener('click', goHome);
	document.getElementById('nav-dictionary').addEventListener('click', openDictionary);
	document.getElementById('dictionary-link').addEventListener('click', openDictionary);

	document.getElementById('daily-lesson').addEventListener('click', startDailyLesson);
	document.getElementById('lesson-quit').addEventListener('click', goHome);
	document.getElementById('lesson-continue').addEventListener('click', continueLesson);
	document.getElementById('complete-continue').addEventListener('click', goHome);

	document.getElementById('dialogue-quit').addEventListener('click', goHome);
	document.getElementById('dialogue-advance').addEventListener('click', advanceDialogue);
	document.getElementById('dialogue-continue').addEventListener('click', continueDialogue);
	document.getElementById('dialogue-choices').addEventListener('click', answerDialogueQuestion);

	const exerciseChoiceEls = document.getElementById('exercise-choices').getElementsByTagName('button');
	for (const choiceEl of exerciseChoiceEls) choiceEl.addEventListener('click', answerExercise);

	document.getElementById('exercise-check').addEventListener('click', checkExercise);
	speakRecorder = createRecorder({
		recordBtn: 'speak-record',
		recordLabel: 'speak-record-label',
		playBtn: 'speak-play-you',
		recordingLabel: 'Stop recording',
		againLabel: 'Record again',
	});
	document.getElementById('speak-record').addEventListener('click', () => speakRecorder.toggle());
	document.getElementById('speak-play-you').addEventListener('click', () => speakRecorder.play());
	document.getElementById('speak-continue').addEventListener('click', () => {
		speakRecorder.reset();
		continueLesson();
	});

	// SR-08: pronunciation coaching ("Sounds of Nepali").
	soundsRecorder = createRecorder({
		recordBtn: 'sounds-record',
		recordLabel: 'sounds-record-label',
		playBtn: 'sounds-play-you',
		idleLabel: 'Record yourself',
		recordingLabel: 'Stop recording',
		againLabel: 'Record again',
	});
	document.getElementById('sounds-drill-back').addEventListener('click', goHome);
	document.getElementById('sounds-play').addEventListener('click', () => soundDrill && SanoAudio.play(soundDrill.examples[soundDrill.index].id));
	document.getElementById('sounds-record').addEventListener('click', () => soundsRecorder.toggle());
	document.getElementById('sounds-play-you').addEventListener('click', () => soundsRecorder.play());
	document.getElementById('sounds-next').addEventListener('click', advanceSound);
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
	SanoOnboard.maybeStart();

	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW register failed:', err));
	}

	let resizeTimer;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			if (!document.getElementById('screen-home').classList.contains('hide')) renderPath();
			const grid = document.getElementById('exercise-match');
			if (!grid.classList.contains('hide')) fitMatchTiles(grid);
		}, 150);
	});
});

// State management. All progress lives in a single versioned LocalStorage entry.

function defaultState() {
	return {
		version: 2,
		name: null,
		onboarded: false,
		streak: 0,
		streakFreezes: 1, // SR-09: forgiveness days that protect the streak (start 1, cap 2)
		lastActivityDay: null,
		itemsToday: 0,
		itemsTotal: 0,
		items: {}, // item id -> { seen, correct, ease, interval, lastSeen, intro }
		dialoguesDone: {}, // SR-01: which path conversations have been completed
		soundsDone: {}, // SR-08: which pronunciation drills have been completed
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
	for (const id in loaded.items) {
		const record = Object.assign({ seen: 0, correct: 0, lastSeen: null, intro: false }, loaded.items[id]);
		// SR-05: records and dev seeds predating the graded scheduler carry a Leitner
		// `level`; derive a per-item interval/ease from it once, then drop it.
		if (typeof record.interval !== 'number') record.interval = legacyLevelToInterval(record.level, record.intro);
		if (typeof record.ease !== 'number') record.ease = DEFAULT_EASE;
		delete record.level;
		loaded.items[id] = record;
	}
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

// Calendar days from one YYYY-MM-DD day string to another (local midnight to midnight).
function daysBetween(fromDay, toDay) {
	const [fy, fm, fd] = fromDay.split('-').map(Number);
	const [ty, tm, td] = toDay.split('-').map(Number);
	return Math.round((new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / 864e5);
}

// Whether a streak freeze was just spent; the complete screen reads it. Reset per lesson.
let streakFreezeJustUsed = false;

// Called on every completed item: maintains the streak and daily counter. A single
// missed day is forgiven by a "streak freeze" rather than resetting to zero (SR-09).
function registerActivity() {
	const today = dayString(new Date());
	if (state.lastActivityDay !== today) {
		const gap = state.lastActivityDay ? daysBetween(state.lastActivityDay, today) : null;
		if (gap === 1) {
			state.streak += 1;
		} else if (gap === 2 && state.streakFreezes > 0) {
			// Exactly one missed day, and a freeze to cover it: keep the streak going.
			state.streakFreezes -= 1;
			streakFreezeJustUsed = true;
			state.streak += 1;
		} else {
			state.streak = 1;
		}
		// Reward consistency: bank a freeze at each 5-day milestone (capped at 2).
		if (state.streak % 5 === 0) state.streakFreezes = Math.min(2, (state.streakFreezes || 0) + 1);
		state.itemsToday = 0;
	}
	state.lastActivityDay = today;
}

function itemRecord(id) {
	if (!Object.hasOwn(state.items, id)) state.items[id] = { seen: 0, correct: 0, ease: DEFAULT_EASE, interval: 0, lastSeen: null, intro: false };
	return state.items[id];
}

// Spaced repetition (SM-2-lite). Each item tracks its own review interval and ease
// factor (see the pure scheduler block up top); a graded review stretches or resets
// the interval, and an item is due once that interval has elapsed since it was seen.

function daysSince(day) {
	if (!day) return Infinity;
	const now = new Date();
	const [y, m, d] = day.split('-').map(Number);
	return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000);
}

function isDue(record) {
	return record.intro && daysSince(record.lastSeen) >= reviewInterval(record);
}

function overdueDays(item) {
	const record = state.items[item.id];
	return daysSince(record.lastSeen) - reviewInterval(record);
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

// The dictionary's two tables are large, so build them the first time it's opened
// rather than at boot (it starts hidden and many sessions never open it).
let tablesRendered = false;
function openDictionary() {
	if (!tablesRendered) {
		renderTables();
		tablesRendered = true;
	}
	showScreen('dictionary');
}

function showScreen(name) {
	for (const screen of ['onboarding', 'home', 'lesson', 'complete', 'dictionary', 'dialogue', 'sounds'])
		document.getElementById('screen-' + screen).classList.toggle('hide', screen !== name);
}

function goHome() {
	lesson = null;
	if (speakRecorder && speakRecorder.recording) speakRecorder.reset(); // stop the mic if quitting mid-record
	if (soundsRecorder && soundsRecorder.recording) soundsRecorder.reset();
	soundDrill = null;

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

// SR-10 placement / skip-ahead. An experienced learner can start partway in;
// `placeBefore` marks every item in the units ahead of `unitId` as already
// introduced at recall strength, so those units read complete (unlocking the
// chosen start) while spaced reviews still resurface that "known" material over
// the next few days to confirm the self-placement.
function placeBefore(unitId) {
	const idx = COURSE.findIndex((u) => u.id === unitId);
	if (idx <= 0) return; // unknown id, or the first unit — nothing precedes it
	const today = dayString(new Date());
	for (let i = 0; i < idx; i++) {
		for (const item of COURSE[i].items) {
			const r = itemRecord(item.id);
			r.intro = true;
			r.seen = Math.max(r.seen, 1);
			r.correct = Math.max(r.correct, 1);
			r.interval = Math.max(r.interval, RECALL_INTERVAL);
			r.ease = DEFAULT_EASE;
			r.lastSeen = today;
		}
	}
	saveState();
}

// The points a learner can skip ahead to: the start of each path section after
// the first. Each option means "I already know <known>" and starts them at the
// next section. Derived from PATH_SECTIONS so it tracks the course shape.
function placementOptions() {
	const startIds = Object.keys(PATH_SECTIONS);
	const opts = [];
	for (let s = 1; s < startIds.length; s++) {
		const startIdx = COURSE.findIndex((u) => u.id === startIds[s]);
		const knownIdx = COURSE.findIndex((u) => u.id === startIds[s - 1]);
		opts.push({
			startId: startIds[s],
			startSection: PATH_SECTIONS[startIds[s]],
			known: PATH_SECTIONS[startIds[s - 1]],
			blurb: COURSE.slice(knownIdx, startIdx).map((u) => u.title),
		});
	}
	return opts;
}

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

	// Frame the current unit as a real-world "can-do" objective (SR-06).
	const goalEl = document.getElementById('home-goal');
	if (unit && unit.goal) {
		goalEl.textContent = unit.goal;
		goalEl.classList.remove('hide');
	} else {
		goalEl.classList.add('hide');
	}

	// SR-09: if exactly one day was missed but a freeze is banked, reassure the user
	// on the home screen that finishing a lesson will spend it and keep the streak.
	const freezeEl = document.getElementById('home-streak-freeze');
	const gap = state.lastActivityDay ? daysBetween(state.lastActivityDay, dayString(new Date())) : 0;
	if (gap === 2 && state.streakFreezes > 0 && state.streak > 0) {
		document.getElementById('home-streak-freeze-text').textContent =
			'Streak freeze ready — your ' + state.streak + '-day streak is safe. Finish a lesson to use it.';
		freezeEl.classList.remove('hide');
	} else {
		freezeEl.classList.add('hide');
	}
}

// The Duolingo-style winding path. All geometry is computed here so it can
// adapt to the container width; CSS handles colors and type.
// A path conversation unlocks once the unit it follows is complete.
function dialogueUnlocked(dlg) {
	const afterUnit = COURSE.find((u) => u.id === dlg.after);
	return afterUnit ? unitIsComplete(afterUnit) : true;
}

function renderPath() {
	const wrap = document.getElementById('path');
	wrap.textContent = '';

	const width = wrap.clientWidth || 560;
	// Match the CSS breakpoint exactly so geometry and styling switch together.
	const compact = window.matchMedia('(max-width: 520px)').matches;
	const nodeSize = compact ? 64 : 76;
	const step = compact ? 108 : 124;
	const labelGap = 22;
	// Two tuning knobs for the path's feel:
	const SPACING = 0.84; // node-to-node distance along the curve, ×(even-Y step); < 1 = closer
	const SWING = 0.81; // horizontal amplitude multiplier; < 1 = gentler left/right swings
	// Labels may spill outside the path column into page margins, but must stay
	// inside the viewport: shrink the curve, then the labels, when space is tight.
	const halfSpan = window.innerWidth / 2 - 12;
	let amplitude, labelWidth;
	if (compact) {
		// Swing wide — close to the edge — but never let a node clip off-screen.
		amplitude = SWING * Math.min(width / 2 - nodeSize / 2 - 6, width * 0.34 + 12);
		labelWidth = Math.max(86, width / 2 - amplitude - nodeSize / 2 - labelGap - 2);
	} else {
		amplitude = SWING * Math.min(180, width * 0.34 + 12, Math.max(72, halfSpan - nodeSize / 2 - labelGap - 120));
		labelWidth = Math.min(150, Math.max(86, halfSpan - amplitude - nodeSize / 2 - labelGap));
	}
	const center = width / 2;
	const current = currentUnit();

	// The winding curve. Nodes ride a sine wave whose horizontal shape (amplitude +
	// wavelength) is exactly what the path has always had — ~5 nodes per cycle,
	// phase-shifted so it starts at the left edge — but they sit EVENLY ALONG THE CURVE
	// instead of evenly down the Y axis. Picture beads strung at equal intervals, then
	// the string wiggled: the beads keep their spacing along the string, so they bunch
	// closer in Y on the diagonal runs and spread out at the turns. `vWave` is a virtual
	// vertical that only the even-spacing walk advances; section banners / START
	// clearance push the real `y` down without disturbing the horizontal wiggle.
	const WAVE = 1.2;
	const omega = WAVE / step; // spatial frequency (rad/px) — preserves the old wavelength
	const xAtV = (v) => center + Math.sin(omega * (v - 30) - Math.PI / 2) * amplitude;

	// Arc length per node. meanSpeed (= mean |curve velocity| ds/dv over one wave cycle)
	// normalizes the walk so that at SPACING = 1 the average vertical advance equals
	// `step`; the SPACING knob above then scales the node-to-node distance.
	let meanSpeed = 0;
	const SAMPLES = 64;
	for (let k = 0; k < SAMPLES; k++) {
		meanSpeed += Math.hypot(1, amplitude * omega * Math.cos((k / SAMPLES) * 2 * Math.PI));
	}
	meanSpeed /= SAMPLES;
	const arcStep = step * meanSpeed * SPACING;

	// March the virtual vertical until one arc-step of curve length has passed. Arc
	// length is strictly increasing in v, so this is unambiguous (unlike a chord solve).
	const nextV = (v0) => {
		let v = v0;
		let prevX = xAtV(v0);
		let acc = 0;
		for (;;) {
			const nx = xAtV(v + 1);
			const seg = Math.hypot(nx - prevX, 1);
			if (acc + seg >= arcStep) return v + (arcStep - acc) / seg; // land exactly on it
			acc += seg;
			v += 1;
			prevX = nx;
		}
	};

	let y = 30;
	let vWave = 30;
	let currentNodeEl = null; // the in-progress unit's node — centered in the viewport on load
	const anchors = []; // {x, yTop} per node, in order — drives decorative-companion placement
	const bannerBands = []; // {top, bottom} of each full-width section banner, to dodge with companions
	const advance = () => {
		const nv = nextV(vWave);
		y += nv - vWave;
		vWave = nv;
	};
	// Vertically center a label on its node's midpoint, whatever its line count (the node
	// top is the current `y`). Must run after the label is in the DOM with its width set,
	// so the wrapped height is real; falls back to a fixed offset if measured hidden.
	const centerLabel = (label) => {
		const h = label.offsetHeight;
		label.style.top = (h ? y + nodeSize / 2 - h / 2 : y + (compact ? 10 : 16)) + 'px';
	};

	// Weave each section's conversation into the path right after the unit it follows.
	const seq = [];
	for (const unit of COURSE) {
		seq.push({ kind: 'unit', unit: unit });
		const dlg = DIALOGUES.find((d) => d.after === unit.id);
		if (dlg) seq.push({ kind: 'dialogue', dialogue: dlg });
		const snd = SOUND_TOPICS.find((t) => t.after === unit.id);
		if (snd) seq.push({ kind: 'sound', topic: snd });
	}

	seq.forEach((entry) => {
		const x = xAtV(vWave);
		const onLeft = x > center;

		if (entry.kind === 'dialogue') {
			const dlg = entry.dialogue;
			const done = !!(state.dialoguesDone && state.dialoguesDone[dlg.id]);
			const unlocked = dialogueUnlocked(dlg);
			const status = done ? 'complete' : unlocked ? 'unlocked' : 'locked';

			const node = document.createElement('button');
			node.type = 'button';
			node.className = 'path-node dialogue ' + status;
			node.style.width = nodeSize + 'px';
			node.style.height = nodeSize + 'px';
			node.style.left = x - nodeSize / 2 + 'px';
			node.style.top = y + 'px';
			node.title = dlg.title;
			const icon = document.createElement('span');
			icon.className = 'icon';
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
			use.setAttribute('href', '#i-' + (done ? 'check' : unlocked ? 'forum' : 'lock'));
			svg.appendChild(use);
			icon.appendChild(svg);
			node.appendChild(icon);
			if (unlocked || done) node.addEventListener('click', () => startDialogue(dlg));
			wrap.appendChild(node);
			anchors.push({ x: x, yTop: y });

			const label = document.createElement('div');
			label.className = 'path-label ' + (onLeft ? 'left' : 'right') + (status === 'locked' ? ' locked-label' : '');
			label.style.width = labelWidth + 'px';
			label.style.left = (onLeft ? x - nodeSize / 2 - labelWidth - labelGap : x + nodeSize / 2 + labelGap) + 'px';
			const dtitle = document.createElement('div');
			dtitle.textContent = dlg.title;
			label.appendChild(dtitle);
			wrap.appendChild(label);
			centerLabel(label);

			advance();
			return;
		}

		if (entry.kind === 'sound') {
			const topic = entry.topic;
			const done = !!(state.soundsDone && state.soundsDone[topic.id]);
			const unlocked = soundUnlocked(topic);
			const status = done ? 'complete' : unlocked ? 'unlocked' : 'locked';

			const node = document.createElement('button');
			node.type = 'button';
			node.className = 'path-node sound ' + status;
			node.style.width = nodeSize + 'px';
			node.style.height = nodeSize + 'px';
			node.style.left = x - nodeSize / 2 + 'px';
			node.style.top = y + 'px';
			node.title = topic.title;
			const icon = document.createElement('span');
			icon.className = 'icon';
			if (done) {
				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
				use.setAttribute('href', '#i-check');
				svg.appendChild(use);
				icon.appendChild(svg);
			} else if (unlocked) {
				icon.textContent = topic.glyph; // a Devanagari letter from the lesson
			} else {
				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
				use.setAttribute('href', '#i-lock');
				svg.appendChild(use);
				icon.appendChild(svg);
			}
			node.appendChild(icon);
			if (unlocked || done) node.addEventListener('click', () => startSoundDrill(topic, soundExamples(topic)));
			wrap.appendChild(node);
			anchors.push({ x: x, yTop: y });

			const label = document.createElement('div');
			label.className = 'path-label ' + (onLeft ? 'left' : 'right') + (status === 'locked' ? ' locked-label' : '');
			label.style.width = labelWidth + 'px';
			label.style.left = (onLeft ? x - nodeSize / 2 - labelWidth - labelGap : x + nodeSize / 2 + labelGap) + 'px';
			const stitle = document.createElement('div');
			stitle.textContent = topic.title;
			label.appendChild(stitle);
			wrap.appendChild(label);
			centerLabel(label);

			advance();
			return;
		}
		const unit = entry.unit;
		const complete = unitIsComplete(unit);
		const isCurrent = unit === current;

		if (PATH_SECTIONS[unit.id]) {
			// The node above can carry a three-line label; with the tighter spacing, add
			// clearance so it doesn't collide with the banner (skip the first banner — no
			// node sits above it).
			if (y > 30) y += compact ? 22 : 26;
			const section = document.createElement('div');
			section.className = 'path-section';
			section.textContent = PATH_SECTIONS[unit.id];
			section.style.top = y + 'px';
			wrap.appendChild(section);
			bannerBands.push({ top: y - (compact ? 8 : 10), bottom: y + (compact ? 56 : 64) });
			y += compact ? 56 : 64;
		}
		// The START bubble extends above the current node — always give it clearance,
		// whether the node follows a section banner, a unit, or a conversation node.
		if (isCurrent) y += 34;
		const status = complete ? 'complete' : isCurrent ? 'current' : 'locked';

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
		anchors.push({ x: x, yTop: y });
		if (isCurrent) currentNodeEl = node;

		const label = document.createElement('div');
		label.className = 'path-label ' + (onLeft ? 'left' : 'right') + (status === 'locked' ? ' locked-label' : '');
		label.style.width = labelWidth + 'px';
		label.style.left = (onLeft ? x - nodeSize / 2 - labelWidth - labelGap : x + nodeSize / 2 + labelGap) + 'px';

		const title = document.createElement('div');
		title.textContent = unit.title;
		label.appendChild(title);
		wrap.appendChild(label);
		centerLabel(label);

		advance();
	});

	let contentBottom = y + 30;

	// Decorative companions (SR-07): tuck Sano's friends into the path's deep pockets — the
	// open side at each turn of the wave, beyond the label column — sized to nearly fill the
	// pocket without crowding the page edge or the lesson text. Ordered Thulo, then Pyaro,
	// then the rest, each friend appearing once. Purely ornamental: they idle like Sano and
	// do a head-shake when tapped (wiring below), nothing more.
	const buddyOrder = ['thulo', 'pyaro', 'rangin', 'bahadur', 'gyani', 'hiun', 'chanchal', 'shanta', 'phurtilo', 'lamo'];
	if (typeof CHARACTER_BODIES !== 'undefined') {
		// A turn is where the wave reverses horizontal direction. Right→left (a local max,
		// node swung right) opens a pocket on the LEFT; left→right opens one on the RIGHT.
		const turns = [];
		let prevDx = 0;
		for (let i = 1; i < anchors.length; i++) {
			const dx = anchors[i].x - anchors[i - 1].x;
			if (dx === 0) continue;
			if (prevDx !== 0 && Math.sign(dx) !== Math.sign(prevDx)) {
				turns.push({ x: anchors[i - 1].x, yTop: anchors[i - 1].yTop, pocket: prevDx > 0 ? 'left' : 'right' });
			}
			prevDx = dx;
		}

		const edgePad = compact ? 10 : 14; // keep clear of the page edge
		const textPad = compact ? 14 : 18; // keep clear of the label column
		const sizeCap = compact ? 150 : 168; // never bigger than this, even in a wide pocket
		const minSize = 78; // skip shallow pockets too small for a readable figure

		let bi = 0;
		for (const t of turns) {
			if (bi >= buddyOrder.length) break;
			// Open horizontal span on the turn's side, past the reserved label column
			// (labelWidth = the widest a label can wrap, so we stay clear of short ones too).
			let left, right;
			if (t.pocket === 'left') {
				left = edgePad;
				right = t.x - nodeSize / 2 - labelGap - labelWidth - textPad;
			} else {
				left = t.x + nodeSize / 2 + labelGap + labelWidth + textPad;
				right = width - edgePad;
			}
			const pocketW = right - left;
			if (pocketW < minSize) continue;
			const size = Math.min(pocketW, sizeCap);
			const top = t.yTop + nodeSize / 2 - size / 2; // center on the turn node's midline
			if (bannerBands.some((b) => top < b.bottom && top + size > b.top)) continue; // dodge a banner

			const id = buddyOrder[bi++];
			const buddy = document.createElement('div');
			buddy.className = 'path-buddy';
			buddy.setAttribute('aria-hidden', 'true');
			buddy.style.width = size + 'px';
			buddy.style.height = size + 'px';
			buddy.style.left = Math.round((left + right) / 2 - size / 2) + 'px';
			buddy.style.top = Math.round(top) + 'px';
			buddy.style.setProperty('--buddy-phase', '-' + (Math.random() * 9).toFixed(2) + 's');
			buddy.innerHTML = '<div class="buddy-art">' + CHARACTER_BODIES[id] + '</div>';
			if (!buddy.querySelector('.part-head')) buddy.classList.add('no-head'); // side view → shake whole figure
			// Profiles (one eye) should face the path: flip a right-facing profile sitting in a
			// right pocket (path on its left), and a left-facing one in a left pocket.
			const eyes = buddy.querySelectorAll('.part-eyes circle');
			if (eyes.length === 1) {
				const vb = (buddy.querySelector('svg').getAttribute('viewBox') || '0 0 200 200').split(/\s+/).map(Number);
				const eyeSide = parseFloat(eyes[0].getAttribute('cx')) > vb[0] + vb[2] / 2 ? 'right' : 'left';
				if (eyeSide === t.pocket) buddy.classList.add('flip');
			}
			buddy.addEventListener('click', () => {
				buddy.classList.remove('shake');
				void buddy.offsetWidth; // reflow so a repeat tap restarts the shake
				buddy.classList.add('shake');
			});
			buddy.addEventListener('animationend', (e) => {
				if (e.animationName === 'buddy-head-shake') buddy.classList.remove('shake');
			});
			wrap.appendChild(buddy);
			contentBottom = Math.max(contentBottom, top + size + 20);
		}
	}

	wrap.style.height = contentBottom + 'px';

	// First render only (app load): center the in-progress lesson in the viewport so a
	// returning learner lands on what's next instead of at "Namaste". Resizing or
	// returning home rebuilds the path but must not re-scroll or replay the reveal.
	if (!pathRevealed) {
		pathRevealed = true;
		const node = currentNodeEl;
		// If the in-progress lesson is below the fold on load, scroll so it's centered in the
		// viewport below the fixed header — returning learners land on what's next instead of
		// at "Namaste". When it's already visible near the top (new / early learners), keep the
		// natural top-of-page view and play the reveal instead.
		if (node && node.getBoundingClientRect().bottom > window.innerHeight) {
			const recenter = () => {
				const rect = node.getBoundingClientRect();
				const header = document.getElementById('header');
				const headerH = header ? header.offsetHeight : 0;
				const nodeCenter = rect.top + window.scrollY + rect.height / 2;
				window.scrollTo(0, Math.max(0, Math.round(nodeCenter - (window.innerHeight + headerH) / 2)));
			};
			recenter();
			// Web fonts reflow the content above the path, so re-center once they settle
			// (instant on cached loads). The top-down reveal is skipped — its stagger would
			// leave the centered node blank until its delay elapses.
			if (document.fonts) document.fonts.ready.then(recenter);
		} else {
			// At/near the top: play the staggered top-to-bottom reveal.
			wrap.classList.add('reveal');
			for (const el of wrap.children) el.style.animationDelay = Math.max(0, Math.min(parseFloat(el.style.top) * 0.55, 700)) + 'ms';
		}
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
	streakFreezeJustUsed = false;
	lesson = {
		queue: queue,
		index: 0,
		answered: false,
		firstTryCorrect: 0,
		// A matching exercise covers several items, so stats count items rather than
		// exercises; the intro warmup is excluded since its words are scored by their drills.
		statTotal: queue.reduce((n, ex) => n + (ex.items ? (ex.intro ? 0 : ex.items.length) : ex.unscored ? 0 : 1), 0),
		scheduled: {},
		strengthened: 0,
		firstOfDay: state.lastActivityDay !== dayString(new Date()),
	};
	showScreen('lesson');
	renderExercise();
}

// Fraction of eligible review drills delivered as listening exercises (SR-03):
// an audio-only prompt with no romanization, so the ear does the work.
const LISTEN_PROBABILITY = 0.5;

// New items are drilled with multiple choice in both directions. Review items get
// harder types as their interval stretches (isRecallStrength): multiple choice while
// the interval is still short, then word bank (multi-word phrases) or typing
// (single words) once an item is known well enough for recall; half of those recall
// reviews are delivered instead as "what you hear" listening drills. Vocab that's
// still being learned is bundled into a single matching exercise when there's enough.
// Tap-the-pairs grids (match, listenMatch) grade by item id, so two tiles showing the same
// romanized or English text are ambiguous — a correct-looking pairing could grade as wrong.
// Keep only the first item for each np/en so a bundle never holds a display-text collision.
function uniquePairItems(items) {
	const seenNp = new Set();
	const seenEn = new Set();
	const out = [];
	for (const item of items) {
		const np = item.np.toLowerCase();
		const en = item.en.toLowerCase();
		if (seenNp.has(np) || seenEn.has(en)) continue;
		seenNp.add(np);
		seenEn.add(en);
		out.push(item);
	}
	return out;
}

function buildExercises(newItems, reviewItems) {
	const exercises = [];
	for (const item of newItems) {
		exercises.push({ item: item, type: 'choice', dir: 'np-en' });
		exercises.push({ item: item, type: 'choice', dir: 'en-np' });
		// A skippable "say it aloud" speaking step for each new word (SR-04, unscored).
		exercises.push({ item: item, type: 'speak', unscored: true });
	}

	const matchable = uniquePairItems(reviewItems.filter((item) => item.emoji && !isRecallStrength(itemRecord(item.id))));
	const matchItems = matchable.length >= 4 ? matchable.slice(0, 5) : [];

	// Listening match (audio -> romanization): bundle single-word recall-strength reviews into a
	// tap-the-sound round, the ear-only sibling of the recognition match above. Single-word only
	// keeps the romanization tiles short and leaves multi-word phrases for word bank.
	const listenable = uniquePairItems(
		reviewItems.filter((item) => item.np.trim().split(/\s+/).length === 1 && isRecallStrength(itemRecord(item.id)) && !matchItems.includes(item)),
	);
	const listenMatchItems = listenable.length >= 4 ? shuffleArray(listenable.slice()).slice(0, 5) : [];

	for (const item of reviewItems) {
		if (matchItems.includes(item) || listenMatchItems.includes(item)) continue;
		if (isRecallStrength(itemRecord(item.id))) {
			if (item.np.split(/\s+/).length >= 2) exercises.push({ item: item, type: 'wordbank', dir: Math.random() < 0.5 ? 'en-np' : 'np-en' });
			// Half of single-word recall reviews become "type what you hear".
			else exercises.push({ item: item, type: 'type', listen: Math.random() < LISTEN_PROBABILITY });
		} else if (Math.random() < LISTEN_PROBABILITY) {
			// "Select what you hear": audio-only prompt, pick the meaning.
			exercises.push({ item: item, type: 'choice', dir: 'np-en', listen: true });
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
	if (listenMatchItems.length > 0)
		exercises.splice(Math.floor(Math.random() * (exercises.length + 1)), 0, { type: 'listenMatch', items: listenMatchItems });

	// Open with a matching round whenever the lesson introduces new words. It's a
	// pure warmup that previews the words; the drills below do all the SRS scoring,
	// so this round must always sit first (after the review match has been placed).
	const introItems = newItems.filter((item) => !(state.items[item.id] && state.items[item.id].intro));
	if (introItems.length > 0) {
		const warmup = uniquePairItems(warmupItems(introItems));
		if (warmup.length >= 2) exercises.unshift({ type: 'match', items: warmup, intro: true });
	}
	return exercises;
}

const WARMUP_SIZE = 5;

// The warmup always previews the lesson's new words; when there are only a few,
// it's padded up to WARMUP_SIZE with the user's weakest already-seen words from
// the same unit (lowest accuracy first, then lowest Leitner level) for extra reps.
function warmupItems(newItems) {
	const items = newItems.slice(0, WARMUP_SIZE);
	if (items.length >= WARMUP_SIZE) return items;
	const unit = COURSE.find((u) => u.items.includes(newItems[0]));
	const seen = shuffleArray(unit.items.filter((item) => !items.includes(item) && state.items[item.id] && state.items[item.id].intro));
	seen.sort((a, b) => itemAccuracy(a) - itemAccuracy(b) || reviewInterval(state.items[a.id]) - reviewInterval(state.items[b.id]));
	return items.concat(seen.slice(0, WARMUP_SIZE - items.length));
}

function itemAccuracy(item) {
	const record = state.items[item.id];
	return record.seen > 0 ? record.correct / record.seen : 0;
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
	document.getElementById('exercise-listen-match').classList.toggle('hide', ex.type !== 'listenMatch');
	document.getElementById('exercise-speak').classList.toggle('hide', ex.type !== 'speak');
	document.getElementById('exercise-check').classList.toggle('hide', ex.type !== 'wordbank' && ex.type !== 'type');

	if (ex.type === 'choice') renderChoice(ex);
	else if (ex.type === 'wordbank') renderWordbank(ex);
	else if (ex.type === 'type') renderType(ex);
	else if (ex.type === 'speak') renderSpeak(ex);
	else if (ex.type === 'listenMatch') renderListenMatch(ex);
	else renderMatch(ex);
}

function setPrompt(label, word, pron, audioId) {
	document.getElementById('exercise-label').textContent = label;
	const wordEl = document.getElementById('exercise-word');
	wordEl.textContent = word;
	// An audioId is passed only when the headword shown is the Nepali — the one direction
	// where playing it can't give the answer away. In that case offer a play button beside
	// it AND auto-play it on load, so a Nepali word at the top always speaks itself. The
	// English-prompt directions pass no audioId; their Nepali audio lives in the tappable
	// tiles/choices below instead. renderExercise always runs inside the tap that opened or
	// advanced the lesson, so this autoplay stays within a user gesture (iOS).
	if (audioId) {
		wordEl.appendChild(SanoAudio.button(audioId, { className: 'audio-inline' }));
		SanoAudio.play(audioId);
	}
	document.getElementById('exercise-pronounce').textContent = pron;
}

// Listening prompt (SR-03): the headword slot becomes a big tap-to-play button and
// no romanization shows, so the learner has to rely on the audio. It also auto-plays on
// load (like a Nepali headword in setPrompt) so the clip you must identify speaks itself;
// the button is then there to replay. Same user-gesture chain as setPrompt (iOS).
function setListenPrompt(label, audioId) {
	document.getElementById('exercise-label').textContent = label;
	const wordEl = document.getElementById('exercise-word');
	wordEl.textContent = '';
	wordEl.appendChild(SanoAudio.button(audioId, { className: 'audio-prompt' }));
	SanoAudio.play(audioId);
	document.getElementById('exercise-pronounce').textContent = '';
}

function renderChoice(ex) {
	if (ex.listen) setListenPrompt('Select what you hear', ex.item.id);
	else if (ex.dir === 'np-en') setPrompt('Select the correct meaning', ex.item.np, ex.item.pron, ex.item.id);
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

// Tile display text: drop the punctuation (?,.!) and capitalization that would
// otherwise reveal a word's place in the phrase (first word capitalized, last word
// carrying the ? / .). Answer-checking runs through normalize() (which already
// lowercases and strips punctuation), so cleaning the tiles is purely cosmetic.
function cleanTileText(word) {
	// Drop the punctuation that gives a word's place away (capital first word, trailing
	// ? / .) plus slashes from meanings like "Hello / Goodbye". normalize() ignores all of
	// this when grading, so it's cosmetic. (Parenthetical asides are removed earlier by
	// stripParens, before the phrase is split into words.)
	return word.replace(/[?,.!।\/()]/g, '').toLowerCase();
}

// Remove parenthetical asides like "(formal)" / "(very polite)" from a phrase before it
// becomes tiles or a grading target. They annotate the English meaning, aren't part of the
// spoken answer, and listing them as tiles gives the register away. The matching grading
// target is stripped the same way (checkExercise), so the answer is still correct without them.
function stripParens(s) {
	return s
		.replace(/\([^)]*\)/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

// Play a Nepali word tile's audio (SR-02, request #1). Every tile-word has its own clip
// at audio/words/<slug>.mp3 (rendered from tools/tts/words.json); the slug matches
// build-words.mjs. A missing clip is a silent no-op (SanoAudio swallows the miss).
function playTileWord(word) {
	SanoAudio.playWord(normalize(word).replace(/\s+/g, '-'));
}

// Word bank in two directions (request #5):
//   en-np (default) — English prompt at top, assemble the Nepali from tiles; tapping a
//                     Nepali tile plays that word (request #1).
//   np-en           — Nepali phrase shown at top and spoken on load, assemble the English.
function renderWordbank(ex) {
	const buildNepali = ex.dir !== 'np-en';
	const target = buildNepali ? ex.item.np : ex.item.en;

	if (buildNepali) {
		setPrompt('Build the Nepali from the tiles', promptText(ex.item), '');
	} else {
		// Showing/parsing the Nepali is the prompt here, so its audio button doesn't give
		// the (English) answer away; setPrompt auto-plays it on load (Nepali headword).
		setPrompt('Listen and build the English', ex.item.np, '', ex.item.id);
	}

	const answerEl = document.getElementById('wordbank-answer');
	const poolEl = document.getElementById('wordbank-pool');
	answerEl.textContent = '';
	poolEl.textContent = '';
	const checkEl = document.getElementById('exercise-check');
	const refresh = () => (checkEl.disabled = answerEl.children.length === 0);

	// Tiles are pre-cleaned (lowercase, no punctuation); drop any that clean to empty
	// (e.g. a stray "/"). The cleaned text still resolves the same per-word audio via
	// normalize(), and the assembled answer still grades against the raw phrase.
	const targetTiles = stripParens(target).split(/\s+/).map(cleanTileText).filter(Boolean);
	const tiles = shuffleArray(targetTiles.concat(wordbankDistractors(ex.item, ex.dir)));
	for (const word of tiles) {
		// The pool tile stays put when chosen; a matching tile is added to the answer
		// row above and the pool tile is marked "selected" (request #2). Tapping a
		// selected tile — or its copy in the answer row — deselects and removes it.
		const poolTile = document.createElement('button');
		poolTile.type = 'button';
		poolTile.className = 'wordbank-tile';
		poolTile.textContent = word;
		let answerTile = null;

		const deselect = () => {
			if (answerTile) {
				answerTile.remove();
				answerTile = null;
			}
			poolTile.classList.remove('selected');
			refresh();
		};
		const select = () => {
			poolTile.classList.add('selected');
			answerTile = document.createElement('button');
			answerTile.type = 'button';
			answerTile.className = 'wordbank-tile placed';
			answerTile.textContent = poolTile.textContent;
			answerTile.addEventListener('click', deselect);
			answerEl.appendChild(answerTile);
			refresh();
		};
		poolTile.addEventListener('click', () => {
			if (poolTile.classList.contains('selected')) {
				deselect();
			} else {
				if (buildNepali) playTileWord(word); // hear the word when placing it (request #1)
				select();
			}
		});
		poolEl.appendChild(poolTile);
	}
	refresh();
}

// A few extra words (in the same language as the tiles) from other phrases, so the
// answer isn't just "use every tile". Cleaned + lowercased like the real tiles.
function wordbankDistractors(item, dir) {
	const field = dir === 'np-en' ? 'en' : 'np';
	const targetWords = cleanTileText(stripParens(item[field])).split(/\s+/);
	const pool = shuffleArray(COURSE.filter((u) => u.kind === 'phrases').flatMap((u) => u.items));

	const distractors = [];
	for (const candidate of pool) {
		if (distractors.length === 3) break;
		for (const word of stripParens(candidate[field]).split(/\s+/)) {
			if (distractors.length === 3) break;
			const cleaned = cleanTileText(word);
			if (cleaned === '' || cleaned === '___' || cleaned === '...') continue;
			if (targetWords.includes(cleaned) || distractors.includes(cleaned)) continue;
			distractors.push(cleaned);
		}
	}
	return distractors;
}

function renderType(ex) {
	if (ex.listen) setListenPrompt('Type what you hear', ex.item.id);
	else setPrompt('Type the Nepali', promptText(ex.item), '');
	const input = document.getElementById('type-answer');
	input.value = '';
	document.getElementById('exercise-check').disabled = true;
	input.focus();
}

// SR-04 speaking practice: record yourself, then play it back against the model audio.
// There's no scoring (browsers have no Nepali speech recognition) — just self-compare —
// and the whole step is skippable via Continue, with graceful fallback if the mic is
// unavailable or denied.
// Shared mic recorder for the speaking steps — the SR-04 lesson step and the SR-08
// sounds drill both use it. Wraps getUserMedia + MediaRecorder over a record button, a
// label, and a "play your take" button. No scoring (browsers have no Nepali speech
// recognition) — record, then compare against the model audio — and it degrades quietly
// if the mic is denied or unavailable.
function createRecorder(opts) {
	const recordBtn = document.getElementById(opts.recordBtn);
	const recordLabel = document.getElementById(opts.recordLabel);
	const playBtn = document.getElementById(opts.playBtn);
	const idle = opts.idleLabel || 'Tap to record';
	let recorder = null;
	let chunks = [];
	let takeBuffer = null; // ArrayBuffer of the last take, decoded via Web Audio in play()
	let audioCtx = null; // one reused AudioContext; see play() for why not an <audio> element
	let recording = false;

	function reset() {
		if (recording && recorder) {
			try {
				recorder.stop();
			} catch (e) {}
		}
		recorder = null;
		chunks = [];
		takeBuffer = null;
		recording = false;
		recordBtn.classList.remove('recording');
		recordLabel.textContent = idle;
		playBtn.classList.add('hide');
	}

	async function toggle() {
		if (recording) {
			recorder.stop();
			return;
		}
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (e) {
			recordLabel.textContent = 'Microphone unavailable';
			return;
		}
		recorder = new MediaRecorder(stream);
		chunks = [];
		recorder.ondataavailable = (e) => {
			if (e.data && e.data.size) chunks.push(e.data);
		};
		recorder.onstop = () => {
			stream.getTracks().forEach((t) => t.stop());
			recording = false;
			recordBtn.classList.remove('recording');
			if (!chunks.length) return;
			// Keep the take as raw bytes and decode it with the Web Audio API in
			// play(). iOS records audio (audio/mp4) that it then refuses to play back
			// through an <audio> element — both data: and blob: sources reject with
			// NotSupportedError — but AudioContext.decodeAudioData handles it.
			const type = recorder.mimeType || chunks[0].type || '';
			new Blob(chunks, type ? { type: type } : undefined).arrayBuffer().then((ab) => {
				takeBuffer = ab;
				recordLabel.textContent = opts.againLabel || 'Record again';
				playBtn.classList.remove('hide');
			});
		};
		recorder.start();
		recording = true;
		recordBtn.classList.add('recording');
		recordLabel.textContent = opts.recordingLabel || 'Stop recording';
	}

	function play() {
		if (!takeBuffer) return;
		try {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			if (!audioCtx) audioCtx = new Ctx();
			// iOS starts the context suspended; resume it inside this tap (a user
			// gesture) so the buffer decoded below is audible.
			if (audioCtx.state === 'suspended') audioCtx.resume();
			// decodeAudioData detaches its input, so decode a copy to keep replays.
			audioCtx.decodeAudioData(
				takeBuffer.slice(0),
				(buf) => {
					const src = audioCtx.createBufferSource();
					src.buffer = buf;
					src.connect(audioCtx.destination);
					src.start(0);
				},
				(err) => {
					recordLabel.textContent = 'Playback failed: ' + (err && err.name ? err.name : 'decode');
					console.warn('decodeAudioData failed', err);
				},
			);
		} catch (e) {
			recordLabel.textContent = 'Playback failed: ' + (e && e.name ? e.name : e);
			console.warn('recording playback failed', e);
		}
	}

	return {
		toggle,
		reset,
		play,
		get recording() {
			return recording;
		},
	};
}

function renderSpeak(ex) {
	setPrompt('Say it aloud, then compare', ex.item.np, ex.item.pron, ex.item.id);
	speakRecorder.reset();
}

// --- SR-08: pronunciation coaching ("Sounds of Nepali") ---
// A listen-and-repeat mode for the contrasts romanization can't show. Each topic
// (js/sounds.js) is illustrated by real course words found by scanning their Devanagari
// for the topic's marks, so the audio and Nepali are the ones already shipped in COURSE.

// A pronunciation node unlocks once the unit it follows in the path is complete.
function soundUnlocked(topic) {
	const afterUnit = COURSE.find((u) => u.id === topic.after);
	return afterUnit ? unitIsComplete(afterUnit) : true;
}

// Real course words that exhibit a contrast: those whose Devanagari contains one of the
// topic's marks — single words, de-duped, shortest first (clearer), capped at six.
function soundExamples(topic) {
	const seen = new Set();
	const matches = [];
	for (const unit of COURSE) {
		for (const item of unit.items) {
			if (!item.dev || seen.has(item.np) || item.np.split(/\s+/).length > 1) continue;
			if (topic.marks.some((m) => item.dev.includes(m))) {
				seen.add(item.np);
				matches.push(item);
			}
		}
	}
	matches.sort((a, b) => a.dev.length - b.dev.length);
	return matches.slice(0, 6);
}

// Open a contrast's drill straight from its path node (there's no longer a list).
function startSoundDrill(topic, examples) {
	soundDrill = { topic: topic, examples: examples, index: 0 };
	showScreen('sounds');
	document.getElementById('sounds-drill-title').textContent = topic.title;
	document.getElementById('sounds-drill-intro').textContent = topic.intro;
	document.getElementById('sounds-tip').textContent = topic.tip;
	renderSoundCard();
}

function renderSoundCard() {
	const topic = soundDrill.topic;
	const item = soundDrill.examples[soundDrill.index];

	const devEl = document.getElementById('sounds-dev');
	devEl.textContent = '';
	for (const node of highlightDev(item.dev, topic.marks)) devEl.appendChild(node);
	document.getElementById('sounds-roman').textContent = item.np + ' · ' + item.pron;
	document.getElementById('sounds-en').textContent = item.en;

	soundsRecorder.reset();
	const n = soundDrill.examples.length;
	document.getElementById('sounds-progress-fill').style.width = Math.round(((soundDrill.index + 1) / n) * 100) + '%';
	document.getElementById('sounds-next').textContent = soundDrill.index >= n - 1 ? 'Done' : 'Next sound';

	// Auto-play the model on reveal (within the tap that opened or advanced the card).
	SanoAudio.play(item.id);
}

// Break the Devanagari into grapheme clusters and wrap the ones carrying a mark, so the
// contrast stands out without splitting a base letter from its vowel sign or nasal mark.
function highlightDev(dev, marks) {
	const clusters =
		typeof Intl !== 'undefined' && Intl.Segmenter
			? [...new Intl.Segmenter('ne', { granularity: 'grapheme' }).segment(dev)].map((seg) => seg.segment)
			: [...dev];
	return clusters.map((cluster) => {
		if (![...cluster].some((ch) => marks.includes(ch))) return document.createTextNode(cluster);
		const span = document.createElement('span');
		span.className = 'sounds-mark';
		span.textContent = cluster;
		return span;
	});
}

function advanceSound() {
	if (!soundDrill) return;
	if (soundDrill.index >= soundDrill.examples.length - 1) {
		finishSound();
		return;
	}
	soundDrill.index++;
	renderSoundCard();
}

// A celebration screen at the end of the drill, like other lessons. Pronunciation has
// no per-word SRS scoring, but completing it counts toward the daily streak.
function finishSound() {
	const topic = soundDrill.topic;
	const count = soundDrill.examples.length;
	if (!state.soundsDone) state.soundsDone = {};
	state.soundsDone[topic.id] = true;
	// Counts toward the daily streak, like other lessons. Capture firstOfDay before
	// registerActivity() stamps today's date.
	streakFreezeJustUsed = false;
	const firstOfDay = state.lastActivityDay !== dayString(new Date());
	registerActivity();
	saveState();
	soundsRecorder.reset();
	soundDrill = null;
	document.getElementById('complete-title').textContent = 'Sounds practiced!';
	showStreakResult(firstOfDay);
	document.getElementById('complete-strengthened').classList.add('hide');
	document.getElementById('complete-stats').textContent =
		'You practiced ' + count + ' ' + (count === 1 ? 'word' : 'words') + ' — ' + topic.title.toLowerCase();
	document.getElementById('complete-goal').classList.add('hide');
	showScreen('complete');
}

function renderMatch(ex) {
	setPrompt(ex.intro ? 'Tap the matching pairs' : 'Match the pairs', '', '');
	matchState = { remaining: ex.items.length, missed: {}, selected: { left: null, right: null } };

	const grid = document.getElementById('exercise-match');
	grid.textContent = '';
	const left = shuffleArray(ex.items.slice()).map((item) => matchTile(item, 'left', item.np));
	const right = shuffleArray(ex.items.slice()).map((item) => matchTile(item, 'right', item.en));
	// Interleave so each grid row holds one Nepali tile and one English tile; the
	// row height (and thus both tiles) stays aligned even when a label wraps.
	for (let i = 0; i < ex.items.length; i++) {
		grid.appendChild(left[i]);
		grid.appendChild(right[i]);
	}
	fitMatchTiles(grid);
	if (document.fonts) document.fonts.ready.then(() => fitMatchTiles(grid));
}

// Shrink the tile labels to the largest uniform size that keeps every word on one
// line, so the short Nepali column and the longer English column line up. If even
// the minimum size can't fit a label it wraps (the grid keeps paired tiles equal
// height). Sizes in px against the 10px root (1rem = 10px).
function fitMatchTiles(grid) {
	const tiles = grid.querySelectorAll('.match-tile');
	if (!tiles.length) return;
	const MAX = 17;
	const MIN = 11.5;
	const ctx = (fitMatchTiles.ctx = fitMatchTiles.ctx || document.createElement('canvas').getContext('2d'));

	let size = MAX;
	const measured = [];
	for (const tile of tiles) {
		const cs = getComputedStyle(tile);
		const avail = tile.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
		ctx.font = cs.fontWeight + ' ' + MAX + 'px ' + cs.fontFamily;
		const width = ctx.measureText(tile.textContent).width;
		measured.push({ avail, width });
		if (width > avail) size = Math.min(size, (MAX * avail) / width);
	}
	size = Math.max(MIN, size);
	const wrap = measured.some((m) => (m.width * size) / MAX > m.avail + 0.5);
	for (const tile of tiles) {
		tile.style.fontSize = size.toFixed(2) + 'px';
		tile.style.whiteSpace = wrap ? 'normal' : 'nowrap';
	}
}

// Deterministic pseudo-waveform for the listening-match tiles. Bar heights come from a hash
// of the item id, so a clip's tile looks the same every time it appears (stable on replay)
// yet unrelated to phrase length — every tile is the same width, so the bars never hint which
// romanization is the long one.
function hashId(str) {
	let h = 0x811c9dc5; // FNV-1a; Math.imul keeps it identical across browsers (no float drift).
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function waveformSvg(id, bars) {
	bars = bars || 9;
	let h = hashId(id) || 1; // avoid a zero seed (xorshift on 0 stays 0 -> flat waveform)
	const next = () => {
		// xorshift32 on the seeded hash -> a stable [0,1) sequence per id.
		h ^= h << 13;
		h >>>= 0;
		h ^= h >> 17;
		h ^= h << 5;
		h >>>= 0;
		return h / 0xffffffff;
	};
	const W = 100;
	const H = 40;
	const gap = 2;
	const bw = (W - gap * (bars - 1)) / bars;
	let rects = '';
	for (let i = 0; i < bars; i++) {
		const bh = (0.25 + 0.75 * next()) * H; // floor at 25% so every bar still reads as a bar
		const x = i * (bw + gap);
		const y = (H - bh) / 2; // centered -> symmetric waveform
		const r = Math.min(bw / 2, 2).toFixed(2);
		rects +=
			'<rect x="' +
			x.toFixed(2) +
			'" y="' +
			y.toFixed(2) +
			'" width="' +
			bw.toFixed(2) +
			'" height="' +
			bh.toFixed(2) +
			'" rx="' +
			r +
			'" fill="currentColor"/>';
	}
	return '<svg class="lm-wave" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + rects + '</svg>';
}

// A listening-match left tile: a waveform button that plays the clip and selects like a match
// tile. It carries .match-tile so it inherits the tile border, the selected/miss/matched
// states, and the reduced-motion handling for free.
function listenTile(item, n) {
	const tile = document.createElement('button');
	tile.type = 'button';
	tile.className = 'match-tile listen-tile';
	tile.dataset.id = item.id;
	tile.innerHTML = waveformSvg(item.id);
	// No visible text, so give assistive tech a neutral label that never reveals the answer.
	tile.setAttribute('aria-label', 'Play audio clip ' + (n + 1));
	tile.addEventListener('click', () => {
		SanoAudio.play(item.id);
		selectMatchTile(tile, 'left');
	});
	return tile;
}

function renderListenMatch(ex) {
	// Pass no audioId to setPrompt so nothing auto-plays — auto-playing one clip on load would
	// reveal which tile it is. The learner taps each waveform to hear it.
	setPrompt('Match the sound to the word', '', '');
	matchState = { remaining: ex.items.length, missed: {}, selected: { left: null, right: null } };

	const grid = document.getElementById('exercise-listen-match');
	grid.textContent = '';
	const left = shuffleArray(ex.items.slice()).map((item, i) => listenTile(item, i));
	const right = shuffleArray(ex.items.slice()).map((item) => matchTile(item, 'right', item.np));
	for (let i = 0; i < ex.items.length; i++) {
		grid.appendChild(left[i]);
		grid.appendChild(right[i]);
	}
	fitMatchTiles(grid);
	if (document.fonts) document.fonts.ready.then(() => fitMatchTiles(grid));
}

function matchTile(item, side, text) {
	const tile = document.createElement('button');
	tile.type = 'button';
	tile.className = 'match-tile';
	tile.textContent = text;
	tile.dataset.id = item.id;
	tile.addEventListener('click', () => {
		// The left column holds the Nepali word — speak it on every tap (even once
		// matched) so the sound reinforces the pairing.
		if (side === 'left') SanoAudio.play(item.id);
		selectMatchTile(tile, side);
	});
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

	// The intro warmup only previews the new words; the drills that follow handle
	// all scoring, streak, and leveling, so it touches no state.
	if (ex.intro) {
		showFeedback(true, "Now let's practice these.", '');
		return;
	}

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
		if (!lesson.scheduled[item.id]) {
			lesson.scheduled[item.id] = true;
			const before = record.interval;
			// A clean listening-match item is harder retrieval (ear only), so it earns the EASY
			// bump like the other listening drills; the recognition match stays GOOD.
			scheduleReview(record, correct ? (ex.type === 'listenMatch' ? GRADE.EASY : GRADE.GOOD) : GRADE.LAPSE);
			if (record.interval > before) lesson.strengthened++;
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
	// Word bank checks against whichever phrase the tiles build (Nepali by default, the
	// English meaning in the np-en direction); typing always builds the Nepali.
	let expected = ex.type === 'wordbank' && ex.dir === 'np-en' ? ex.item.en : ex.item.np;
	// Parenthetical asides are dropped from the tiles, so they're not required to match.
	if (ex.type === 'wordbank') expected = stripParens(expected);
	applyAnswer(ex, lenientEquals(given, expected, ex.type === 'type'));
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
		// Advance the item's spaced-repetition schedule once per lesson, graded by the
		// exercise it first appeared in (SR-05).
		if (!lesson.scheduled[ex.item.id]) {
			lesson.scheduled[ex.item.id] = true;
			const before = record.interval;
			scheduleReview(record, exerciseGrade(ex, correct));
			if (record.interval > before) lesson.strengthened++;
		}
	}
	if (!correct && !ex.requeued) lesson.queue.push(Object.assign({}, ex, { requeued: true }));

	// Always show the full answer for recall and listening exercises; for plain
	// multiple choice only on a miss.
	const showAnswer = !correct || ex.type === 'wordbank' || ex.type === 'type' || ex.listen;
	showFeedback(correct, correct ? 'Correct!' : 'Not quite.', showAnswer ? ex.item.np + ' = ' + promptText(ex.item) : '', ex.item.id);

	saveState();
	refreshHeader();
}

function showFeedback(correct, title, answerText, audioId) {
	const feedbackEl = document.getElementById('lesson-feedback');
	feedbackEl.classList.remove('hide');
	feedbackEl.classList.toggle('correct', correct);
	feedbackEl.classList.toggle('incorrect', !correct);
	document.getElementById('feedback-title').textContent = title;
	const answerEl = document.getElementById('feedback-answer');
	answerEl.textContent = answerText;
	// The reveal shows the Nepali answer ("<np> = <meaning>") — let the learner hear it.
	if (answerText && audioId) answerEl.appendChild(SanoAudio.button(audioId, { className: 'audio-inline' }));
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

// Show the streak line on the complete screen when this was the day's first
// activity, with one wording shared by every lesson type that extends the streak.
function showStreakResult(firstOfDay) {
	const streakEl = document.getElementById('complete-streak');
	streakEl.classList.toggle('hide', !firstOfDay);
	if (firstOfDay)
		document.getElementById('complete-streak-text').textContent = streakFreezeJustUsed
			? 'Streak freeze used — your ' + state.streak + '-day streak is safe'
			: state.streak === 1
				? 'Streak started!'
				: state.streak + ' day streak!';
}

function finishLesson() {
	saveState();
	// Reset the title in case a dialogue left "Conversation complete!" behind.
	document.getElementById('complete-title').textContent = 'Lesson complete!';
	document.getElementById('complete-stats').textContent = lesson.firstTryCorrect + ' of ' + lesson.statTotal + ' correct on the first try';

	showStreakResult(lesson.firstOfDay);

	const strengthenedEl = document.getElementById('complete-strengthened');
	strengthenedEl.classList.toggle('hide', lesson.strengthened === 0);
	strengthenedEl.textContent = lesson.strengthened + (lesson.strengthened === 1 ? ' word' : ' words') + ' strengthened';

	// Reinforce what this practice is building toward (SR-06 can-do goal).
	const goalEl = document.getElementById('complete-goal');
	const goalUnit = currentUnit();
	if (goalUnit && goalUnit.goal) {
		goalEl.textContent = goalUnit.goal;
		goalEl.classList.remove('hide');
	} else {
		goalEl.classList.add('hide');
	}

	showScreen('complete');
}

// --- SR-01: two-character dialogues with comprehension questions ---

// Lazy id -> COURSE item lookup, so dialogue lines can reference existing phrases.
let courseItemMap = null;
function courseItem(id) {
	if (!courseItemMap) {
		courseItemMap = {};
		for (const unit of COURSE) for (const item of unit.items) courseItemMap[item.id] = item;
	}
	return courseItemMap[id];
}

let dialogueSession = null;

function startDialogue(dialogue) {
	dialogueSession = { def: dialogue, lineIndex: -1, qIndex: 0, correct: 0, answered: false };
	showScreen('dialogue');
	renderDialogueConvo();
}

// Phase 1: the conversation reveals one bubble at a time (Change 1), auto-playing each
// line as it appears (in its character's voice — one default voice today,
// per-character voices later).
function renderDialogueConvo() {
	const d = dialogueSession.def;
	document.getElementById('dialogue-convo').classList.remove('hide');
	document.getElementById('dialogue-quiz').classList.add('hide');
	document.getElementById('dialogue-goal').textContent = d.goal;
	// Introduce the companion (cast.B) with a one-line persona so they're memorable.
	const persona = document.getElementById('dialogue-persona');
	const blurb = CHARACTER_PERSONAS[d.cast.B];
	if (blurb) {
		persona.textContent = (CHARACTER_NAMES[d.cast.B] || d.cast.B) + ' — ' + blurb;
		persona.classList.remove('hide');
	} else {
		persona.classList.add('hide');
	}
	document.getElementById('dialogue-thread').textContent = '';
	dialogueSession.lineIndex = -1;
	window.scrollTo(0, 0);
	revealNextLine();
}

// Build one dialogue line: a head-only character portrait beside a speech bubble
// (Change 3 / SR-07). Sano sits on the left, the companion mirrored on the right.
function dialogueBubble(line) {
	const d = dialogueSession.def;
	const item = courseItem(line.ref);
	const charId = line.who === 'A' ? d.cast.A : d.cast.B;

	const row = document.createElement('div');
	row.className = 'dialogue-line ' + (line.who === 'A' ? 'sano' : 'pyaro');

	const head = document.createElement('div');
	head.className = 'dialogue-head';
	head.innerHTML = CHARACTER_HEADS[charId] || '';

	const bubble = document.createElement('div');
	bubble.className = 'bubble ' + (line.who === 'A' ? 'sano' : 'user');

	const speaker = document.createElement('p');
	speaker.className = 'speaker';
	speaker.textContent = CHARACTER_NAMES[charId] || charId;

	const np = document.createElement('p');
	np.className = 'np';
	np.textContent = item.np;
	np.appendChild(SanoAudio.button(item.id, { className: 'audio-inline', voiceId: SanoAudio.voiceForCharacter(charId) }));

	const en = document.createElement('p');
	en.className = 'en';
	en.textContent = item.en;

	bubble.append(speaker, np, en);
	row.append(head, bubble);
	return row;
}

// Reveal the next line, append its bubble, and auto-play it. The advance button is
// only ever clicked from a tap, so this autoplay stays within a user gesture.
function revealNextLine() {
	const d = dialogueSession.def;
	dialogueSession.lineIndex++;
	const line = d.lines[dialogueSession.lineIndex];
	const bubble = dialogueBubble(line);
	document.getElementById('dialogue-thread').appendChild(bubble);

	const charId = line.who === 'A' ? d.cast.A : d.cast.B;
	SanoAudio.play(line.ref, SanoAudio.voiceForCharacter(charId));

	// The conversation fills the first half of the progress bar; questions fill the rest.
	const fill = Math.round(((dialogueSession.lineIndex + 1) / d.lines.length) * 50);
	document.getElementById('dialogue-progress-fill').style.width = fill + '%';
	const last = dialogueSession.lineIndex >= d.lines.length - 1;
	document.getElementById('dialogue-advance').textContent = last ? 'Continue to questions' : 'Continue';
	if (dialogueSession.lineIndex > 0) bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function advanceDialogue() {
	if (dialogueSession.lineIndex >= dialogueSession.def.lines.length - 1) startDialogueQuiz();
	else revealNextLine();
}

// Phase 2: comprehension questions, scored on their own (no SRS or streak impact).
function startDialogueQuiz() {
	dialogueSession.qIndex = 0;
	dialogueSession.correct = 0;
	document.getElementById('dialogue-convo').classList.add('hide');
	document.getElementById('dialogue-quiz').classList.remove('hide');
	renderDialogueQuestion();
}

function renderDialogueQuestion() {
	const d = dialogueSession.def;
	const q = d.questions[dialogueSession.qIndex];
	dialogueSession.answered = false;
	document.getElementById('dialogue-progress-fill').style.width = 50 + Math.round((dialogueSession.qIndex / d.questions.length) * 50) + '%';
	document.getElementById('dialogue-feedback').classList.add('hide');
	document.getElementById('dialogue-q-label').textContent = 'Question ' + (dialogueSession.qIndex + 1) + ' of ' + d.questions.length;
	document.getElementById('dialogue-q-text').textContent = q.q;

	const choices = shuffleArray(q.choices.map((text, i) => ({ text: text, correct: i === q.answer })));
	const buttons = document.getElementById('dialogue-choices').getElementsByTagName('button');
	let i = 0;
	for (const b of buttons) {
		if (i < choices.length) {
			b.textContent = choices[i].text;
			b.dataset.correct = choices[i].correct ? 'true' : 'false';
			b.className = '';
			b.disabled = false;
			b.parentNode.classList.remove('hide');
		} else {
			b.parentNode.classList.add('hide');
		}
		i++;
	}
}

function answerDialogueQuestion(e) {
	const btn = e.target.closest('button');
	if (!btn || dialogueSession.answered) return;
	dialogueSession.answered = true;
	const correct = btn.dataset.correct === 'true';
	if (correct) dialogueSession.correct++;
	for (const b of document.getElementById('dialogue-choices').getElementsByTagName('button')) {
		b.disabled = true;
		if (b.dataset.correct === 'true') b.classList.add('correct');
		else if (b === btn) b.classList.add('incorrect');
	}
	const fb = document.getElementById('dialogue-feedback');
	fb.classList.remove('hide');
	fb.classList.toggle('correct', correct);
	fb.classList.toggle('incorrect', !correct);
	document.getElementById('dialogue-feedback-title').textContent = correct ? 'Correct!' : 'Not quite.';
}

function continueDialogue() {
	dialogueSession.qIndex++;
	if (dialogueSession.qIndex >= dialogueSession.def.questions.length) finishDialogue();
	else renderDialogueQuestion();
}

function finishDialogue() {
	const d = dialogueSession.def;
	if (!state.dialoguesDone) state.dialoguesDone = {};
	state.dialoguesDone[d.id] = true;
	// Completing a conversation counts toward the daily streak, like other lessons.
	// Capture firstOfDay before registerActivity() stamps today's date.
	streakFreezeJustUsed = false;
	const firstOfDay = state.lastActivityDay !== dayString(new Date());
	registerActivity();
	saveState();
	document.getElementById('complete-title').textContent = 'Conversation complete!';
	showStreakResult(firstOfDay);
	document.getElementById('complete-strengthened').classList.add('hide');
	document.getElementById('complete-stats').textContent = dialogueSession.correct + ' of ' + d.questions.length + ' questions correct';
	const goalEl = document.getElementById('complete-goal');
	goalEl.textContent = d.goal;
	goalEl.classList.remove('hide');
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
				// First cell is the Nepali word — give every dictionary row a play button.
				if (i === 0) cell.appendChild(SanoAudio.button(item.id, { className: 'audio-inline' }));
				row.appendChild(cell);
			});
			tbody.appendChild(row);
		}
	}
}

function refreshHeader() {
	document.getElementById('name').textContent = state.name || '';
	document.getElementById('streak').textContent = state.streak;

	const extended = state.streak > 0 && state.lastActivityDay === dayString(new Date());
	document.getElementById('streak-label').classList.toggle('streak-extended', extended);

	document.getElementById('login-name-input').value = state.name || '';
}

function saveName(e) {
	e.preventDefault();
	state.name = document.getElementById('login-name-input').value.trim();
	saveState();
	refreshHeader();
	document.getElementById('login-panel').classList.add('hide');
}

// Word table interactions.

function toggleWord(e) {
	const rowEl = e.target.parentNode;
	if (rowEl.classList.contains('topic') || !rowEl.parentNode || rowEl.classList.contains('header')) return;

	const delta = rowEl.classList.contains('complete') ? -1 : 1;
	registerActivity();
	state.itemsToday += delta;
	state.itemsTotal += delta;
	rowEl.classList.toggle('complete');
	saveState();
	refreshHeader();
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

// Explicit surface for the sibling modules (sync.js, onboarding.js) so the
// cross-script contract is visible instead of each reaching into bare globals.
// Defined at file top-level, so it exists before any handler that uses it fires.
window.Sano = {
	get state() {
		return state;
	},
	saveState,
	refreshHeader,
	showScreen,
	renderHome,
	applyServerState,
	placeBefore,
	placementOptions,
	resetPathReveal() {
		pathRevealed = false;
	},
};
