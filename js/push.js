// Daily-reminder push subscriptions and per-user schedule.
//
// Two pieces work together: a push *subscription* (per browser/device, stored by
// api/push-subscribe.php) is how a notification is delivered; a *reminder time*
// (per account: reminder_hour + reminder_tz, stored by api/reminder.php) is when
// the server's hourly cron decides to send. A reminder is "on" only when both
// exist, so enabling collects a time and subscribes together.
//
// UI: a toggle + time label live in the login panel (signed in AND installed
// PWA only). A one-time setup modal also nudges an installed, signed-in PWA that
// has no reminder configured yet.
//
// iOS quirks: Web Push only works inside an installed PWA (Safari tabs can't
// receive push); permission requests must come from a user gesture; iOS 16.4+ is
// the floor.

const SanoPush = (() => {
	// VAPID public key — the server's push identity, safe to ship to the client.
	// Generated alongside the matching private key, which lives only in ~/sano-config.php.
	const VAPID_PUBLIC_KEY = 'BAFK1Ta_8ZEj1UeO4V8XqOEOj8RqoM-JIYpmlkkHfHq8EmxE55zfGvfV5hHI7Cg5psOLNJcMYmBlBVQrvE6D9PU';
	const DISMISS_KEY = 'sano.reminderDismissed';

	function isSupported() {
		return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
	}

	function isInstalled() {
		return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
	}

	function detectTz() {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
		} catch (e) {
			return 'UTC';
		}
	}

	function formatHour(h) {
		const ampm = h < 12 ? 'AM' : 'PM';
		const h12 = h % 12 === 0 ? 12 : h % 12;
		return h12 + ':00 ' + ampm;
	}

	function urlBase64ToUint8Array(base64) {
		const padding = '='.repeat((4 - (base64.length % 4)) % 4);
		const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(b64);
		const arr = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
		return arr;
	}

	function api(path, options = {}) {
		options.credentials = 'include';
		options.headers = Object.assign({ 'X-Sano-Request': '1' }, options.headers || {});
		if (options.body !== undefined) options.headers['Content-Type'] = 'application/json';
		return fetch('/api/' + path, options);
	}

	async function getSubscription() {
		const reg = await navigator.serviceWorker.ready;
		return reg.pushManager.getSubscription();
	}

	// Request permission and subscribe this device's browser for push.
	async function enable() {
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') throw new Error('permission_denied');
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
		});
		const json = sub.toJSON();
		const res = await api('push-subscribe.php', { method: 'POST', body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
		if (!res.ok) {
			// Server rejected (likely 401 or DB error) — drop the local subscription so we
			// don't leave the browser holding a key the server can't deliver to.
			await sub.unsubscribe().catch(() => {});
			throw new Error('subscribe_rejected_' + res.status);
		}
	}

	async function disable() {
		const sub = await getSubscription();
		if (!sub) return;
		const json = sub.toJSON();
		await api('push-unsubscribe.php', { method: 'POST', body: JSON.stringify({ endpoint: json.endpoint }) }).catch(() => {});
		await sub.unsubscribe();
	}

	// Account-level reminder schedule, mirrored from api/reminder.php.
	let reminderConfig = null; // { hour, tz } or null

	async function fetchReminder() {
		try {
			const res = await api('reminder.php');
			if (!res.ok) {
				reminderConfig = null;
				return;
			}
			const body = await res.json();
			reminderConfig = body.hour === null || body.hour === undefined ? null : { hour: body.hour, tz: body.tz };
		} catch (e) {
			reminderConfig = null;
		}
	}

	async function saveReminder(hour, tz) {
		try {
			const res = await api('reminder.php', { method: 'POST', body: JSON.stringify({ hour, tz }) });
			if (!res.ok) return false;
			reminderConfig = { hour, tz };
			return true;
		} catch (e) {
			return false;
		}
	}

	async function clearReminder() {
		try {
			await api('reminder.php', { method: 'POST', body: JSON.stringify({ disable: true }) });
		} catch (e) {}
		reminderConfig = null;
	}

	// --- Login-panel row ---

	let row, toggle, status;

	function showStatus(text) {
		if (!status) return;
		status.textContent = text;
		status.classList.toggle('hide', !text);
	}

	function updateLabel() {
		const label = document.getElementById('reminders-label');
		const edit = document.getElementById('reminders-edit');
		if (reminderConfig) {
			label.textContent = 'Daily reminder at ' + formatHour(reminderConfig.hour);
			edit.classList.remove('hide');
		} else {
			label.textContent = 'Daily reminder';
			edit.classList.add('hide');
		}
	}

	async function refresh() {
		if (!row) return;
		const loggedIn = !document.getElementById('logout-row').classList.contains('hide');
		row.classList.toggle('hide', !loggedIn);
		document.getElementById('reminders-edit').classList.add('hide');
		if (!loggedIn) {
			reminderConfig = null;
			return;
		}

		if (!isSupported()) {
			toggle.checked = false;
			toggle.disabled = true;
			showStatus('Reminders aren’t available in this browser.');
			return;
		}
		if (!isInstalled()) {
			toggle.checked = false;
			toggle.disabled = true;
			showStatus('Add Sano to your home screen to enable reminders.');
			return;
		}
		if (Notification.permission === 'denied') {
			toggle.checked = false;
			toggle.disabled = true;
			showStatus('Notifications are blocked in iOS settings.');
			return;
		}

		await fetchReminder();
		const sub = await getSubscription();
		toggle.disabled = false;
		toggle.checked = !!sub && Notification.permission === 'granted' && reminderConfig !== null;
		updateLabel();
		showStatus('');
		maybeShowModal();
	}

	// --- Setup modal ---

	let modalShown = false; // once per page load for the proactive prompt
	let modalAuto = false; // whether the open was the proactive nudge (vs a click)
	let selectsBuilt = false;

	function buildSelects() {
		if (selectsBuilt) return;
		selectsBuilt = true;
		const hourSel = document.getElementById('reminder-hour');
		for (let h = 0; h < 24; h++) {
			const opt = document.createElement('option');
			opt.value = String(h);
			opt.textContent = formatHour(h);
			hourSel.appendChild(opt);
		}
		const tzSel = document.getElementById('reminder-tz');
		let zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
		if (!zones || !zones.length) zones = [detectTz()];
		if (zones.indexOf(detectTz()) === -1) zones = [detectTz()].concat(zones);
		for (const z of zones) {
			const opt = document.createElement('option');
			opt.value = z;
			opt.textContent = z.replace(/_/g, ' ');
			tzSel.appendChild(opt);
		}
	}

	function openModal(auto) {
		modalAuto = !!auto;
		buildSelects();
		document.getElementById('reminder-hour').value = String(reminderConfig ? reminderConfig.hour : 19);
		document.getElementById('reminder-tz').value = (reminderConfig && reminderConfig.tz) || detectTz();
		document.getElementById('reminder-modal-error').classList.add('hide');
		const modal = document.getElementById('reminder-modal');
		if (!modal.open) modal.showModal();
	}

	function closeModal() {
		const modal = document.getElementById('reminder-modal');
		if (modal.open) modal.close();
	}

	function maybeShowModal() {
		if (modalShown) return;
		if (!isSupported() || !isInstalled()) return;
		if (Notification.permission === 'denied') return;
		if (reminderConfig !== null) return;
		if (localStorage.getItem(DISMISS_KEY)) return;
		if (document.getElementById('screen-home').classList.contains('hide')) return; // home only
		modalShown = true;
		openModal(true);
	}

	async function onSave() {
		const hour = parseInt(document.getElementById('reminder-hour').value, 10);
		const tz = document.getElementById('reminder-tz').value;
		const saveBtn = document.getElementById('reminder-save');
		const errEl = document.getElementById('reminder-modal-error');
		const showError = (msg) => {
			errEl.textContent = msg;
			errEl.classList.remove('hide');
			saveBtn.disabled = false;
		};
		saveBtn.disabled = true;
		try {
			await enable();
		} catch (e) {
			return showError(e.message === 'permission_denied' ? 'Notification permission was denied.' : 'Could not enable notifications.');
		}
		if (!(await saveReminder(hour, tz))) return showError('Could not save the reminder — try again.');
		saveBtn.disabled = false;
		closeModal();
		refresh();
	}

	function onCancel() {
		if (modalAuto) localStorage.setItem(DISMISS_KEY, '1');
		closeModal();
		refresh();
	}

	async function onToggle() {
		if (toggle.checked) {
			openModal(false); // collect the time first, then enable + save
		} else {
			toggle.disabled = true;
			try {
				await disable();
				await clearReminder();
			} finally {
				refresh();
			}
		}
	}

	function init() {
		row = document.getElementById('reminders-row');
		toggle = document.getElementById('reminders-toggle');
		status = document.getElementById('reminders-status');
		if (!row || !toggle) return;

		toggle.addEventListener('change', onToggle);
		document.getElementById('reminders-edit').addEventListener('click', () => openModal(false));
		document.getElementById('reminder-save').addEventListener('click', onSave);
		document.getElementById('reminder-cancel').addEventListener('click', onCancel);
		const modal = document.getElementById('reminder-modal');
		// Click on the ::backdrop (outside the dialog box) cancels. Coordinate check
		// so a click on the dialog's own padding doesn't count as a backdrop click.
		modal.addEventListener('click', (e) => {
			const r = modal.getBoundingClientRect();
			if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onCancel();
		});
		// Escape fires the dialog's native `cancel`; route it through onCancel so the
		// dismiss flag + UI refresh still run (then close it ourselves).
		modal.addEventListener('cancel', (e) => {
			e.preventDefault();
			onCancel();
		});

		refresh();
	}

	return { init, refresh };
})();
