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

test('forgot password opens the future-update modal', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('visitor@example.com');
  await page.getByRole('button', { name: /forgot password/i }).click();

  await expect(page.getByRole('dialog', { name: /password reset coming soon/i })).toBeVisible();
  await expect(page.getByText(/password recovery for visitor@example.com/i)).toBeVisible();
});

test('create-user card is available without leaving the auth screen', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /^create user$/i }).first().click();

  await expect(page.getByRole('heading', { name: /create user/i })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
});

