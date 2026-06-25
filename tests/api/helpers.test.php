<?php
// Pure-helper unit checks for api/lib.php — run with `php tests/api/helpers.test.php`.
// Requiring lib.php only DEFINES functions (db() is never called), so no database is
// needed. Zero-framework: a tiny check() helper, non-zero exit on any failure.

declare(strict_types=1);
require __DIR__ . '/../../api/lib.php';

$failures = 0;
function check(string $name, bool $cond): void
{
	global $failures;
	if ($cond) {
		echo "ok - $name\n";
		return;
	}
	$failures++;
	fwrite(STDERR, "FAIL - $name\n");
}

// state_payload(null): the "no saved state yet" shape the GET endpoint returns.
$empty = state_payload(null);
check('state_payload(null): state is null', $empty['state'] === null);
check('state_payload(null): revision is 0', $empty['revision'] === 0);
check('state_payload(null): updatedAt is null', $empty['updatedAt'] === null);

// state_payload(row): decodes the JSON blob and integer-casts revision/updatedAt.
$row = state_payload(['state' => '{"name":"Aastha","streak":3}', 'revision' => '7', 'updated_ms' => '1700000000000']);
check('state_payload: decodes the JSON state blob to an object', is_object($row['state']) && $row['state']->name === 'Aastha' && $row['state']->streak === 3);
check('state_payload: casts revision to int', $row['revision'] === 7);
check('state_payload: casts updatedAt to int', $row['updatedAt'] === 1700000000000);

// require_csrf_header(): the pass path must return without exiting (the 403 failure
// path calls exit() and is covered by the HTTP guard specs).
$_SERVER['HTTP_X_SANO_REQUEST'] = '1';
require_csrf_header();
check('require_csrf_header(): returns when the header is present', true);

if ($failures > 0) {
	fwrite(STDERR, "\n$failures PHP helper assertion(s) failed.\n");
	exit(1);
}
echo "api helpers: all assertions passed\n";
