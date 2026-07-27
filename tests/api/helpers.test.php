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

// --- Web Push validation (T42) ----------------------------------------------
// push_endpoint_ok() decides where the hourly cron is willing to send an outbound
// POST, so the interesting cases are the ones that *look* like a push service.
$b64url = fn(string $raw): string => rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
$goodP256 = $b64url("\x04" . str_repeat("\x11", 64)); // 65 bytes, uncompressed-point tag
$goodAuth = $b64url(str_repeat("\x22", 16)); // 16 bytes

// Shapes taken from the one real subscription on the server: 87 and 22 chars.
check('push_key_ok: a real-shaped p256dh is 87 chars', strlen($goodP256) === 87);
check('push_key_ok: a real-shaped auth is 22 chars', strlen($goodAuth) === 22);

foreach (
	[
		'https://web.push.apple.com/QSAgent' => true, // Safari / iOS — the live one
		'https://fcm.googleapis.com/fcm/send/abc123' => true,
		'https://updates.push.services.mozilla.com/wpush/v2/abc' => true,
		'https://db5p.notify.windows.com/w/?token=abc' => true, // WNS regional subdomain
		'http://web.push.apple.com/x' => false, // plaintext
		'https://127.0.0.1/x' => false, // loopback — the SSRF target
		'https://169.254.169.254/latest/meta-data/' => false, // cloud metadata
		'https://localhost/x' => false,
		'https://web.push.apple.com@evil.test/x' => false, // userinfo trick: host is evil.test
		'https://web.push.apple.com:8080/x' => false, // explicit port
		'https://web.push.apple.com.evil.test/x' => false, // lookalike suffix
		'https://evilnotify.windows.com/x' => false, // suffix must be dot-anchored
		'ftp://web.push.apple.com/x' => false,
		'' => false,
		'not a url' => false,
	]
	as $endpoint => $want
) {
	$label = $endpoint === '' ? '(empty)' : $endpoint;
	check("push_endpoint_ok: $label -> " . ($want ? 'allowed' : 'rejected'), push_endpoint_ok($endpoint) === $want);
}

check('push_key_ok: a well-formed p256dh passes', push_key_ok($goodP256, 65, 0x04));
check('push_key_ok: a well-formed auth passes', push_key_ok($goodAuth, 16));
check('push_key_ok: a p256dh of the wrong length fails', !push_key_ok($b64url("\x04" . str_repeat("\x11", 32)), 65, 0x04));
check('push_key_ok: a p256dh without the 0x04 point tag fails', !push_key_ok($b64url("\x02" . str_repeat("\x11", 64)), 65, 0x04));
check('push_key_ok: an auth of the wrong length fails', !push_key_ok($b64url(str_repeat("\x22", 15)), 16));
check('push_key_ok: non-base64 fails', !push_key_ok('!!!not base64!!!', 16));
check('push_key_ok: empty fails', !push_key_ok('', 16));
check('push_key_ok: the p256dh is not accepted as an auth', !push_key_ok($goodP256, 16));

// --- Admin state summary (T45) ------------------------------------------------
// The blob is whatever an account chose to sync, so every bound here is load-bearing.
$blob = fn(array $items, int $streak = 0): string => json_encode(['streak' => $streak, 'items' => $items]);
$grad = ['graduated' => true, 'seen' => 3];

$plain = state_summary($blob(['a-one' => $grad, 'b-two' => ['graduated' => false], 'c-three' => $grad], 7), ADMIN_MAX_TOTAL_IDS);
check('state_summary: reads the streak', $plain['streak'] === 7);
check('state_summary: returns only graduated ids', $plain['graduated'] === ['a-one', 'c-three']);
check('state_summary: nothing capped for an ordinary blob', $plain['capped'] === false);

check('state_summary: a null blob is an empty summary', state_summary(null, ADMIN_MAX_TOTAL_IDS) === ['streak' => 0, 'graduated' => [], 'capped' => false]);
check('state_summary: junk that is not JSON yields an empty summary', state_summary('not json', ADMIN_MAX_TOTAL_IDS)['graduated'] === []);
check('state_summary: a JSON scalar yields an empty summary', state_summary('42', ADMIN_MAX_TOTAL_IDS)['graduated'] === []);
check(
	'state_summary: items of the wrong type yield an empty summary',
	state_summary(json_encode(['items' => 'nope']), ADMIN_MAX_TOTAL_IDS)['graduated'] === [],
);

// A padded account: far more graduated items than the whole course has.
$flood = [];
for ($i = 0; $i < ADMIN_MAX_GRADUATED + 500; $i++) {
	$flood["item-$i"] = $grad;
}
$capped = state_summary($blob($flood), ADMIN_MAX_TOTAL_IDS);
check('state_summary: caps a flooded blob at ADMIN_MAX_GRADUATED', count($capped['graduated']) === ADMIN_MAX_GRADUATED);
check('state_summary: reports that it capped', $capped['capped'] === true);

// The longest real course id is 59 chars; anything wildly longer is padding.
$long = str_repeat('z', ADMIN_MAX_ID_LEN + 1);
$mixed = state_summary($blob([$long => $grad, 'real-id' => $grad]), ADMIN_MAX_TOTAL_IDS);
check('state_summary: drops an over-long id but keeps the real one', $mixed['graduated'] === ['real-id']);
check('state_summary: an over-long id counts as capped', $mixed['capped'] === true);

// The caller's whole-response budget wins even when the per-blob limit would not.
$budgeted = state_summary($blob(['x-1' => $grad, 'x-2' => $grad, 'x-3' => $grad]), 2);
check('state_summary: the shared budget bounds the list', count($budgeted['graduated']) === 2);
check('state_summary: an exhausted budget yields nothing', state_summary($blob(['x-1' => $grad]), 0)['graduated'] === []);

if ($failures > 0) {
	fwrite(STDERR, "\n$failures PHP helper assertion(s) failed.\n");
	exit(1);
}
echo "api helpers: all assertions passed\n";
