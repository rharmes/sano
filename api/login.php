<?php
// POST {username, password} -> 200 {ok, state, revision, updatedAt} + session cookie
//                              401 {error: "bad_credentials"}
//                              429 {error: "rate_limited", retryAfter: seconds}
//
// Every rejection below the per-IP throttle is that one 401: a wrong password, a
// username that doesn't exist, and a locked account are deliberately identical in
// status, body, cost and rate-limit budget (T47 — see the two comments inline).

require __DIR__ . '/lib.php';

// An argon2id hash of a random password nobody holds — not a placeholder, a real hash
// the miss path verifies against so that a username that doesn't exist costs the same
// ~100 ms as one that does. Without it, `!$user || password_verify(...)` short-circuits:
// a real username spends a full argon2id verify and a fake one answers in about a
// millisecond, which is a one-request-per-candidate membership oracle measurable from
// anywhere on the internet. Its cost parameters have to match the stored hashes' or the
// timings still separate — tests/api/helpers.test.php fails if PHP's argon2id defaults
// ever drift away from these (m=65536,t=4,p=1 on PHP 7.3 through 8.5).
//
// The cost of this is real and worth naming: a junk username is no longer free to
// serve, it now burns ~100 ms and argon2id's 64 MiB like any other attempt. That
// ceiling already existed for anyone who knew one real username; the per-IP throttle
// below — deliberately checked before any verify — is what bounds it, to 30 per window.
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=1$WFViV2QzcEFYNnpma3lzeA$yS6rfKXsn0I9gecx8ZKmGRKLB/6vOJDhOwJG/PLI6Wg';

require_method('POST');
require_csrf_header();
$body = read_json_body();
$username = (string) ($body['username'] ?? '');
$password = (string) ($body['password'] ?? '');
if ($username === '' || $password === '') {
	respond(400, ['error' => 'missing_fields']);
}

$pdo = db();

// Housekeeping: drop expired sessions while we're here.
$pdo->exec('DELETE FROM sessions WHERE expires_at <= NOW()');

// Per-IP throttle. The per-account lockout below stops one username being
// hammered, but not an attacker rotating usernames (credential stuffing); this
// bounds failed attempts per source IP. Checked before password_verify so a
// flood can't also burn argon2id CPU. Pack the IP to bytes (IPv4 4 / IPv6 16).
$ip = inet_pton($_SERVER['REMOTE_ADDR'] ?? '') ?: str_repeat("\0", 16);
// Overridable via env so the CI integration suite (every test logging in from 127.0.0.1)
// isn't starved by the 30/window cap, and so one spec can drive the cap deliberately.
// Unset in production, and any nonsense value falls back to the constant rather than to
// zero — a zero cap would 429 every sign-in on the site.
$ipMax = (int) getenv('SANO_LOGIN_IP_MAX');
if ($ipMax < 1) {
	$ipMax = LOGIN_IP_MAX;
}
$pdo->exec('DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL ' . LOGIN_IP_WINDOW_MINUTES . ' MINUTE');
$recent = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND created_at > NOW() - INTERVAL ' . LOGIN_IP_WINDOW_MINUTES . ' MINUTE');
$recent->execute([$ip]);
if ((int) $recent->fetchColumn() >= $ipMax) {
	respond(429, ['error' => 'rate_limited', 'retryAfter' => LOGIN_IP_WINDOW_MINUTES * 60]);
}

$stmt = $pdo->prepare(
	'SELECT id, password_hash, failed_logins, locked_until, TIMESTAMPDIFF(SECOND, NOW(), locked_until) AS lock_left, is_admin FROM users WHERE username = ?',
);
$stmt->execute([$username]);
$user = $stmt->fetch();

// The lockout used to answer with its own `429 {error:"locked", retryAfter}`. That
// response is only reachable for a username that exists, so it announced membership —
// and because it returned *above* the attempt row below, polling it was free: an
// attacker could confirm an account forever without spending a single one of their 30
// failures per window. So a locked account now takes the same path as any other failure:
// the same 401, the same argon2id cost, and the same charge against the caller's budget.
// The branch table lives in login_decide() (api/lib.php) so it can be tested without a
// database — tests/api/helpers.test.php walks every combination.
['ok' => $ok, 'locked' => $locked] = login_decide($user, $password, DUMMY_HASH);

if (!$ok) {
	// Count this failure toward the per-IP throttle above — including the locked case,
	// which is the whole point of metering it.
	$pdo->prepare('INSERT INTO login_attempts (ip) VALUES (?)')->execute([$ip]);
	// Per-account lockout. NOTE: a deliberate failer can lock a *known* username
	// out for LOCK_MINUTES (a minor targeted-DoS tradeoff accepted for a small
	// invite app); the per-IP throttle above is the broader credential-stuffing defense.
	// Not bumped while already locked: re-arming the timer on every probe would let one
	// request per LOCK_MINUTES hold an account shut for good. That does leave the locked
	// path one indexed UPDATE lighter than a wrong password — sub-millisecond against a
	// ~100 ms verify, well under the jitter of any remote measurement, and not worth
	// buying back with an indefinite lockout.
	if ($user !== false && !$locked) {
		$failures = $user['failed_logins'] + 1;
		if ($failures >= LOCK_AFTER_FAILURES) {
			$pdo->prepare('UPDATE users SET failed_logins = 0, locked_until = NOW() + INTERVAL ' . LOCK_MINUTES . ' MINUTE WHERE id = ?')->execute([
				$user['id'],
			]);
		} else {
			$pdo->prepare('UPDATE users SET failed_logins = ? WHERE id = ?')->execute([$failures, $user['id']]);
		}
	}
	respond(401, ['error' => 'bad_credentials']);
}

$pdo->prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?')->execute([$user['id']]);

$token = bin2hex(random_bytes(32));
$pdo->prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ' . SESSION_DAYS . ' DAY)')->execute([
	hash('sha256', $token),
	$user['id'],
]);
set_session_cookie($token, SESSION_DAYS * 86400);

respond(200, ['ok' => true, 'isAdmin' => (bool) $user['is_admin']] + state_payload(state_row((int) $user['id'])));
