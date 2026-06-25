import { defineConfig } from '@playwright/test';

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
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { baseURL: BASE },
	// PHP's built-in server runs the app + api/. The guard specs run WITHOUT a
	// sano-config.php on disk, so any endpoint path that reaches the DB 500s — they
	// assert only the pre-DB guards. DB-backed integration specs are skipped unless
	// SANO_TEST_DB is set (see tests/api/).
	webServer: {
		command: `php -S 127.0.0.1:${PORT}`,
		url: BASE,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
