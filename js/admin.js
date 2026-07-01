// Admin dashboard logic (/admin/). Loads the user list from /api/admin-users.php,
// renders a sortable table, and drives the reset-password / delete-user modals.
//
// COURSE (js/data.js) is loaded first; path position is derived client-side,
// mirroring sano.js's unitIsComplete — a unit is complete when every item has
// GRADUATED (the SR-05 mastery gate), and (units unlock in order) the first
// incomplete unit is the current position. The API returns each user's graduated
// item ids. ?demo=1 renders sample rows with stubbed actions for local UI review,
// since the real table needs the server DB (there's no local MySQL).
(function () {
	'use strict';

	const DEMO = new URLSearchParams(location.search).get('demo') === '1';
	const TOTAL_UNITS = COURSE.length;
	const $ = (id) => document.getElementById(id);

	let me = null; // the admin's own username — its row can't be deleted
	let rows = []; // [{ username, pathLabel, pathSort, streak, syncedLabel, syncedSort, isSelf }]
	let sortKey = 'username';
	let sortDir = 'asc';
	let resetUser = null;
	let deleteUser = null;

	// ── derived columns ──────────────────────────────────────────────────────

	function pathPosition(masteredSet) {
		let complete = 0;
		for (const unit of COURSE) {
			if (unit.items.every((it) => masteredSet.has(it.id))) complete++;
			else break;
		}
		if (complete >= TOTAL_UNITS) return { label: 'Done', sort: TOTAL_UNITS + 1 };
		return { label: String(complete + 1), sort: complete + 1 };
	}

	function syncedDisplay(ms) {
		if (ms == null) return { label: 'Never', sort: null };
		const d = new Date(ms);
		const p = (n) => String(n).padStart(2, '0');
		const hour = d.getHours() % 12 || 12;
		const ampm = d.getHours() < 12 ? 'AM' : 'PM';
		const label = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${hour}:${p(d.getMinutes())} ${ampm}`;
		return { label, sort: ms };
	}

	function toRow(u) {
		const path = pathPosition(new Set(u.graduated || []));
		const synced = syncedDisplay(u.lastSyncedAt);
		return {
			username: u.username,
			pathLabel: path.label,
			pathSort: path.sort,
			streak: u.streak || 0,
			syncedLabel: synced.label,
			syncedSort: synced.sort,
			isSelf: u.username === me,
		};
	}

	// ── sorting ──────────────────────────────────────────────────────────────

	const COLUMNS = [
		{ key: 'username', label: 'Username', sortable: true },
		{ key: 'path', label: 'Path', sortable: true },
		{ key: 'streak', label: 'Streak', icon: 'ai-bolt', sortable: true },
		{ key: 'synced', label: 'Last synced', sortable: true },
		{ key: 'reset', label: '', sortable: false },
		{ key: 'delete', label: '', sortable: false },
	];

	function sortRows() {
		const dir = sortDir === 'asc' ? 1 : -1;
		rows.sort((a, b) => {
			// "Never" always sorts last, regardless of direction.
			if (sortKey === 'synced') {
				const an = a.syncedSort == null;
				const bn = b.syncedSort == null;
				if (an && bn) return a.username.localeCompare(b.username);
				if (an) return 1;
				if (bn) return -1;
			}
			let c = 0;
			if (sortKey === 'username') c = a.username.localeCompare(b.username);
			else if (sortKey === 'path') c = a.pathSort - b.pathSort;
			else if (sortKey === 'streak') c = a.streak - b.streak;
			else if (sortKey === 'synced') c = a.syncedSort - b.syncedSort;
			if (c === 0) c = a.username.localeCompare(b.username); // stable tie-break
			return c * dir;
		});
	}

	function onSort(key) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = 'asc';
		}
		render();
	}

	// ── rendering ────────────────────────────────────────────────────────────

	const SORT_ARROW = '<span class="admin-sort-arrow"><svg aria-hidden="true"><use href="#ai-sort" /></svg></span>';

	function render() {
		sortRows();
		const content = $('admin-content');
		content.textContent = '';

		if (!rows.length) {
			showNotice('No users yet.');
			return;
		}

		const wrap = document.createElement('div');
		wrap.className = 'admin-table-wrap';
		const table = document.createElement('table');
		table.className = 'admin-table';

		const thead = document.createElement('thead');
		const htr = document.createElement('tr');
		for (const col of COLUMNS) {
			const th = document.createElement('th');
			// A column may show an icon (the streak bolt) instead of text; `label` is still
			// its accessible name. Reset/delete have an empty label — their buttons' aria-labels
			// describe them, so the headers stay blank for density.
			const heading = col.icon ? '<svg class="admin-th-icon" aria-hidden="true"><use href="#' + col.icon + '" /></svg>' : esc(col.label);
			if (col.label) th.setAttribute('aria-label', col.label);
			if (col.sortable) {
				th.className = 'admin-th-sort';
				th.tabIndex = 0;
				th.setAttribute('role', 'button');
				if (sortKey === col.key) th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
				th.innerHTML = heading + SORT_ARROW;
				th.addEventListener('click', () => onSort(col.key));
				th.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onSort(col.key);
					}
				});
			} else if (col.icon) {
				th.innerHTML = heading;
			} else {
				th.textContent = col.label;
			}
			htr.appendChild(th);
		}
		thead.appendChild(htr);
		table.appendChild(thead);

		const tbody = document.createElement('tbody');
		for (const row of rows) {
			const tr = document.createElement('tr');

			tr.appendChild(cell(row.username, 'admin-username'));
			tr.appendChild(cell(row.pathLabel));
			tr.appendChild(cell(String(row.streak), 'admin-cell-num'));

			const syncedTd = cell(row.syncedLabel);
			if (row.syncedSort == null) syncedTd.classList.add('admin-never');
			tr.appendChild(syncedTd);

			const resetTd = document.createElement('td');
			resetTd.className = 'admin-action-cell';
			resetTd.appendChild(iconButton('reset', 'ai-key', 'Reset ' + row.username + '’s password', () => openReset(row.username)));
			tr.appendChild(resetTd);

			const delTd = document.createElement('td');
			delTd.className = 'admin-action-cell';
			const delBtn = iconButton('delete', 'ai-delete', 'Delete ' + row.username, () => openDelete(row.username));
			if (row.isSelf) {
				delBtn.disabled = true;
				delBtn.title = 'You can’t delete your own account';
			}
			delTd.appendChild(delBtn);
			tr.appendChild(delTd);

			tbody.appendChild(tr);
		}
		table.appendChild(tbody);
		wrap.appendChild(table);
		content.appendChild(wrap);
	}

	function cell(text, cls) {
		const td = document.createElement('td');
		td.textContent = text;
		if (cls) td.className = cls;
		return td;
	}

	function iconButton(kind, symbol, label, onClick) {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'admin-action ' + kind;
		b.title = label;
		b.setAttribute('aria-label', label);
		b.innerHTML = '<svg aria-hidden="true"><use href="#' + symbol + '" /></svg>';
		b.addEventListener('click', onClick);
		return b;
	}

	function esc(s) {
		return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
	}

	function showNotice(html) {
		$('admin-content').innerHTML = '<p class="admin-notice">' + html + '</p>';
	}

	function status(msg, isError) {
		const el = $('admin-status');
		el.textContent = msg || '';
		el.classList.toggle('error', !!isError);
	}

	// ── modals ───────────────────────────────────────────────────────────────

	function openReset(username) {
		resetUser = username;
		$('admin-reset-title').textContent = 'Reset password — ' + username;
		$('admin-reset-password').value = '';
		$('admin-reset-error').classList.add('hide');
		$('admin-reset-dialog').showModal();
		$('admin-reset-password').focus();
	}

	async function submitReset(e) {
		e.preventDefault();
		const pw = $('admin-reset-password').value;
		if (pw.length < 8) {
			showError('admin-reset-error', 'At least 8 characters.');
			return;
		}
		if (DEMO) {
			$('admin-reset-dialog').close();
			status('Password reset for ' + resetUser + ' (demo).');
			return;
		}
		const res = await postJson('admin-reset-password.php', { username: resetUser, password: pw });
		if (res && res.ok) {
			$('admin-reset-dialog').close();
			status('Password reset for ' + resetUser + ' — they’ve been signed out on all devices.');
		} else {
			showError('admin-reset-error', errText(res));
		}
	}

	function openDelete(username) {
		deleteUser = username;
		$('admin-delete-title').textContent = 'Delete ' + username + '?';
		$('admin-delete-body').innerHTML = 'This permanently removes <b>' + esc(username) + '</b> and all their progress. This can’t be undone.';
		$('admin-delete-error').classList.add('hide');
		$('admin-delete-dialog').showModal();
	}

	async function confirmDelete() {
		if (DEMO) {
			$('admin-delete-dialog').close();
			rows = rows.filter((r) => r.username !== deleteUser);
			render();
			status('Deleted ' + deleteUser + ' (demo).');
			return;
		}
		const res = await postJson('admin-delete-user.php', { username: deleteUser });
		if (res && res.ok) {
			$('admin-delete-dialog').close();
			rows = rows.filter((r) => r.username !== deleteUser);
			render();
			status('Deleted ' + deleteUser + '.');
		} else {
			showError('admin-delete-error', errText(res));
		}
	}

	function showError(id, msg) {
		const el = $(id);
		el.textContent = msg;
		el.classList.remove('hide');
	}

	function errText(res) {
		if (!res) return 'Could not reach the server.';
		const map = {
			missing_fields: 'Missing a required field.',
			bad_password: 'Password must be 8–200 characters.',
			no_such_user: 'That user no longer exists.',
			cannot_delete_self: 'You can’t delete your own account.',
			forbidden: 'Your session is not an admin.',
		};
		return (res.body && map[res.body.error]) || 'Failed (' + res.status + ').';
	}

	async function postJson(path, body) {
		try {
			const res = await fetch('/api/' + path, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-Sano-Request': '1' },
				body: JSON.stringify(body),
			});
			let parsed = null;
			try {
				parsed = await res.json();
			} catch (e) {}
			return { ok: res.ok, status: res.status, body: parsed };
		} catch (e) {
			return null;
		}
	}

	// ── demo data (local UI review without a DB) ─────────────────────────────

	function masterUpTo(unitCount) {
		const ids = [];
		for (let i = 0; i < unitCount && i < COURSE.length; i++) for (const it of COURSE[i].items) ids.push(it.id);
		return ids;
	}

	function demoUsers() {
		const now = Date.now();
		return [
			{ username: 'aastha', lastSyncedAt: now - 2 * 3600e3, streak: 12, graduated: masterUpTo(2) },
			{ username: 'bishal', lastSyncedAt: now - 26 * 3600e3, streak: 47, graduated: masterUpTo(16) },
			{ username: 'chandra', lastSyncedAt: now - 9 * 864e5, streak: 0, graduated: masterUpTo(5) },
			{ username: 'naya', lastSyncedAt: null, streak: 0, graduated: [] },
			{ username: 'ross', lastSyncedAt: now - 5 * 60e3, streak: 103, graduated: masterUpTo(COURSE.length) },
		];
	}

	// ── load ─────────────────────────────────────────────────────────────────

	async function load() {
		if (DEMO) {
			me = 'ross';
			rows = demoUsers().map(toRow);
			render();
			status('Demo mode — sample data; reset/delete are stubbed.');
			return;
		}
		let res;
		try {
			res = await fetch('/api/admin-users.php');
		} catch (e) {
			showNotice('Could not reach the server.');
			return;
		}
		if (res.status === 401) {
			showNotice('Please <a href="/">sign in</a> as an admin to view this page.');
			return;
		}
		if (res.status === 403) {
			showNotice('This account isn’t an admin. <a href="/">Back to Sano</a>.');
			return;
		}
		if (!res.ok) {
			showNotice('Failed to load users (' + res.status + ').');
			return;
		}
		const data = await res.json();
		me = data.me;
		rows = data.users.map(toRow);
		render();
	}

	function init() {
		document.querySelectorAll('[data-admin-cancel]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
		$('admin-reset-form').addEventListener('submit', submitReset);
		$('admin-delete-confirm').addEventListener('click', confirmDelete);
		load();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
