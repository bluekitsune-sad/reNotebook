import { test, expect } from '@playwright/test';

test.describe('Notes', () => {
  test('note list displays correctly on home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('My Notes');
    await expect(page.locator('.search-bar')).toBeVisible();
    await expect(page.locator('.nav-brand')).toContainText('Synced Notepad');
  });

  test('create a new note via New Note button', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/notes/new"]');
    await page.waitForURL(/\/notes\//);
    await expect(page.locator('.title-input')).toBeVisible();
    await expect(page.locator('.content-input')).toBeVisible();
  });

  test('edit note title and content', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/notes/new"]');
    await page.waitForURL(/\/notes\//);

    await page.fill('.title-input', 'E2E Test Note');
    await page.fill('.content-input', 'This is test content for the note.');

    await expect(page.locator('.title-input')).toHaveValue('E2E Test Note');
    await expect(page.locator('.content-input')).toHaveValue('This is test content for the note.');

    await page.click('button:has-text("Save")');
    await expect(page.locator('.save-indicator')).toContainText('Saved');
  });

  test('delete a note', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/notes/new"]');
    await page.waitForURL(/\/notes\//);

    await page.fill('.title-input', 'Note to Delete');
    await page.fill('.content-input', 'This note will be deleted.');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.save-indicator')).toContainText('Saved');

    page.on('dialog', (dialog) => dialog.accept());
    await page.click('button:has-text("Delete")');

    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('My Notes');
  });

  test('search notes via search bar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.search-bar input')).toBeVisible();
    await page.fill('.search-bar input', 'test query');
    await expect(page.locator('.search-bar input')).toHaveValue('test query');
  });

  test('note list shows empty state when no notes exist', async ({ page }) => {
    await page.goto('/');
    const emptyState = page.locator('.empty-state');
    const noteList = page.locator('.note-list');
    const hasNotes = (await noteList.count()) > 0;
    if (!hasNotes) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('navigate back to notes list from note editor', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/notes/new"]');
    await page.waitForURL(/\/notes\//);
    await page.click('a.nav-link:has-text("Notes")');
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('My Notes');
  });

  test('note editor shows save button and toolbar', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/notes/new"]');
    await page.waitForURL(/\/notes\//);
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
    await expect(page.locator('.editor-toolbar')).toBeVisible();
  });
});
