<?php
// Sano daily reminder dispatcher.
//
// Picks every user whose state's lastActivityDay isn't today (Pacific) and who
// has at least one push subscription, then sends a Web Push notification to each
// of their subscriptions. tools/ is never deployed to the docroot — install on
// the server as ~/sano-tools/send-reminders.php and run via cron.
//
// Cron (Pacific, fires at 7pm PT regardless of server TZ):
//   CRON_TZ=America/Los_Angeles
//   0 19 * * * php $HOME/sano-tools/send-reminders.php >> $HOME/sano-reminders.log 2>&1
//
// Flags:
//   --dry-run         List who would be notified, send nothing.
//   --user <name>     Only consider that one user (testing).
//
// Setup once on the server:
//   cd ~ && mkdir -p sano-tools sano-vendor
//   scp tools/send-reminders.php sano-deploy:sano-tools/
//   ssh sano-deploy 'cd sano-vendor && curl -sS https://getcomposer.org/installer | php && php composer.phar require minishlink/web-push'
//   (then add VAPID keys to ~/sano-config.php — see comment block below)

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
	exit(1);
}

// Locate config and the Composer autoload. The script supports running both
// from the deployed location (~/sano-tools/) and from the repo (tools/), where
// the parent two levels up are the repo root.
$config = null;
foreach ([__DIR__ . '/../sano-config.php', __DIR__ . '/../../sano-config.php'] as $path) {
	if (file_exists($path)) {
		$config = require $path;
		break;
	}
}
if (!$config) {
	fwrite(STDERR, "sano-config.php not found\n");
	exit(1);
}

$autoload = null;
foreach ([__DIR__ . '/../sano-vendor/vendor/autoload.php', __DIR__ . '/../../sano-vendor/vendor/autoload.php'] as $path) {
	if (file_exists($path)) {
		$autoload = $path;
		break;
	}
}

// ~/sano-config.php must add three VAPID fields alongside the existing dsn/user/pass:
//   'vapid_subject'     => 'mailto:ross@rossharmes.net',
//   'vapid_public_key'  => '<base64url uncompressed P-256 public key>',
//   'vapid_private_key' => '<base64url 32-byte private scalar>',
foreach (['vapid_subject', 'vapid_public_key', 'vapid_private_key'] as $k) {
	if (empty($config[$k])) {
		fwrite(STDERR, "sano-config.php missing $k\n");
		exit(1);
	}
}

$dry = in_array('--dry-run', $argv, true);
$onlyUser = null;
foreach ($argv as $i => $a) {
	if ($a === '--user' && isset($argv[$i + 1])) {
		$onlyUser = $argv[$i + 1];
	}
}

$pdo = new PDO($config['dsn'], $config['user'], $config['pass'], [
	PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
	PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

// Two-step form so the parens survive prettier-php (chained `new()->m()` needs PHP 8.4).
$nowPt = new DateTime('now', new DateTimeZone('America/Los_Angeles'));
$today = $nowPt->format('Y-m-d');

// Hand-rolled LEFT JOIN so a user who has never saved state (no app_state row) still
// gets reminded. JSON_EXTRACT returns SQL NULL for a missing key — both branches mean
// "hasn't done a lesson today PT".
$sql = "SELECT u.id AS user_id, u.username,
               ps.id AS sub_id, ps.endpoint, ps.p256dh, ps.auth_secret
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
        LEFT JOIN app_state s ON s.user_id = u.id
        WHERE s.state IS NULL
           OR JSON_UNQUOTE(JSON_EXTRACT(s.state, '$.lastActivityDay')) <> ?
           OR JSON_UNQUOTE(JSON_EXTRACT(s.state, '$.lastActivityDay')) IS NULL";
$params = [$today];
if ($onlyUser !== null) {
	$sql .= ' AND u.username = ?';
	$params[] = $onlyUser;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

if (!$rows) {
	fwrite(STDERR, "No one to notify (PT today: $today)\n");
	exit(0);
}

if ($dry) {
	foreach ($rows as $r) {
		printf("would notify %s (sub %d)\n", $r['username'], $r['sub_id']);
	}
	exit(0);
}

if (!$autoload) {
	fwrite(STDERR, "Composer autoload not found (sano-vendor)\n");
	exit(1);
}
require $autoload;

$webPush = new Minishlink\WebPush\WebPush([
	'VAPID' => [
		'subject' => $config['vapid_subject'],
		'publicKey' => $config['vapid_public_key'],
		'privateKey' => $config['vapid_private_key'],
	],
]);

$payload = json_encode([
	'title' => 'Sano',
	'body' => 'Don’t break your streak — quick lesson?',
	'url' => '/',
]);

// Track endpoint -> sub_id so we can update the right row in flush().
$subIdByEndpoint = [];
foreach ($rows as $r) {
	$sub = Minishlink\WebPush\Subscription::create([
		'endpoint' => $r['endpoint'],
		'publicKey' => $r['p256dh'],
		'authToken' => $r['auth_secret'],
	]);
	$webPush->queueNotification($sub, $payload);
	$subIdByEndpoint[$r['endpoint']] = (int) $r['sub_id'];
}

foreach ($webPush->flush() as $report) {
	$endpoint = $report->getEndpoint();
	$subId = $subIdByEndpoint[$endpoint] ?? null;
	if ($report->isSuccess()) {
		if ($subId) {
			$pdo->prepare('UPDATE push_subscriptions SET last_success_at = NOW(), failure_count = 0, last_failure_at = NULL WHERE id = ?')->execute(
				[$subId],
			);
		}
		echo "OK $endpoint\n";
		continue;
	}
	$resp = $report->getResponse();
	$code = $resp ? $resp->getStatusCode() : 0;
	if ($code === 410 || $code === 404) {
		if ($subId) {
			$pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$subId]);
		}
		echo "GONE $endpoint (deleted)\n";
	} else {
		if ($subId) {
			$pdo->prepare('UPDATE push_subscriptions SET last_failure_at = NOW(), failure_count = failure_count + 1 WHERE id = ?')->execute([
				$subId,
			]);
		}
		echo "FAIL $endpoint ($code) " . $report->getReason() . "\n";
	}
}
