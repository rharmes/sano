<?php
// Store (or refresh) a Web Push subscription for the authenticated user.
// Body: { endpoint, keys: { p256dh, auth } }

declare(strict_types=1);
require __DIR__ . '/lib.php';

require_method('POST');
require_csrf_header();
$userId = require_user();

$body = read_json_body();
$endpoint = (string) ($body['endpoint'] ?? '');
$p256dh = (string) ($body['keys']['p256dh'] ?? '');
$auth = (string) ($body['keys']['auth'] ?? '');

if ($endpoint === '' || $p256dh === '' || $auth === '') {
	respond(400, ['error' => 'missing_fields']);
}
if (strlen($endpoint) > 500) {
	respond(400, ['error' => 'endpoint_too_long']);
}

// UPSERT by endpoint: if the same browser re-subscribes (e.g. after the user signs
// in on a different account), reattach it and reset failure counters.
$stmt = db()->prepare(
	'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_secret)
	 VALUES (?, ?, ?, ?)
	 ON DUPLICATE KEY UPDATE user_id = VALUES(user_id),
	                         p256dh = VALUES(p256dh),
	                         auth_secret = VALUES(auth_secret),
	                         failure_count = 0,
	                         last_failure_at = NULL',
);
$stmt->execute([$userId, $endpoint, $p256dh, $auth]);

respond(200, ['ok' => true]);
