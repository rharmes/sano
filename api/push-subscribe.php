<?php
// Store (or refresh) a Web Push subscription for the authenticated user.
// Body: { endpoint, keys: { p256dh, auth } }
//        -> 200 {ok}
//           400 {error: "bad_endpoint" | "bad_keys" | ...}
//           403 {error: "endpoint_taken"}

declare(strict_types=1);
require __DIR__ . '/lib.php';

require_method('POST');
require_csrf_header();

$body = read_json_body();
// is_string rather than a (string) cast: `endpoint: []` casts to the literal
// "Array", which would pass every check below and collide on uniq_endpoint.
$endpoint = is_string($body['endpoint'] ?? null) ? $body['endpoint'] : '';
$p256dh = is_string($body['keys']['p256dh'] ?? null) ? $body['keys']['p256dh'] : '';
$auth = is_string($body['keys']['auth'] ?? null) ? $body['keys']['auth'] : '';

if ($endpoint === '' || $p256dh === '' || $auth === '') {
	respond(400, ['error' => 'missing_fields']);
}
if (strlen($endpoint) > 500) {
	respond(400, ['error' => 'endpoint_too_long']);
}
// The hourly cron POSTs to this URL, so it has to be a real push service rather
// than whatever address the caller fancies (see push_endpoint_ok in lib.php).
if (!push_endpoint_ok($endpoint)) {
	respond(400, ['error' => 'bad_endpoint']);
}
// Malformed keys can't be caught later without cost: they blow up inside the
// cron's encryption step, which takes down that hour's whole run (T52).
if (!push_key_ok($p256dh, 65, 0x04) || !push_key_ok($auth, 16)) {
	respond(400, ['error' => 'bad_keys']);
}

$userId = require_user();
$pdo = db();

// Insert first and let UNIQUE(endpoint) decide whether this device is already on
// file — no SELECT-then-INSERT race, and no gap lock on a row that isn't there.
$inserted = false;
try {
	$pdo->prepare('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_secret) VALUES (?, ?, ?, ?)')->execute([
		$userId,
		$endpoint,
		$p256dh,
		$auth,
	]);
	$inserted = true;
} catch (PDOException $e) {
	if ($e->getCode() !== '23000') {
		throw $e; // not a duplicate key — let the generic 500 handler take it
	}
}

if (!$inserted) {
	// The endpoint is already stored. Re-attaching it to a different account is a
	// real case — one device, user signs out and signs in as someone else — but the
	// endpoint alone must not be enough to do it, or anyone who reads one out of a
	// log can move that device onto their own account and silently take over its
	// reminders. The browser proves it *is* that device by presenting the same
	// subscription keys; an endpoint lifted from a log arrives without them.
	$stmt = $pdo->prepare('SELECT user_id, p256dh, auth_secret FROM push_subscriptions WHERE endpoint = ?');
	$stmt->execute([$endpoint]);
	$row = $stmt->fetch();
	if ($row === false) {
		respond(409, ['error' => 'retry']); // deleted between the insert and this read
	}
	$mine = (int) $row['user_id'] === $userId;
	$sameDevice = hash_equals($row['p256dh'], $p256dh) && hash_equals($row['auth_secret'], $auth);
	if (!$mine && !$sameDevice) {
		respond(403, ['error' => 'endpoint_taken']);
	}
	$pdo->prepare(
		'UPDATE push_subscriptions
		    SET user_id = ?, p256dh = ?, auth_secret = ?, failure_count = 0, last_failure_at = NULL
		  WHERE endpoint = ?',
	)->execute([$userId, $p256dh, $auth, $endpoint]);
}

// Bound the table. Without a cap one account can store unlimited distinct
// endpoints, each of which the cron then tries to deliver to, every hour.
$over = $pdo->prepare('SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100 OFFSET ' . MAX_PUSH_SUBS_PER_USER);
$over->execute([$userId]);
$stale = $over->fetchAll(PDO::FETCH_COLUMN);
if ($stale) {
	$pdo->prepare('DELETE FROM push_subscriptions WHERE id IN (' . implode(',', array_fill(0, count($stale), '?')) . ')')->execute($stale);
}

respond(200, ['ok' => true]);
