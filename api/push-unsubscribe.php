<?php
// Delete a Web Push subscription. Body: { endpoint }

declare(strict_types=1);
require __DIR__ . '/lib.php';

require_method('POST');
require_csrf_header();

$body = read_json_body();
$endpoint = (string) ($body['endpoint'] ?? '');
if ($endpoint === '') {
	respond(400, ['error' => 'missing_endpoint']);
}

$userId = require_user();

$stmt = db()->prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?');
$stmt->execute([$endpoint, $userId]);

respond(204, null);
