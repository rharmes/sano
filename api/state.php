<?php
// GET -> 200 {state, revision, updatedAt}   (state null until first PUT)
// PUT {state, baseRevision, force?} -> 200 {revision, updatedAt}
//                                      409 {error: "conflict", state, revision, updatedAt}
// Both -> 401 {error: "auth"} when not logged in.

// strict_types matters here specifically: it is file-scoped, so lib.php's own
// declaration does not cover this file, and without it strlen(false) silently
// measured 0 — see the json_encode guard below.
declare(strict_types=1);
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

// Decode to stdClass, not assoc arrays: an assoc round-trip would re-encode empty
// JSON objects (a fresh state's "items": {}) as [], corrupting the blob. Parse and
// validate the payload before authenticating, so a malformed body fails fast and
// stays testable without a DB (see the guard-order note in lib.php).
$body = json_decode(file_get_contents('php://input'));
if (!is_object($body)) {
	respond(400, ['error' => 'bad_json']);
}
if (!isset($body->state) || !is_object($body->state)) {
	respond(400, ['error' => 'missing_state']);
}
// json_encode returns false for INF/NAN, which a JSON literal like 1e999 produces
// on decode. The old code then measured strlen(false) as 0, passed the size cap,
// and bound false — storing the empty string. That row is not valid JSON, so the
// reminder cron's JSON_UNQUOTE(JSON_EXTRACT(s.state, ...)) over *every* subscriber
// failed on it and aborted the whole SELECT: one account could silently stop
// everybody's reminders until the row was fixed by hand. Reject it instead.
$stateJson = json_encode($body->state);
if ($stateJson === false) {
	respond(400, ['error' => 'bad_state']);
}
if (strlen($stateJson) > MAX_STATE_BYTES) {
	respond(413, ['error' => 'state_too_large']);
}
$baseRevision = (int) ($body->baseRevision ?? 0);
$force = !empty($body->force);

$userId = require_user();

$pdo = db();
$pdo->beginTransaction();

// The conflict check rides along in the UPDATE rather than a preceding
// SELECT ... FOR UPDATE, so there is no window between reading the revision and
// writing it. rowCount() is the answer: 1 when the row existed and (unless
// forcing) its base revision still matched, 0 otherwise. `revision + 1` always
// changes the row, so a matched row is always an affected row.
$sql = 'UPDATE app_state SET state = ?, revision = revision + 1 WHERE user_id = ?';
$params = [$stateJson, $userId];
if (!$force) {
	$sql .= ' AND revision = ?';
	$params[] = $baseRevision;
}
$write = $pdo->prepare($sql);
$write->execute($params);

if ($write->rowCount() === 0) {
	// Nothing updated: either this account has no row yet, or another device has
	// written since $baseRevision. Insert and let the primary key say which.
	try {
		$pdo->prepare('INSERT INTO app_state (user_id, state) VALUES (?, ?)')->execute([$userId, $stateJson]);
	} catch (PDOException $e) {
		// 23000 duplicate key: the row was there, so this is a genuine conflict.
		// 40001 deadlock: two first-ever PUTs from one account raced; the loser
		// should reconcile against the winner's copy, which is the same answer.
		if ($e->getCode() !== '23000' && $e->getCode() !== '40001') {
			throw $e;
		}
		if ($pdo->inTransaction()) {
			$pdo->rollBack(); // a deadlock has already rolled it back for us
		}
		respond(409, ['error' => 'conflict'] + state_payload(state_row($userId)));
	}
}

// Read the revision while the transaction is still open, so it is the value this
// request produced — reading after the commit could pick up a revision a racing
// PUT from the user's other device wrote in between, and the client would then
// store a base revision it never wrote.
$row = state_row($userId);
$pdo->commit();

respond(200, ['revision' => (int) $row['revision'], 'updatedAt' => (int) $row['updated_ms']]);
