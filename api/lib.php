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

function read_json_body(): array
{
	$body = json_decode(file_get_contents('php://input'), true);
	if (!is_array($body)) {
		respond(400, ['error' => 'bad_json']);
	}
	return $body;
}

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
