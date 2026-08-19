import { test, expect } from '@playwright/test';

test.describe('Devices', () => {
  test('navigate to devices page', async ({ page }) => {
    await page.goto('/devices');
    await expect(page.locator('h1')).toContainText('Devices');
  });

  test('devices page shows Add Device button', async ({ page }) => {
    await page.goto('/devices');
    await expect(page.locator('button:has-text("Add Device")')).toBeVisible();
  });

  test('devices page shows device list or empty state', async ({ page }) => {
    await page.goto('/devices');
    const deviceList = page.locator('.device-list');
    const emptyState = page.locator('.empty-state');
    const hasDevices = (await deviceList.count()) > 0;
    if (hasDevices) {
      await expect(deviceList).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

  test('device list displays device info when devices exist', async ({ page }) => {
    await page.goto('/devices');
    const deviceItems = page.locator('.device-item');
    const count = await deviceItems.count();
    if (count > 0) {
      const firstDevice = deviceItems.first();
      await expect(firstDevice.locator('.device-info')).toBeVisible();
      await expect(firstDevice.locator('.device-details')).toBeVisible();
    }
  });

  test('clicking Add Device shows pairing QR modal', async ({ page }) => {
    await page.goto('/devices');
    await page.click('button:has-text("Add Device")');
    await expect(page.locator('button:has-text("Generating...")')).toBeVisible({ timeout: 5000 });
  });

  test('navigate to devices via nav link', async ({ page }) => {
    await page.goto('/');
    await page.click('a.nav-link:has-text("Devices")');
    await page.waitForURL('/devices');
    await expect(page.locator('h1')).toContainText('Devices');
  });

  test('devices page header has correct structure', async ({ page }) => {
    await page.goto('/devices');
    await expect(page.locator('.page-header')).toBeVisible();
    await expect(page.locator('.page-header h1')).toContainText('Devices');
  });

  test('current device shows This device badge', async ({ page }) => {
    await page.goto('/devices');
    const ownerBadge = page.locator('.badge--owner');
    const count = await ownerBadge.count();
    if (count > 0) {
      await expect(ownerBadge.first()).toContainText('This device');
    }
  });
});
