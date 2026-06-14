<?php
// Sano daily reminder dispatcher.
//
// Picks every user who set a daily reminder (reminder_hour/reminder_tz) and has
// at least one push subscription, then — for those whose chosen hour matches the
// current hour in their own timezone and who haven't studied yet today — sends a
// Web Push notification to each of their subscriptions. tools/ is never deployed
// to the docroot — install on the server as ~/sano-tools/send-reminders.php.
//
// Cron — runs hourly (each user fires at their own local hour, so it must run
// every hour on the hour; no CRON_TZ needed, zones are handled per-user):
//   0 * * * * php $HOME/sano-tools/send-reminders.php >> $HOME/sano-reminders.log 2>&1
//
// Flags:
//   --dry-run         List who would be notified, send nothing.
//   --user <name>     Only consider that one user (testing).
//   --force           Ignore the hour-match and the "studied today" filter
//                     (testing — sends to every reminder-enabled subscription).
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
$force = in_array('--force', $argv, true);
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

// Pull every reminder-enabled subscription with the user's chosen hour/zone and
// their last activity day. The LEFT JOIN keeps users who have never saved state
// (JSON_EXTRACT yields SQL NULL there, which never equals today's date).
$sql = "SELECT u.id AS user_id, u.username, u.reminder_hour, u.reminder_tz,
               ps.id AS sub_id, ps.endpoint, ps.p256dh, ps.auth_secret,
               JSON_UNQUOTE(JSON_EXTRACT(s.state, '$.lastActivityDay')) AS last_activity_day
        FROM push_subscriptions ps
        JOIN users u ON u.id = ps.user_id
        LEFT JOIN app_state s ON s.user_id = u.id
        WHERE u.reminder_hour IS NOT NULL";
$params = [];
if ($onlyUser !== null) {
	$sql .= ' AND u.username = ?';
	$params[] = $onlyUser;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$candidates = $stmt->fetchAll();

// Filter in PHP (not SQL) so we never depend on the MySQL timezone tables being
// loaded: a subscription is due when it's the user's chosen hour in their own
// zone and they haven't studied yet today (local date).
$rows = [];
foreach ($candidates as $r) {
	try {
		$now = new DateTime('now', new DateTimeZone($r['reminder_tz']));
	} catch (Exception $e) {
		fwrite(STDERR, "skip {$r['username']}: bad tz {$r['reminder_tz']}\n");
		continue;
	}
	if (!$force) {
		if ((int) $now->format('G') !== (int) $r['reminder_hour']) {
			continue;
		}
		if ($r['last_activity_day'] === $now->format('Y-m-d')) {
			continue;
		}
	}
	$rows[] = $r;
}

if (!$rows) {
	fwrite(STDERR, "No one to notify this hour\n");
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
