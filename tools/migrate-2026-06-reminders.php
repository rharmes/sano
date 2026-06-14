<?php
// One-off migration for the self-service signup + per-user reminder features.
// Idempotent: safe to run more than once. Run on the server (tools/ is never
// deployed to the docroot):
//
//   scp tools/migrate-2026-06-reminders.php sano-deploy:
//   ssh sano-deploy 'php migrate-2026-06-reminders.php'
//
// Looks for sano-config.php next to itself (server home dir) first, then two
// levels up (local dev layout), same as make-user.php.

if (PHP_SAPI !== 'cli') {
	exit(1);
}

$config = null;
foreach ([__DIR__ . '/sano-config.php', __DIR__ . '/../../sano-config.php'] as $path) {
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

// 1. Per-IP signup throttle table.
$pdo->exec(
	'CREATE TABLE IF NOT EXISTS signup_attempts (
	   ip         VARBINARY(16) NOT NULL,
	   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	   KEY idx_ip_time (ip, created_at)
	 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
);
echo "signup_attempts: ok\n";

// 2. users.reminder_hour / reminder_tz — add only if missing (ADD COLUMN IF NOT
//    EXISTS isn't portable across MySQL versions, so check information_schema).
$columnExists = function (string $column) use ($pdo): bool {
	$stmt = $pdo->prepare(
		"SELECT COUNT(*) FROM information_schema.columns
		 WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?",
	);
	$stmt->execute([$column]);
	return (bool) $stmt->fetchColumn();
};

if (!$columnExists('reminder_hour')) {
	$pdo->exec('ALTER TABLE users ADD COLUMN reminder_hour TINYINT UNSIGNED NULL');
	echo "users.reminder_hour: added\n";
} else {
	echo "users.reminder_hour: already present\n";
}

if (!$columnExists('reminder_tz')) {
	$pdo->exec('ALTER TABLE users ADD COLUMN reminder_tz VARCHAR(64) NULL');
	echo "users.reminder_tz: added\n";
} else {
	echo "users.reminder_tz: already present\n";
}

echo "Migration complete.\n";
