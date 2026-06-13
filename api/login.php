<?php
// POST {username, password} -> 200 {ok, state, revision, updatedAt} + session cookie
//                              401 {error: "bad_credentials"}
//                              429 {error: "locked", retryAfter: seconds}

require __DIR__ . '/lib.php';

require_method('POST');
require_csrf_header();
$body = read_json_body();
$username = (string) ($body['username'] ?? '');
$password = (string) ($body['password'] ?? '');
if ($username === '' || $password === '') respond(400, ['error' => 'missing_fields']);

$pdo = db();

// Housekeeping: drop expired sessions while we're here.
$pdo->exec('DELETE FROM sessions WHERE expires_at <= NOW()');

$stmt = $pdo->prepare('SELECT id, password_hash, failed_logins, locked_until, TIMESTAMPDIFF(SECOND, NOW(), locked_until) AS lock_left FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if ($user && $user['locked_until'] !== null && $user['lock_left'] > 0) {
	respond(429, ['error' => 'locked', 'retryAfter' => (int) $user['lock_left']]);
}

if (!$user || !password_verify($password, $user['password_hash'])) {
	if ($user) {
		$failures = $user['failed_logins'] + 1;
		if ($failures >= LOCK_AFTER_FAILURES) {
			$pdo->prepare('UPDATE users SET failed_logins = 0, locked_until = NOW() + INTERVAL ' . LOCK_MINUTES . ' MINUTE WHERE id = ?')->execute([$user['id']]);
		} else {
			$pdo->prepare('UPDATE users SET failed_logins = ? WHERE id = ?')->execute([$failures, $user['id']]);
		}
	}
	respond(401, ['error' => 'bad_credentials']);
}

$pdo->prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?')->execute([$user['id']]);

$token = bin2hex(random_bytes(32));
$pdo->prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ' . SESSION_DAYS . ' DAY)')
	->execute([hash('sha256', $token), $user['id']]);
set_session_cookie($token, SESSION_DAYS * 86400);

respond(200, ['ok' => true] + state_payload(state_row((int) $user['id'])));
