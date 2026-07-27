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
//   0 * * * * umask 077; php $HOME/sano-tools/send-reminders.php >> $HOME/sano-reminders.log 2>&1
// The umask is what makes the log 0600 — cron inherits 0022, and the shell creates the
// file on redirect, before this script could chmod anything it doesn't know the name of.
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
//
// JSON_VALID guard: JSON_EXTRACT raises ER_INVALID_JSON_TEXT on a row whose state
// isn't valid JSON, and that aborts the entire SELECT — one bad row would stop
// every user's reminders. api/state.php can no longer write one (T43), but a row
// stored before that fix still could exist, so degrade to "no activity recorded"
// rather than taking the run down.
$sql = "SELECT u.id AS user_id, u.username, u.reminder_hour, u.reminder_tz,
               ps.id AS sub_id, ps.endpoint, ps.p256dh, ps.auth_secret,
               JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(s.state), s.state, '{}'), '$.lastActivityDay')) AS last_activity_day
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

// Rows stored before api/push-subscribe.php started validating them (T42) can
// hold any endpoint string and any key shape, so re-check here rather than
// trusting the table: the endpoint is a URL *this script* POSTs to, and a
// malformed key throws inside the encryption step, which takes the whole run
// down with it. A failing row is skipped and reported, never deleted — a
// legitimate subscription rejected by a stale allowlist should be visible and
// fixable, not silently destroyed.
//
// Mirrors PUSH_HOSTS / push_endpoint_ok / push_key_ok in api/lib.php; this script
// runs from ~/sano-tools/ on the server and can't require the docroot's lib.php,
// so the copy is deliberate (drift-guarded by tests/data/push-allowlist.test.mjs).
const PUSH_HOSTS = [
	'web.push.apple.com', // Safari / iOS
	'fcm.googleapis.com', // Chrome, Edge, Samsung, Opera — every Chromium
	'updates.push.services.mozilla.com', // Firefox
];
const PUSH_HOST_SUFFIXES = ['.notify.windows.com']; // WNS, per-region subdomains

function push_endpoint_ok(string $endpoint): bool
{
	$parts = parse_url($endpoint);
	if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || isset($parts['port']) || isset($parts['user'])) {
		return false;
	}
	$host = strtolower($parts['host'] ?? '');
	if ($host === '') {
		return false;
	}
	if (in_array($host, PUSH_HOSTS, true)) {
		return true;
	}
	foreach (PUSH_HOST_SUFFIXES as $suffix) {
		if (str_ends_with($host, $suffix)) {
			return true;
		}
	}
	return false;
}

function push_key_ok(string $key, int $bytes, int $firstByte = -1): bool
{
	$raw = base64_decode(strtr($key, '-_', '+/'), true);
	if ($raw === false || strlen($raw) !== $bytes) {
		return false;
	}
	return $firstByte < 0 || ord($raw[0]) === $firstByte;
}

// Filter in PHP (not SQL) so we never depend on the MySQL timezone tables being
// loaded: a subscription is due when it's the user's chosen hour in their own
// zone and they haven't studied yet today (local date).
$rows = [];
$rejected = 0;
foreach ($candidates as $r) {
	if (!push_endpoint_ok($r['endpoint']) || !push_key_ok($r['p256dh'], 65, 0x04) || !push_key_ok($r['auth_secret'], 16)) {
		fwrite(STDERR, "skip {$r['username']}: sub {$r['sub_id']} failed validation (kept, not sent)\n");
		$rejected++;
		continue;
	}
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

if ($rejected > 0) {
	fwrite(STDERR, "$rejected subscription(s) failed validation and were skipped\n");
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

// Drop a subscription after this many consecutive failures rather than retrying a
// permanently broken row every hour forever. Reset to 0 on any success.
const MAX_PUSH_FAILURES = 10;

// Count a failed delivery; returns true if that failure retired the subscription.
// The reason text comes from the push service (or from an exception message), so
// strip it to printable ASCII and truncate before it lands in a log a human reads.
function push_failed(PDO $pdo, int $subId, string $username, string $why): bool
{
	$pdo->prepare('UPDATE push_subscriptions SET last_failure_at = NOW(), failure_count = failure_count + 1 WHERE id = ?')->execute([$subId]);
	$read = $pdo->prepare('SELECT failure_count FROM push_subscriptions WHERE id = ?');
	$read->execute([$subId]);
	$n = (int) $read->fetchColumn();
	$why = substr(preg_replace('/[^\x20-\x7E]/', '', $why) ?? '', 0, 120);
	if ($n >= MAX_PUSH_FAILURES) {
		$pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$subId]);
		printf("DROP sub %d (%s) after %d failures: %s\n", $subId, $username, $n, $why);
		return true;
	}
	printf("FAIL sub %d (%s) %d/%d: %s\n", $subId, $username, $n, MAX_PUSH_FAILURES, $why);
	return false;
}

// One subscription per flush(), deliberately. flush() is a generator that calls
// prepare() — the encryption step — from *inside* itself, so anything thrown there
// kills the generator and takes every notification still queued behind it. The
// library's default batchSize is 1000, i.e. the whole run is always a single batch,
// so queueing everything and flushing once means one broken subscription costs
// every other user their reminder for that hour, silently.
//
// Keys are validated on write (T42) and again above, but shape validation cannot
// prove that a 65-byte 0x04-prefixed blob is a point actually on the P-256 curve —
// a well-formed-but-invalid key still throws in here. Isolating each send is what
// makes the run independent of any single row. The cost is sequential HTTP rather
// than Guzzle's parallel pool; at this scale that is a far better trade than a
// shared failure mode. Revisit only if the subscriber count reaches the hundreds.
$sent = $dropped = $failed = 0;

foreach ($rows as $r) {
	$subId = (int) $r['sub_id'];
	$ok = false;
	$code = 0;
	$why = 'no delivery report';
	try {
		$webPush->queueNotification(
			Minishlink\WebPush\Subscription::create([
				'endpoint' => $r['endpoint'],
				'publicKey' => $r['p256dh'],
				'authToken' => $r['auth_secret'],
			]),
			$payload,
		);
		foreach ($webPush->flush() as $report) {
			$ok = $report->isSuccess();
			$resp = $report->getResponse();
			$code = $resp ? $resp->getStatusCode() : 0;
			if (!$ok) {
				$why = $code . ' ' . $report->getReason();
			}
		}
	} catch (Throwable $e) {
		$why = get_class($e) . ': ' . $e->getMessage();
	}

	// The database work sits outside the try on purpose: a DB error is not a push
	// failure and must not quietly increment failure_count — let it surface.
	if ($ok) {
		$pdo->prepare('UPDATE push_subscriptions SET last_success_at = NOW(), failure_count = 0, last_failure_at = NULL WHERE id = ?')->execute([
			$subId,
		]);
		$sent++;
		printf("OK   sub %d (%s)\n", $subId, $r['username']);
	} elseif ($code === 404 || $code === 410) {
		// The push service says this subscription is gone for good.
		$pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$subId]);
		$dropped++;
		printf("GONE sub %d (%s) %d — deleted\n", $subId, $r['username'], $code);
	} else {
		$failed++;
		if (push_failed($pdo, $subId, $r['username'], $why)) {
			$dropped++;
		}
	}
}

printf("sent %d · failed %d · dropped %d\n", $sent, $failed, $dropped);
