<?php
// Shared helpers for the sano API. Not a public endpoint (api/.htaccess denies it).
//
// Config lives OUTSIDE the docroot in ~/sano-config.php (one level above the
// site directory; never committed or deployed). It returns:
//   ['dsn' => 'mysql:host=...;dbname=...;charset=utf8mb4', 'user' => ..., 'pass' => ...]

declare(strict_types=1);

const SESSION_COOKIE = 'sano_session';
const SESSION_DAYS = 90;
const LOCK_AFTER_FAILURES = 10;
const LOCK_MINUTES = 15;
const LOGIN_IP_WINDOW_MINUTES = 15; // per-IP login throttle window
const LOGIN_IP_MAX = 30; // failed logins per IP per window before a 429
const MAX_STATE_BYTES = 1048576;
// Everything except the state blob is a handful of fields — credentials, an hour
// and a timezone, a push endpoint and two keys. Nothing legitimate approaches this.
const MAX_BODY_BYTES = 16384;
// The state PUT's envelope ({"state":…,"baseRevision":N,"force":…}) on top of the
// blob itself, plus room for a client that pretty-prints its JSON.
const MAX_STATE_BODY_BYTES = MAX_STATE_BYTES + 8192;
const MAX_PUSH_SUBS_PER_USER = 20;

// Fail closed: never surface a stack trace or the DB DSN to the client. Any
// uncaught exception (a PDO error, a bad config, register.php's re-thrown
// non-duplicate insert) becomes a generic JSON 500; the detail is logged
// server-side only. Endpoints just `require` this file, so the guard covers all.
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e): void {
	error_log('sano api: ' . $e);
	if (!headers_sent()) {
		http_response_code(500);
		header('Content-Type: application/json');
	}
	echo json_encode(['error' => 'server']);
});

// A fatal error — memory exhaustion above all — bypasses set_exception_handler
// completely, so without this a request that runs out of memory returns an empty
// body with no Content-Type and the client's res.json() rejects on nothing.
// (No memory is reserved for this handler: PHP frees the request's allocations
// before shutdown functions run, verified down to a 2M memory_limit under both a
// single failed allocation and many retained ones.)
register_shutdown_function(function (): void {
	$last = error_get_last();
	if ($last === null || !in_array($last['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
		return;
	}
	error_log('sano api fatal: ' . $last['message'] . ' in ' . $last['file'] . ':' . $last['line']);
	if (!headers_sent()) {
		http_response_code(500);
		header('Content-Type: application/json');
		echo json_encode(['error' => 'server']);
	}
});

function db(): PDO
{
	static $pdo = null;
	if ($pdo === null) {
		$config = require __DIR__ . '/../../sano-config.php';
		$pdo = new PDO($config['dsn'], $config['user'], $config['pass'], [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
		]);
	}
	return $pdo;
}

function respond(int $code, $data): void
{
	http_response_code($code);
	header('Content-Type: application/json');
	if ($code !== 204) {
		echo json_encode($data);
	}
	exit();
}

// Read the raw request body with a hard ceiling. Every size check used to run
// *after* file_get_contents('php://input') had already pulled the whole body into
// memory, and post_max_size does not bound a PUT read that way — only memory_limit
// does. So an unauthenticated request could drive PHP into a memory-exhaustion
// fatal before a single guard ran.
function read_body(int $maxBytes, string $tooLarge = 'too_large'): string
{
	// Content-Length is a hint, not a promise (a chunked request carries none), so
	// use it to reject cheaply and still bound the read that follows.
	if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $maxBytes) {
		respond(413, ['error' => $tooLarge]);
	}
	$fh = fopen('php://input', 'rb');
	$raw = $fh === false ? false : stream_get_contents($fh, $maxBytes + 1);
	if ($fh !== false) {
		fclose($fh);
	}
	if ($raw === false) {
		respond(400, ['error' => 'bad_json']);
	}
	// One byte over the cap is enough to know it was too big, without holding it all.
	if (strlen($raw) > $maxBytes) {
		respond(413, ['error' => $tooLarge]);
	}
	return $raw;
}

function read_json_body(int $maxBytes = MAX_BODY_BYTES): array
{
	$body = json_decode(read_body($maxBytes), true);
	if (!is_array($body)) {
		respond(400, ['error' => 'bad_json']);
	}
	return $body;
}

// --- Request guards ---------------------------------------------------------
// Canonical order for every endpoint: require_method() -> require_csrf_header()
// (mutating verbs) -> read_json_body() -> stateless field validation ->
// require_user()/require_admin() -> DB work. Auth runs LAST among the guards so a
// cheap, stateless check fails fast without opening a DB connection, and so the
// whole input-validation surface stays testable with no database: session_user()
// returns null (-> 401) without a cookie, before any db() call (tests/api/guards.spec.mjs).
// Checks that need a row (user existence, revision conflicts) necessarily follow auth.

function require_method(string $method): void
{
	if ($_SERVER['REQUEST_METHOD'] !== $method) {
		respond(405, ['error' => 'method']);
	}
}

// CSRF guard: same-origin fetch() must send this custom header. A cross-origin
// request can only include it after a CORS preflight, which we never grant.
function require_csrf_header(): void
{
	if (($_SERVER['HTTP_X_SANO_REQUEST'] ?? '') !== '1') {
		respond(403, ['error' => 'csrf']);
	}
}

function set_session_cookie(string $value, int $maxAge): void
{
	setcookie(SESSION_COOKIE, $value, [
		'expires' => $maxAge > 0 ? time() + $maxAge : 1,
		'path' => '/',
		'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
		'httponly' => true,
		'samesite' => 'Strict',
	]);
}

// Returns the authenticated user id, or null.
function session_user(): ?int
{
	$token = $_COOKIE[SESSION_COOKIE] ?? '';
	if ($token === '') {
		return null;
	}
	$stmt = db()->prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > NOW()');
	$stmt->execute([hash('sha256', $token)]);
	$userId = $stmt->fetchColumn();
	return $userId === false ? null : (int) $userId;
}

function require_user(): int
{
	$userId = session_user();
	if ($userId === null) {
		respond(401, ['error' => 'auth']);
	}
	return $userId;
}

// True when the user holds the admin flag (the /admin/ dashboard gate).
function is_admin(int $userId): bool
{
	$stmt = db()->prepare('SELECT is_admin FROM users WHERE id = ?');
	$stmt->execute([$userId]);
	return (bool) $stmt->fetchColumn();
}

// Like require_user(), but also 403s a logged-in non-admin. Returns the admin id.
function require_admin(): int
{
	$userId = require_user();
	if (!is_admin($userId)) {
		respond(403, ['error' => 'forbidden']);
	}
	return $userId;
}

// --- Web Push subscriptions -------------------------------------------------
// A subscription endpoint is a URL *the server itself* POSTs to, every hour, from
// tools/send-reminders.php. So an unvalidated one doesn't just store junk — it
// points the host's outbound HTTP at whatever address the caller likes.
//
// The allowlist is deliberate. Rejecting private/loopback IPs is the obvious
// alternative and it does not work: the endpoint is a *hostname*, it can resolve
// anywhere, and it can resolve somewhere else by the time the cron runs an hour
// later. The set of real Web Push services is small and changes about once a
// decade, so naming them is both stronger and simpler.
//
// Keep in sync with the copy in tools/send-reminders.php, which re-checks rows
// that predate this validation (drift-guarded by tests/data/push-allowlist.test.mjs).
const PUSH_HOSTS = [
	'web.push.apple.com', // Safari / iOS
	'fcm.googleapis.com', // Chrome, Edge, Samsung, Opera — every Chromium
	'updates.push.services.mozilla.com', // Firefox
];
const PUSH_HOST_SUFFIXES = ['.notify.windows.com']; // WNS, per-region subdomains

function push_endpoint_ok(string $endpoint): bool
{
	$parts = parse_url($endpoint);
	// No userinfo and no explicit port: `https://web.push.apple.com@evil.test/`
	// parses with host `evil.test`, and a real push service is always on 443.
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

// A subscription key is base64url of a fixed-length binary value: p256dh is an
// uncompressed P-256 point (65 bytes, leading 0x04), auth is 16 random bytes.
// Anything else can only fail later — inside the cron's encryption step, where
// it takes the whole run down with it.
function push_key_ok(string $key, int $bytes, int $firstByte = -1): bool
{
	$raw = base64_decode(strtr($key, '-_', '+/'), true);
	if ($raw === false || strlen($raw) !== $bytes) {
		return false;
	}
	return $firstByte < 0 || ord($raw[0]) === $firstByte;
}

// updated_at (DATETIME(3), server zone) -> epoch milliseconds, via SQL so PHP
// and MySQL timezone settings can't disagree.
function state_row(int $userId): ?array
{
	$stmt = db()->prepare('SELECT state, revision, ROUND(UNIX_TIMESTAMP(updated_at) * 1000) AS updated_ms FROM app_state WHERE user_id = ?');
	$stmt->execute([$userId]);
	$row = $stmt->fetch();
	return $row === false ? null : $row;
}

function state_payload(?array $row): array
{
	if ($row === null) {
		return ['state' => null, 'revision' => 0, 'updatedAt' => null];
	}
	return [
		'state' => json_decode($row['state']),
		'revision' => (int) $row['revision'],
		'updatedAt' => (int) $row['updated_ms'],
	];
}
