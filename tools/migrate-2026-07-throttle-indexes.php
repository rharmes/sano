<?php
// One-off migration (T54): index the two columns the login endpoint prunes on.
//
// `login.php` deletes expired sessions and stale login_attempts on every sign-in.
// Neither column was indexed — `sessions` had only its PRIMARY KEY on token_hash, and
// `login_attempts`' idx_ip_time can't serve `WHERE created_at < …` because created_at
// isn't its leading column — so both DELETEs were full scans, on the one endpoint an
// unauthenticated caller can reach repeatedly.
//
// Idempotent: checks information_schema first, so re-running is a no-op. NEVER re-apply
// schema.sql to a live database; that's what this file is for. Run on the server
// (tools/ is never deployed to the docroot):
//
//   scp tools/migrate-2026-07-throttle-indexes.php sano-deploy:sano-tools/
//   ssh sano-deploy 'php ~/sano-tools/migrate-2026-07-throttle-indexes.php'
//
// Looks for sano-config.php next to itself, one level up (the ~/sano-tools/ layout),
// then two levels up (local dev), same as the other server scripts.

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

$pdo = new PDO($config['dsn'], $config['user'], $config['pass'], [
	PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
	PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$has = $pdo->prepare('SELECT COUNT(*) FROM information_schema.statistics
                      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?');

foreach (
	[
		['sessions', 'idx_expires', 'ALTER TABLE sessions ADD KEY idx_expires (expires_at)'],
		['login_attempts', 'idx_time', 'ALTER TABLE login_attempts ADD KEY idx_time (created_at)'],
	]
	as [$table, $index, $sql]
) {
	$has->execute([$table, $index]);
	if ((int) $has->fetchColumn() > 0) {
		echo "$table.$index already present\n";
		continue;
	}
	$pdo->exec($sql);
	echo "$table.$index created\n";
}

echo "done\n";
