import { test, expect } from '@playwright/test';

test.describe('Conflicts', () => {
  test('navigate to conflicts page', async ({ page }) => {
    await page.goto('/conflicts');
    await expect(page.locator('h1')).toContainText('Conflicts');
  });

  test('empty state shows "No conflicts" when no conflicts exist', async ({ page }) => {
    await page.goto('/conflicts');
    const emptyState = page.locator('.empty-state');
    const conflictCards = page.locator('.conflict-card');
    const count = await conflictCards.count();
    if (count === 0) {
      await expect(emptyState).toBeVisible();
      await expect(emptyState.locator('h3')).toContainText('No conflicts');
      await expect(emptyState.locator('p')).toContainText('in sync');
    }
  });

  test('conflicts page has Refresh button', async ({ page }) => {
    await page.goto('/conflicts');
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
  });

  test('clicking Refresh reloads conflict list', async ({ page }) => {
    await page.goto('/conflicts');
    await expect(page.locator('h1')).toContainText('Conflicts');
    await page.click('button:has-text("Refresh")');
    await expect(page.locator('h1')).toContainText('Conflicts');
  });

  test('navigate to conflicts via nav link', async ({ page }) => {
    await page.goto('/');
    await page.click('a.nav-link:has-text("Conflicts")');
    await page.waitForURL('/conflicts');
    await expect(page.locator('h1')).toContainText('Conflicts');
  });

  test('conflict card shows local and server versions when conflicts exist', async ({ page }) => {
    await page.goto('/conflicts');
    const conflictCards = page.locator('.conflict-card');
    const count = await conflictCards.count();
    if (count > 0) {
      const firstConflict = conflictCards.first();
      await expect(firstConflict.locator('.conflict-version')).toHaveCount(2);
      await expect(firstConflict.locator('.conflict-version-label').first()).toContainText('Local');
      await expect(firstConflict.locator('.conflict-version-label').last()).toContainText('Server');
    }
  });

  test('conflict resolution buttons appear for each conflict', async ({ page }) => {
    await page.goto('/conflicts');
    const conflictCards = page.locator('.conflict-card');
    const count = await conflictCards.count();
    if (count > 0) {
      const firstConflict = conflictCards.first();
      await expect(firstConflict.locator('button:has-text("Keep Local")')).toBeVisible();
      await expect(firstConflict.locator('button:has-text("Keep Server")')).toBeVisible();
      await expect(firstConflict.locator('button:has-text("Merge")')).toBeVisible();
    }
  });

  test('conflicts page header has correct structure', async ({ page }) => {
    await page.goto('/conflicts');
    await expect(page.locator('.page-header')).toBeVisible();
    await expect(page.locator('.page-header h1')).toContainText('Conflicts');
  });
});
