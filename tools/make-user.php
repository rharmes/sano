<?php
// Create a sano account, or reset its password. Invite-only: this script is the
// only way accounts come into being. Run it on the server (tools/ is never
// deployed to the docroot):
//
//   scp tools/make-user.php sano-deploy:
//   ssh -t sano-deploy 'php make-user.php <username> [--reset-password]'
//
// Looks for sano-config.php next to itself first (server home dir), then two
// levels up (local dev layout, where config sits above the repo).

if (PHP_SAPI !== 'cli') exit(1);

$args = array_slice($argv, 1);
$reset = in_array('--reset-password', $args, true);
$args = array_values(array_diff($args, ['--reset-password']));
if (count($args) !== 1) {
	fwrite(STDERR, "Usage: php make-user.php <username> [--reset-password]\n");
	exit(1);
}
$username = $args[0];

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

function prompt_password(string $label): string {
	fwrite(STDERR, $label);
	shell_exec('stty -echo');
	$password = rtrim(fgets(STDIN), "\n");
	shell_exec('stty echo');
	fwrite(STDERR, "\n");
	return $password;
}

$password = prompt_password('Password: ');
if (strlen($password) < 8) {
	fwrite(STDERR, "Password must be at least 8 characters.\n");
	exit(1);
}
if (prompt_password('Again: ') !== $password) {
	fwrite(STDERR, "Passwords do not match.\n");
	exit(1);
}
// The server's PHP (8.2) has argon2id compiled in; password_verify autodetects.
$hash = password_hash($password, PASSWORD_ARGON2ID);

$pdo = new PDO($config['dsn'], $config['user'], $config['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$exists = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$exists->execute([$username]);
$userId = $exists->fetchColumn();

if ($reset) {
	if ($userId === false) {
		fwrite(STDERR, "No such user: $username\n");
		exit(1);
	}
	$pdo->prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?')->execute([$hash, $userId]);
	echo "Password reset for $username\n";
} else {
	if ($userId !== false) {
		fwrite(STDERR, "User already exists: $username (use --reset-password)\n");
		exit(1);
	}
	$pdo->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')->execute([$username, $hash]);
	echo "Created user $username\n";
}
