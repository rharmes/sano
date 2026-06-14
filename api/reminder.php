<?php
// Per-user daily-reminder schedule.
//
// GET                 -> 200 {hour, tz}   (both null when no reminder is set)
// POST {hour, tz}     -> 200 {ok, hour, tz}      set / update the reminder
// POST {disable:true} -> 200 {ok, hour:null, tz:null}   clear it
//
// Both require an authenticated session; POST also requires the CSRF header.
//   hour: integer 0-23 — whole hours only, so the dispatcher cron need only
//         run once an hour (tools/send-reminders.php).
//   tz:   IANA zone name, validated against timezone_identifiers_list().

declare(strict_types=1);
require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
	$userId = require_user();
	$stmt = db()->prepare('SELECT reminder_hour, reminder_tz FROM users WHERE id = ?');
	$stmt->execute([$userId]);
	$row = $stmt->fetch();
	respond(200, [
		'hour' => isset($row['reminder_hour']) ? (int) $row['reminder_hour'] : null,
		'tz' => $row['reminder_tz'] ?? null,
	]);
}

if ($method !== 'POST') {
	respond(405, ['error' => 'method']);
}
require_csrf_header();
$userId = require_user();
$body = read_json_body();

// Clear when explicitly disabled or when no hour is provided.
if (!empty($body['disable']) || ($body['hour'] ?? null) === null) {
	db()
		->prepare('UPDATE users SET reminder_hour = NULL, reminder_tz = NULL WHERE id = ?')
		->execute([$userId]);
	respond(200, ['ok' => true, 'hour' => null, 'tz' => null]);
}

$hour = $body['hour'];
$tz = (string) ($body['tz'] ?? '');
if (!is_int($hour) || $hour < 0 || $hour > 23) {
	respond(400, ['error' => 'bad_hour']);
}
if (!in_array($tz, timezone_identifiers_list(), true)) {
	respond(400, ['error' => 'bad_tz']);
}

db()
	->prepare('UPDATE users SET reminder_hour = ?, reminder_tz = ? WHERE id = ?')
	->execute([$hour, $tz, $userId]);
respond(200, ['ok' => true, 'hour' => $hour, 'tz' => $tz]);
