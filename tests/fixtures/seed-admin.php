<?php
// CI-only seed for the admin integration specs (T54).
//
// The admin read paths — admin-users.php's success path and the whole of
// admin-traffic.php — had no integration coverage at all: the suite could only reach
// their 403. That was fine until two changes landed that alter the PHP *type* of every
// value coming out of the database (declare(strict_types=1) and
// PDO::ATTR_EMULATE_PREPARES => false), which is precisely the kind of thing that turns a
// working aggregate query into a TypeError only in production.
//
// So this creates what those specs need and nothing more: one admin account with a known
// password, and a couple of days of traffic aggregates so the populated branch of
// admin-traffic.php is exercised rather than its "nothing ingested yet" early return.
//
// Idempotent — CI may run it more than once. Never runs anywhere but CI: it needs a
// sano-config.php, and it writes rows no real database should contain.

if (PHP_SAPI !== 'cli') {
	exit(1);
}

$config = null;
foreach ([__DIR__ . '/../../../sano-config.php', __DIR__ . '/../../sano-config.php'] as $path) {
	if (file_exists($path)) {
		$config = require $path;
		break;
	}
}
if (!$config) {
	fwrite(STDERR, "sano-config.php not found\n");
	exit(1);
}

$pdo = new PDO($config['dsn'], $config['user'], $config['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// The account the @admin spec signs in as. is_admin is set here because nothing in the
// API can grant it — which is the point of that column.
$pdo->prepare(
	'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)
               ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_admin = 1',
)->execute(['adminci', password_hash('password123', PASSWORD_ARGON2ID)]);
$adminId = (int) $pdo->query("SELECT id FROM users WHERE username = 'adminci'")->fetchColumn();

// Give the admin a state blob, so admin-users.php runs state_summary() over real JSON
// rather than the NULL path (T45 bounded that function; this is what exercises it).
$pdo->prepare(
	'INSERT INTO app_state (user_id, state, revision) VALUES (?, ?, 1)
               ON DUPLICATE KEY UPDATE state = VALUES(state)',
)->execute([
	$adminId,
	json_encode(['version' => 3, 'streak' => 7, 'items' => ['greet-namaste' => ['graduated' => true], 'greet-dhanyabaad' => ['graduated' => true]]]),
]);

// Two days of traffic aggregates. Dated relative to today so they always fall inside the
// dashboard's 7-day window, whenever CI happens to run.
foreach ([1, 2] as $daysAgo) {
	$day = (new DateTimeImmutable("-$daysAgo day"))->format('Y-m-d');
	$pdo->prepare(
		'REPLACE INTO traffic_days (day, requests, bot_requests, bytes, errors_4xx, errors_5xx)
	               VALUES (?, ?, ?, ?, ?, ?)',
	)->execute([$day, 120, 45, 987654, 3, 1]);
	// Two visitors a day: one new, one returning, one of them flagged as "mine".
	foreach ([['NP', 'phone', 'Safari', 1, 0], ['US', 'desktop', 'Chrome', 0, 1]] as $i => [$cc, $device, $browser, $isNew, $isMine]) {
		$pdo->prepare(
			'REPLACE INTO traffic_visitor_days (day, visitor, sessions, requests, is_new, is_mine, country, device, browser)
		               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
		)->execute([$day, str_pad("seed$daysAgo$i", 16, "\0"), 2, 60, $isNew, $isMine, $cc, $device, $browser]);
	}
	$pdo->prepare('REPLACE INTO traffic_referrers (day, mine, host, hits) VALUES (?, 0, ?, ?)')->execute([$day, 'example.test', 9]);
	$pdo->prepare('REPLACE INTO traffic_errors (day, mine, status, path, hits) VALUES (?, 0, ?, ?, ?)')->execute([$day, 404, '/audio/words/gone.mp3', 4]);
}

echo "seeded: adminci (admin), 2 days of traffic\n";
