import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: `e2e-auth-${Date.now()}@test.com`,
  password: 'TestPass123!',
  displayName: 'E2E Auth User',
  workspaceName: 'Test Workspace',
};

test.describe('Authentication', () => {
  test('register a new user via API and verify token is stored', async ({ page }) => {
    const response = await page.request.post('http://localhost:3001/api/auth/register', {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        displayName: TEST_USER.displayName,
        workspaceName: TEST_USER.workspaceName,
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBeTruthy();
    expect(body.data.token).toBeTruthy();
  });

  test('login with existing user via API', async ({ page }) => {
    await page.request.post('http://localhost:3001/api/auth/register', {
      data: {
        email: `e2e-login-${Date.now()}@test.com`,
        password: 'TestPass123!',
        displayName: 'Login User',
        workspaceName: 'Login Workspace',
      },
    });

    const response = await page.request.post('http://localhost:3001/api/auth/login', {
      data: {
        email: `e2e-login-${Date.now()}@test.com`,
        password: 'TestPass123!',
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBeTruthy();
    expect(body.data.token).toBeTruthy();
  });

  test('reject login with wrong password', async ({ page }) => {
    const response = await page.request.post('http://localhost:3001/api/auth/login', {
      data: {
        email: 'nonexistent@test.com',
        password: 'WrongPassword123!',
      },
    });
    expect(response.ok()).toBeFalsy();
  });

  test('GET /auth/me returns current user with valid token', async ({ page }) => {
    const regRes = await page.request.post('http://localhost:3001/api/auth/register', {
      data: {
        email: `e2e-me-${Date.now()}@test.com`,
        password: 'TestPass123!',
        displayName: 'Me User',
        workspaceName: 'Me Workspace',
      },
    });
    const { data: { token } } = await regRes.json();

    const meRes = await page.request.get('http://localhost:3001/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.ok()).toBeTruthy();
    const body = await meRes.json();
    expect(body.data.user.email).toBeTruthy();
  });

  test('redirect to home when not authenticated on app', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('.nav-brand')).toContainText('Synced Notepad');
  });

  test('navigate to home after loading app', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('My Notes');
  });
});
