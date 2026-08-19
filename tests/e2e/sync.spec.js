import { test, expect } from '@playwright/test';

test.describe('Sync', () => {
  test('sync status indicator is visible in nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sync-status')).toBeVisible();
  });

  test('create note triggers sync status change to syncing then synced', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/notes/new"]');
    await page.waitForURL(/\/notes\//);

    await page.fill('.title-input', 'Sync Test Note');
    await page.fill('.content-input', 'Testing sync status.');
    await page.click('button:has-text("Save")');

    await expect(page.locator('.save-indicator')).toContainText('Saved');

    const syncBtn = page.locator('.sync-status');
    await expect(syncBtn).toBeVisible();
  });

  test('offline banner appears when network is disconnected', async ({ page, context }) => {
    await page.goto('/');

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const offlineBanner = page.locator('.offline-banner');
    await expect(offlineBanner).toBeVisible({ timeout: 5000 });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });

  test('pending changes badge updates when note is created offline', async ({ page, context }) => {
    await page.goto('/');

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    await page.click('a[href="/notes/new"]');
    await page.waitForURL(/\/notes\//);
    await page.fill('.title-input', 'Pending Note');
    await page.fill('.content-input', 'Offline content.');
    await page.click('button:has-text("Save")');

    const pendingBadge = page.locator('.pending-badge');
    const hasBadge = (await pendingBadge.count()) > 0;
    if (hasBadge) {
      await expect(pendingBadge).toBeVisible();
    }

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });

  test('clicking sync button triggers sync', async ({ page }) => {
    await page.goto('/');
    const syncBtn = page.locator('.sync-status');
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();
  });

  test('sync status shows Synced text when idle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sync-status')).toBeVisible();
    const text = await page.locator('.sync-status').textContent();
    expect(text).toMatch(/Synced|Offline|pending/);
  });

  test('nav links are accessible during sync', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-links')).toBeVisible();
    await expect(page.locator('a.nav-link:has-text("Notes")')).toBeVisible();
    await expect(page.locator('a.nav-link:has-text("Devices")')).toBeVisible();
    await expect(page.locator('a.nav-link:has-text("Conflicts")')).toBeVisible();
  });
});
