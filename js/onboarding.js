// First-run onboarding: a scripted conversation in Sano's voice that captures
// the learner's name, then optionally walks them into a cloud account and daily
// reminders. Shown only when no name is saved yet (see maybeStart). The bubble
// styles are shared with the home-screen conversation (.thread / .bubble in
// css/sano.css and design/style-guide.html).
//
// State + screen control live in sano.js, reached through the global `Sano`
// surface (Sano.state, saveState, refreshHeader, showScreen, renderHome,
// resetPathReveal); this module only drives the conversation UI.
//
// NOTE: the Romanized Nepali strings below are a first draft — Ross corrects
// them during review. $NAME is substituted with the learner's name at render.

const SanoOnboard = (() => {
	// Each line is [romanizedNepali, english]. The Nepali shows large, English small.
	const L = {
		askName: ['Tapaiko naam ke ho?', 'What is your name?'],
		myName: ['Mero naam', 'My name is ___.'], // input is spliced into the Nepali line
		greet: ['Taparoolai bhetera khushi laagyo, $NAME!', 'Nice to meet you, $NAME!'],
		willSave: ['Ma tapaiko pragati surakshit garchu.', "I'll save your progress for you."],
		thanks: ['Dhanyabaad, Sano.', 'Thank you, Sano.'],
		askCloud: ['Ke ma tapaiko pragati cloud-ma pani surakshit garun?', 'Would you like me to also save your progress to the cloud?'],
		yes: ['Hunchha, kripaya.', 'Yes please.'],
		no: ['Aile haina.', 'Not right now.'],
		needCreds: ['Malai euta username ra password chahincha.', "I'll need a username and a password."],
		myCreds: ['Mero username', 'My username is ___ and my password is ___.'], // inputs spliced in
		askInstall: [
			'Yo app home screen-ma rakhnu bhayo bhane, ma har din paath sidhyauna samjhana garauna sakchu.',
			'If you save this app to your home screen, I can remind you daily to finish a lesson.',
		],
		showHow: ['Ke ma tapailai kasari garne dekhaun?', 'Should I show you how?'],
		done: ['Setup pura bhayo! Ab sikne bela.', 'Set up complete! Time to learn.'],
		// SR-10 placement step (Romanized Nepali drafts — Ross's to refine, like the rest):
		askExperience: ['Tapaile pahile Nepali siknu bhayeko cha?', 'Have you studied Nepali before?'],
		newLearner: ['Ma naulo sikne ho.', "I'm just starting out."],
		knowSome: ['Malai ali-ali Nepali aauncha.', 'I already know some.'],
		askLevel: ['Hami kaha bata suru garaun?', 'Where would you like to start?'],
		levelHint: ['Tapaile janne antim samuha chhannuhos.', "Tap the last group you're comfortable with — I'll start you just after it."],
		placed: ['Ramro! Suru garaun.', "Great — here's where we'll begin."],
		startBeginning: ['Suru dekhi nai.', 'Start me at the very beginning.'],
	};

	const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

	let screenEl, threadEl, controlsEl, diagramEl;

	// --- small DOM helpers (createElement, matching sano.js's no-innerHTML style) ---

	function el(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text != null) node.textContent = text;
		return node;
	}

	// npLines: array of items; each item is a string or an array of (string | node)
	// pieces, rendered as one `.np` paragraph. en: the English subtitle.
	function bubble(side, npLines, en, speaker) {
		const b = el('div', 'bubble ' + side);
		b.appendChild(el('p', 'speaker', speaker));
		for (const line of npLines) {
			const np = el('p', 'np');
			if (typeof line === 'string') {
				np.textContent = line;
			} else {
				for (const piece of line) np.append(typeof piece === 'string' ? document.createTextNode(piece) : piece);
			}
			b.appendChild(np);
		}
		if (en) b.appendChild(el('p', 'en', en));
		return b;
	}

	function sano(pair) {
		return bubble('sano', [pair[0]], pair[1], 'Sano');
	}

	function withName(pair) {
		return [pair[0].replace('$NAME', Sano.state.name), pair[1].replace('$NAME', Sano.state.name)];
	}

	function clear() {
		threadEl.textContent = '';
		controlsEl.textContent = '';
		diagramEl.classList.add('hide');
		screenEl.classList.remove('onboard-celebrate');
	}

	// Stagger the bubbles in, top to bottom (skipped under reduced motion via CSS).
	function reveal() {
		threadEl.classList.remove('reveal');
		void threadEl.offsetWidth;
		threadEl.classList.add('reveal');
		let i = 0;
		for (const child of threadEl.children) child.style.animationDelay = Math.min(i++ * 150, 750) + 'ms';
	}

	function primaryButton(label, onClick, disabled) {
		const btn = el('button', 'btn-primary onboard-primary', label);
		btn.type = 'button';
		btn.disabled = !!disabled;
		btn.addEventListener('click', onClick);
		return btn;
	}

	// Renders the two answer options as tappable user-style speech bubbles.
	function choices(options) {
		const wrap = el('div', 'onboard-choices');
		for (const opt of options) {
			const btn = el('button', 'bubble user choice');
			btn.type = 'button';
			btn.appendChild(el('p', 'np', opt.pair[0]));
			btn.appendChild(el('p', 'en', opt.pair[1]));
			btn.addEventListener('click', opt.onClick);
			wrap.appendChild(btn);
		}
		return wrap;
	}

	function bubbleInput(attrs) {
		const input = el('input', 'onboard-input');
		input.type = attrs.type || 'text';
		for (const k in attrs) if (k !== 'type') input.setAttribute(k, attrs[k]);
		return input;
	}

	// --- conversation states ---

	function show(name) {
		clear();
		if (name === 'name') return renderName();
		if (name === 'placement') return renderPlacement();
		if (name === 'level') return renderLevel();
		if (name === 'account') return renderAccount();
		if (name === 'creds') return renderCreds();
		if (name === 'install') return renderInstall();
		if (name === 'diagram') return renderDiagram();
		if (name === 'done') return renderDone();
	}

	function renderName() {
		const input = bubbleInput({ maxlength: '16', autocomplete: 'off', autocapitalize: 'words', 'aria-label': 'Your name' });
		threadEl.appendChild(sano(L.askName));
		threadEl.appendChild(bubble('user', [['Mero naam ', input, ' ho.']], L.myName[1], 'You'));

		const submit = primaryButton('ENTER', saveName, true);
		input.addEventListener('input', () => (submit.disabled = input.value.trim() === ''));
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && input.value.trim() !== '') saveName();
		});
		controlsEl.appendChild(submit);
		reveal();
		input.focus();
	}

	function saveName() {
		const input = threadEl.querySelector('.onboard-input');
		const value = input.value.trim();
		if (value === '') return;
		Sano.state.name = value;
		Sano.saveState();
		Sano.refreshHeader();
		show('placement');
	}

	// SR-10: after the name, greet and ask about prior experience. Brand-new
	// learners go straight on; those who know some Nepali get a starting-point picker.
	function renderPlacement() {
		threadEl.appendChild(sano(withName(L.greet)));
		threadEl.appendChild(sano(L.askExperience));
		controlsEl.appendChild(
			choices([
				{ pair: L.newLearner, onClick: () => show('account') },
				{ pair: L.knowSome, onClick: () => show('level') },
			]),
		);
		reveal();
	}

	// Skip-ahead picker: one option per path section the learner can test out of,
	// built from the course (Sano.placementOptions), plus a start-from-scratch out.
	function renderLevel() {
		threadEl.appendChild(sano(L.askLevel));
		threadEl.appendChild(sano(L.levelHint));
		const options = Sano.placementOptions().map((o) => ({
			pair: [o.known, o.blurb.slice(0, 4).join(', ') + (o.blurb.length > 4 ? '…' : '')],
			onClick: () => choosePlacement(o.startId, o.startSection),
		}));
		options.push({ pair: L.startBeginning, onClick: () => show('account') });
		controlsEl.appendChild(choices(options));
		reveal();
	}

	// Mark everything before the chosen section as known, confirm, then carry on.
	function choosePlacement(startId, startSection) {
		Sano.placeBefore(startId);
		clear();
		threadEl.appendChild(bubble('sano', [L.placed[0]], "Great — I'll start you at " + startSection + '.', 'Sano'));
		controlsEl.appendChild(primaryButton('Continue', () => show('account')));
		reveal();
	}

	function renderAccount() {
		threadEl.appendChild(sano(L.willSave));
		threadEl.appendChild(bubble('user', [L.thanks[0]], L.thanks[1], 'You'));
		threadEl.appendChild(sano(L.askCloud));
		controlsEl.appendChild(
			choices([
				{ pair: L.yes, onClick: () => show('creds') },
				{ pair: L.no, onClick: () => show('done') },
			]),
		);
		reveal();
	}

	function renderCreds() {
		const user = bubbleInput({ maxlength: '32', autocomplete: 'off', autocapitalize: 'none', 'aria-label': 'Username' });
		const pass = bubbleInput({ type: 'password', maxlength: '200', autocomplete: 'new-password', 'aria-label': 'Password' });

		threadEl.appendChild(sano(L.needCreds));
		threadEl.appendChild(
			bubble(
				'user',
				[
					['Mero username ', user, ' ho,'],
					['ra password ', pass, ' ho.'],
				],
				L.myCreds[1],
				'You',
			),
		);

		const error = el('p', 'onboard-error hide');
		const submit = primaryButton('Create account', () => createAccount(user.value.trim(), pass.value, error, submit));
		controlsEl.appendChild(submit);
		controlsEl.appendChild(error);
		reveal();
		user.focus();
	}

	// Validate client-side, then create the account on the server. On success the
	// endpoint sets a session cookie; SanoSync.adoptSession reconciles the local
	// onboarding progress up to the new account, then we move on to the install
	// step. Server-side validation is authoritative; this only saves a round-trip.
	async function createAccount(username, password, errorEl, submit) {
		if (!USERNAME_RE.test(username)) return showError(errorEl, 'Username must be 3–32 characters: a–z, 0–9, underscore.');
		if (password.length < 8) return showError(errorEl, 'Password must be at least 8 characters.');
		showError(errorEl, '');
		submit.disabled = true;

		let res;
		try {
			res = await fetch('api/register.php', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json', 'X-Sano-Request': '1' },
				body: JSON.stringify({ username, password }),
			});
		} catch (e) {
			submit.disabled = false;
			return showError(errorEl, 'Could not reach the server — try again.');
		}
		if (!res.ok) {
			submit.disabled = false;
			if (res.status === 409) return showError(errorEl, 'That username is taken — try another.');
			if (res.status === 429) return showError(errorEl, 'Too many sign-ups from here — try again later.');
			if (res.status === 400) return showError(errorEl, 'Please check your username and password.');
			return showError(errorEl, 'Could not create the account (' + res.status + ').');
		}

		let payload = {};
		try {
			payload = await res.json();
		} catch (e) {}
		SanoSync.adoptSession(username, payload);
		show('install');
	}

	function showError(errorEl, message) {
		errorEl.textContent = message;
		errorEl.classList.toggle('hide', message === '');
	}

	function renderInstall() {
		threadEl.appendChild(sano(L.askInstall));
		threadEl.appendChild(sano(L.showHow));
		controlsEl.appendChild(
			choices([
				{ pair: L.yes, onClick: () => show('diagram') },
				{ pair: L.no, onClick: () => show('done') },
			]),
		);
		reveal();
	}

	function renderDiagram() {
		threadEl.appendChild(sano(L.showHow));
		diagramEl.classList.remove('hide');
		controlsEl.appendChild(primaryButton('Continue', () => show('done')));
		reveal();
	}

	function renderDone() {
		screenEl.classList.add('onboard-celebrate');
		threadEl.appendChild(sano(L.done));
		controlsEl.appendChild(primaryButton('Continue', finish));
		reveal();
	}

	function finish() {
		Sano.state.onboarded = true;
		Sano.saveState();
		// Replay the path's entrance animation when the new learner first lands home
		// (it otherwise "revealed" invisibly behind the onboarding screen at boot).
		Sano.resetPathReveal();
		Sano.showScreen('home');
		Sano.renderHome();
	}

	// Entry point, called from sano.js boot. Runs the flow only for brand-new
	// users (no saved name); everyone else boots straight to the home screen.
	function maybeStart() {
		screenEl = document.getElementById('screen-onboarding');
		threadEl = document.getElementById('onboard-thread');
		controlsEl = document.getElementById('onboard-controls');
		diagramEl = document.getElementById('onboard-diagram');
		if (!screenEl || Sano.state.name) return;
		Sano.showScreen('onboarding');
		show('name');
	}

	return { maybeStart };
})();
