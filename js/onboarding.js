// First-run onboarding: a scripted conversation in Sano's voice that captures
// the learner's name, then optionally walks them into a cloud account and daily
// reminders. Shown only when no name is saved yet (see maybeStart). The bubble
// styles are shared with the home-screen conversation (.thread / .bubble in
// css/sano.css and design/style-guide.html).
//
// State lives in sano.js (global `state`, plus saveState / refreshHeader /
// showScreen / renderHome); this module only drives the conversation UI.
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
		optional: ['Yo aniwarya haina.', 'This is optional.'],
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
		return [pair[0].replace('$NAME', state.name), pair[1].replace('$NAME', state.name)];
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
		const btn = el('button', 'onboard-primary', label);
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
		state.name = value;
		saveState();
		refreshHeader();
		show('account');
	}

	function renderAccount() {
		threadEl.appendChild(sano(withName(L.greet)));
		threadEl.appendChild(sano(L.willSave));
		threadEl.appendChild(bubble('user', [L.thanks[0]], L.thanks[1], 'You'));
		threadEl.appendChild(sano(L.askCloud));
		threadEl.appendChild(sano(L.optional));
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
		const submit = primaryButton('Create account', () => createAccount(user.value.trim(), pass.value, error));
		controlsEl.appendChild(submit);
		controlsEl.appendChild(error);
		reveal();
		user.focus();
	}

	// Phase 1: validate client-side and advance (stub). Phase 2 will POST these to
	// api/register.php, establish a session via SanoSync, then advance to install.
	function createAccount(username, password, errorEl) {
		if (!USERNAME_RE.test(username)) return showError(errorEl, 'Username must be 3–32 characters: a–z, 0–9, underscore.');
		if (password.length < 8) return showError(errorEl, 'Password must be at least 8 characters.');
		showError(errorEl, '');
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
		state.onboarded = true;
		saveState();
		// Replay the path's entrance animation when the new learner first lands home
		// (it otherwise "revealed" invisibly behind the onboarding screen at boot).
		pathRevealed = false;
		showScreen('home');
		renderHome();
	}

	// Entry point, called from sano.js boot. Runs the flow only for brand-new
	// users (no saved name); everyone else boots straight to the home screen.
	function maybeStart() {
		screenEl = document.getElementById('screen-onboarding');
		threadEl = document.getElementById('onboard-thread');
		controlsEl = document.getElementById('onboard-controls');
		diagramEl = document.getElementById('onboard-diagram');
		if (!screenEl || state.name) return;
		showScreen('onboarding');
		show('name');
	}

	return { maybeStart };
})();
