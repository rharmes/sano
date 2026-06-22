<?php
// GET -> 200 {state, revision, updatedAt}   (state null until first PUT)
// PUT {state, baseRevision, force?} -> 200 {revision, updatedAt}
//                                      409 {error: "conflict", state, revision, updatedAt}
// Both -> 401 {error: "auth"} when not logged in.

require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
	$userId = require_user();
	respond(200, ['isAdmin' => is_admin($userId)] + state_payload(state_row($userId)));
}

if ($method !== 'PUT') {
	respond(405, ['error' => 'method']);
}
require_csrf_header();
$userId = require_user();

// Decode to stdClass, not assoc arrays: an assoc round-trip would re-encode
// empty JSON objects (a fresh state's "items": {}) as [], corrupting the blob.
$body = json_decode(file_get_contents('php://input'));
if (!is_object($body)) {
	respond(400, ['error' => 'bad_json']);
}
if (!isset($body->state) || !is_object($body->state)) {
	respond(400, ['error' => 'missing_state']);
}
$stateJson = json_encode($body->state);
if (strlen($stateJson) > MAX_STATE_BYTES) {
	respond(413, ['error' => 'state_too_large']);
}
$baseRevision = (int) ($body->baseRevision ?? 0);
$force = !empty($body->force);

$pdo = db();
$pdo->beginTransaction();
$stmt = $pdo->prepare('SELECT revision FROM app_state WHERE user_id = ? FOR UPDATE');
$stmt->execute([$userId]);
$revision = $stmt->fetchColumn();

if ($revision === false) {
	$pdo->prepare('INSERT INTO app_state (user_id, state) VALUES (?, ?)')->execute([$userId, $stateJson]);
} elseif ($force || $baseRevision === (int) $revision) {
	$pdo->prepare('UPDATE app_state SET state = ?, revision = revision + 1 WHERE user_id = ?')->execute([$stateJson, $userId]);
} else {
	$pdo->commit();
	respond(409, ['error' => 'conflict'] + state_payload(state_row($userId)));
}
$pdo->commit();

$row = state_row($userId);
respond(200, ['revision' => (int) $row['revision'], 'updatedAt' => (int) $row['updated_ms']]);
