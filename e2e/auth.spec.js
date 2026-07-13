/**
 * File purpose: Runs browser-level smoke tests for the most important public auth flows.
 */
import { expect, test } from '@playwright/test';

test('guest can enter the dashboard from the login page', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /continue as guest/i }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/a virtual trading platform/i)).toBeVisible();
});

test('forgot password opens the secure reset request', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('visitor@example.com');
  await page.getByRole('button', { name: /forgot password/i }).click();

  await expect(page.getByRole('dialog', { name: /reset your password/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
});

test('login creates a protected browser session cookie', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('cookie-session@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Secure!23');
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/auth/login')),
    page.locator('.login-face button[type="submit"]').click(),
  ]);

  expect(loginResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === 'stockpulse_session');
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
});

test('create-user card is available without leaving the auth screen', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /^create user$/i }).first().click();

  await expect(page.getByRole('heading', { name: /create user/i })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
});

