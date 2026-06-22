<?php
// One-off, idempotent migration: add users.is_admin and (optionally) grant it to a
// user. Run on the server (tools/ is never deployed to the docroot):
//
//   scp tools/migrate-2026-06-admin.php sano-deploy:
//   ssh -t sano-deploy 'php migrate-2026-06-admin.php [<username-to-grant>]'
//
// Reads sano-config.php like make-user.php (next to itself first, then two levels up).

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

// Add the column only if it isn't already present (so re-running is harmless).
if ($pdo->query("SHOW COLUMNS FROM users LIKE 'is_admin'")->fetch()) {
	echo "users.is_admin already exists.\n";
} else {
	$pdo->exec('ALTER TABLE users ADD COLUMN is_admin TINYINT UNSIGNED NOT NULL DEFAULT 0');
	echo "Added users.is_admin.\n";
}

// Optional: grant admin to the username passed as the first argument.
$grant = $argv[1] ?? null;
if ($grant !== null) {
	$stmt = $pdo->prepare('UPDATE users SET is_admin = 1 WHERE username = ?');
	$stmt->execute([$grant]);
	if ($stmt->rowCount() > 0) {
		echo "Granted admin to $grant.\n";
	} else {
		// rowCount 0 means either no such user or already an admin (no row changed).
		$exists = $pdo->prepare('SELECT is_admin FROM users WHERE username = ?');
		$exists->execute([$grant]);
		if ($exists->fetch() === false) {
			fwrite(STDERR, "No such user: $grant\n");
			exit(1);
		}
		echo "$grant is already an admin.\n";
	}
}
