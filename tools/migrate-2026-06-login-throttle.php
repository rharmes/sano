<?php
// One-off migration adding the per-IP login throttle table (api/login.php).
// Idempotent: safe to run more than once. Run on the server (tools/ is never
// deployed to the docroot):
//
//   scp tools/migrate-2026-06-login-throttle.php sano-deploy:
//   ssh sano-deploy 'php migrate-2026-06-login-throttle.php'
//
// Finds sano-config.php next to itself (server home) or two levels up (local dev),
// same as make-user.php / migrate-2026-06-reminders.php.

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

$pdo->exec(
	'CREATE TABLE IF NOT EXISTS login_attempts (
	   ip         VARBINARY(16) NOT NULL,
	   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	   KEY idx_ip_time (ip, created_at)
	 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
);

echo "login_attempts: ok\nMigration complete.\n";
