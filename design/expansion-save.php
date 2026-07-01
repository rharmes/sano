<?php
// Localhost-only save endpoint for the expansion review tool (design/expansion.html).
// It accepts a POST of review decisions for AI-drafted candidate words and merges them into
// design/expansion-approved.json — a map keyed by candidate id. Ross approves/edits/rejects each
// drafted word here; a separate merge step (stage 4) folds the APPROVED rows into js/data.js.
// It deliberately does NOT touch js/data.js.
//
// This file lives in design/, which is NOT in the deploy rsync (tools/deploy.sh), so it never
// ships to the live site. Run it locally with `php -S 127.0.0.1:8000` from the repo root. No auth:
// it only ever runs on your machine.

header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	http_response_code(405);
	echo json_encode(['ok' => false, 'error' => 'POST only']);
	exit();
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body) || !isset($body['edits']) || !is_array($body['edits'])) {
	http_response_code(400);
	echo json_encode(['ok' => false, 'error' => 'expected JSON { edits: [...] }']);
	exit();
}

$path = __DIR__ . '/expansion-approved.json';

// Load the existing decisions map. Missing file = empty map; a corrupt one is set aside as .bak
// rather than silently overwritten, so no prior review work is lost.
$store = [];
if (is_file($path)) {
	$existing = json_decode((string) file_get_contents($path), true);
	if (is_array($existing)) {
		$store = $existing;
	} else {
		@rename($path, $path . '.bak');
	}
}

$saved = 0;
$removed = 0;
foreach ($body['edits'] as $e) {
	if (!is_array($e)) {
		continue;
	}
	$id = isset($e['id']) ? trim((string) $e['id']) : '';
	if ($id === '') {
		continue;
	}
	// A row reverted to "pending" asks us to drop any stored decision for it.
	if (!empty($e['remove'])) {
		if (isset($store[$id])) {
			unset($store[$id]);
			$removed++;
		}
		continue;
	}
	$decision = isset($e['decision']) ? trim((string) $e['decision']) : '';
	if ($decision !== 'approved' && $decision !== 'rejected') {
		continue; // only persisted states are approved/rejected
	}
	$store[$id] = [
		'decision' => $decision,
		'dev' => isset($e['dev']) ? trim((string) $e['dev']) : '',
		'en' => isset($e['en']) ? trim((string) $e['en']) : '',
		'emoji' => isset($e['emoji']) ? trim((string) $e['emoji']) : '',
		'usage' => isset($e['usage']) ? trim((string) $e['usage']) : '',
		'unit' => isset($e['unit']) ? trim((string) $e['unit']) : '',
		'ts' => date('c'),
	];
	$saved++;
}

// Pretty-print with Devanagari left readable; write atomically. Cast to object so an empty map
// serializes as {} (a map keyed by id), not [].
$json = json_encode((object) $store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$tmp = $path . '.tmp';
if ($json === false || file_put_contents($tmp, $json) === false || !rename($tmp, $path)) {
	http_response_code(500);
	echo json_encode(['ok' => false, 'error' => 'could not write approved file']);
	exit();
}

$approved = 0;
foreach ($store as $row) {
	if (is_array($row) && ($row['decision'] ?? '') === 'approved') {
		$approved++;
	}
}

echo json_encode([
	'ok' => true,
	'saved' => $saved,
	'removed' => $removed,
	'total' => count($store),
	'approved' => $approved,
]);
