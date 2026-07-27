// Traffic tab of the admin dashboard (/admin/#traffic, T40). Defines the global
// SanoAdminTraffic; js/admin.js owns the tabs and calls show() the first time the tab
// is opened (the fetch is lazy — a visit to the Users tab never pays for it).
//
// Everything shown comes from /api/admin-traffic.php, which reads the aggregate tables
// tools/ingest-traffic.php fills nightly from the Apache access logs. Two consequences
// worth remembering while reading this file: numbers end at the last INGESTED day (today
// is still being written, so it isn't stored), and a "visitor" is a salted hash of
// IP + User-Agent — close to a person, but a phone that changes networks is two.
//
// The chart is plain HTML/CSS bars rather than SVG: it has to stay readable from 320px to
// desktop with no build step, and CSS bars reflow where a fixed viewBox would either
// shrink its own labels to nothing or distort. Per-day stack = new visitors over
// returning ones, 2px gap between the segments, rounded top on the stack, no label on
// every bar (hover for the numbers, or open the daily table underneath).
(function () {
	'use strict';

	const DEMO = new URLSearchParams(location.search).get('demo') === '1';
	const RANGES = [
		['7', '7 days'],
		['30', '30 days'],
		['90', '90 days'],
		['all', 'All time'],
	];

	let range = '30';
	let includeMine = false;
	let root = null;
	let loading = false;

	// ── formatting ───────────────────────────────────────────────────────────

	const num = (n) => Number(n || 0).toLocaleString();

	// Intl.DisplayNames is built into every browser we support, so country names cost
	// no bundled table and no network call (the app makes none at runtime).
	const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

	function countryName(code) {
		if (!code) return 'Unknown';
		try {
			return (regionNames && regionNames.of(code)) || code;
		} catch (e) {
			return code;
		}
	}

	// Regional-indicator pair: 'NP' -> the Nepal flag. Renders as letters where flags
	// aren't supported (Windows), which is a fine fallback next to the name.
	function flag(code) {
		if (!code || code.length !== 2) return '🌐';
		return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
	}

	function shortDay(iso) {
		const [, m, d] = iso.split('-');
		return Number(m) + '/' + Number(d);
	}

	function longDay(iso) {
		const dt = new Date(iso + 'T12:00:00');
		return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
	}

	// ── small DOM helpers (no innerHTML with server data) ────────────────────

	function el(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	function card(title, note) {
		const c = el('section', 'tr-card');
		if (title) c.appendChild(el('h2', 'tr-card-title', title));
		if (note) c.appendChild(el('p', 'tr-card-note', note));
		return c;
	}

	function table(headers, rows, emptyText) {
		if (!rows.length) return el('p', 'tr-empty', emptyText);
		const wrap = el('div', 'admin-table-wrap');
		const t = el('table', 'admin-table tr-table');
		const thead = el('thead');
		const htr = el('tr');
		headers.forEach((h, i) => {
			const th = el('th', i > 0 ? 'tr-num' : null, h);
			htr.appendChild(th);
		});
		thead.appendChild(htr);
		t.appendChild(thead);
		const tbody = el('tbody');
		for (const row of rows) {
			const tr = el('tr');
			row.forEach((cellValue, i) => {
				const td = el('td', i > 0 ? 'tr-num admin-cell-num' : null);
				if (cellValue instanceof Node) td.appendChild(cellValue);
				else td.textContent = cellValue;
				tr.appendChild(td);
			});
			tbody.appendChild(tr);
		}
		t.appendChild(tbody);
		wrap.appendChild(t);
		return wrap;
	}

	// ── controls ─────────────────────────────────────────────────────────────

	function controls(data) {
		const bar = el('div', 'tr-controls');
		const group = el('div', 'tr-range', null);
		group.setAttribute('role', 'group');
		group.setAttribute('aria-label', 'Time range');
		for (const [value, label] of RANGES) {
			const b = el('button', 'tr-range-btn', label);
			b.type = 'button';
			if (value === range) b.setAttribute('aria-pressed', 'true');
			else b.setAttribute('aria-pressed', 'false');
			b.addEventListener('click', () => {
				if (range === value) return;
				range = value;
				load();
			});
			group.appendChild(b);
		}
		bar.appendChild(group);

		// Ross's own testing is most of the real traffic, so it's hidden by default; the
		// ingest flags any visitor whose session touched /admin/.
		const label = el('label', 'tr-toggle');
		const box = document.createElement('input');
		box.type = 'checkbox';
		box.checked = includeMine;
		box.addEventListener('change', () => {
			includeMine = box.checked;
			load();
		});
		label.appendChild(box);
		label.appendChild(el('span', null, data.mineVisitors ? 'Include my visits (' + num(data.mineVisitors) + ')' : 'Include my visits'));
		bar.appendChild(label);
		return bar;
	}

	// ── stat tiles ───────────────────────────────────────────────────────────

	function tile(label, value, note) {
		const t = el('div', 'tr-tile');
		t.appendChild(el('div', 'tr-tile-label', label));
		t.appendChild(el('div', 'tr-tile-value', num(value)));
		t.appendChild(el('div', 'tr-tile-note', note || ' '));
		return t;
	}

	function tiles(data) {
		const t = data.totals;
		const row = el('div', 'tr-tiles');
		const perVisitor = t.visitors ? (t.sessions / t.visitors).toFixed(1) : '0';
		const repeatShare = t.sessions ? Math.round((t.repeatSessions / t.sessions) * 100) : 0;
		row.appendChild(tile('Distinct visitors', t.visitors, t.newVisitors + ' first-time'));
		row.appendChild(tile('Sessions', t.sessions, perVisitor + ' per visitor'));
		row.appendChild(tile('Repeat sessions', t.repeatSessions, repeatShare + '% of sessions'));
		row.appendChild(tile('Came back', t.returningVisitors, 'visitors on 2+ days'));
		row.appendChild(tile('Countries', t.countries, t.countries === 1 ? 'country seen' : 'countries seen'));
		return row;
	}

	// ── daily chart ──────────────────────────────────────────────────────────

	function chart(data) {
		const days = data.days;
		const c = card('Visitors per day');
		const max = Math.max(1, ...days.map((d) => d.visitors));

		const legend = el('div', 'tr-legend');
		for (const [cls, text] of [
			['new', 'First-time'],
			['returning', 'Returning'],
		]) {
			const item = el('span', 'tr-legend-item');
			item.appendChild(el('span', 'tr-swatch tr-swatch-' + cls));
			item.appendChild(el('span', null, text));
			legend.appendChild(item);
		}
		c.appendChild(legend);

		const plotWrap = el('div', 'tr-plot-wrap');
		const yAxis = el('div', 'tr-yaxis');
		yAxis.appendChild(el('span', null, String(max)));
		yAxis.appendChild(el('span', null, '0'));
		plotWrap.appendChild(yAxis);

		const plot = el('div', 'tr-plot');
		// The bars are decorative — the numbers live in the tooltip and the table below,
		// so the plot is one labelled image rather than 90 tab stops.
		plot.setAttribute('role', 'img');
		plot.setAttribute(
			'aria-label',
			days.length
				? 'Daily visitors from ' + longDay(days[0].day) + ' to ' + longDay(days[days.length - 1].day) + ', peak ' + max + '.'
				: 'No days ingested yet.',
		);

		const tip = el('div', 'tr-tip');
		tip.hidden = true;

		for (const d of days) {
			const bar = el('div', 'tr-bar');
			const returning = Math.max(0, d.visitors - d.newVisitors);
			if (d.visitors === 0) {
				bar.appendChild(el('div', 'tr-seg tr-seg-empty'));
			} else {
				if (d.newVisitors > 0) {
					const seg = el('div', 'tr-seg tr-seg-new');
					seg.style.height = (d.newVisitors / max) * 100 + '%';
					bar.appendChild(seg);
				}
				if (returning > 0) {
					const seg = el('div', 'tr-seg tr-seg-returning');
					seg.style.height = (returning / max) * 100 + '%';
					bar.appendChild(seg);
				}
			}
			const show = () => {
				tip.textContent = '';
				tip.appendChild(el('b', null, longDay(d.day)));
				tip.appendChild(
					el(
						'span',
						null,
						d.visitors +
							(d.visitors === 1 ? ' visitor' : ' visitors') +
							' · ' +
							d.sessions +
							(d.sessions === 1 ? ' session' : ' sessions'),
					),
				);
				if (d.newVisitors) tip.appendChild(el('span', null, d.newVisitors + ' first-time'));
				tip.hidden = false;
				// Anchor to the bar, then clamp so the last days don't push it off-card.
				const pct = (bar.offsetLeft + bar.offsetWidth / 2) / plot.offsetWidth;
				tip.style.left = Math.min(92, Math.max(8, pct * 100)) + '%';
			};
			bar.addEventListener('mouseenter', show);
			bar.addEventListener('touchstart', show, { passive: true });
			plot.appendChild(bar);
		}
		plot.addEventListener('mouseleave', () => {
			tip.hidden = true;
		});

		plot.appendChild(tip); // absolute inside the plot, so the % anchoring lines up
		plotWrap.appendChild(plot);
		c.appendChild(plotWrap);

		if (days.length) {
			const axis = el('div', 'tr-xaxis');
			axis.appendChild(el('span', null, shortDay(days[0].day)));
			axis.appendChild(el('span', null, shortDay(days[days.length - 1].day)));
			c.appendChild(axis);
		}

		// The table view: same numbers, keyboard- and screen-reader-reachable.
		const details = el('details', 'tr-details');
		details.appendChild(el('summary', null, 'Daily numbers'));
		details.appendChild(
			table(
				['Day', 'Visitors', 'First-time', 'Sessions', 'Requests', 'Bots', 'Errors'],
				days
					.slice()
					.reverse()
					.map((d) => [
						longDay(d.day),
						num(d.visitors),
						num(d.newVisitors),
						num(d.sessions),
						num(d.requests),
						num(d.botRequests),
						num(d.errors),
					]),
				'Nothing ingested yet.',
			),
		);
		c.appendChild(details);
		return c;
	}

	// ── breakdown cards ──────────────────────────────────────────────────────

	function countryCard(data) {
		const c = card('Countries');
		c.appendChild(
			table(
				['Country', 'Visitors', 'Sessions'],
				data.countries.map((row) => {
					const name = el('span', 'tr-country');
					name.appendChild(el('span', 'tr-flag', flag(row.name)));
					name.appendChild(el('span', null, countryName(row.name)));
					return [name, num(row.visitors), num(row.sessions)];
				}),
				'No visitors in this range.',
			),
		);
		return c;
	}

	function splitCard(data) {
		const c = card('Devices & browsers');
		const grid = el('div', 'tr-split');
		const left = el('div');
		left.appendChild(
			table(
				['Device', 'Visitors'],
				data.devices.map((d) => [d.name || 'Unknown', num(d.visitors)]),
				'No visitors yet.',
			),
		);
		const right = el('div');
		right.appendChild(
			table(
				['Browser', 'Visitors'],
				data.browsers.map((d) => [d.name || 'Unknown', num(d.visitors)]),
				'No visitors yet.',
			),
		);
		grid.appendChild(left);
		grid.appendChild(right);
		c.appendChild(grid);
		return c;
	}

	function referrerCard(data) {
		const c = card('Referrers', 'Counted on page arrivals only — assets carry the site itself as their referer.');
		c.appendChild(
			table(
				['Came from', 'Arrivals'],
				data.referrers.map((r) => [r.host, num(r.hits)]),
				'No external referrers — everyone typed the address, opened the installed app, or arrived without a referer.',
			),
		);
		return c;
	}

	function errorCard(data) {
		const c = card('Failed requests', 'From real visitors only — a scanner 404ing on /wp-login.php isn’t a bug.');
		c.appendChild(
			table(
				['Status', 'Path', 'Hits'],
				data.errors.map((e) => [String(e.status), e.path, num(e.hits)]),
				'No failed requests in this range.',
			),
		);
		const t = c.querySelector('table');
		if (t) t.classList.add('tr-errors');
		return c;
	}

	function footnote(data) {
		const t = data.totals;
		const p = el('p', 'tr-footnote');
		p.appendChild(
			el(
				'span',
				null,
				'From the Apache access logs, ingested nightly — complete through ' +
					longDay(data.ingestedThrough) +
					' (today is still being written). ' +
					num(t.botRequests) +
					' bot requests excluded: DreamHost’s monitor, crawlers, and scanners. ' +
					num(t.requests) +
					' real requests, ' +
					(t.bytes / 1048576).toFixed(1) +
					' MB served.',
			),
		);
		p.appendChild(
			el(
				'span',
				null,
				'A visitor is a salted hash of IP + browser, so no addresses are stored — but one person on two networks counts twice, and a household on one router can count as one.',
			),
		);
		return p;
	}

	// ── render ───────────────────────────────────────────────────────────────

	function render(data) {
		root.textContent = '';
		root.appendChild(controls(data));
		if (!data.hasData) {
			root.appendChild(
				el(
					'p',
					'admin-notice',
					'No traffic ingested yet. Run tools/ingest-traffic.php on the server (it backfills whatever logs are still on disk), or wait for tonight’s cron.',
				),
			);
			return;
		}
		root.appendChild(tiles(data));
		root.appendChild(chart(data));
		const grid = el('div', 'tr-grid');
		grid.appendChild(countryCard(data));
		grid.appendChild(splitCard(data));
		grid.appendChild(referrerCard(data));
		grid.appendChild(errorCard(data));
		root.appendChild(grid);
		root.appendChild(footnote(data));
	}

	function notice(text) {
		root.textContent = '';
		root.appendChild(el('p', 'admin-notice', text));
	}

	async function load() {
		if (loading) return;
		loading = true;
		if (!root.hasChildNodes()) notice('Loading traffic…');
		try {
			const data = DEMO ? demoData() : await fetchTraffic();
			if (data) render(data);
		} finally {
			loading = false;
		}
	}

	async function fetchTraffic() {
		let res;
		try {
			res = await fetch('/api/admin-traffic.php?range=' + encodeURIComponent(range) + '&mine=' + (includeMine ? '1' : '0'));
		} catch (e) {
			notice('Could not reach the server.');
			return null;
		}
		if (res.status === 401 || res.status === 403) {
			notice('This account isn’t an admin.');
			return null;
		}
		if (!res.ok) {
			notice('Failed to load traffic (' + res.status + ').');
			return null;
		}
		return res.json();
	}

	// ── demo data (?demo=1 — local UI review without a DB) ────────────────────

	function demoData() {
		const days = [];
		const span = range === 'all' ? 45 : Number(range);
		const end = new Date();
		end.setDate(end.getDate() - 1);
		let visitorsTotal = 0;
		let sessionsTotal = 0;
		let newTotal = 0;
		for (let i = span - 1; i >= 0; i--) {
			const d = new Date(end);
			d.setDate(d.getDate() - i);
			// Deterministic wobble so the demo chart looks like traffic, not noise.
			const wave = Math.sin(i / 3.1) + Math.sin(i / 7.7);
			const visitors = Math.max(0, Math.round(3 + wave * 2) + (i % 11 === 0 ? 4 : 0));
			const newVisitors = Math.min(visitors, Math.round(visitors * 0.4));
			const sessions = visitors + Math.round(visitors * 0.6);
			visitorsTotal += visitors;
			sessionsTotal += sessions;
			newTotal += newVisitors;
			days.push({
				day: d.toISOString().slice(0, 10),
				visitors,
				newVisitors,
				sessions,
				requests: visitors * 27,
				botRequests: 180 + ((i * 13) % 60),
				errors: i % 9 === 0 ? 1 : 0,
			});
		}
		const totalBots = days.reduce((s, d) => s + d.botRequests, 0);
		return {
			range,
			includesMine: includeMine,
			hasData: true,
			from: days[0].day,
			ingestedThrough: days[days.length - 1].day,
			firstDay: days[0].day,
			days,
			totals: {
				visitors: Math.round(visitorsTotal * 0.55),
				newVisitors: newTotal,
				returningVisitors: Math.round(visitorsTotal * 0.2),
				sessions: sessionsTotal,
				repeatSessions: sessionsTotal - newTotal,
				requests: days.reduce((s, d) => s + d.requests, 0),
				botRequests: totalBots,
				bytes: 1048576 * 42.3,
				errors4xx: 3,
				errors5xx: 1,
				countries: 6,
				days: days.length,
			},
			countries: [
				{ name: 'US', visitors: 41, sessions: 96 },
				{ name: 'NP', visitors: 22, sessions: 71 },
				{ name: 'GB', visitors: 7, sessions: 12 },
				{ name: 'IN', visitors: 5, sessions: 9 },
				{ name: 'AU', visitors: 3, sessions: 4 },
				{ name: 'DE', visitors: 2, sessions: 2 },
				{ name: null, visitors: 1, sessions: 1 },
			],
			devices: [
				{ name: 'iPhone', visitors: 39 },
				{ name: 'Mac', visitors: 18 },
				{ name: 'Android', visitors: 14 },
				{ name: 'Windows', visitors: 8 },
				{ name: 'iPad', visitors: 2 },
			],
			browsers: [
				{ name: 'Safari', visitors: 47 },
				{ name: 'Chrome', visitors: 26 },
				{ name: 'Firefox', visitors: 6 },
				{ name: 'Edge', visitors: 2 },
			],
			referrers: [
				{ host: 'google.com', hits: 18 },
				{ host: 'duckduckgo.com', hits: 4 },
				{ host: 'reddit.com', hits: 3 },
			],
			errors: [
				{ status: 404, path: '/audio/words/dhanyabaad.mp3', hits: 3 },
				{ status: 500, path: '/api/state.php', hits: 1 },
			],
			mineVisitors: 2,
		};
	}

	// Called by js/admin.js the first time the Traffic tab is opened.
	window.SanoAdminTraffic = {
		show(container) {
			root = container;
			if (!root.hasChildNodes()) load();
		},
	};
})();
