<?php
// GET -> 200 { me, users: [{ username, lastSyncedAt, streak, graduated }] }
//   401 {error:"auth"} when logged out · 403 {error:"forbidden"} for a non-admin.
//
// The admin dashboard (/admin/) data source: every account with the bits needed to
// render its row. Path position isn't computed here (the server has no COURSE) — we
// return the set of GRADUATED item ids (the SR-05 mastery gate — a unit unlocks the
// next only when every word has graduated) and let js/admin.js derive "Unit N / total".
// A GET needs no CSRF header (the session cookie is SameSite=Strict).

declare(strict_types=1);
require __DIR__ . '/lib.php';

require_method('GET');
$adminId = require_admin();

$pdo = db();

$me = $pdo->prepare('SELECT username FROM users WHERE id = ?');
$me->execute([$adminId]);
$meName = (string) $me->fetchColumn();

// Stream the rows rather than fetchAll(): a buffered fetch materialises every account's
// state blob in PHP at once, and each may be up to MAX_STATE_BYTES (1 MiB). A handful of
// self-registered accounts padding their state could therefore exhaust the memory limit
// and deny the admin this page entirely — an unprivileged user breaking the dashboard.
// Unbuffered, only one blob is resident at a time, whatever the account count.
// Nothing else may query the connection until this result set is drained, and the loop
// below always drains it.
$pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);

// LEFT JOIN: accounts that have never synced have no app_state row (state NULL).
$stmt = $pdo->query(
	'SELECT u.username, a.state AS state, ROUND(UNIX_TIMESTAMP(a.updated_at) * 1000) AS last_synced
	   FROM users u
	   LEFT JOIN app_state a ON a.user_id = u.id
	  ORDER BY u.username',
);

$users = [];
$budget = ADMIN_MAX_TOTAL_IDS;
$cappedAccounts = 0;
foreach ($stmt as $r) {
	$summary = state_summary($r['state'], $budget);
	$budget -= count($summary['graduated']);
	if ($summary['capped']) {
		$cappedAccounts++;
	}
	$users[] = [
		'username' => $r['username'],
		'lastSyncedAt' => $r['last_synced'] !== null ? (int) $r['last_synced'] : null,
		'streak' => $summary['streak'],
		'graduated' => $summary['graduated'],
	];
}
$pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);

// Never cap silently: a truncated list quietly understates someone's progress, and it
// also means an account is carrying far more item ids than the course has.
if ($cappedAccounts > 0) {
	error_log("sano admin-users: truncated the graduated-id list for $cappedAccounts account(s)");
}

respond(200, ['me' => $meName, 'users' => $users]);
