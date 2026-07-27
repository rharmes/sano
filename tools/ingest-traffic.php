<?php
// Sano traffic ingest (T40) — Apache access logs -> aggregate rows in MySQL.
//
// Dreamhost keeps only ~7 days of ~/logs/namastesano.com/https/access.log*, so the
// numbers behind /admin/#traffic have to ACCUMULATE server-side: this runs nightly,
// parses every complete day still on disk that isn't already stored, and writes
// per-day + per-visitor-day aggregates. Raw IPs are never stored — a "visitor" is a
// salted sha256(ip + "\n" + user-agent) truncated to 16 bytes, so the rows can't be
// walked back to an address without the salt.
//
// Roughly half of the raw log is DreamHost's own SiteMonitor plus crawlers and
// wp-admin scanners, so a visitor-day only counts as human when the User-Agent isn't
// bot-shaped AND it successfully fetched at least one real app path (see is_app_path).
// Everything else is tallied as bot_requests, which the dashboard shows so the filter
// stays auditable.
//
// tools/ is never deployed to the docroot — install on the server as
// ~/sano-tools/ingest-traffic.php.
//
// Cron — nightly. Dreamhost rotates the log just after midnight (America/Los_Angeles),
// so 2:30am leaves plenty of slack; the script skips today as incomplete anyway:
//   30 2 * * * php $HOME/sano-tools/ingest-traffic.php >> $HOME/sano-traffic.log 2>&1
//
// Setup once on the server:
//   scp tools/ingest-traffic.php sano-deploy:sano-tools/
//   ssh sano-deploy 'php ~/sano-tools/migrate-2026-07-traffic.php'  # creates the tables
//   ssh sano-deploy 'php ~/sano-tools/ingest-traffic.php --update-geo'  # ~3MB index
//   (add  'traffic_salt' => '<32+ random chars>'  to ~/sano-config.php)
//
// Flags:
//   --update-geo        Download + compile the CC0 IP->country index, then exit.
//   --from <csv>        With --update-geo: compile from a local CSV, no download
//                       (v4 if the rows are integers, v6 if they're addresses).
//   --all               Re-ingest every day on disk, overwriting what's stored.
//   --day <YYYY-MM-DD>  Ingest only that day (overwrites it).
//   --today             Also ingest today, which is otherwise skipped as incomplete.
//   --file <path>       Parse this log file instead of the glob (repeatable).
//   --log-glob <glob>   Override the access-log glob.
//   --geo-dir <dir>     Compiled geo index location (default: <script dir>/geo).
//   --dry-run           Parse and report, write nothing.
//   --json              Print the parsed aggregates as JSON and exit (implies
//                       --dry-run). Needs neither a DB nor sano-config.php, which is
//                       what makes the parser testable — tests/data/traffic-parse.test.mjs.

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
	exit(1);
}

// A session ends after this much silence from one visitor (the analytics standard).
// A session that spans midnight is counted once per day: ingest is per-day, and a
// day is the unit the dashboard queries.
const SESSION_GAP = 1800;

// Flood bounds (T49). A whole day is held in memory before anything can be classified,
// and the visitor key is sha256(ip + UA) — so someone rotating the User-Agent mints a
// fresh bucket per request. Unbounded, a few hundred thousand requests exhaust the
// 128 MB CLI limit, the nightly run dies, and because Dreamhost keeps only ~7 days of
// logs that day's history is gone for good. Below that threshold the same flood writes
// one traffic_errors row per distinct 404 path. Every limit here sits far above a real
// day for this site, and anything dropped is reported rather than silently discarded.
const MAX_VISITORS_PER_DAY = 20000;
const MAX_TIMES_PER_VISITOR = 2000; // only ever used to find session gaps
const MAX_KEYS_PER_VISITOR = 50; // distinct error paths / referrer hosts per visitor
const MAX_ROWS_PER_DAY = 500; // distinct referrer / error rows stored per day

// Free, public-domain (CC0) IP->country ranges. Compiled locally into fixed-width
// binary so lookups are an fseek binary search — a 128M PHP CLI can't hold the 8MB
// CSV as arrays, and this keeps every lookup on our own disk (no third party ever
// sees a visitor's address, and nothing is fetched at app runtime).
const GEO_V4_URL = 'https://cdn.jsdelivr.net/npm/@ip-location-db/geo-whois-asn-country/geo-whois-asn-country-ipv4-num.csv';
const GEO_V6_URL = 'https://cdn.jsdelivr.net/npm/@ip-location-db/geo-whois-asn-country/geo-whois-asn-country-ipv6.csv';
const GEO_V4_REC = 10; // uint32 start, uint32 end, 2-char country
const GEO_V6_REC = 34; // 16-byte start, 16-byte end, 2-char country

// Bot-shaped User-Agents. "monitor" catches DreamHost SiteMonitor (~45% of the log);
// the tool names catch scripted fetches that don't announce themselves as crawlers.
const BOT_UA_RE = '/bot\b|bot\/|crawl|spider|slurp|monitor|scanner|scrapy|curl\/|wget|python|java\/|go-http|okhttp|libwww|headless|phantom|puppeteer|playwright|lighthouse|semrush|ahrefs|mj12|dotbot|petal|bytedance|bytespider|externalhit|embedly|feedfetcher|uptime|pingdom|zgrab|censys|masscan|nuclei|expanse|internetmeasurement|dataprovider|webindex|site-?monitor/i';

// ── arguments ────────────────────────────────────────────────────────────────

$opt = [
	'update-geo' => false,
	'all' => false,
	'today' => false,
	'dry-run' => false,
	'json' => false,
	'day' => null,
	'from' => null,
	'log-glob' => null,
	'geo-dir' => __DIR__ . '/geo',
	'files' => [],
];
for ($i = 1; $i < $argc; $i++) {
	$a = $argv[$i];
	$next = $argv[$i + 1] ?? null;
	switch ($a) {
		case '--update-geo':
		case '--all':
		case '--today':
		case '--dry-run':
			$opt[substr($a, 2)] = true;
			break;
		case '--json':
			$opt['json'] = true;
			$opt['dry-run'] = true;
			break;
		case '--file':
			$opt['files'][] = (string) $next;
			$i++;
			break;
		case '--day':
		case '--from':
		case '--log-glob':
		case '--geo-dir':
			$opt[substr($a, 2)] = (string) $next;
			$i++;
			break;
		default:
			fwrite(STDERR, "unknown flag: $a\n");
			exit(1);
	}
}

// The log lives under the home directory both on the server and (for a local
// --file run) wherever the caller points us.
$home = getenv('HOME') ?: '';
$logGlob = $opt['log-glob'] ?? $home . '/logs/namastesano.com/https/access.log*';

if ($opt['update-geo']) {
	geo_update($opt['geo-dir'], $opt['from']);
	exit(0);
}

// ── config (skipped for --json, which is pure parsing) ────────────────────────

$config = null;
$salt = 'sano-traffic-test-salt'; // --json only; a real run always uses the config salt
if (!$opt['json']) {
	foreach ([__DIR__ . '/../sano-config.php', __DIR__ . '/../../sano-config.php'] as $path) {
		if (file_exists($path)) {
			$config = require $path;
			break;
		}
	}
	if (!$config) {
		fwrite(STDERR, "sano-config.php not found\n");
		exit(1);
	}
	if (empty($config['traffic_salt']) || strlen((string) $config['traffic_salt']) < 16) {
		fwrite(STDERR, "sano-config.php needs 'traffic_salt' => '<32+ random chars>'\n");
		exit(1);
	}
	$salt = (string) $config['traffic_salt'];
}

// ── parse ────────────────────────────────────────────────────────────────────

$files = $opt['files'];
if (!$files) {
	// Dedupe by realpath: access.log.0 is a symlink to that day's dated file, and
	// reading both would double every count.
	$seen = [];
	foreach (glob($logGlob) ?: [] as $f) {
		$real = realpath($f);
		if ($real === false || isset($seen[$real])) {
			continue;
		}
		$seen[$real] = true;
		$files[] = $real;
	}
	sort($files);
}
if (!$files) {
	fwrite(STDERR, "no log files matched: $logGlob\n");
	exit(1);
}

$geo = geo_open($opt['geo-dir']);
$days = []; // 'Y-m-d' => day bucket (see day_bucket())

foreach ($files as $file) {
	// gzopen reads plain files transparently, so rotated .gz and the live log take
	// the same path.
	$fh = @gzopen($file, 'rb');
	if (!$fh) {
		fwrite(STDERR, "skip unreadable $file\n");
		continue;
	}
	while (($line = gzgets($fh)) !== false) {
		$r = parse_line($line);
		if ($r === null) {
			continue;
		}
		$day = $r['day'];
		if (!isset($days[$day])) {
			$days[$day] = day_bucket();
		}
		$bucket = &$days[$day];

		// A bot-shaped User-Agent is decided by the UA alone, so settle it here instead
		// of allocating a bucket and unpicking it later: roughly half of all traffic is
		// crawlers and monitors, and this keeps every one of them out of memory. Totals
		// are unchanged — a bot's requests only ever counted toward botRequests anyway.
		if (is_bot_ua($r['ua'])) {
			$bucket['botRequests']++;
			unset($bucket);
			continue;
		}

		$vid = substr(hash('sha256', $salt . $r['ip'] . "\n" . $r['ua'], true), 0, 16);
		if (!isset($bucket['visitors'][$vid])) {
			if (count($bucket['visitors']) >= MAX_VISITORS_PER_DAY) {
				// Past this point the day is being flooded, not visited.
				$bucket['botRequests']++;
				$bucket['overflow']++;
				unset($bucket);
				continue;
			}
			$bucket['visitors'][$vid] = visitor_bucket($r['ip'], $r['ua']);
		}
		$v = &$bucket['visitors'][$vid];
		if (count($v['times']) < MAX_TIMES_PER_VISITOR) {
			$v['times'][] = $r['time']; // only needed to spot the gaps between sessions
		}
		$v['requests']++;
		$v['bytes'] += $r['bytes'];
		if (is_app_path($r['path']) && $r['status'] >= 200 && $r['status'] < 400) {
			$v['app'] = true;
		}
		if (is_crawler_path($r['path'])) {
			$v['crawler'] = true;
		}
		// Only a real admin session gets a 2xx out of an admin endpoint. /admin/ itself
		// is a public static shell that answers 200 to anyone, so counting a request for
		// it let *any* visitor mark themselves "mine" and drop out of the dashboard's
		// default view permanently — a one-request, no-account way to skew the numbers.
		if (str_starts_with($r['path'], '/api/admin-') && $r['status'] >= 200 && $r['status'] < 300) {
			$v['mine'] = true;
		}
		if ($r['status'] >= 400) {
			$key = $r['status'] . "\t" . log_text($r['path'], 180);
			// Bounded: the path is attacker-chosen, so /audio/<random>.mp3 on repeat would
			// otherwise mint a distinct key — and later a distinct DB row — every time.
			if (isset($v['errors'][$key]) || count($v['errors']) < MAX_KEYS_PER_VISITOR) {
				$v['errors'][$key] = ($v['errors'][$key] ?? 0) + 1;
			}
			$v[$r['status'] < 500 ? 'e4' : 'e5']++;
		}
		// Referrers only from the page request itself: every asset carries the site
		// as its referer, which would drown out the handful of real arrivals.
		if (is_page_path($r['path'])) {
			$host = referrer_host($r['ref']);
			if ($host !== null && (isset($v['refs'][$host]) || count($v['refs']) < MAX_KEYS_PER_VISITOR)) {
				$v['refs'][$host] = ($v['refs'][$host] ?? 0) + 1;
			}
		}
		unset($v, $bucket);
	}
	gzclose($fh);
}

// Roll each visitor-day up: classify human vs bot, count sessions, resolve country.
$today = date('Y-m-d');
$ipCountry = [];
foreach ($days as $day => &$bucket) {
	foreach ($bucket['visitors'] as $vid => &$v) {
		// A bot-shaped UA never got a bucket (filtered at parse time), so what's left is
		// a browser UA that either asked for something only a crawler asks for, or never
		// successfully fetched an app path at all.
		$bot = $v['crawler'] || !$v['app'];
		if ($bot) {
			$bucket['botRequests'] += $v['requests'];
			unset($bucket['visitors'][$vid]);
			continue;
		}
		sort($v['times']);
		$sessions = 1;
		for ($i = 1, $n = count($v['times']); $i < $n; $i++) {
			if ($v['times'][$i] - $v['times'][$i - 1] > SESSION_GAP) {
				$sessions++;
			}
		}
		$v['sessions'] = $sessions;
		$ip = $v['ip'];
		if (!array_key_exists($ip, $ipCountry)) {
			$ipCountry[$ip] = geo_country($geo, $ip);
		}
		$v['country'] = $ipCountry[$ip];
		[$v['device'], $v['browser']] = classify_ua($v['ua']);
		$bucket['requests'] += $v['requests'];
		$bucket['bytes'] += $v['bytes'];
		$bucket['errors4xx'] += $v['e4'];
		$bucket['errors5xx'] += $v['e5'];
		// Referrers/errors are stored split by mine so the dashboard's "exclude my
		// visits" toggle applies to them too.
		$mine = $v['mine'] ? 1 : 0;
		foreach ($v['refs'] as $host => $hits) {
			$bucket['referrers'][$mine . "\t" . $host] ??= 0;
			$bucket['referrers'][$mine . "\t" . $host] += $hits;
		}
		foreach ($v['errors'] as $key => $hits) {
			$bucket['errors'][$mine . "\t" . $key] ??= 0;
			$bucket['errors'][$mine . "\t" . $key] += $hits;
		}
	}
	unset($v);
	// Keep only the busiest rows. The dashboard reads the top 20 of each, and without a
	// ceiling a flood of distinct 404 paths becomes a distinct DB row apiece, for ever.
	foreach (['referrers', 'errors'] as $k) {
		if (count($bucket[$k]) > MAX_ROWS_PER_DAY) {
			arsort($bucket[$k]);
			$bucket[$k] = array_slice($bucket[$k], 0, MAX_ROWS_PER_DAY, true);
		}
	}
	if ($bucket['overflow'] > 0) {
		fwrite(STDERR, "$day: dropped {$bucket['overflow']} request(s) past " . MAX_VISITORS_PER_DAY . " distinct visitors\n");
	}
}
unset($bucket);
ksort($days);

if ($opt['json']) {
	echo json_encode(json_shape($days), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
	exit(0);
}

// ── which days to store ──────────────────────────────────────────────────────

$pdo = new PDO($config['dsn'], $config['user'], $config['pass'], [
	PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
	PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$stored = [];
foreach ($pdo->query('SELECT day FROM traffic_days')->fetchAll() as $row) {
	$stored[$row['day']] = true;
}

$targets = [];
foreach (array_keys($days) as $day) {
	if ($opt['day'] !== null) {
		if ($day === $opt['day']) {
			$targets[] = $day;
		}
		continue;
	}
	if ($day === $today && !$opt['today']) {
		continue; // still being written — it would be stored as a partial day
	}
	if (isset($stored[$day]) && !$opt['all']) {
		continue;
	}
	$targets[] = $day;
}

if (!$targets) {
	echo 'nothing new to ingest (', count($days), " day(s) on disk)\n";
	exit(0);
}

// ── write ────────────────────────────────────────────────────────────────────

foreach ($targets as $day) {
	$b = $days[$day];
	$countries = [];
	foreach ($b['visitors'] as $v) {
		if ($v['country']) {
			$countries[$v['country']] = true;
		}
	}
	$mine = 0;
	$sessions = 0;
	foreach ($b['visitors'] as $v) {
		$mine += $v['mine'] ? 1 : 0;
		$sessions += $v['sessions'];
	}
	printf(
		"%s  visitors %d (%d mine)  sessions %d  requests %d  bots %d  countries %s%s\n",
		$day,
		count($b['visitors']),
		$mine,
		$sessions,
		$b['requests'],
		$b['botRequests'],
		$countries ? implode(',', array_keys($countries)) : '-',
		$opt['dry-run'] ? '  [dry run]' : '',
	);
	if ($opt['dry-run']) {
		continue;
	}

	$pdo->beginTransaction();
	// Re-ingesting a day replaces it wholesale, so the script is idempotent.
	foreach (['traffic_visitor_days', 'traffic_referrers', 'traffic_errors'] as $t) {
		$pdo->prepare("DELETE FROM $t WHERE day = ?")->execute([$day]);
	}
	$pdo->prepare(
		'REPLACE INTO traffic_days (day, requests, bot_requests, bytes, errors_4xx, errors_5xx, ingested_at)
		 VALUES (?, ?, ?, ?, ?, ?, NOW())',
	)->execute([$day, $b['requests'], $b['botRequests'], $b['bytes'], $b['errors4xx'], $b['errors5xx']]);

	// is_new / is_mine are filled by the recompute pass below, which is the only
	// place that can see a visitor's whole history.
	$ins = $pdo->prepare(
		'INSERT INTO traffic_visitor_days (day, visitor, sessions, requests, is_new, is_mine, country, device, browser)
		 VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)',
	);
	foreach ($b['visitors'] as $vid => $v) {
		$ins->execute([$day, $vid, $v['sessions'], $v['requests'], $v['mine'] ? 1 : 0, $v['country'], $v['device'], $v['browser']]);
	}
	$insRef = $pdo->prepare('INSERT INTO traffic_referrers (day, mine, host, hits) VALUES (?, ?, ?, ?)');
	foreach ($b['referrers'] as $key => $hits) {
		[$m, $host] = explode("\t", $key, 2);
		$insRef->execute([$day, (int) $m, $host, $hits]);
	}
	$insErr = $pdo->prepare('INSERT INTO traffic_errors (day, mine, status, path, hits) VALUES (?, ?, ?, ?, ?)');
	foreach ($b['errors'] as $key => $hits) {
		[$m, $status, $path] = explode("\t", $key, 3);
		$insErr->execute([$day, (int) $m, (int) $status, $path, $hits]);
	}
	$pdo->commit();
}

if (!$opt['dry-run']) {
	recompute_visitor_flags($pdo);
	echo 'ingested ', count($targets), " day(s)\n";
}

// ── helpers ──────────────────────────────────────────────────────────────────

function day_bucket(): array
{
	return [
		'visitors' => [],
		'requests' => 0,
		'botRequests' => 0,
		'overflow' => 0, // requests dropped past MAX_VISITORS_PER_DAY
		'bytes' => 0,
		'errors4xx' => 0,
		'errors5xx' => 0,
		'referrers' => [],
		'errors' => [],
	];
}

// Decided by the User-Agent alone, so it can run before a bucket is allocated.
function is_bot_ua(string $ua): bool
{
	return $ua === '' || $ua === '-' || preg_match(BOT_UA_RE, $ua) === 1;
}

// Log fields are attacker-chosen: the request path and the Referer are whatever was
// sent. Apache escapes control bytes as \xNN before writing, but printable mischief —
// markup, quotes — arrives intact and ends up rendered in the admin dashboard. The
// dashboard builds every cell with textContent, so this is defence in depth rather than
// the only guard; it also keeps the byte-wise truncation below from splitting anything.
function log_text(string $s, int $max): string
{
	$s = preg_replace('/[^\x20-\x7E]/', '', $s) ?? '';
	return substr(str_replace(['<', '>', '"', "'", '\\'], '', $s), 0, $max);
}

function visitor_bucket(string $ip, string $ua): array
{
	return [
		'ip' => $ip,
		'ua' => $ua,
		'app' => false, // fetched a real app path successfully -> a browser, not a scanner
		'crawler' => false, // asked for something only a crawler or scanner asks for
		'mine' => false,
		'times' => [],
		'requests' => 0,
		'bytes' => 0,
		'e4' => 0,
		'e5' => 0,
		'refs' => [],
		'errors' => [],
		'sessions' => 0,
		'country' => null,
		'device' => null,
		'browser' => null,
	];
}

// One combined-format line -> the fields we aggregate, or null if it doesn't parse.
function parse_line(string $line): ?array
{
	if (!preg_match('/^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/', $line, $m)) {
		return null;
	}
	// The timestamp already carries the server's offset, so its date IS the local
	// day — no timezone conversion, and none of MySQL's zone tables involved.
	$dt = DateTime::createFromFormat('d/M/Y:H:i:s O', $m[2]);
	if (!$dt) {
		return null;
	}
	$parts = explode(' ', $m[3]);
	$target = $parts[1] ?? '/';
	$path = strtok($target, '?');
	return [
		'ip' => $m[1],
		'time' => $dt->getTimestamp(),
		'day' => $dt->format('Y-m-d'),
		'path' => $path === false ? '/' : $path,
		'status' => (int) $m[4],
		'bytes' => ctype_digit($m[5]) ? (int) $m[5] : 0,
		'ref' => $m[6],
		'ua' => $m[7],
	];
}

// An allowlist, not a blocklist: everything the real app fetches. A scanner probing
// /wp-admin/install.php never hits one of these, so it never counts as a visitor.
function is_app_path(string $path): bool
{
	if ($path === '/' || $path === '/index.html' || $path === '/manifest.json' || $path === '/sw.js') {
		return true;
	}
	foreach (['/css/', '/js/', '/audio/', '/fonts/', '/api/', '/admin', '/favicon', '/icon-', '/apple-touch-icon'] as $prefix) {
		if (str_starts_with($path, $prefix)) {
			return true;
		}
	}
	return false;
}

// Paths the app never asks for, but crawlers and scanners always do. This is the
// signal that catches the well-behaved AI crawlers: they fetch / and the JS like a
// browser (so is_app_path alone clears them), then give themselves away by also
// asking for robots.txt or llms.txt. One such request disqualifies the whole
// visitor-day.
function is_crawler_path(string $path): bool
{
	static $exact = [
		'/robots.txt',
		'/sitemap.xml',
		'/sitemap_index.xml',
		'/llms.txt',
		'/llms-full.txt',
		'/ads.txt',
		'/app-ads.txt',
		'/humans.txt',
		'/security.txt',
	];
	if (in_array($path, $exact, true)) {
		return true;
	}
	foreach (['/.well-known/', '/wp-', '/.env', '/.git', '/phpmyadmin', '/vendor/', '/cgi-bin/', '/xmlrpc.php'] as $prefix) {
		if (str_starts_with($path, $prefix)) {
			return true;
		}
	}
	return false;
}

function is_page_path(string $path): bool
{
	return $path === '/' || $path === '/index.html';
}

// Referer -> the host that sent them, or null for same-site/absent (in-app navigation
// and direct opens both look the same in a log, so neither is an acquisition source).
function referrer_host(string $ref): ?string
{
	if ($ref === '' || $ref === '-') {
		return null;
	}
	$host = parse_url($ref, PHP_URL_HOST);
	if (!is_string($host) || $host === '') {
		return null;
	}
	$host = strtolower($host);
	// parse_url is lenient — `http://<script>alert(1)</script>/x` yields the host
	// `<script>alert(1)<`. A hostname is a narrow thing, so require it to look like one
	// and drop anything else rather than storing it for the dashboard to render.
	if (preg_match('/^[a-z0-9.-]+$/', $host) !== 1) {
		return null;
	}
	if ($host === 'namastesano.com' || str_ends_with($host, '.namastesano.com')) {
		return null;
	}
	// google.com and www.google.com are one source, not two.
	if (str_starts_with($host, 'www.')) {
		$host = substr($host, 4);
	}
	return substr($host, 0, 180);
}

// User-Agent -> [device, browser]. Order matters: Chrome and Edge both claim Safari,
// and iOS Chrome/Firefox claim to be Safari too (CriOS / FxiOS).
function classify_ua(string $ua): array
{
	$device = 'Other';
	foreach (
		[
			'iPhone' => 'iPhone',
			'iPad' => 'iPad',
			'Android' => 'Android',
			'Macintosh' => 'Mac',
			'Windows' => 'Windows',
			'X11' => 'Linux',
			'Linux' => 'Linux',
		]
		as $needle => $name
	) {
		if (str_contains($ua, $needle)) {
			$device = $name;
			break;
		}
	}
	$browser = 'Other';
	foreach (
		[
			'Edg' => 'Edge',
			'OPR' => 'Opera',
			'CriOS' => 'Chrome',
			'Chrome' => 'Chrome',
			'FxiOS' => 'Firefox',
			'Firefox' => 'Firefox',
			'Safari' => 'Safari',
		]
		as $needle => $name
	) {
		if (str_contains($ua, $needle)) {
			$browser = $name;
			break;
		}
	}
	return [$device, $browser];
}

// is_new (was this the visitor's first day ever?) and is_mine (did any of their
// sessions ever touch /admin/?) depend on a visitor's whole history, so they're
// recomputed from the stored table after every ingest rather than guessed per day.
// That also makes backfilling an OLDER day self-correcting. The temp table keeps
// MySQL from reading and writing traffic_visitor_days in one statement.
function recompute_visitor_flags(PDO $pdo): void
{
	$pdo->exec('CREATE TEMPORARY TABLE traffic_first (visitor BINARY(16) PRIMARY KEY, first_day DATE NOT NULL, mine TINYINT UNSIGNED NOT NULL)');
	$pdo->exec('INSERT INTO traffic_first SELECT visitor, MIN(day), MAX(is_mine) FROM traffic_visitor_days GROUP BY visitor');
	$pdo->exec('UPDATE traffic_visitor_days vd JOIN traffic_first f ON f.visitor = vd.visitor
	               SET vd.is_new = (vd.day = f.first_day), vd.is_mine = f.mine');
	$pdo->exec('DROP TEMPORARY TABLE traffic_first');
}

// The --json shape: stable, DB-free, and what tests/data/traffic-parse.test.mjs asserts on.
function json_shape(array $days): array
{
	$out = [];
	foreach ($days as $day => $b) {
		$visitors = [];
		foreach ($b['visitors'] as $vid => $v) {
			$visitors[] = [
				'visitor' => bin2hex($vid),
				'sessions' => $v['sessions'],
				'requests' => $v['requests'],
				'mine' => (bool) $v['mine'],
				'country' => $v['country'],
				'device' => $v['device'],
				'browser' => $v['browser'],
			];
		}
		$referrers = [];
		foreach ($b['referrers'] as $key => $hits) {
			[$m, $host] = explode("\t", $key, 2);
			$referrers[] = ['mine' => $m === '1', 'host' => $host, 'hits' => $hits];
		}
		$errors = [];
		foreach ($b['errors'] as $key => $hits) {
			[$m, $status, $path] = explode("\t", $key, 3);
			$errors[] = ['mine' => $m === '1', 'status' => (int) $status, 'path' => $path, 'hits' => $hits];
		}
		$out[$day] = [
			'requests' => $b['requests'],
			'botRequests' => $b['botRequests'],
			'bytes' => $b['bytes'],
			'errors4xx' => $b['errors4xx'],
			'errors5xx' => $b['errors5xx'],
			'visitors' => $visitors,
			'referrers' => $referrers,
			'errors' => $errors,
		];
	}
	return ['days' => $out];
}

// ── geo index ────────────────────────────────────────────────────────────────

// Compile the CC0 CSVs into fixed-width sorted records: 250k IPv4 ranges as PHP
// arrays would blow the 128M CLI limit, but as a 2.5MB file they're an fseek
// binary search with no memory cost at all.
function geo_update(string $dir, ?string $localCsv): void
{
	if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
		fwrite(STDERR, "cannot create $dir\n");
		exit(1);
	}
	$jobs = $localCsv !== null ? [[$localCsv, null]] : [[GEO_V4_URL, 'v4'], [GEO_V6_URL, 'v6']];
	foreach ($jobs as [$src, $kind]) {
		$in = @fopen($src, 'rb');
		if (!$in) {
			fwrite(STDERR, "cannot read $src\n");
			exit(1);
		}
		// A local CSV's flavour is whatever its first row looks like: digits = the
		// IPv4 integer file, anything else = IPv6 addresses.
		$first = fgets($in);
		if ($first === false) {
			fwrite(STDERR, "empty source $src\n");
			exit(1);
		}
		if ($kind === null) {
			$kind = ctype_digit(explode(',', trim($first))[0] ?? '') ? 'v4' : 'v6';
		}
		$tmp = $dir . "/geo-ip$kind.bin.tmp";
		$out = fopen($tmp, 'wb');
		$count = 0;
		$line = $first;
		do {
			$cols = explode(',', trim($line));
			if (count($cols) < 3) {
				continue;
			}
			[$start, $end, $cc] = $cols;
			$cc = strtoupper(substr($cc, 0, 2));
			if (strlen($cc) !== 2) {
				continue;
			}
			if ($kind === 'v4') {
				if (!ctype_digit($start) || !ctype_digit($end)) {
					continue;
				}
				fwrite($out, pack('NN', (int) $start, (int) $end) . $cc);
			} else {
				$s = @inet_pton($start);
				$e = @inet_pton($end);
				if ($s === false || $e === false || strlen($s) !== 16 || strlen($e) !== 16) {
					continue;
				}
				fwrite($out, $s . $e . $cc);
			}
			$count++;
		} while (($line = fgets($in)) !== false);
		fclose($in);
		fclose($out);
		rename($tmp, $dir . "/geo-ip$kind.bin");
		echo "geo $kind: $count ranges -> $dir/geo-ip$kind.bin\n";
	}
}

function geo_open(string $dir): array
{
	$geo = [];
	foreach (['v4' => GEO_V4_REC, 'v6' => GEO_V6_REC] as $kind => $rec) {
		$path = "$dir/geo-ip$kind.bin";
		$size = is_file($path) ? filesize($path) : 0;
		if (!$size || $size % $rec !== 0) {
			continue;
		}
		$geo[$kind] = ['fh' => fopen($path, 'rb'), 'n' => intdiv($size, $rec), 'rec' => $rec];
	}
	return $geo;
}

// Binary search the compiled ranges. IPv4 compares as an unsigned 32-bit int; IPv6
// compares as the 16 raw bytes, which sort correctly because they're big-endian.
function geo_country(array $geo, string $ip): ?string
{
	$packed = @inet_pton($ip);
	if ($packed === false) {
		return null;
	}
	$kind = strlen($packed) === 4 ? 'v4' : 'v6';
	if (!isset($geo[$kind])) {
		return null;
	}
	$needle = $kind === 'v4' ? unpack('N', $packed)[1] : $packed;
	['fh' => $fh, 'n' => $n, 'rec' => $rec] = $geo[$kind];
	$lo = 0;
	$hi = $n - 1;
	while ($lo <= $hi) {
		$mid = intdiv($lo + $hi, 2);
		fseek($fh, $mid * $rec);
		$buf = fread($fh, $rec);
		if ($buf === false || strlen($buf) !== $rec) {
			return null;
		}
		if ($kind === 'v4') {
			$r = unpack('Nstart/Nend', $buf);
			$start = $r['start'];
			$end = $r['end'];
			$cmpLow = $needle < $start ? -1 : ($needle > $end ? 1 : 0);
		} else {
			$start = substr($buf, 0, 16);
			$end = substr($buf, 16, 16);
			$cmpLow = strcmp($needle, $start) < 0 ? -1 : (strcmp($needle, $end) > 0 ? 1 : 0);
		}
		if ($cmpLow < 0) {
			$hi = $mid - 1;
		} elseif ($cmpLow > 0) {
			$lo = $mid + 1;
		} else {
			return substr($buf, $rec - 2, 2);
		}
	}
	return null;
}
