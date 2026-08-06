<?php
// Localhost-only save endpoint for the English-prompt gloss review tool (design/en-gloss.html,
// T59). It accepts a POST of corrected word→word alignments between an exercise prompt's
// English and its Nepali, and merges them into design/en-gloss-review.json — a map keyed by
// the frame's audioId (item.id, or <id>-fN). Ross fixes what the aligner in
// tools/build-en-glosses.mjs got wrong or left unmatched; a separate merge step folds the
// reviewed rows into that script's OVERRIDES table, which is what actually ships in
// js/en-glosses.js. It deliberately does NOT touch js/data.js or js/en-glosses.js.
//
// This file lives in design/, which is NOT in the deploy rsync (tools/deploy.sh), so it never
// ships to the live site. Run it locally with `php -S 127.0.0.1:8000` from the repo root. No
// auth: it only ever runs on your machine. Mirrors design/frames-save.php.

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

$path = __DIR__ . '/en-gloss-review.json';

// Load the existing decisions map. Missing file = empty map; a corrupt one is set aside as
// .bak rather than silently overwritten, so no prior review work is lost.
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
	// A row reset to the aligner's own output asks us to drop any stored correction for it.
	if (!empty($e['remove'])) {
		if (isset($store[$id])) {
			unset($store[$id]);
			$removed++;
		}
		continue;
	}
	if (!isset($e['tokens']) || !is_array($e['tokens'])) {
		continue;
	}
	// One [englishWord, romanizedNepaliWord] pair per word of the prompt, in order; an empty
	// second element means "leave this word plain". Rebuilt defensively rather than stored
	// as sent, so a malformed row can't reach the build script.
	$tokens = [];
	foreach ($e['tokens'] as $pair) {
		if (!is_array($pair) || !isset($pair[0])) {
			continue;
		}
		$tokens[] = [trim((string) $pair[0]), isset($pair[1]) ? trim((string) $pair[1]) : ''];
	}
	if (!$tokens) {
		continue;
	}
	$store[$id] = [
		'en' => isset($e['en']) ? trim((string) $e['en']) : '',
		'np' => isset($e['np']) ? trim((string) $e['np']) : '',
		'tokens' => $tokens,
		'ts' => date('c'),
	];
	$saved++;
}

// Write atomically. Cast to object so an empty map serializes as {} (a map keyed by id), not [].
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
