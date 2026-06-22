<?php
// POST { username } -> 200 { ok }
//   400 {error:"missing_fields" | "cannot_delete_self"} · 404 {error:"no_such_user"}
//   401/403 when not an admin.
//
// Admin-only account deletion. Removing the users row cascades to app_state,
// sessions, and push_subscriptions (ON DELETE CASCADE in schema.sql). The admin
// cannot delete their own account.

require __DIR__ . '/lib.php';

require_method('POST');
require_csrf_header();
$adminId = require_admin();

$body = read_json_body();
$username = (string) ($body['username'] ?? '');
if ($username === '') {
	respond(400, ['error' => 'missing_fields']);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
$userId = $stmt->fetchColumn();
if ($userId === false) {
	respond(404, ['error' => 'no_such_user']);
}
if ((int) $userId === $adminId) {
	respond(400, ['error' => 'cannot_delete_self']);
}

$pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);

respond(200, ['ok' => true]);
