<?php
// One-off migration for the admin traffic dashboard (T40) — creates the four
// tables tools/ingest-traffic.php writes and api/admin-traffic.php reads.
// Idempotent: safe to run more than once. Run on the server (tools/ is never
// deployed to the docroot):
//
//   scp tools/migrate-2026-07-traffic.php sano-deploy:sano-tools/
//   ssh sano-deploy 'php ~/sano-tools/migrate-2026-07-traffic.php'
//
// Looks for sano-config.php next to itself, one level up (the ~/sano-tools/
// layout), then two levels up (local dev), same as the other server scripts.

if (PHP_SAPI !== 'cli') {
	exit(1);
}

// A crash must not spill a stack trace into the cron log. A trace carries every string
// argument on the stack — PHP truncates them to 15 characters, which is not protection —
// along with the DSN and the DB user. PHP 8.2+ does mask the password itself behind
// #[\SensitiveParameter], but only inside its own APIs: a helper of ours that takes a
// secret is printed in full (both verified on 8.5). So arguments off, and one line out
// instead of a trace. Identical in all four CLI scripts — they are installed standalone
// on the server and cannot share a require — drift-guarded by tests/data/cli-guards.test.mjs.
ini_set('zend.exception_ignore_args', '1');
set_exception_handler(function (Throwable $e): void {
	fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine() . "\n");
	exit(1);
});

$config = null;
foreach ([__DIR__ . '/sano-config.php', __DIR__ . '/../sano-config.php', __DIR__ . '/../../sano-config.php'] as $path) {
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

// 1. Per-day rollup. Doubles as the ingest ledger: a row exists only for a day
//    that has been parsed, which is how the nightly run knows what's left to do.
$pdo->exec(
	'CREATE TABLE IF NOT EXISTS traffic_days (
	   day          DATE PRIMARY KEY,
	   requests     INT UNSIGNED NOT NULL DEFAULT 0,
	   bot_requests INT UNSIGNED NOT NULL DEFAULT 0,
	   bytes        BIGINT UNSIGNED NOT NULL DEFAULT 0,
	   errors_4xx   INT UNSIGNED NOT NULL DEFAULT 0,
	   errors_5xx   INT UNSIGNED NOT NULL DEFAULT 0,
	   ingested_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
);
echo "traffic_days: ok\n";

// 2. One row per visitor per day — the grain every headline number is derived
//    from. `visitor` is a salted sha256(ip + user-agent) truncated to 16 bytes;
//    the address itself is never stored.
$pdo->exec(
	'CREATE TABLE IF NOT EXISTS traffic_visitor_days (
	   day      DATE NOT NULL,
	   visitor  BINARY(16) NOT NULL,
	   sessions SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	   requests INT UNSIGNED NOT NULL DEFAULT 0,
	   is_new   TINYINT UNSIGNED NOT NULL DEFAULT 0,
	   is_mine  TINYINT UNSIGNED NOT NULL DEFAULT 0,
	   country  CHAR(2) NULL,
	   device   VARCHAR(16) NULL,
	   browser  VARCHAR(16) NULL,
	   PRIMARY KEY (day, visitor),
	   KEY idx_visitor (visitor)
	 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
);
echo "traffic_visitor_days: ok\n";

// 3. Referrers, counted only on page requests (assets carry the site as referer).
$pdo->exec(
	'CREATE TABLE IF NOT EXISTS traffic_referrers (
	   day  DATE NOT NULL,
	   mine TINYINT UNSIGNED NOT NULL DEFAULT 0,
	   host VARCHAR(190) NOT NULL,
	   hits INT UNSIGNED NOT NULL DEFAULT 0,
	   PRIMARY KEY (day, mine, host)
	 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
);
echo "traffic_referrers: ok\n";

// 4. Failed requests from human visitors only — a scanner 404ing on /wp-login.php
//    isn't a bug, but a 404 on an audio clip is.
$pdo->exec(
	'CREATE TABLE IF NOT EXISTS traffic_errors (
	   day    DATE NOT NULL,
	   mine   TINYINT UNSIGNED NOT NULL DEFAULT 0,
	   status SMALLINT UNSIGNED NOT NULL,
	   path   VARCHAR(190) NOT NULL,
	   hits   INT UNSIGNED NOT NULL DEFAULT 0,
	   PRIMARY KEY (day, mine, status, path)
	 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
);
echo "traffic_errors: ok\n";

echo "Migration complete.\n";
