<?php
// POST {username, password} -> 201 {ok, state, revision, updatedAt} + session cookie
//                              400 {error: "bad_username" | "bad_password"}
//                              409 {error: "username_taken"}
//                              429 {error: "rate_limited", retryAfter: seconds}
//
// Open self-service signup (no invite needed), guarded by: the CSRF header,
// strict username/password validation, argon2id hashing, and a per-IP hourly
// throttle (signup_attempts). On success the new account is auto-logged-in with
// the same session cookie login.php issues, so onboarding flows straight into
// syncing the learner's local progress.

declare(strict_types=1);
require __DIR__ . '/lib.php';

// Per-IP signups allowed per hour. Overridable via env so the CI integration suite can
// register many accounts from one IP; it's unset in production, so the default (5) holds.
$signupsPerHour = (int) (getenv('SANO_SIGNUPS_PER_HOUR') ?: 5);

require_method('POST');
require_csrf_header();
$body = read_json_body();
$username = (string) ($body['username'] ?? '');
$password = (string) ($body['password'] ?? '');

// Validate before throttling so a typo doesn't burn the IP's hourly budget.
if (!preg_match('/^[a-z0-9_]{3,32}$/', $username)) {
	respond(400, ['error' => 'bad_username']);
}
if (strlen($password) < 8 || strlen($password) > 200) {
	respond(400, ['error' => 'bad_password']);
}

$pdo = db();

// Per-IP throttle. throttle_ip() packs the address, keys IPv6 on its /64 (one end site
// otherwise has 2^64 buckets and no limit at all), and falls back to a shared all-zero
// bucket for a missing/odd REMOTE_ADDR so the attempt still records.
$ip = throttle_ip($_SERVER['REMOTE_ADDR'] ?? null);

$pdo->prepare('DELETE FROM signup_attempts WHERE created_at < NOW() - INTERVAL 1 HOUR')->execute();
$recent = $pdo->prepare('SELECT COUNT(*) FROM signup_attempts WHERE ip = ? AND created_at > NOW() - INTERVAL 1 HOUR');
$recent->execute([$ip]);
if ((int) $recent->fetchColumn() >= $signupsPerHour) {
	respond(429, ['error' => 'rate_limited', 'retryAfter' => 3600]);
}
$pdo->prepare('INSERT INTO signup_attempts (ip) VALUES (?)')->execute([$ip]);

// The server's PHP has argon2id compiled in; password_verify autodetects it.
$hash = password_hash($password, PASSWORD_ARGON2ID);

try {
	$pdo->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')->execute([$username, $hash]);
} catch (PDOException $e) {
	// 23000 = integrity constraint violation, i.e. the UNIQUE(username) race.
	// NOTE: a distinct 409 lets a probe learn which usernames exist (enumeration).
	// Accepted — it's inherent to any "username taken" signup UX, and the per-IP
	// throttle above bounds how fast a probe can sweep. A non-23000 error re-throws
	// to the lib.php exception handler, which returns a generic 500 (no leak).
	if ($e->getCode() === '23000') {
		respond(409, ['error' => 'username_taken']);
	}
	throw $e;
}
$userId = (int) $pdo->lastInsertId();

// Auto-login: issue a session exactly like login.php so the cookie is set.
$token = bin2hex(random_bytes(32));
$pdo->prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ' . SESSION_DAYS . ' DAY)')->execute([
	hash('sha256', $token),
	$userId,
]);
set_session_cookie($token, SESSION_DAYS * 86400);

respond(201, ['ok' => true] + state_payload(state_row($userId)));
