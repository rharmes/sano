import { defineConfig, devices } from '@playwright/test';

// Playwright config for the sano test suite. Owns the HTTP (api/) and browser (e2e)
// tiers; the node:test logic/data tiers live separately (tools/test.sh ties them
// together). Convention: node:test files are `*.test.mjs`, Playwright specs `*.spec.mjs`.
const PORT = Number(process.env.SANO_PORT || 8123);
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
	testDir: './tests',
	testMatch: '**/*.spec.mjs', // exclude the node:test *.test.mjs files
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// e2e flows are inherently timing-sensitive in WebKit; a retry absorbs transient flakes
	// (the app isn't buggy — different long flows would flake on different runs otherwise).
	retries: process.env.CI ? 2 : 1,
	// php -S serves the app even with PHP_CLI_SERVER_WORKERS; cap browser workers so a burst
	// of parallel page loads doesn't starve it (slow loads read as actionability flakes).
	workers: process.env.CI ? 2 : 4,
	timeout: 60_000, // multi-step lesson/dialogue playthroughs in WebKit need headroom
	expect: { timeout: 10_000 },
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { baseURL: BASE, actionTimeout: 15_000, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
	// PHP's built-in server runs the app + api/. The guard specs run WITHOUT a
	// sano-config.php on disk, so any endpoint path that reaches the DB 500s — they
	// assert only the pre-DB guards. DB-backed integration specs are skipped unless
	// SANO_TEST_DB is set (see tests/api/).
	webServer: {
		// PHP_CLI_SERVER_WORKERS lets the built-in server handle concurrent requests; without
		// it the single-threaded server starves under parallel browser workers and pages never
		// finish loading (slow WebKit then times out on actionability).
		command: `PHP_CLI_SERVER_WORKERS=16 php -S 127.0.0.1:${PORT}`,
		url: BASE,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
	projects: [
		// api/ specs use the request fixture only — no browser needed.
		{ name: 'api', testDir: './tests/api' },
		// e2e specs run in both engines at a phone viewport; iPhone 13 = WebKit, the
		// closest available engine to the iOS Safari target the app is built for.
		{ name: 'chromium', testDir: './tests/e2e', use: { ...devices['Pixel 7'] } },
		{ name: 'webkit', testDir: './tests/e2e', use: { ...devices['iPhone 13'] } },
	],
});
