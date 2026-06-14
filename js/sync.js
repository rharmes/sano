// Server sync. localStorage stays the working copy so the app works offline;
// the server (api/) is the source of truth across devices. Conflicts are
// detected by revision number and resolved last-write-wins by timestamp.
// sano.js calls SanoSync.init() at boot and SanoSync.markDirty() on every save.

const SanoSync = (() => {
	const SYNC_KEY = 'sano.sync.v1';
	const PUSH_DEBOUNCE_MS = 2000;

	let meta = loadMeta();
	let pushTimer = null;
	let pushing = false;

	function loadMeta() {
		let parsed = null;
		try {
			parsed = JSON.parse(localStorage.getItem(SYNC_KEY));
		} catch (e) {}
		// username is only a UI hint; the HttpOnly cookie is the credential.
		return Object.assign({ revision: 0, dirty: false, localModifiedAt: 0, username: null, lastUsername: null }, parsed || {});
	}

	function saveMeta() {
		localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
	}

	// The custom header doubles as the CSRF guard: the API rejects requests
	// without it, and cross-origin pages can't send it.
	function api(path, options = {}) {
		options.headers = Object.assign({ 'X-Sano-Request': '1' }, options.headers || {});
		if (options.body !== undefined) options.headers['Content-Type'] = 'application/json';
		return fetch('api/' + path, options);
	}

	function init() {
		document.getElementById('account-button').addEventListener('click', togglePanel);
		document.getElementById('login-form').addEventListener('submit', submitLogin);
		document.getElementById('logout-button').addEventListener('click', logout);
		window.addEventListener('online', () => {
			if (meta.dirty && meta.username) schedulePush();
		});
		// Don't lose the tail end of a study session when the tab closes.
		window.addEventListener('pagehide', flush);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') flush();
		});
		updateUi();
		if (meta.username) refresh();
	}

	async function refresh() {
		let res;
		try {
			res = await api('state.php');
		} catch (e) {
			return; // Offline; the 'online' listener retries.
		}
		if (res.status === 401) {
			setLoggedOut();
			return;
		}
		if (!res.ok) return;
		reconcile(await res.json());
	}

	function reconcile(server) {
		if (server.state === null) {
			push(true); // Fresh account: import the local progress.
			return;
		}
		// This browser has never synced with the account (fresh device or a
		// different account): the server copy is the real history. Adopting it
		// beats letting five minutes of local demo progress clobber months.
		if (meta.revision === 0) {
			adopt(server);
			return;
		}
		if (!meta.dirty) {
			adopt(server);
			return;
		}
		if (server.revision === meta.revision) {
			schedulePush(0);
			return;
		}
		// Both sides changed since the last sync: newest wins, loser is dropped.
		if (meta.localModifiedAt > server.updatedAt) push(true);
		else adopt(server);
	}

	function adopt(server) {
		meta.revision = server.revision;
		meta.dirty = false;
		saveMeta();
		Sano.applyServerState(server.state);
	}

	function schedulePush(delay = PUSH_DEBOUNCE_MS) {
		clearTimeout(pushTimer);
		pushTimer = setTimeout(() => push(), delay);
	}

	// Called from saveState() after every local write.
	function markDirty() {
		meta.dirty = true;
		meta.localModifiedAt = Date.now();
		saveMeta();
		if (meta.username) schedulePush();
	}

	async function push(force = false, keepalive = false) {
		if (pushing && !keepalive) {
			schedulePush();
			return;
		}
		pushing = true;
		clearTimeout(pushTimer);
		let res;
		try {
			res = await api('state.php', {
				method: 'PUT',
				keepalive,
				body: JSON.stringify({ state: Sano.state, baseRevision: meta.revision, force }),
			});
		} catch (e) {
			pushing = false;
			return; // Still dirty; retried on 'online' or the next save.
		}
		pushing = false;
		if (res.status === 401) {
			setLoggedOut();
			return;
		}
		if (res.status === 409) {
			reconcile(await res.json());
			return;
		}
		if (!res.ok) return;
		const body = await res.json();
		meta.revision = body.revision;
		meta.dirty = false;
		saveMeta();
	}

	function flush() {
		if (meta.dirty && meta.username) push(false, true);
	}

	// Login panel.

	function togglePanel() {
		document.getElementById('login-panel').classList.toggle('hide');
		const error = document.getElementById('login-error');
		error.classList.add('hide');
		if (!meta.username) document.getElementById('login-username').focus();
	}

	function hidePanel() {
		document.getElementById('login-panel').classList.add('hide');
	}

	function showLoginError(message) {
		const error = document.getElementById('login-error');
		error.textContent = message;
		error.classList.toggle('hide', message === '');
	}

	async function submitLogin(e) {
		e.preventDefault();
		const username = document.getElementById('login-username').value.trim();
		const password = document.getElementById('login-password').value;
		if (username === '' || password === '') return;
		showLoginError('');
		let res;
		try {
			res = await api('login.php', { method: 'POST', body: JSON.stringify({ username, password }) });
		} catch (e) {
			showLoginError('Could not reach the server — try again.');
			return;
		}
		if (res.status === 401) {
			showLoginError('Wrong username or password.');
			return;
		}
		if (res.status === 429) {
			const body = await res.json();
			showLoginError('Too many attempts — try again in ' + Math.ceil(body.retryAfter / 60) + ' min.');
			return;
		}
		if (!res.ok) {
			showLoginError('Sign-in failed (' + res.status + ').');
			return;
		}
		const body = await res.json();
		document.getElementById('login-password').value = '';
		hidePanel();
		adoptSession(username, body);
	}

	// Adopt a freshly authenticated session (from login.php or register.php) and
	// reconcile local progress against it. `body` is the endpoint's JSON payload
	// (the same {state, revision, updatedAt} shape both endpoints return).
	function adoptSession(username, body) {
		// A revision counter only means something for the account it came from.
		if (meta.lastUsername !== username) meta.revision = 0;
		meta.username = username;
		meta.lastUsername = username;
		saveMeta();
		updateUi();
		reconcile(body);
	}

	async function logout() {
		if (meta.dirty) await push(); // Final push before the session dies.
		try {
			await api('logout.php', { method: 'POST' });
		} catch (e) {}
		setLoggedOut();
		hidePanel();
	}

	function setLoggedOut() {
		meta.username = null;
		saveMeta();
		updateUi();
	}

	function updateUi() {
		const signedIn = meta.username !== null;
		document.getElementById('account-button').classList.toggle('signed-in', signedIn);
		document.getElementById('account-button').title = signedIn ? 'Account (' + meta.username + ')' : 'Sign in to sync';
		document.getElementById('login-form').classList.toggle('hide', signedIn);
		document.getElementById('logout-row').classList.toggle('hide', !signedIn);
		if (signedIn) document.getElementById('login-status').textContent = 'Signed in as ' + meta.username;
		if (typeof SanoPush !== 'undefined') SanoPush.refresh();
	}

	return { init, markDirty, adoptSession };
})();
