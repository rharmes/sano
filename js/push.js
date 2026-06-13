// Daily-reminder push subscriptions.
//
// Lifecycle:
//   - On boot, SanoPush.init() wires up the toggle in the login panel.
//   - SanoSync calls SanoPush.refresh() after login/logout to show/hide the row.
//   - Toggle on  → request notification permission → pushManager.subscribe(VAPID)
//                  → POST /api/push-subscribe.php (server stores endpoint + keys).
//   - Toggle off → POST /api/push-unsubscribe.php then pushManager.unsubscribe().
//
// iOS quirks worth knowing: Web Push only works inside an installed PWA (Safari tabs
// can't receive push). Permission requests must come from a user gesture. iOS 16.4+
// is the floor; you're on iOS 26 so this is fine.

const SanoPush = (() => {
	// VAPID public key — this is the server's push identity, safe to ship to the client.
	// Generated alongside the matching private key, which lives only in ~/sano-config.php.
	const VAPID_PUBLIC_KEY = 'BAFK1Ta_8ZEj1UeO4V8XqOEOj8RqoM-JIYpmlkkHfHq8EmxE55zfGvfV5hHI7Cg5psOLNJcMYmBlBVQrvE6D9PU';

	function isSupported() {
		return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
	}

	function isInstalled() {
		return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
	}

	function urlBase64ToUint8Array(base64) {
		const padding = '='.repeat((4 - (base64.length % 4)) % 4);
		const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(b64);
		const arr = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
		return arr;
	}

	async function getSubscription() {
		const reg = await navigator.serviceWorker.ready;
		return reg.pushManager.getSubscription();
	}

	async function enable() {
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') throw new Error('permission_denied');
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
		});
		const json = sub.toJSON();
		const res = await fetch('/api/push-subscribe.php', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json', 'X-Sano-Request': '1' },
			body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
		});
		if (!res.ok) {
			// Server rejected (likely 401 or DB error) — drop the local subscription so we don't
			// leave the browser holding a key the server can't deliver to.
			await sub.unsubscribe().catch(() => {});
			throw new Error('subscribe_rejected_' + res.status);
		}
	}

	async function disable() {
		const sub = await getSubscription();
		if (!sub) return;
		const json = sub.toJSON();
		await fetch('/api/push-unsubscribe.php', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json', 'X-Sano-Request': '1' },
			body: JSON.stringify({ endpoint: json.endpoint }),
		}).catch(() => {});
		await sub.unsubscribe();
	}

	let row, toggle, status;

	function showStatus(text) {
		if (!status) return;
		status.textContent = text;
		status.classList.toggle('hide', !text);
	}

	async function refresh() {
		if (!row) return;
		const loggedIn = !document.getElementById('logout-row').classList.contains('hide');
		row.classList.toggle('hide', !loggedIn);
		if (!loggedIn) return;

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
		toggle.disabled = false;
		const sub = await getSubscription();
		toggle.checked = !!sub && Notification.permission === 'granted';
		showStatus('');
	}

	function init() {
		row = document.getElementById('reminders-row');
		toggle = document.getElementById('reminders-toggle');
		status = document.getElementById('reminders-status');
		if (!row || !toggle) return;

		toggle.addEventListener('change', async () => {
			toggle.disabled = true;
			try {
				if (toggle.checked) await enable();
				else await disable();
				showStatus('');
			} catch (err) {
				console.warn('reminders toggle failed:', err);
				showStatus(err.message === 'permission_denied' ? 'Notification permission was denied.' : 'Could not update reminders.');
			} finally {
				await refresh();
			}
		});

		refresh();
	}

	return { init, refresh };
})();
