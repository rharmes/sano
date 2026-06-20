<?php
// Localhost-only save endpoint for the Devanagari review tool
// (design/devanagari.html). It accepts a POST of changed entries and merges them
// into design/devanagari-review.json — a map keyed by item id — which Ross then
// verifies and merges into js/data.js by hand. It deliberately does NOT touch
// js/data.js.
//
// This file lives in design/, which is NOT in the deploy rsync (tools/deploy.sh),
// so it never ships to the live site. Run it locally with `php -S 127.0.0.1:8000`
// from the repo root. No auth: it only ever runs on your machine.

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

$path = __DIR__ . '/devanagari-review.json';

// Load the existing review map. A missing file is an empty map; a corrupt one is
// set aside as .bak rather than silently overwritten, so no prior work is lost.
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
	// A reverted/cleared override asks us to drop the correction entirely.
	if (!empty($e['remove'])) {
		if (isset($store[$id])) {
			unset($store[$id]);
			$removed++;
		}
		continue;
	}
	$dev = isset($e['dev']) ? trim((string) $e['dev']) : '';
	if ($dev === '') {
		continue;
	}
	$store[$id] = [
		'dev' => $dev,
		'draft' => isset($e['old']) ? (string) $e['old'] : '', // the AI draft it replaces
		'en' => isset($e['en']) ? (string) $e['en'] : '',
		'np' => isset($e['np']) ? (string) $e['np'] : '',
		'ts' => date('c'),
	];
	$saved++;
}

// Pretty-print with Devanagari left readable (not \uXXXX-escaped); write atomically.
// Cast to object so an empty map serializes as {} (a map keyed by id), not [].
$json = json_encode((object) $store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$tmp = $path . '.tmp';
if ($json === false || file_put_contents($tmp, $json) === false || !rename($tmp, $path)) {
	http_response_code(500);
	echo json_encode(['ok' => false, 'error' => 'could not write review file']);
	exit();
}

echo json_encode([
	'ok' => true,
	'saved' => $saved,
	'removed' => $removed,
	'total' => count($store),
]);
