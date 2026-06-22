<?php
// POST { username, password } -> 200 { ok }
//   400 {error:"missing_fields" | "bad_password"} · 404 {error:"no_such_user"}
//   401/403 when not an admin.
//
// Admin-only password reset for another account. Mirrors tools/make-user.php's reset
// (argon2id, clear lockout) and additionally invalidates every session for that user,
// so the reset signs them out on all devices. Password rules match signup (8-200).

require __DIR__ . '/lib.php';

require_method('POST');
require_csrf_header();
require_admin();

$body = read_json_body();
$username = (string) ($body['username'] ?? '');
$password = (string) ($body['password'] ?? '');
if ($username === '') {
	respond(400, ['error' => 'missing_fields']);
}
if (strlen($password) < 8 || strlen($password) > 200) {
	respond(400, ['error' => 'bad_password']);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
$userId = $stmt->fetchColumn();
if ($userId === false) {
	respond(404, ['error' => 'no_such_user']);
}

$hash = password_hash($password, PASSWORD_ARGON2ID);
$pdo->prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?')->execute([$hash, $userId]);
$pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);

respond(200, ['ok' => true]);
