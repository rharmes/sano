<?php
// GET -> 200 { me, users: [{ username, lastSyncedAt, streak, graduated }] }
//   401 {error:"auth"} when logged out · 403 {error:"forbidden"} for a non-admin.
//
// The admin dashboard (/admin/) data source: every account with the bits needed to
// render its row. Path position isn't computed here (the server has no COURSE) — we
// return the set of GRADUATED item ids (the SR-05 mastery gate — a unit unlocks the
// next only when every word has graduated) and let js/admin.js derive "Unit N / total".
// A GET needs no CSRF header (the session cookie is SameSite=Strict).

require __DIR__ . '/lib.php';

require_method('GET');
$adminId = require_admin();

$pdo = db();

$me = $pdo->prepare('SELECT username FROM users WHERE id = ?');
$me->execute([$adminId]);
$meName = (string) $me->fetchColumn();

// LEFT JOIN: accounts that have never synced have no app_state row (state NULL).
$rows = $pdo
	->query(
		'SELECT u.username, a.state AS state, ROUND(UNIX_TIMESTAMP(a.updated_at) * 1000) AS last_synced
	   FROM users u
	   LEFT JOIN app_state a ON a.user_id = u.id
	  ORDER BY u.username',
	)
	->fetchAll();

$users = [];
foreach ($rows as $r) {
	$streak = 0;
	$graduated = [];
	if ($r['state'] !== null) {
		$state = json_decode($r['state']);
		if (is_object($state)) {
			$streak = isset($state->streak) ? (int) $state->streak : 0;
			if (isset($state->items) && is_object($state->items)) {
				foreach ($state->items as $id => $rec) {
					if (is_object($rec) && !empty($rec->graduated)) {
						$graduated[] = $id;
					}
				}
			}
		}
	}
	$users[] = [
		'username' => $r['username'],
		'lastSyncedAt' => $r['last_synced'] !== null ? (int) $r['last_synced'] : null,
		'streak' => $streak,
		'graduated' => $graduated,
	];
}

respond(200, ['me' => $meName, 'users' => $users]);
