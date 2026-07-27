// Admin dashboard: the standalone /admin/ page renders its user list from stub data under
// ?demo=1 (no DB, no auth needed), so the table layout and row actions can be reviewed.
import { test, expect } from '@playwright/test';

test('the admin dashboard renders demo rows', async ({ page }) => {
	await page.goto('/admin/?demo=1');
	const content = page.locator('#admin-content');
	await expect(content).toBeVisible();
	await expect(content).not.toBeEmpty();
	// Each row offers per-account actions (reset password / delete).
	await expect(content.locator('button').first()).toBeVisible();
});

// T58: the admin page is the one place account-controlled strings reach the screen.
// Signup constrains usernames to [a-z0-9_], but accounts minted by the CLI before T46
// were not constrained at all, so the rendering must not lean on that. Stubbing the API
// rather than the ?demo=1 data exercises the real path — and keeps the demo table, which
// Ross reviews by eye, free of test junk.
test('a username that looks like markup is rendered as text, never parsed', async ({ page }) => {
	const hostile = '<img src=x onerror="window.__xss=1">';
	await page.route('**/api/admin-users.php', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ me: 'ross', users: [{ username: hostile, lastSyncedAt: null, streak: 0, graduated: [] }] }),
		}),
	);
	await page.goto('/admin/');

	// The table cell shows the name literally, and no element was created from it.
	const cell = page.locator('#admin-content .admin-username');
	await expect(cell).toHaveText(hostile);
	await expect(page.locator('#admin-content img')).toHaveCount(0);

	// The delete modal interpolates the same name — the sink that used to be innerHTML.
	await page.locator('#admin-content button.delete').click();
	const body = page.locator('#admin-delete-body');
	await expect(body).toContainText(hostile);
	await expect(body.locator('img')).toHaveCount(0);
	await expect(body.locator('b')).toHaveText(hostile); // still bold, still text

	expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

// The two notices that carry a link were markup strings until T58; they are built from
// nodes now, so this checks the rewrite actually still produces a working way back.
test('the signed-out and non-admin notices still offer a link home', async ({ page }) => {
	for (const [status, wording] of [
		[401, /sign in as an admin/i],
		[403, /isn’t an admin/i],
	]) {
		await page.route('**/api/admin-users.php', (route) => route.fulfill({ status, contentType: 'application/json', body: '{"error":"x"}' }));
		await page.goto('/admin/');
		const notice = page.locator('#admin-content .admin-notice');
		await expect(notice).toHaveText(wording);
		await expect(notice.locator('a')).toHaveAttribute('href', '/');
		await page.unroute('**/api/admin-users.php');
	}
});
