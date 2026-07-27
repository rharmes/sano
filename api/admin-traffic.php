<?php
// GET ?range=7|30|90|all&mine=0|1 -> 200 { range, days, totals, countries, devices,
//   browsers, referrers, errors, ingestedThrough, ... }
//   400 {error:"range"} for a bad window · 401 {error:"auth"} when logged out ·
//   403 {error:"forbidden"} for a non-admin.
//
// The Traffic tab of /admin/ (T40). Everything here is read straight out of the
// aggregate tables that tools/ingest-traffic.php fills nightly from the Apache logs —
// no log parsing happens in a web request, and no raw IP exists to read: a visitor is
// a salted hash, and a country is whatever the ingest resolved at the time.
//
// The window ends at the newest INGESTED day rather than today, because today's log is
// still being written and is deliberately not stored — anchoring on CURDATE() would
// leave the chart with a permanently empty last column.
//
// mine=0 (the default) hides Ross's own visits: the ingest flags any visitor whose
// session ever touched /admin/, which with traffic this small is the difference between
// "who uses this" and "me testing on my phone".
//
// A GET needs no CSRF header (the session cookie is SameSite=Strict).

require __DIR__ . '/lib.php';

require_method('GET');

$range = $_GET['range'] ?? '30';
if (!in_array($range, ['7', '30', '90', 'all'], true)) {
	respond(400, ['error' => 'range']);
}
$includeMine = ($_GET['mine'] ?? '0') === '1';

require_admin();

$pdo = db();

// `mine` is a fixed 0/1 from the validated flag above, never user text, so it can be
// inlined into these fragments; every other value is bound.
$mineSql = $includeMine ? '' : ' AND vd.is_mine = 0';
$mineRefSql = $includeMine ? '' : ' AND mine = 0';

$bounds = $pdo->query('SELECT MIN(day) AS first_day, MAX(day) AS last_day FROM traffic_days')->fetch();
$lastDay = $bounds['last_day'] ?? null;

if ($lastDay === null) {
	// Nothing ingested yet (a fresh DB, or the cron hasn't run) — the tab renders its
	// "no data" state rather than a wall of zeros.
	respond(200, [
		'range' => $range,
		'includesMine' => $includeMine,
		'hasData' => false,
		'days' => [],
		'totals' => null,
		'countries' => [],
		'devices' => [],
		'browsers' => [],
		'referrers' => [],
		'errors' => [],
		'mineVisitors' => 0,
		'ingestedThrough' => null,
		'firstDay' => null,
	]);
}

$start = $bounds['first_day'];
if ($range !== 'all') {
	$from = new DateTime($lastDay);
	$from->modify('-' . ((int) $range - 1) . ' days');
	$start = max($start, $from->format('Y-m-d'));
}
$window = [$start, $lastDay];

// Per-day series. Visitor-derived columns come from traffic_visitor_days so the mine
// filter applies to them; bot_requests and bytes are whole-day facts from traffic_days.
// LEFT JOIN, because a day can be all bots and still deserve a column in the chart.
$daysStmt = $pdo->prepare(
	"SELECT d.day,
	        COALESCE(v.visitors, 0)     AS visitors,
	        COALESCE(v.new_visitors, 0) AS new_visitors,
	        COALESCE(v.sessions, 0)     AS sessions,
	        COALESCE(v.requests, 0)     AS requests,
	        d.bot_requests,
	        d.errors_4xx + d.errors_5xx AS errors
	   FROM traffic_days d
	   LEFT JOIN (SELECT vd.day,
	                     COUNT(*)         AS visitors,
	                     SUM(vd.is_new)   AS new_visitors,
	                     SUM(vd.sessions) AS sessions,
	                     SUM(vd.requests) AS requests
	                FROM traffic_visitor_days vd
	               WHERE 1 = 1$mineSql
	               GROUP BY vd.day) v ON v.day = d.day
	  WHERE d.day BETWEEN ? AND ?
	  ORDER BY d.day",
);
$daysStmt->execute($window);
$days = [];
foreach ($daysStmt->fetchAll() as $r) {
	$days[] = [
		'day' => $r['day'],
		'visitors' => (int) $r['visitors'],
		'newVisitors' => (int) $r['new_visitors'],
		'sessions' => (int) $r['sessions'],
		'requests' => (int) $r['requests'],
		'botRequests' => (int) $r['bot_requests'],
		'errors' => (int) $r['errors'],
	];
}

// Headline totals. A distinct visitor is counted once across the whole window (not
// summed per day); repeat sessions are every session after a visitor's first ever, and
// is_new marks exactly that first day — so sessions - new = repeats, including the
// sessions of people whose first visit predates the window.
$totalsStmt = $pdo->prepare(
	"SELECT COUNT(DISTINCT vd.visitor) AS visitors,
	        COALESCE(SUM(vd.sessions), 0) AS sessions,
	        COALESCE(SUM(vd.is_new), 0)   AS new_visitors,
	        COALESCE(SUM(vd.requests), 0) AS requests
	   FROM traffic_visitor_days vd
	  WHERE vd.day BETWEEN ? AND ?$mineSql",
);
$totalsStmt->execute($window);
$t = $totalsStmt->fetch();

// "Returned" = seen on two or more separate days inside the window.
$returningStmt = $pdo->prepare(
	"SELECT COUNT(*) FROM (
	   SELECT vd.visitor FROM traffic_visitor_days vd
	    WHERE vd.day BETWEEN ? AND ?$mineSql
	    GROUP BY vd.visitor HAVING COUNT(*) > 1) r",
);
$returningStmt->execute($window);
$returning = (int) $returningStmt->fetchColumn();

$dayTotals = $pdo->prepare(
	'SELECT COALESCE(SUM(bot_requests), 0) AS bot_requests, COALESCE(SUM(bytes), 0) AS bytes,
	        COALESCE(SUM(errors_4xx), 0) AS errors_4xx, COALESCE(SUM(errors_5xx), 0) AS errors_5xx,
	        COUNT(*) AS days
	   FROM traffic_days WHERE day BETWEEN ? AND ?',
);
$dayTotals->execute($window);
$dt = $dayTotals->fetch();

$mineStmt = $pdo->prepare('SELECT COUNT(DISTINCT visitor) FROM traffic_visitor_days WHERE day BETWEEN ? AND ? AND is_mine = 1');
$mineStmt->execute($window);

// Breakdowns: one visitor counts once per bucket no matter how many days they span.
$group = function (string $column) use ($pdo, $window, $mineSql): array {
	$stmt = $pdo->prepare(
		"SELECT vd.$column AS name, COUNT(DISTINCT vd.visitor) AS visitors, COALESCE(SUM(vd.sessions), 0) AS sessions
		   FROM traffic_visitor_days vd
		  WHERE vd.day BETWEEN ? AND ?$mineSql
		  GROUP BY vd.$column
		  ORDER BY visitors DESC, name",
	);
	$stmt->execute($window);
	$out = [];
	foreach ($stmt->fetchAll() as $r) {
		$out[] = ['name' => $r['name'], 'visitors' => (int) $r['visitors'], 'sessions' => (int) $r['sessions']];
	}
	return $out;
};

$refStmt = $pdo->prepare(
	"SELECT host, SUM(hits) AS hits FROM traffic_referrers
	  WHERE day BETWEEN ? AND ?$mineRefSql GROUP BY host ORDER BY hits DESC, host LIMIT 20",
);
$refStmt->execute($window);
$referrers = [];
foreach ($refStmt->fetchAll() as $r) {
	$referrers[] = ['host' => $r['host'], 'hits' => (int) $r['hits']];
}

$errStmt = $pdo->prepare(
	"SELECT status, path, SUM(hits) AS hits FROM traffic_errors
	  WHERE day BETWEEN ? AND ?$mineRefSql GROUP BY status, path ORDER BY hits DESC, path LIMIT 20",
);
$errStmt->execute($window);
$errors = [];
foreach ($errStmt->fetchAll() as $r) {
	$errors[] = ['status' => (int) $r['status'], 'path' => $r['path'], 'hits' => (int) $r['hits']];
}

$countries = $group('country');
$sessions = (int) $t['sessions'];
$newVisitors = (int) $t['new_visitors'];

respond(200, [
	'range' => $range,
	'includesMine' => $includeMine,
	'hasData' => true,
	'from' => $start,
	'ingestedThrough' => $lastDay,
	'firstDay' => $bounds['first_day'],
	'days' => $days,
	'totals' => [
		'visitors' => (int) $t['visitors'],
		'newVisitors' => $newVisitors,
		'returningVisitors' => $returning,
		'sessions' => $sessions,
		'repeatSessions' => max(0, $sessions - $newVisitors),
		'requests' => (int) $t['requests'],
		'botRequests' => (int) $dt['bot_requests'],
		'bytes' => (int) $dt['bytes'],
		'errors4xx' => (int) $dt['errors_4xx'],
		'errors5xx' => (int) $dt['errors_5xx'],
		'countries' => count(array_filter($countries, fn($c) => $c['name'] !== null)),
		'days' => (int) $dt['days'],
	],
	'countries' => $countries,
	'devices' => $group('device'),
	'browsers' => $group('browser'),
	'referrers' => $referrers,
	'errors' => $errors,
	'mineVisitors' => (int) $mineStmt->fetchColumn(),
]);
