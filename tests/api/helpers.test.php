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

// --- The session cookie (T48) -----------------------------------------------
// The __Host- prefix is a contract with the browser, not a naming convention: Secure,
// Path=/, no Domain. Break any one of them and the browser silently drops the cookie, so
// nobody stays signed in — and the protection the prefix buys (no sibling host can write
// this cookie) is gone. Both shapes are asserted here because production's can't be
// observed from the test suite: PHP_SAPI is 'cli' here and 'cli-server' under the
// Playwright specs, never the FastCGI SAPI the live site runs.
$prod = session_cookie_options(SESSION_DAYS * 86400, false);
check('session cookie: production is named __Host-sano_session', session_cookie_name(false) === '__Host-sano_session');
check('session cookie: production is Secure', $prod['secure'] === true);
check('session cookie: __Host- requires Path=/', $prod['path'] === '/');
check('session cookie: __Host- forbids a Domain', !array_key_exists('domain', $prod));
check('session cookie: HttpOnly, so no script can read it', $prod['httponly'] === true);
check('session cookie: SameSite=Strict', $prod['samesite'] === 'Strict');
check('session cookie: lives SESSION_DAYS', $prod['expires'] > time() + (SESSION_DAYS - 1) * 86400);
check('session cookie: maxAge 0 expires it in the past', session_cookie_options(0, false)['expires'] === 1);

// The dev server (php -S) is plain http, where a Secure cookie never comes back and a
// __Host- one is refused on arrival — so both come off, together. They must move
// together: a __Host- name without Secure is a cookie the browser throws away.
$dev = session_cookie_options(SESSION_DAYS * 86400, true);
check('session cookie: the dev server gets the unprefixed name', session_cookie_name(true) === 'sano_session');
check('session cookie: the dev server drops Secure with the prefix', $dev['secure'] === false);
check('session cookie: the dev server keeps HttpOnly and SameSite', $dev['httponly'] === true && $dev['samesite'] === 'Strict');
foreach ([false, true] as $isDev) {
	$prefixed = str_starts_with(session_cookie_name($isDev), '__Host-');
	check('session cookie: prefix and Secure agree (dev=' . var_export($isDev, true) . ')', $prefixed === session_cookie_options(1, $isDev)['secure']);
}

// --- The login timing equalizer (T47) ---------------------------------------
// api/login.php verifies against a fixed DUMMY_HASH whenever the username doesn't exist
// or the account is locked, so those cost the same argon2id work as a real attempt. That
// only holds while the dummy's cost parameters match the ones the stored hashes were
// made with — if PHP ever changes its argon2id defaults, the dummy silently becomes
// cheaper (or dearer) than the real hashes and the timing oracle re-opens without a
// single test noticing. Read it out of the source rather than requiring login.php, which
// would run the endpoint.
preg_match("/const DUMMY_HASH = '([^']+)'/", file_get_contents(__DIR__ . '/../../api/login.php'), $m);
check('login.php: DUMMY_HASH is defined', isset($m[1]));
$dummy = $m[1] ?? '';
$params = fn(string $hash) => implode('$', array_slice(explode('$', $hash), 0, 4)); // $argon2id$v=19$m=…,t=…,p=…
check('DUMMY_HASH: is argon2id', str_starts_with($dummy, '$argon2id$'));
check("DUMMY_HASH: cost parameters match this PHP's argon2id defaults", $params($dummy) === $params(password_hash('x', PASSWORD_ARGON2ID)));
// It has to be a hash of something nobody can supply — a verify that could ever return
// true would hand out a session for a username that doesn't exist.
foreach (['', 'password', 'password123', 'dummy'] as $guess) {
	check('DUMMY_HASH: rejects ' . var_export($guess, true), !password_verify($guess, $dummy));
}

// login_decide(): the whole branch table, with no database in sight. api/login.php is
// otherwise only exercised by the MySQL-backed integration job, and this is the part
// worth pinning everywhere — that the three ways to fail are one way to fail.
$right = 'password123';
$row = fn($lockLeft) => [
	'id' => 1,
	'password_hash' => password_hash($right, PASSWORD_ARGON2ID),
	'failed_logins' => 0,
	'locked_until' => $lockLeft === null ? null : '2030-01-01 00:00:00',
	'lock_left' => $lockLeft,
	'is_admin' => 0,
];
$open = $row(null);
$locked = $row(600); // ten minutes left on the lock
$expired = $row(-5); // lock ran out five seconds ago

$cases = [
	'right password on an open account signs in' => [login_decide($open, $right, $dummy), true, false],
	'wrong password on an open account fails' => [login_decide($open, 'nope', $dummy), false, false],
	'right password on a locked account fails, and reports the lock' => [login_decide($locked, $right, $dummy), false, true],
	'wrong password on a locked account fails' => [login_decide($locked, 'nope', $dummy), false, true],
	'an expired lock lets the right password through' => [login_decide($expired, $right, $dummy), true, false],
	'a username that does not exist fails' => [login_decide(false, $right, $dummy), false, false],
];
foreach ($cases as $name => [$got, $wantOk, $wantLocked]) {
	check("login_decide: $name", $got['ok'] === $wantOk && $got['locked'] === $wantLocked);
}

// The point of the dummy hash: every failure has to cost what a real verify costs. A
// short-circuit shows up as microseconds against argon2id's ~100 ms, so a floor well
// below one real verify separates them without depending on how fast the machine is.
foreach (
	[
		'a wrong password' => [$open, 'nope'],
		'a locked account' => [$locked, $right],
		'an unknown username' => [false, $right],
	]
	as $name => [$who, $pw]
) {
	$t = hrtime(true);
	login_decide($who, $pw, $dummy);
	$ms = (hrtime(true) - $t) / 1e6;
	check("login_decide: $name still does the argon2id work (" . round($ms) . 'ms)', $ms > 20);
}

if ($failures > 0) {
	fwrite(STDERR, "\n$failures PHP helper assertion(s) failed.\n");
	exit(1);
}
echo "api helpers: all assertions passed\n";
